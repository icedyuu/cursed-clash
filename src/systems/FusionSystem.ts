/**
 * Always-on fusion abilities that live around the hero:
 * - Void Halo (Voidwalker): orbiting void orbs that shred enemies on contact.
 * - Winter's Embrace (Frost Witch): a blizzard aura that chills and freezes nearby enemies.
 * Shot/strike based fusions live in the ability behaviours; Blood Geyser lives in CombatSystem.
 */
import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { World } from './World';
import { DEPTH } from '../game/GameConfig';

export const HALO = { orbs: 3, radius: 32, spin: 3.2, hitRadius: 10, damage: 11, hitCooldown: 0.45 };
export const AURA = { radius: 54, tick: 0.5, damage: 2.5 };

interface HaloState {
  orbs: Phaser.GameObjects.Sprite[];
  glows: Phaser.GameObjects.Image[];
  angle: number;
}

interface AuraState {
  gfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  timer: number;
  t: number;
}

export class FusionSystem {
  private halos = new Map<Player, HaloState>();
  private auras = new Map<Player, AuraState>();
  /** Per-enemy next time a halo orb may hit it. */
  private haloHitAt = new WeakMap<Enemy, number>();
  private near: Enemy[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: () => World,
  ) {}

  private has(p: Player, ability: string, flag: string): boolean {
    return (p.build.abilityFlags[ability] ?? []).includes(flag);
  }

  update(p: Player, dt: number): void {
    const halo = p.alive && this.has(p, 'void_resonance', 'halo');
    const aura = p.alive && this.has(p, 'frostbite', 'aura');
    if (halo) this.updateHalo(p, dt);
    else this.hideHalo(p);
    if (aura) this.updateAura(p, dt);
    else this.hideAura(p);
  }

  private updateHalo(p: Player, dt: number): void {
    const w = this.world();
    let s = this.halos.get(p);
    if (!s) {
      s = { orbs: [], glows: [], angle: 0 };
      for (let i = 0; i < HALO.orbs; i++) {
        const g = this.scene.add.image(p.x, p.y, 'glow').setTint(0xb05cff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setAlpha(0.8).setDepth(DEPTH.light);
        const o = this.scene.add.sprite(p.x, p.y, 'proj-void-orb', 0).setDepth(DEPTH.projectiles).setScale(0.9);
        if (this.scene.anims.exists('proj-void-orb:loop')) o.play('proj-void-orb:loop');
        s.orbs.push(o);
        s.glows.push(g);
      }
      this.halos.set(p, s);
      w.effects.ring(p.x, p.y - 10, 4, HALO.radius, 0xe0b3ff, 0.4, 3);
    }
    s.angle += HALO.spin * dt;
    const r = HALO.radius * (0.85 + p.stats.area * 0.15);
    const cx = p.x;
    const cy = p.y - 10;
    for (let i = 0; i < s.orbs.length; i++) {
      const a = s.angle + (i / s.orbs.length) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.8;
      s.orbs[i].setVisible(true).setPosition(x, y);
      s.glows[i].setVisible(true).setPosition(x, y);
      if (w.rng.chance(0.35)) w.effects.burst('void', x, y, 1);
      this.near.length = 0;
      for (const e of w.enemyGrid.queryCircle(x, y, HALO.hitRadius + 20, this.near)) {
        if (e.dying) continue;
        const rr = HALO.hitRadius + e.radius;
        const ex = e.x;
        const ey = e.y - e.radius * 0.6;
        if ((ex - x) * (ex - x) + (ey - y) * (ey - y) > rr * rr) continue;
        if ((this.haloHitAt.get(e) ?? 0) > w.time) continue;
        this.haloHitAt.set(e, w.time + HALO.hitCooldown);
        const d = Math.max(1, Math.hypot(ex - cx, ey - cy));
        w.combat.hitEnemy(e, HALO.damage * p.stats.damage, { owner: p, abilityId: 'void_halo', knockback: 55, dirX: (ex - cx) / d, dirY: (ey - cy) / d, noProc: true });
        w.effects.burst('void', x, y, 4);
      }
    }
  }

  private hideHalo(p: Player): void {
    const s = this.halos.get(p);
    if (!s) return;
    s.orbs.forEach((o) => o.destroy());
    s.glows.forEach((g) => g.destroy());
    this.halos.delete(p);
  }

  private updateAura(p: Player, dt: number): void {
    const w = this.world();
    let s = this.auras.get(p);
    if (!s) {
      s = {
        gfx: this.scene.add.graphics().setDepth(DEPTH.zones + 1),
        glow: this.scene.add.image(p.x, p.y, 'glow-big').setTint(0x6fe3ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDepth(DEPTH.light),
        timer: 0,
        t: 0,
      };
      this.auras.set(p, s);
      w.effects.ring(p.x, p.y - 6, 6, AURA.radius, 0xd4f7ff, 0.5, 3);
    }
    s.t += dt;
    const r = AURA.radius * p.stats.area;
    const cx = p.x;
    const cy = p.y - 6;
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 4);
    const g = s.gfx;
    g.clear();
    g.fillStyle(0x6fe3ff, 0.07 + pulse * 0.05);
    g.fillEllipse(cx, cy, r * 2, r * 1.6);
    g.lineStyle(2, 0xd4f7ff, 0.35 + pulse * 0.25);
    g.strokeEllipse(cx, cy, r * 2, r * 1.6);
    // rotating snow "spokes"
    for (let k = 0; k < 6; k++) {
      const a = s.t * 1.5 + (k / 6) * Math.PI * 2;
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(cx + Math.cos(a) * r * 0.85 - 1, cy + Math.sin(a) * r * 0.68 - 1, 2, 2);
    }
    s.glow.setPosition(cx, cy).setScale((r * 2.4) / 128).setVisible(true);
    if (w.rng.chance(0.5)) {
      const a = w.rng.next() * Math.PI * 2;
      const rr = w.rng.next() * r;
      w.effects.burst('frost', cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 1, { angle: a + Math.PI / 2, spread: 0.4 });
    }
    s.timer -= dt;
    if (s.timer > 0) return;
    s.timer = AURA.tick;
    this.near.length = 0;
    for (const e of w.enemyGrid.queryCircle(cx, cy, r + 10, this.near)) {
      if (e.dying) continue;
      const dx = e.x - cx;
      const dy = (e.y - cy) / 0.8;
      if (dx * dx + dy * dy > (r + e.radius) * (r + e.radius)) continue;
      w.combat.hitEnemy(e, AURA.damage * p.stats.damage, { owner: p, abilityId: 'winter_aura', knockback: 0, dirX: 0, dirY: 0, isDot: true });
      if (!e.dying) w.combat.applyFrostbite(p, e, w);
    }
  }

  private hideAura(p: Player): void {
    const s = this.auras.get(p);
    if (!s) return;
    s.gfx.destroy();
    s.glow.destroy();
    this.auras.delete(p);
  }

  clear(): void {
    for (const p of [...this.halos.keys()]) this.hideHalo(p);
    for (const p of [...this.auras.keys()]) this.hideAura(p);
  }
}
