/** XP curve, crystal drops/collection and other pickups. */
import Phaser from 'phaser';
import { Pickup, type PickupKind } from '../entities/Pickup';
import type { Player } from '../entities/Player';
import type { World } from './World';
import { PLAYER_BALANCE } from '../data/balance';
import { gemTextureFor, xpToNext } from '../core/progression';
import { ARENA } from '../game/GameConfig';
import { dist2 } from '../core/math';
import { audio } from '../game/AudioManager';
import { gainFragments } from './abilities/psychic';

export { xpToNext, gemTextureFor };

const MAX_GEMS = 260;

export class XPSystem {
  private pool: Pickup[] = [];
  readonly active: Pickup[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: () => World,
  ) {}

  private obtain(): Pickup {
    const p = this.pool.pop() ?? (this.scene.add.existing(new Pickup(this.scene)) as Pickup);
    this.active.push(p);
    return p;
  }

  private clampToArena(x: number, y: number): [number, number] {
    const b = ARENA.bounds;
    return [Phaser.Math.Clamp(x, b.x + 8, b.x + b.w - 8), Phaser.Math.Clamp(y, b.y + 10, b.y + b.h - 6)];
  }

  dropXp(x: number, y: number, value: number): void {
    if (value <= 0) return;
    const w = this.world();
    let gems = 0;
    for (const p of this.active) if (p.kind === 'xp') gems++;
    if (gems >= MAX_GEMS) {
      // merge into the nearest crystal to keep counts bounded during huge waves
      let best: Pickup | null = null;
      let bd = Infinity;
      for (const p of this.active) {
        if (p.kind !== 'xp' || p.target) continue;
        const d = dist2(x, y, p.x, p.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        best.value += value;
        best.setTexture(gemTextureFor(best.value));
        best.play(`${gemTextureFor(best.value)}:loop`, true);
        return;
      }
    }
    const [cx, cy] = this.clampToArena(x + w.rng.range(-4, 4), y + w.rng.range(-3, 3));
    this.obtain().init('xp', cx, cy, value, gemTextureFor(value), w.time);
  }

  drop(kind: Exclude<PickupKind, 'xp'>, x: number, y: number, reservedFor: 0 | 1 | null = null): Pickup {
    const tex = { heart: 'pickup-heart', chest: 'pickup-chest', magnet: 'pickup-magnet', crown: 'pickup-crown', fragment: 'pickup-fragment' }[kind];
    const [cx, cy] = this.clampToArena(x, y);
    const p = this.obtain();
    p.init(kind, cx, cy, 0, tex, this.world().time);
    p.reservedFor = reservedFor;
    if (reservedFor !== null && kind !== 'fragment') p.setTint(reservedFor === 0 ? 0xd9c2ff : 0xc2ffec);
    else p.clearTint();
    // pop-out arc
    this.scene.tweens.add({ targets: p, y: { from: cy - 10, to: cy }, duration: 350, ease: 'Bounce.easeOut' });
    return p;
  }

  /** Magnet pickup: every crystal on the field flies to `player`. */
  magnetAll(player: Player): void {
    for (const p of this.active) if (p.kind === 'xp') p.target = player;
  }

  update(dt: number): void {
    const w = this.world();
    const players = w.livingPlayers();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      const age = w.time - p.bornAt;
      if (p.kind !== 'xp' && !p.target) p.y = p.baseY + Math.sin(age * 4) * 1.5;
      if (p.target && !p.target.alive) p.target = null;
      if (!p.target) {
        if (age < 0.25) continue;
        let best: Player | null = null;
        let bd = Infinity;
        for (const pl of players) {
          if (p.reservedFor !== null && pl.index !== p.reservedFor) continue;
          // fragments are drawn in when he comes near (auto collection)
          const range = p.kind === 'xp' ? pl.stats.pickupRange : p.kind === 'fragment' ? pl.stats.pickupRange * 0.8 : 14;
          const d = dist2(p.x, p.y, pl.x, pl.y - 6);
          if (d < range * range && d < bd) {
            bd = d;
            best = pl;
          }
        }
        if (!best) continue;
        p.target = best;
        p.speed = 30;
      }
      const t = p.target;
      p.speed = Math.min(PLAYER_BALANCE.xpMagnetSpeed * 1.6, p.speed + PLAYER_BALANCE.xpMagnetSpeed * 3 * dt);
      const dx = t.x - p.x;
      const dy = t.y - 8 - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 7) {
        this.collect(p, t, w);
        this.active.splice(i, 1);
        p.release();
        this.pool.push(p);
        continue;
      }
      p.x += (dx / d) * p.speed * dt;
      p.y += (dy / d) * p.speed * dt;
      p.baseY = p.y;
    }
  }

  private collect(p: Pickup, pl: Player, w: World): void {
    switch (p.kind) {
      case 'xp': {
        const bonus = w.versus ? w.versus.xpBonusFor(pl) : 1;
        const amount = p.value * pl.stats.xpGain * bonus;
        pl.gainXp(amount);
        pl.addUltCharge(p.value * PLAYER_BALANCE.ultPerXp);
        w.effects.burst('xp', pl.x, pl.y - 10, 2);
        audio.play('xp', { pitch: 0.9 + Math.random() * 0.3 });
        break;
      }
      case 'heart':
        pl.heal(pl.stats.maxHp * 0.25 * pl.stats.healing, w);
        w.effects.burst('blood', pl.x, pl.y - 10, 10);
        audio.play('heal');
        break;
      case 'magnet':
        this.magnetAll(pl);
        w.effects.ring(pl.x, pl.y - 8, 6, 60, 0xff3344, 0.4);
        audio.play('chest');
        break;
      case 'chest':
        pl.pendingRewards.push('rare');
        w.effects.burst('gold', p.x, p.y, 30);
        w.effects.ring(p.x, p.y, 4, 36, 0xffd36b, 0.5);
        audio.play('chest');
        break;
      case 'fragment':
        gainFragments(pl, 1, w);
        w.effects.burst('psychic', pl.x, pl.y - 14, 6);
        w.effects.ring(pl.x, pl.y - 14, 3, 12, 0xd9ccff, 0.2, 1);
        audio.play('fragment', { pitch: 0.9 + Math.random() * 0.2 });
        break;
      case 'crown':
        pl.pendingRewards.push('epic');
        pl.heal(pl.stats.maxHp, w);
        w.effects.burst('gold', p.x, p.y, 50);
        w.effects.ring(p.x, p.y, 4, 80, 0xffd36b, 0.8, 3);
        audio.play('synergy');
        w.banner('Crown of the Hollow King', '#ffd36b', w.mode === 'versus' ? `${pl.index === 0 ? 'P1' : 'P2'} claims an Epic blessing` : 'An Epic blessing awaits');
        break;
    }
  }

  clear(): void {
    for (const p of this.active) {
      p.release();
      this.pool.push(p);
    }
    this.active.length = 0;
  }
}
