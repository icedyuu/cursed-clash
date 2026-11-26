/**
 * Persistent areas: Black Hole / Event Horizon (gravity), Frozen Ground, Crimson Trail,
 * and the Hollow King's cursed pools. Each kind has update + render rules below.
 */
import Phaser from 'phaser';
import { DEPTH } from '../game/GameConfig';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { World } from './World';
import { dist, distToSegment } from '../core/math';
import { audio } from '../game/AudioManager';

export type ZoneKind = 'gravity' | 'frost' | 'bloodTrail' | 'curse';

export interface ZoneSpec {
  kind: ZoneKind;
  owner: Player | null;
  abilityId: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  duration: number;
  tickInterval?: number;
  tickDamage?: number;
  pull?: number;
  slow?: number;
  buildup?: number;
  freezeTime?: number;
  collapseDamage?: number;
  bleedDps?: number;
  flags?: Set<string>;
  /** Delay before a hostile zone becomes active (it is telegraphed meanwhile). */
  armDelay?: number;
}

interface Zone extends ZoneSpec {
  t: number;
  tick: number;
  extra: number;
  gfx: Phaser.GameObjects.Graphics;
  inside: Set<Enemy>;
  alive: boolean;
}

export class ZoneSystem {
  private zones: Zone[] = [];
  private pool: Phaser.GameObjects.Graphics[] = [];
  private tmp: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: () => World,
  ) {}

  add(spec: ZoneSpec): void {
    const gfx = this.pool.pop() ?? this.scene.add.graphics();
    gfx.setDepth(DEPTH.zones).setVisible(true).setBlendMode(spec.kind === 'gravity' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.NORMAL);
    this.zones.push({ ...spec, flags: spec.flags ?? new Set(), t: 0, tick: 0, extra: 0, gfx, inside: new Set(), alive: true });
  }

  get count(): number {
    return this.zones.length;
  }

  /** True if (x,y) is inside an active hostile zone – used by AI to avoid stacking. */
  isHostileAt(x: number, y: number): boolean {
    return this.zones.some((z) => z.kind === 'curse' && dist(x, y, z.x, z.y) < z.radius);
  }

  update(dt: number): void {
    const w = this.world();
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.t >= z.duration) {
        this.finish(z, w);
        z.gfx.clear().setVisible(false);
        this.pool.push(z.gfx);
        this.zones.splice(i, 1);
        continue;
      }
      switch (z.kind) {
        case 'gravity':
          this.updateGravity(z, dt, w);
          break;
        case 'frost':
          this.updateFrost(z, dt, w);
          break;
        case 'bloodTrail':
          this.updateTrail(z, dt, w);
          break;
        case 'curse':
          this.updateCurse(z, dt, w);
          break;
      }
      this.render(z, w);
    }
  }

  private enemiesIn(z: Zone, w: World, r = z.radius): Enemy[] {
    this.tmp.length = 0;
    return w.enemyGrid.queryCircle(z.x, z.y, r, this.tmp).filter((e) => !e.dying);
  }

  private updateGravity(z: Zone, dt: number, w: World): void {
    const pull = z.pull ?? 80;
    for (const e of this.enemiesIn(z, w, z.radius * 1.2)) {
      const dx = z.x - e.x;
      const dy = z.y - e.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const strength = pull * (0.35 + 0.65 * Math.min(1, d / z.radius)) * (1 - e.def.knockbackResist * 0.85);
      // don't overshoot the singularity
      const s = Math.min(strength, d / Math.max(dt, 1 / 60));
      e.pullVx += (dx / d) * s;
      e.pullVy += (dy / d) * s;
      if (z.flags!.has('vulnerable')) e.vulnerableUntil = w.time + 0.4;
    }
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = z.tickInterval ?? 0.4;
      for (const e of this.enemiesIn(z, w)) w.combat.hitEnemy(e, z.tickDamage ?? 0, { owner: z.owner, abilityId: z.abilityId, knockback: 0, dirX: 0, dirY: 0, isDot: true });
    }
    // inward-spiralling particles
    z.extra -= dt;
    if (z.extra <= 0) {
      z.extra = z.radius > 90 ? 0.015 : 0.04;
      const a = Math.random() * Math.PI * 2;
      const r = z.radius * (0.8 + Math.random() * 0.3);
      w.effects.burst('void', z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, 1, { angle: a + Math.PI + 0.5, spread: 0.1 });
    }
  }

  private updateFrost(z: Zone, dt: number, w: World): void {
    const inside = new Set(this.enemiesIn(z, w));
    for (const e of inside) {
      e.applySlow(z.slow ?? 0.5, 0.25, w.time);
      if (!e.isFrozenAt(w.time)) {
        e.zoneBuildup += dt;
        if (e.zoneBuildup >= (z.buildup ?? 1.5)) {
          e.zoneBuildup = 0;
          e.freeze(z.freezeTime ?? 1.5, w.time);
          w.effects.burst('frost', e.x, e.y - 6, 6);
          audio.play('freeze');
        }
      }
    }
    for (const e of z.inside) if (!inside.has(e)) e.zoneBuildup = Math.max(0, e.zoneBuildup - 0.5);
    z.inside = inside;
    if (z.flags!.has('spikes')) {
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.tickInterval ?? 0.5;
        for (const e of inside) {
          w.combat.hitEnemy(e, z.tickDamage ?? 0, { owner: z.owner, abilityId: z.abilityId, knockback: 0, dirX: 0, dirY: 0, isDot: true });
          w.effects.burst('frost', e.x, e.y - 2, 2, { angle: -Math.PI / 2, spread: 0.3 });
        }
      }
    }
    if (z.flags!.has('blizzard')) {
      z.extra -= dt;
      if (z.extra <= 0 && inside.size > 0) {
        z.extra = 0.35;
        const targets = [...inside];
        const tgt = targets[Math.floor(Math.random() * targets.length)];
        const a = Math.random() * Math.PI * 2;
        const sx = z.x + Math.cos(a) * z.radius * 0.6;
        const sy = z.y + Math.sin(a) * z.radius * 0.6 - 20;
        w.projectiles.spawn({
          texture: 'proj-frost-shard',
          team: 'player',
          owner: z.owner,
          abilityId: 'frost_shard',
          x: sx,
          y: sy,
          angle: Math.atan2(tgt.y - 6 - sy, tgt.x - sx),
          speed: 260,
          range: 160,
          radius: 3,
          damage: 8 * (z.owner?.stats.damage ?? 1),
          knockback: 10,
          pierce: 0,
          trail: 'frost',
        });
      }
    }
    if (Math.random() < 0.3) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * z.radius;
      w.effects.burst('frost', z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, 1, { angle: -Math.PI / 2, spread: 0.2 });
    }
  }

  private updateTrail(z: Zone, dt: number, w: World): void {
    z.tick -= dt;
    if (z.tick > 0) return;
    z.tick = 0.4;
    this.tmp.length = 0;
    const cx = (z.x + (z.x2 ?? z.x)) / 2;
    const cy = (z.y + (z.y2 ?? z.y)) / 2;
    const half = dist(z.x, z.y, z.x2 ?? z.x, z.y2 ?? z.y) / 2 + z.radius;
    for (const e of w.enemyGrid.queryCircle(cx, cy, half, this.tmp)) {
      if (e.dying) continue;
      if (distToSegment(e.x, e.y, z.x, z.y, z.x2 ?? z.x, z.y2 ?? z.y) > z.radius + e.radius) continue;
      w.combat.applyBleed(e, z.bleedDps ?? 6, 2, z.owner);
    }
  }

  private updateCurse(z: Zone, dt: number, w: World): void {
    if (z.t < (z.armDelay ?? 0)) return;
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = z.tickInterval ?? 0.5;
      for (const p of w.players) {
        if (p.alive && dist(p.x, p.y, z.x, z.y) < z.radius) w.combat.hurtPlayer(p, z.tickDamage ?? 6, z.x, z.y, { knockback: 0 });
      }
    }
    if (Math.random() < 0.25) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * z.radius;
      w.effects.burst('king', z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, 1, { angle: -Math.PI / 2, spread: 0.2 });
    }
  }

  private finish(z: Zone, w: World): void {
    if (z.kind === 'gravity' && z.flags!.has('collapse')) {
      w.combat.explode(z.x, z.y, z.radius * 0.9, z.collapseDamage ?? 30, z.owner, z.abilityId);
      w.effects.ring(z.x, z.y, z.radius, 4, 0xe0b3ff, 0.3, 3);
      w.effects.ring(z.x, z.y, 4, z.radius * 1.2, 0xb05cff, 0.5, 4);
      w.effects.burst('void', z.x, z.y, 40);
      w.effects.shake(0.006, 200);
      audio.play('explosion');
    }
  }

  private render(z: Zone, w: World): void {
    const g = z.gfx;
    g.clear();
    const life = z.t / z.duration;
    const fadeIn = Math.min(1, z.t / 0.2);
    const fadeOut = Math.min(1, (z.duration - z.t) / 0.3);
    const a = fadeIn * fadeOut;
    const t = w.time;
    switch (z.kind) {
      case 'gravity': {
        const r = z.radius;
        g.fillStyle(0x05020a, 0.35 * a);
        g.fillCircle(z.x, z.y, r);
        g.fillStyle(0x1f1833, 0.5 * a);
        g.fillCircle(z.x, z.y, r * 0.55);
        // rotating accretion arcs
        for (let k = 0; k < 3; k++) {
          const rr = r * (0.35 + k * 0.25);
          const base = t * (3 - k) * 1.6 + k * 2;
          g.lineStyle(k === 2 ? 1 : 2, k === 0 ? 0xe0b3ff : 0xb05cff, 0.8 * a);
          for (let s = 0; s < 3; s++) {
            g.beginPath();
            g.arc(z.x, z.y, rr, base + (s * Math.PI * 2) / 3, base + (s * Math.PI * 2) / 3 + 1.1);
            g.strokePath();
          }
        }
        g.fillStyle(0x000000, a);
        g.fillCircle(z.x, z.y, Math.max(3, r * 0.14 + Math.sin(t * 10) * 1));
        g.lineStyle(1, 0xe0b3ff, a);
        g.strokeCircle(z.x, z.y, Math.max(3, r * 0.14 + Math.sin(t * 10) * 1) + 1);
        g.lineStyle(1, 0x8a4fe0, 0.4 * a);
        g.strokeCircle(z.x, z.y, r);
        break;
      }
      case 'frost': {
        const r = z.radius;
        g.fillStyle(0x2f7fd6, 0.18 * a);
        g.fillCircle(z.x, z.y, r);
        g.fillStyle(0x6fe3ff, 0.12 * a);
        g.fillCircle(z.x, z.y, r * (0.6 + 0.05 * Math.sin(t * 4)));
        g.lineStyle(1, 0xd4f7ff, 0.8 * a);
        g.strokeCircle(z.x, z.y, r);
        // crystalline cracks
        g.lineStyle(1, 0xd4f7ff, 0.5 * a);
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4 + 0.3;
          g.lineBetween(z.x + Math.cos(ang) * r * 0.2, z.y + Math.sin(ang) * r * 0.2, z.x + Math.cos(ang) * r * 0.85, z.y + Math.sin(ang) * r * 0.85);
        }
        if (z.flags!.has('spikes')) {
          g.fillStyle(0xd4f7ff, 0.8 * a);
          for (let k = 0; k < 10; k++) {
            const ang = k * 2.4 + 0.5;
            const rr = r * (0.3 + ((k * 37) % 60) / 100);
            const px = z.x + Math.cos(ang) * rr;
            const py = z.y + Math.sin(ang) * rr;
            const h = 3 + ((Math.floor(t * 4) + k) % 3);
            g.fillTriangle(px - 2, py, px + 2, py, px, py - h);
          }
        }
        break;
      }
      case 'bloodTrail': {
        g.lineStyle(z.radius * 2, 0x8a1022, 0.45 * a);
        g.lineBetween(z.x, z.y, z.x2 ?? z.x, z.y2 ?? z.y);
        g.lineStyle(Math.max(1, z.radius * 0.8), 0xff3344, 0.5 * a * (0.7 + 0.3 * Math.sin(t * 8)));
        g.lineBetween(z.x, z.y, z.x2 ?? z.x, z.y2 ?? z.y);
        break;
      }
      case 'curse': {
        const armed = z.t >= (z.armDelay ?? 0);
        const r = z.radius;
        if (!armed) {
          const p = z.t / (z.armDelay ?? 1);
          g.lineStyle(1, 0xff3355, 0.9);
          g.strokeCircle(z.x, z.y, r);
          g.fillStyle(0xff3355, 0.12 + 0.2 * p);
          g.fillCircle(z.x, z.y, r * p);
        } else {
          g.fillStyle(0x3a0a14, 0.55 * a);
          g.fillCircle(z.x, z.y, r);
          g.fillStyle(0x7a2f6e, 0.4 * a);
          g.fillCircle(z.x, z.y, r * (0.7 + 0.08 * Math.sin(t * 5)));
          g.lineStyle(1, 0xff3355, 0.8 * a);
          g.strokeCircle(z.x, z.y, r);
        }
        void life;
        break;
      }
    }
  }

  clear(): void {
    for (const z of this.zones) {
      z.gfx.clear().setVisible(false);
      this.pool.push(z.gfx);
    }
    this.zones.length = 0;
  }
}
