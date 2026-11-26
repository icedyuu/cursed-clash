/**
 * The gameplay scene. Owns all systems and implements the World context they share.
 * Solo and Versus run through the same code; Versus adds LocalMultiplayerSystem.
 */
import Phaser from 'phaser';
import { ARENA, DEPTH, GAME_HEIGHT, GAME_WIDTH, IS_DEBUG } from '../game/GameConfig';
import { GameManager, type GameMode, type PlayerSummary, type RunResult } from '../game/GameManager';
import { createController, tickInput, keys } from '../game/InputManager';
import { audio } from '../game/AudioManager';
import { createRng, type Rng } from '../core/rng';
import { SpatialGrid } from '../core/SpatialGrid';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { DIFFICULTY, difficultyAt } from '../data/waves';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import type { Projectile } from '../entities/Projectile';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { TelegraphSystem } from '../systems/TelegraphSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ZoneSystem } from '../systems/ZoneSystem';
import { XPSystem } from '../systems/XPSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { AbilitySystem } from '../systems/AbilitySystem';
import { LocalMultiplayerSystem } from '../systems/LocalMultiplayerSystem';
import { AI } from '../systems/ai/behaviors';
import type { World } from '../systems/World';
import { arenaLayout } from '../art/environmentArt';
import { dist2 } from '../core/math';
import { SceneManager } from '../game/SceneManager';

export class ArenaScene extends Phaser.Scene {
  mode: GameMode = 'solo';
  runTime = 0;
  world!: World;
  rng!: Rng;
  players: Player[] = [];
  enemies: Enemy[] = [];
  enemyGrid = new SpatialGrid<Enemy>(48);
  obstacles!: Phaser.Physics.Arcade.StaticGroup;
  combat!: CombatSystem;
  effects!: EffectsSystem;
  telegraphs!: TelegraphSystem;
  projectiles!: ProjectileSystem;
  zones!: ZoneSystem;
  xp!: XPSystem;
  waves!: WaveSystem;
  abilities!: AbilitySystem;
  versus: LocalMultiplayerSystem | null = null;
  bossesDefeated = 0;
  ended = false;
  god = false;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private obstacleRects: Phaser.Geom.Rectangle[] = [];
  private hitStopUntil = 0;
  private camTarget!: Phaser.GameObjects.Zone;
  private near: Enemy[] = [];
  private fog: Phaser.GameObjects.Image[] = [];
  private propLights: { img: Phaser.GameObjects.Image; base: number; phase: number }[] = [];
  private upgradeOpen = false;

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    const run = GameManager.run;
    this.mode = run.mode;
    this.rng = createRng(run.seed);
    this.runTime = 0;
    this.players = [];
    this.enemies = [];
    this.bossesDefeated = 0;
    this.ended = false;
    this.upgradeOpen = false;
    this.hitStopUntil = 0;
    this.obstacleRects = [];
    this.fog = [];
    this.propLights = [];
    const b = ARENA.bounds;
    this.physics.world.setBounds(b.x, b.y, b.w, b.h);
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#07040d');

    this.add.image(0, 0, 'arena-floor').setOrigin(0).setDepth(DEPTH.floor);
    this.buildProps();
    this.buildAtmosphere();

    // systems
    this.world = this.buildWorld();
    const w = () => this.world;
    this.effects = new EffectsSystem(this);
    this.telegraphs = new TelegraphSystem(this);
    this.combat = new CombatSystem(w);
    this.projectiles = new ProjectileSystem(this, w);
    this.zones = new ZoneSystem(this, w);
    this.xp = new XPSystem(this, w);
    this.waves = new WaveSystem(w);
    this.abilities = new AbilitySystem(w);
    this.versus = this.mode === 'versus' ? new LocalMultiplayerSystem(w) : null;

    this.enemyGroup = this.physics.add.group({ classType: Enemy, maxSize: DIFFICULTY.enemyCap.versus + 40, runChildUpdate: false });
    this.physics.add.collider(this.enemyGroup, this.obstacles);
    this.physics.add.overlap(this.projectiles.group, this.obstacles, (p) => this.projectiles.onObstacle(p as Projectile));

    // players
    const autoAttack = GameManager.save.settings.autoAttack;
    const versus = this.mode === 'versus';
    run.characters.forEach((id, i) => {
      const idx = i as 0 | 1;
      const x = b.x + b.w / 2 + (versus ? (idx === 0 ? -60 : 60) : 0);
      const y = b.y + b.h / 2 + 40;
      const p = new Player(this, x, y, idx, CHARACTERS[id], createController(idx, versus, autoAttack && idx === 0), versus);
      this.physics.add.collider(p, this.obstacles);
      this.players.push(p);
    });

    this.camTarget = this.add.zone(this.players[0].x, this.players[0].y, 1, 1);
    this.cameras.main.startFollow(this.camTarget, true, 0.12, 0.12);
    this.cameras.main.centerOn(this.camTarget.x, this.camTarget.y);

    this.events.on('enemy-killed', this.onEnemyKilled, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.input.mouse?.disableContextMenu();
    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);

    this.scene.launch('HUDScene', { arena: this });
    audio.playMusic('battle');
    SceneManager.fadeIn(this, 400);
    (window as unknown as { __cc?: unknown }).__cc = this;
  }

  private buildProps(): void {
    this.obstacles = this.physics.add.staticGroup();
    for (const pr of arenaLayout()) {
      const img = this.add.sprite(pr.x, pr.y, pr.key, 0).setOrigin(0.5, 1);
      img.setDepth(DEPTH.entities + pr.y - (pr.solid ? 0 : 400));
      const propAnim = this.anims.get(`${pr.key}:loop`);
      if (propAnim) img.play({ key: `${pr.key}:loop`, startFrame: Math.floor(Math.random() * propAnim.frames.length) });
      this.add.image(pr.x, pr.y - 1, pr.bw > 16 ? 'shadow-l' : 'shadow-m').setDepth(DEPTH.shadows);
      if (pr.solid) {
        const zone = this.add.zone(pr.x, pr.y - pr.bh / 2, pr.bw, pr.bh);
        this.physics.add.existing(zone, true);
        this.obstacles.add(zone);
        this.obstacleRects.push(new Phaser.Geom.Rectangle(pr.x - pr.bw / 2, pr.y - pr.bh, pr.bw, pr.bh));
      }
      if (pr.light) {
        const l = this.add
          .image(pr.x, pr.y - (pr.key === 'prop-brazier' ? 20 : 10), 'glow-big')
          .setTint(pr.light)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.light)
          .setScale(pr.key === 'prop-candles' ? 0.6 : 1.1)
          .setAlpha(0.5);
        this.propLights.push({ img: l, base: 0.45, phase: Math.random() * 10 });
      }
    }
  }

  private buildAtmosphere(): void {
    const b = ARENA.bounds;
    // the summoning circle glows faintly
    const c = this.add.image(b.x + b.w / 2, b.y + b.h / 2, 'glow-big').setTint(0x6b3fd1).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setAlpha(0.18).setDepth(DEPTH.decal);
    this.propLights.push({ img: c, base: 0.16, phase: 0 });
    // drifting fog
    for (let i = 0; i < 10; i++) {
      const f = this.add
        .image(b.x + Math.random() * b.w, b.y + Math.random() * b.h, 'fog')
        .setTint(i % 2 ? 0x3a2560 : 0x1f2a3a)
        .setScale(2.5 + Math.random() * 2)
        .setAlpha(0.22)
        .setDepth(DEPTH.fog)
        .setBlendMode(Phaser.BlendModes.ADD);
      f.setData('vx', 4 + Math.random() * 6);
      this.fog.push(f);
    }
  }

  /** The context object handed to every system (keeps Phaser's own `time` clock intact). */
  private buildWorld(): World {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const s = this;
    return {
      scene: this,
      get mode() {
        return s.mode;
      },
      get time() {
        return s.runTime;
      },
      get rng() {
        return s.rng;
      },
      get players() {
        return s.players;
      },
      get enemies() {
        return s.enemies;
      },
      enemyGrid: this.enemyGrid,
      get obstacles() {
        return s.obstacles;
      },
      get combat() {
        return s.combat;
      },
      get effects() {
        return s.effects;
      },
      get telegraphs() {
        return s.telegraphs;
      },
      get projectiles() {
        return s.projectiles;
      },
      get zones() {
        return s.zones;
      },
      get xp() {
        return s.xp;
      },
      get waves() {
        return s.waves;
      },
      get abilities() {
        return s.abilities;
      },
      get versus() {
        return s.versus;
      },
      get bossesDefeated() {
        return s.bossesDefeated;
      },
      set bossesDefeated(v: number) {
        s.bossesDefeated = v;
      },
      spawnEnemy: (id, x, y, opts) => s.spawnEnemy(id, x, y, opts),
      livingPlayers: () => s.livingPlayers(),
      nearestPlayer: (x, y) => s.nearestPlayer(x, y),
      isBlocked: (x, y, r) => s.isBlocked(x, y, r),
      hitStop: (ms) => s.hitStop(ms),
      banner: (t, c, sub) => s.banner(t, c, sub),
    };
  }

  // ───────── World API ─────────
  livingPlayers(): Player[] {
    return this.players.filter((p) => p.alive);
  }

  nearestPlayer(x: number, y: number): Player | null {
    let best: Player | null = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = dist2(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  isBlocked(x: number, y: number, radius: number): boolean {
    const b = ARENA.bounds;
    if (x - radius < b.x || x + radius > b.x + b.w || y - radius < b.y || y > b.y + b.h) return true;
    for (const r of this.obstacleRects) {
      if (x + radius > r.x && x - radius < r.right && y + radius > r.y && y - radius < r.bottom) return true;
    }
    return false;
  }

  hitStop(ms: number): void {
    const now = this.game.loop.time;
    this.hitStopUntil = Math.min(now + 120, Math.max(this.hitStopUntil, now + ms));
  }

  banner(text: string, color = '#e8e2ff', sub?: string): void {
    this.events.emit('banner', text, color, sub);
  }

  spawnEnemy(id: string, x: number, y: number, opts: { hpMult?: number; elite?: boolean } = {}): Enemy | null {
    const def = ENEMIES[id];
    if (!def) return null;
    const cap = this.mode === 'versus' ? DIFFICULTY.enemyCap.versus : DIFFICULTY.enemyCap.solo;
    let active = 0;
    for (const e of this.enemies) if (e.active && !e.dying) active++;
    if (active >= cap && def.ai !== 'boss' && def.ai !== 'elite') return null;
    const diff = difficultyAt(this.runTime);
    const vb = this.versus?.balance;
    const hpMult = diff.hp * (vb ? vb.enemyHpMult : 1) * (opts.hpMult ?? 1);
    const dmgMult = diff.damage * (vb ? vb.enemyDamageMult : 1);
    let e: Enemy | null;
    if (def.ai === 'boss') {
      const boss = new Boss(this, x, y);
      this.add.existing(boss);
      this.physics.add.existing(boss);
      this.enemyGroup.add(boss);
      e = boss;
    } else {
      e = this.enemyGroup.get(x, y) as Enemy | null;
      if (!e) return null;
    }
    // boss HP shouldn't scale with the minute-based curve as steeply
    e.spawn(def, x, y, def.ai === 'boss' ? (opts.hpMult ?? 1) * (1 + this.runTime / 600) : hpMult, dmgMult, def.ai === 'boss' ? 1 : diff.speed, this.runTime);
    if (!this.enemies.includes(e)) this.enemies.push(e);
    return e;
  }

  // ───────── loop ─────────
  update(_time: number, delta: number): void {
    tickInput(this.game.loop.frame);
    if (this.ended) {
      this.effects.update(delta / 1000);
      for (const p of this.players) p.update(0, this.world);
      return;
    }
    if (this.players.some((p) => p.alive && p.intent.pause) || (keys.wasPressed('Escape') && !this.upgradeOpen)) {
      this.openPause();
      return;
    }
    if (IS_DEBUG) this.debugKeys();
    if (this.game.loop.time < this.hitStopUntil) return;
    const dt = Math.min(delta / 1000, 1 / 30);
    this.runTime += dt;

    for (const p of this.players) {
      p.update(dt, this.world);
      this.abilities.update(p, dt);
      if (this.god) p.hp = p.stats.maxHp;
    }
    this.versus?.update();
    this.updateEnemies(dt);
    this.projectiles.update(dt);
    this.zones.update(dt);
    this.xp.update(dt);
    this.waves.update(dt);
    this.telegraphs.update(dt);
    this.effects.update(dt);
    this.contactDamage();
    this.updateCamera();
    this.updateAtmosphere(dt);
    this.checkLevelUps();
    this.checkEnd();
  }

  private updateEnemies(dt: number): void {
    this.enemyGrid.rebuild(this.enemies);
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.dying) {
        e.setDepth(DEPTH.entities + e.y);
        continue;
      }
      if (e.def.ai === 'boss') (e as Boss).updateBoss(dt, this.world);
      else AI[e.def.ai](e, dt, this.world);
      this.separate(e);
      e.integrate(dt, this.world);
      this.combat.tickStatuses(e, dt);
    }
  }

  /** Soft separation so crowds spread out instead of stacking into one sprite. */
  private separate(e: Enemy): void {
    this.near.length = 0;
    this.enemyGrid.queryCircle(e.x, e.y, e.radius + 14, this.near);
    let pushX = 0;
    let pushY = 0;
    let n = 0;
    for (const o of this.near) {
      if (o === e || o.dying) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = e.radius + o.radius;
      if (d >= min) continue;
      const share = o.def.mass / (o.def.mass + e.def.mass);
      const f = ((min - d) / min) * 150 * share;
      pushX += (dx / d) * f;
      pushY += (dy / d) * f;
      if (++n >= 8) break;
    }
    e.knockVx += pushX * 0.12;
    e.knockVy += pushY * 0.12;
    e.desiredVx += pushX;
    e.desiredVy += pushY;
  }

  private contactDamage(): void {
    for (const p of this.players) {
      if (!p.alive || p.invulnerable) continue;
      this.near.length = 0;
      this.enemyGrid.queryCircle(p.x, p.y, 40, this.near);
      for (const e of this.near) {
        if (e.dying || e.def.contactDamage <= 0 || e.isFrozenAt(this.runTime) || this.runTime - e.spawnTime < 0.35) continue;
        const r = e.radius + 5;
        if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
          if (this.combat.hurtPlayer(p, e.def.contactDamage * e.damageMult, e.x, e.y)) break;
        }
      }
    }
  }

  private updateCamera(): void {
    const living = this.livingPlayers();
    const ps = living.length ? living : this.players;
    let x = 0;
    let y = 0;
    for (const p of ps) {
      x += p.x;
      y += p.y;
    }
    // slight look-ahead toward the solo player's aim keeps the action framed
    const lead = ps.length === 1 ? 14 : 0;
    this.camTarget.setPosition(x / ps.length + ps[0].aim.x * lead, y / ps.length - 10 + ps[0].aim.y * lead);
  }

  private updateAtmosphere(dt: number): void {
    const b = ARENA.bounds;
    for (const f of this.fog) {
      f.x += (f.getData('vx') as number) * dt;
      if (f.x > b.x + b.w + 150) f.x = b.x - 150;
    }
    for (const l of this.propLights) l.img.setAlpha(l.base + Math.sin(this.runTime * 3 + l.phase) * 0.06);
  }

  private onEnemyKilled(e: Enemy): void {
    if (!e.isBoss) return;
    this.bossesDefeated++;
    this.waves.onBossDefeated();
    this.hitStop(120);
    audio.play('boss_death');
    this.effects.shake(0.014, 1200);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 250, () => {
        this.effects.ring(e.x, e.y - 20, 10, 120 + i * 40, i % 2 ? 0xff3355 : 0xffd36b, 0.7, 4);
        this.effects.burst('king', e.x + this.rng.range(-20, 20), e.y - 30 + this.rng.range(-20, 20), 40);
      });
    }
    for (let i = 0; i < 12; i++) this.xp.dropXp(e.x + this.rng.range(-50, 50), e.y + this.rng.range(-40, 40), 25);
    this.xp.drop('crown', e.x, e.y);
    if (this.mode === 'versus') this.xp.drop('crown', e.x + 40, e.y);
    this.xp.drop('heart', e.x - 30, e.y + 10);
    this.banner('THE HOLLOW KING HAS FALLEN', '#ffd36b', 'Claim the crown');
    this.events.emit('boss-defeated', e);
    e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.enemyGroup.remove(e, true, true);
      this.enemies = this.enemies.filter((x) => x !== e);
    });
  }

  // ───────── level-ups / pause ─────────
  private checkLevelUps(): void {
    if (this.upgradeOpen) return;
    const needs = this.players.filter((p) => p.alive && (p.pendingLevelUps > 0 || p.pendingRewards.length > 0));
    if (needs.length === 0) return;
    this.upgradeOpen = true;
    audio.play('level_up');
    for (const p of needs) {
      this.effects.ring(p.x, p.y - 10, 4, 40, 0xffd36b, 0.5, 2);
      this.effects.burst('gold', p.x, p.y - 12, 20);
    }
    this.scene.pause();
    this.scene.launch('UpgradeScene', { arena: this, players: needs.map((p) => p.index) });
  }

  onUpgradesDone(): void {
    this.upgradeOpen = false;
    this.scene.resume();
  }

  private autoPause(): void {
    if (this.scene.isActive() && !this.ended && !this.upgradeOpen) this.openPause();
  }

  openPause(): void {
    if (this.ended) return;
    audio.play('ui_select');
    this.scene.pause();
    this.scene.launch('PauseScene', { arena: this });
  }

  // ───────── end of run ─────────
  private checkEnd(): void {
    if (this.mode === 'solo') {
      if (!this.players[0].alive) this.finish();
      return;
    }
    const outcome = this.versus!.checkEnd();
    if (outcome) this.finish();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    const outcome = this.versus?.outcome;
    const summaries: PlayerSummary[] = this.players.map((p) => ({
      index: p.index,
      character: p.def.id,
      survivalTime: p.alive ? this.runTime : p.survivalTime,
      kills: p.kills,
      level: p.level,
      damageDealt: Math.round(p.damageDealt),
      upgrades: [...p.build.history],
      synergies: [...p.build.synergies],
      alive: p.alive,
    }));
    const result: RunResult = { mode: this.mode, time: this.runTime, bossesDefeated: this.bossesDefeated, players: summaries };
    if (this.mode === 'solo') {
      const s = summaries[0];
      result.highscoreRank = GameManager.save.recordSoloRun({ character: s.character, time: s.survivalTime, kills: s.kills, level: s.level, bosses: this.bossesDefeated, date: new Date().toISOString().slice(0, 10) });
      audio.play('defeat');
      this.banner('YOU HAVE FALLEN', '#ff3355');
    } else {
      result.winner = outcome?.winner ?? null;
      result.winReason = outcome?.reason;
      GameManager.save.recordVersus(result.winner, summaries.reduce((a, s) => a + s.kills, 0), this.bossesDefeated);
      audio.play('victory');
      this.banner(result.winner === null ? 'DRAW' : `PLAYER ${result.winner + 1} WINS`, result.winner === 1 ? '#66ffcc' : result.winner === 0 ? '#b98cff' : '#e8e2ff', outcome?.reason);
    }
    GameManager.lastResult = result;
    audio.playMusic(null);
    this.physics.pause();
    this.time.delayedCall(2200, () => {
      this.scene.stop('HUDScene');
      SceneManager.fadeTo(this, 'GameOverScene', {}, 500);
    });
  }

  quitToMenu(): void {
    this.scene.stop('HUDScene');
    this.scene.stop('UpgradeScene');
    this.scene.stop('PauseScene');
    this.scene.start('MainMenuScene');
  }

  restart(): void {
    this.scene.stop('HUDScene');
    this.scene.stop('PauseScene');
    GameManager.startRun(GameManager.run.mode, GameManager.run.characters);
    this.scene.restart();
  }

  private debugKeys(): void {
    if (keys.wasPressed('F1')) this.runTime += 60;
    if (keys.wasPressed('F2')) for (const p of this.livingPlayers()) p.gainXp(p.xpNeeded - p.xp);
    if (keys.wasPressed('F3')) this.waves.spawnBoss();
    if (keys.wasPressed('F4')) this.god = !this.god;
    if (keys.wasPressed('F6')) {
      const p = this.players[0];
      this.spawnEnemy('elite', p.x + 120, p.y, { elite: true });
    }
    if (keys.wasPressed('F7')) for (const p of this.livingPlayers()) p.ultCharge = 100;
  }

  private cleanup(): void {
    this.events.off('enemy-killed', this.onEnemyKilled, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.telegraphs?.clear();
    this.zones?.clear();
    this.effects?.destroy();
    this.players = [];
    this.enemies = [];
  }
}

export const VIEW = { w: GAME_WIDTH, h: GAME_HEIGHT };
