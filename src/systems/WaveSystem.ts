/** Spawning, difficulty curve, scripted events, elites and boss encounters. */
import Phaser from 'phaser';
import type { World } from './World';
import type { Player } from '../entities/Player';
import { ENDLESS, WAVE_EVENTS, segmentAt, spawnIntervalAt, type WaveEvent } from '../data/waves';
import { ARENA, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { audio } from '../game/AudioManager';
import type { Boss } from '../entities/Boss';

/** Max simultaneously alive enemies per type (regular spawns only; scripted swarms ignore it). */
export const ALIVE_CAPS: Record<string, number> = { void_caster: 10, bone_knight: 14 };

export class WaveSystem {
  private spawnTimer = 1.5;
  private eventIdx = 0;
  private nextElite = Infinity;
  private nextSwarm = Infinity;
  private nextBoss = Infinity;
  private targetToggle = 0;
  wave = 1;
  bossCount = 0;
  boss: Boss | null = null;
  bossIncoming = false;

  constructor(private readonly world: () => World) {}

  update(dt: number): void {
    const w = this.world();
    const t = w.time;
    while (this.eventIdx < WAVE_EVENTS.length && WAVE_EVENTS[this.eventIdx].time <= t) this.runEvent(WAVE_EVENTS[this.eventIdx++]);
    if (t >= ENDLESS.startAt) {
      if (this.nextElite === Infinity) {
        this.nextElite = t + ENDLESS.eliteEvery * 0.5;
        this.nextSwarm = t + ENDLESS.swarmEvery * 0.5;
        this.nextBoss = Math.max(t + ENDLESS.bossEvery * 0.6, this.nextBoss === Infinity ? 0 : this.nextBoss);
      }
      if (t >= this.nextElite) {
        this.nextElite = t + ENDLESS.eliteEvery;
        this.runEvent({ time: t, type: 'elite' });
        if (t > ENDLESS.startAt + 240) this.runEvent({ time: t, type: 'elite' });
      }
      if (t >= this.nextSwarm) {
        this.nextSwarm = t + ENDLESS.swarmEvery;
        this.runEvent({ time: t, type: 'swarm', enemy: w.rng.pick(['wraith', 'slime', 'bone_knight', 'void_caster']), count: 14 + Math.floor((t - ENDLESS.startAt) / 30), pattern: 'ring' });
      }
      if (t >= this.nextBoss && !this.boss && !this.bossIncoming) {
        this.nextBoss = t + ENDLESS.bossEvery;
        this.runEvent({ time: t, type: 'boss' });
      }
    }
    // wave banner each minute
    const wave = Math.floor(t / 60) + 1;
    if (wave !== this.wave) {
      this.wave = wave;
      w.banner(`WAVE ${wave}`, '#e8e2ff', wave >= 11 ? 'Endless curse – it only gets worse' : undefined);
      audio.play('wave');
    }
    // regular spawns
    const rate = (w.versus ? w.versus.balance.spawnRateMult : 1) * (this.boss ? 0.35 : 1);
    this.spawnTimer -= dt * rate;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnIntervalAt(t);
      const seg = segmentAt(t);
      // ranged / heavy enemies have alive caps so a screen never fills with turrets
      const alive: Record<string, number> = {};
      for (const e of w.enemies) if (e.active && !e.dying) alive[e.def.id] = (alive[e.def.id] ?? 0) + 1;
      const pool = seg.enemies.filter((e) => (alive[e.id] ?? 0) < (ALIVE_CAPS[e.id] ?? Infinity));
      const pick = w.rng.weighted(pool, (e) => e.weight);
      if (pick) {
        const room = (ALIVE_CAPS[pick.id] ?? Infinity) - (alive[pick.id] ?? 0);
        this.spawnGroup(pick.id, Math.min(room, w.rng.int(seg.groupSize[0], seg.groupSize[1])));
      }
    }
  }

  private runEvent(ev: WaveEvent): void {
    const w = this.world();
    switch (ev.type) {
      case 'banner':
        w.banner(ev.text.toUpperCase(), '#c8a0ff');
        break;
      case 'swarm':
        for (const p of w.livingPlayers()) this.spawnSwarm(ev.enemy, Math.ceil(ev.count / (w.versus ? 1.4 : 1)), ev.pattern, p);
        break;
      case 'elite': {
        const target = this.pickTarget();
        if (!target) return;
        const pt = this.spawnPoint(target, 40);
        w.telegraphs.add({ shape: 'circle', x: pt.x, y: pt.y, radius: 22, dur: 1.2, color: 0xff66cc, onDone: () => {
          const e = w.spawnEnemy('elite', pt.x, pt.y, { elite: true });
          if (e) {
            audio.play('elite_roar');
            w.effects.ring(pt.x, pt.y, 4, 50, 0xff66cc, 0.6, 3);
          }
        } });
        w.banner('ELITE ABOMINATION', '#ff66cc', 'Slay it for a cursed chest');
        break;
      }
      case 'boss':
        this.spawnBoss();
        break;
    }
  }

  private pickTarget(): Player | null {
    const w = this.world();
    const living = w.livingPlayers();
    if (living.length === 0) return null;
    if (living.length === 1) return living[0];
    const hunted = living.find((p) => p.hunted);
    if (hunted && w.versus && w.rng.chance(w.versus.balance.huntedSpawnBias)) return hunted;
    this.targetToggle = 1 - this.targetToggle;
    return living[this.targetToggle] ?? living[0];
  }

  /** A point just outside the visible area around `target`, inside the arena and away from all players. */
  spawnPoint(target: { x: number; y: number }, minPlayerDist = 150): { x: number; y: number } {
    const w = this.world();
    const b = ARENA.bounds;
    const half = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2;
    for (let tries = 0; tries < 16; tries++) {
      const a = w.rng.next() * Math.PI * 2;
      const r = half * (tries < 10 ? 0.9 : 0.65) + w.rng.range(10, 60);
      const x = Phaser.Math.Clamp(target.x + Math.cos(a) * r, b.x + 12, b.x + b.w - 12);
      const y = Phaser.Math.Clamp(target.y + Math.sin(a) * r * 0.8, b.y + 14, b.y + b.h - 10);
      if (w.isBlocked(x, y, 10)) continue;
      if (w.livingPlayers().every((p) => Math.hypot(p.x - x, p.y - y) >= minPlayerDist)) return { x, y };
    }
    // fallback: farthest arena corner
    const corners = [
      { x: b.x + 20, y: b.y + 20 },
      { x: b.x + b.w - 20, y: b.y + 20 },
      { x: b.x + 20, y: b.y + b.h - 20 },
      { x: b.x + b.w - 20, y: b.y + b.h - 20 },
    ];
    corners.sort((c1, c2) => Math.hypot(c2.x - target.x, c2.y - target.y) - Math.hypot(c1.x - target.x, c1.y - target.y));
    return corners[0];
  }

  spawnGroup(id: string, n: number): void {
    const target = this.pickTarget();
    if (!target) return;
    const w = this.world();
    const c = this.spawnPoint(target);
    for (let i = 0; i < n; i++) {
      const x = c.x + w.rng.range(-18, 18);
      const y = c.y + w.rng.range(-14, 14);
      if (!w.isBlocked(x, y, 6)) w.spawnEnemy(id, x, y);
    }
  }

  private spawnSwarm(id: string, count: number, pattern: 'ring' | 'line', target: Player): void {
    const w = this.world();
    const b = ARENA.bounds;
    const half = Math.hypot(GAME_WIDTH, GAME_HEIGHT) / 2;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      if (pattern === 'ring') {
        const a = (i / count) * Math.PI * 2;
        x = target.x + Math.cos(a) * (half + 10);
        y = target.y + Math.sin(a) * (half * 0.75 + 10);
      } else {
        const side = i % 2 === 0 ? -1 : 1;
        x = target.x + side * (GAME_WIDTH / 2 + 30);
        y = target.y + (Math.floor(i / 2) - count / 4) * 26;
      }
      x = Phaser.Math.Clamp(x, b.x + 12, b.x + b.w - 12);
      y = Phaser.Math.Clamp(y, b.y + 14, b.y + b.h - 10);
      if (w.livingPlayers().some((p) => Math.hypot(p.x - x, p.y - y) < 110)) continue;
      if (!w.isBlocked(x, y, 6)) w.spawnEnemy(id, x, y);
    }
  }

  spawnBoss(): void {
    const w = this.world();
    const target = this.pickTarget();
    if (!target || this.boss || this.bossIncoming) return;
    this.bossIncoming = true;
    const b = ARENA.bounds;
    // appear on-screen (so the intro is visible) but at a safe distance, toward the arena centre
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = cx - target.x;
    const dy = cy - target.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = d < 40 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d };
    let x = Phaser.Math.Clamp(target.x + dir.x * 150, b.x + 50, b.x + b.w - 50);
    let y = Phaser.Math.Clamp(target.y + dir.y * 110, b.y + 60, b.y + b.h - 30);
    if (w.isBlocked(x, y, 24)) {
      x = cx;
      y = cy;
    }
    w.banner('THE HOLLOW KING', '#ffd36b', 'A crowned emptiness approaches');
    audio.playMusic('boss');
    audio.play('boss_summon', { pitch: 0.5 });
    w.telegraphs.add({
      shape: 'circle',
      x,
      y: y - 4,
      radius: 40,
      dur: 2,
      color: 0xffd36b,
      onDone: () => {
        const hpMult = Math.pow(1.6, this.bossCount) * (w.versus ? w.versus.balance.bossHpMult : 1);
        const boss = w.spawnEnemy('hollow_king', x, y, { hpMult }) as Boss | null;
        this.bossIncoming = false;
        if (!boss) return;
        this.boss = boss;
        boss.startEncounter(w);
        w.scene.events.emit('boss-spawned', boss);
      },
    });
  }

  onBossDefeated(): void {
    this.boss = null;
    this.bossCount++;
    if (this.nextBoss === Infinity) this.nextBoss = this.world().time + ENDLESS.bossEvery;
    audio.playMusic('battle');
  }
}
