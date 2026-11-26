/**
 * A hero controlled by one PlayerController. All three characters share this class;
 * their differences come from CharacterDef data, abilities and art.
 */
import { pointerWorld } from '../game/InputManager';
import Phaser from 'phaser';
import { DEPTH, COLORS } from '../game/GameConfig';
import { computeStats, type StatBlock, type StatModifier } from '../core/stats';
import { damp, normalize } from '../core/math';
import type { CharacterDef, AbilitySlot, AbilityDef } from '../data/types';
import { getAbility } from '../data/abilities';
import { PLAYER_BALANCE } from '../data/balance';
import { createBuild, type BuildState } from '../systems/UpgradeSystem';
import { xpToNext } from '../systems/XPSystem';
import type { PlayerController, PlayerIntent } from '../game/InputManager';
import { emptyIntent } from '../game/InputManager';
import { THEME_COLORS } from '../art/palette';
import type { World } from '../systems/World';
import { audio } from '../game/AudioManager';

export interface AbilityInstance {
  def: AbilityDef;
  cooldown: number;
  maxCooldown: number;
}

interface TimedBuff {
  source: string;
  mods: StatModifier[];
  until: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly index: 0 | 1;
  readonly def: CharacterDef;
  readonly controller: PlayerController;
  readonly build: BuildState;
  stats!: StatBlock;
  hp: number;
  alive = true;
  level = 1;
  xp = 0;
  xpNeeded = xpToNext(1);
  pendingLevelUps = 0;
  /** Extra upgrade picks with boosted rarity (chests / boss crowns). */
  pendingRewards: ('rare' | 'epic')[] = [];
  kills = 0;
  damageDealt = 0;
  survivalTime = 0;
  deathTime = -1;
  ultCharge = 0;
  abilities: Record<Exclude<AbilitySlot, 'passive'>, AbilityInstance>;
  passive: AbilityDef;
  intent: PlayerIntent = emptyIntent();
  facing = 1;
  aim = { x: 1, y: 0 };
  dashCooldown = 0;
  dashTime = 0;
  dashDir = { x: 1, y: 0 };
  invulnUntil = 0;
  hurtUntil = 0;
  actionLockUntil = 0;
  /** True while an ability (e.g. Blood Rush) is moving the player. */
  forcedMove: { vx: number; vy: number; until: number } | null = null;
  hunted = false;
  /** Run clock as of the last update. */
  now = 0;
  lifestealBudget = 0;
  private buffs: TimedBuff[] = [];
  private vx = 0;
  private vy = 0;
  private footstep = 0;
  shadow: Phaser.GameObjects.Image;
  reticle: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Text;
  readonly color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, index: 0 | 1, def: CharacterDef, controller: PlayerController, showMarker: boolean) {
    super(scene, x, y, `hero-${def.id}`, 0);
    this.index = index;
    this.def = def;
    this.controller = controller;
    this.build = createBuild(def.id);
    this.color = index === 0 ? COLORS.p1 : COLORS.p2;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.9);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(5, 11, 23);
    body.setCollideWorldBounds(true);
    this.abilities = {
      basic: this.makeAbility(def.abilities.basic),
      q: this.makeAbility(def.abilities.q),
      e: this.makeAbility(def.abilities.e),
      ult: this.makeAbility(def.abilities.ult),
    };
    this.passive = getAbility(def.abilities.passive);
    this.recomputeStats();
    this.hp = this.stats.maxHp;
    this.shadow = scene.add.image(x, y, 'shadow-m').setDepth(DEPTH.shadows);
    this.reticle = scene.add.image(x, y, index === 0 && controller.opts.scheme.usesMouse ? 'ui-reticle-p1' : 'ui-arrow').setDepth(DEPTH.numbers - 2).setAlpha(0.85);
    this.reticle.setTint(index === 0 ? 0xe0b3ff : 0x66ffcc);
    this.marker = scene.add
      .text(x, y, index === 0 ? 'P1' : 'P2', { fontFamily: '"Silkscreen", monospace', fontSize: '8px', color: index === 0 ? COLORS.p1css : COLORS.p2css, stroke: '#0d0816', strokeThickness: 2 })
      .setOrigin(0.5)
      .setDepth(DEPTH.numbers - 1)
      .setVisible(showMarker);
    this.play(`hero-${def.id}:idle`);
  }

  private makeAbility(id: string): AbilityInstance {
    return { def: getAbility(id), cooldown: 0, maxCooldown: 1 };
  }

  get theme() {
    return THEME_COLORS[this.def.theme];
  }

  recomputeStats(): void {
    const prevMax = this.stats?.maxHp;
    const mods = [...this.build.statMods, ...this.buffs.flatMap((b) => b.mods)];
    this.stats = computeStats(this.def.stats, mods);
    if (prevMax && this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = Math.min(this.hp ?? this.stats.maxHp, this.stats.maxHp);
  }

  addBuff(source: string, mods: StatModifier[], until: number): void {
    this.buffs = this.buffs.filter((b) => b.source !== source);
    this.buffs.push({ source, mods, until });
    this.recomputeStats();
  }

  hasBuff(source: string): boolean {
    return this.buffs.some((b) => b.source === source);
  }

  heal(amount: number, w: World, showText = true): number {
    if (!this.alive || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    const healed = this.hp - before;
    if (showText && healed >= 1) w.effects.floatText(this.x, this.y - 30, `+${Math.round(healed)}`, '#7be36b', 12, 700);
    return healed;
  }

  get invulnerable(): boolean {
    return this.dashTime > 0 || this.invulnUntil > this.now;
  }

  update(dt: number, w: World): void {
    if (!this.alive) {
      this.shadow.setPosition(this.x, this.y + 1);
      return;
    }
    this.survivalTime = w.time;
    this.now = w.time;
    const t = w.time;
    // timed buffs
    if (this.buffs.some((b) => b.until <= t)) {
      this.buffs = this.buffs.filter((b) => b.until > t);
      this.recomputeStats();
    }
    this.intent = this.controller.poll(this.scene, this);
    const it = this.intent;
    if (it.aimX || it.aimY) this.aim = { x: it.aimX, y: it.aimY };

    // regen + lifesteal budget refill (limits sustain from huge AoE hits)
    if (this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * this.stats.healing * dt);
    this.lifestealBudget = Math.min(this.stats.maxHp * 0.12, this.lifestealBudget + this.stats.maxHp * 0.1 * dt);
    // passive ult charge
    this.addUltCharge(PLAYER_BALANCE.ultPassivePerSecond * dt);

    // ── dash ──
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (it.dash && this.dashCooldown <= 0 && !this.forcedMove) this.startDash(w);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.forcedMove) {
      body.setVelocity(this.forcedMove.vx, this.forcedMove.vy);
      if (t >= this.forcedMove.until) this.forcedMove = null;
      if (Math.floor(t * 60) % 2 === 0) w.effects.afterimage(this, this.theme.main, 0.5, 200);
    } else if (this.dashTime > 0) {
      this.dashTime -= dt;
      const speed = this.stats.dashDistance / this.def.dash.duration;
      body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
      w.effects.afterimage(this, this.theme.main, 0.45, 220);
      if (this.def.dash.style === 'glide') w.effects.burst('frost', this.x, this.y - 3, 1);
      if (this.dashTime <= 0) {
        this.vx = this.dashDir.x * this.stats.moveSpeed;
        this.vy = this.dashDir.y * this.stats.moveSpeed;
      }
    } else {
      const slowCast = this.actionLockUntil > t ? 0.75 : 1;
      const tx = it.moveX * this.stats.moveSpeed * slowCast;
      const ty = it.moveY * this.stats.moveSpeed * slowCast;
      this.vx = damp(this.vx, tx, this.def.acceleration, dt);
      this.vy = damp(this.vy, ty, this.def.acceleration, dt);
      body.setVelocity(this.vx, this.vy);
    }

    // ── facing ──
    const acting = this.actionLockUntil > t;
    if (acting || it.attack) this.facing = this.aim.x < 0 ? -1 : 1;
    else if (Math.abs(it.moveX) > 0.1) this.facing = it.moveX < 0 ? -1 : 1;
    this.setFlipX(this.facing < 0);

    this.updateAnimation(t, it);
    this.updateVisuals(t, w);
  }

  private startDash(w: World): void {
    const it = this.intent;
    let d = normalize(it.moveX, it.moveY);
    if (!d.x && !d.y) d = { x: this.aim.x, y: this.aim.y };
    this.dashDir = d;
    this.dashCooldown = this.stats.dashCooldown;
    const style = this.def.dash.style;
    if (style === 'blink') {
      // Voidwalker teleports: walk the path in small steps and stop before obstacles.
      w.effects.afterimage(this, this.theme.main, 0.8, 350);
      w.effects.burst('void', this.x, this.y - 10, 14);
      let x = this.x;
      let y = this.y;
      const steps = Math.ceil(this.stats.dashDistance / 4);
      for (let i = 0; i < steps; i++) {
        const nx = x + d.x * 4;
        const ny = y + d.y * 4;
        if (w.isBlocked(nx, ny, 5)) break;
        x = nx;
        y = ny;
      }
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.reset(x, y);
      this.setPosition(x, y);
      this.invulnUntil = w.time + 0.25;
      w.effects.burst('void', x, y - 10, 14);
      w.effects.ring(x, y - 8, 4, 18, this.theme.main, 0.25);
      audio.play('blink');
      this.dashTime = 0;
    } else {
      this.dashTime = this.def.dash.duration;
      this.invulnUntil = w.time + this.def.dash.duration + 0.08;
      audio.play('dash');
      w.effects.burst(style === 'glide' ? 'frost' : 'dust', this.x, this.y - 2, 8, { angle: Math.atan2(-d.y, -d.x), spread: 0.5 });
    }
    this.play(`hero-${this.def.id}:dash`, true);
  }

  private updateAnimation(t: number, it: PlayerIntent): void {
    const key = (s: string) => `hero-${this.def.id}:${s}`;
    const cur = this.anims.currentAnim?.key ?? '';
    const playing = this.anims.isPlaying;
    if (this.dashTime > 0 || this.forcedMove) {
      if (cur !== key('dash')) this.play(key('dash'), true);
      return;
    }
    if (this.hurtUntil > t) {
      if (cur !== key('hurt')) this.play(key('hurt'), true);
      return;
    }
    if ((cur === key('attack') || cur === key('cast')) && playing) return;
    const moving = Math.abs(it.moveX) + Math.abs(it.moveY) > 0.1;
    const want = moving ? key('walk') : key('idle');
    if (cur !== want) this.play(want, true);
  }

  playAction(kind: 'attack' | 'cast', lock = 0.12): void {
    this.play(`hero-${this.def.id}:${kind}`, true);
    this.actionLockUntil = this.now + lock;
  }

  private updateVisuals(t: number, w: World): void {
    this.setDepth(DEPTH.entities + this.y);
    this.shadow.setPosition(this.x, this.y + 1);
    // invulnerability blink after taking a hit
    if (this.invulnUntil > t && this.dashTime <= 0 && this.hurtUntil > t - 0.6) this.setAlpha(Math.floor(t * 20) % 2 ? 0.45 : 1);
    else this.setAlpha(1);
    if (this.hasBuff('blood_moon')) this.setTint(0xffb3b3);
    else if (this.hurtUntil > t) this.setTint(0xff8a8a);
    else this.clearTint();
    // aim indicator
    if (this.intent.aimSource === 'mouse') {
      const p = pointerWorld(this.scene);
      this.reticle.setTexture('ui-reticle-p1').setPosition(Math.round(p.x), Math.round(p.y)).setRotation(0);
    } else {
      this.reticle.setTexture('ui-arrow').setPosition(Math.round(this.x + this.aim.x * 18), Math.round(this.y - 10 + this.aim.y * 18)).setRotation(Math.atan2(this.aim.y, this.aim.x));
    }
    this.marker.setPosition(Math.round(this.x), Math.round(this.y - 36));
    if (this.hunted) this.marker.setText(this.index === 0 ? 'P1 ☠' : 'P2 ☠');
    else this.marker.setText(this.index === 0 ? 'P1' : 'P2');
    // footstep dust
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 20;
    this.footstep -= moving ? 1 / 60 : 0;
    if (moving && this.footstep <= 0) {
      this.footstep = 0.22;
      w.effects.burst('dust', this.x, this.y, 1);
    }
  }

  addUltCharge(amount: number): void {
    if (!this.alive) return;
    this.ultCharge = Math.min(PLAYER_BALANCE.ultMax, this.ultCharge + amount * this.stats.ultCharge);
  }

  get ultReady(): boolean {
    return this.ultCharge >= PLAYER_BALANCE.ultMax;
  }

  gainXp(amount: number): void {
    if (!this.alive) return;
    this.xp += amount;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.pendingLevelUps++;
      this.xpNeeded = xpToNext(this.level);
    }
  }

  die(w: World): void {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.deathTime = w.time;
    this.survivalTime = w.time;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.clearTint();
    this.setAlpha(1);
    this.play(`hero-${this.def.id}:death`, true);
    this.reticle.setVisible(false);
    this.marker.setVisible(false);
    w.effects.burst(this.def.theme === 'void' ? 'void' : this.def.theme === 'blood' ? 'blood' : 'frost', this.x, this.y - 12, 40);
    w.effects.ring(this.x, this.y - 10, 6, 60, this.theme.main, 0.6, 3);
  }
}
