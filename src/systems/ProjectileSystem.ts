/**
 * Moves pooled projectiles and resolves hits through the enemy spatial grid
 * (cheaper than Arcade overlap for hundreds of enemies). Arcade still integrates movement
 * and blocks hostile shots with obstacles.
 */
import Phaser from 'phaser';
import { Projectile, type ProjectileSpec } from '../entities/Projectile';
import type { Enemy } from '../entities/Enemy';
import type { World } from './World';
import { ARENA } from '../game/GameConfig';
import { dist2 } from '../core/math';

export class ProjectileSystem {
  readonly group: Phaser.Physics.Arcade.Group;
  private near: Enemy[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly world: () => World,
  ) {
    this.group = scene.physics.add.group({ classType: Projectile, maxSize: 500, runChildUpdate: false });
  }

  spawn(spec: ProjectileSpec): Projectile | null {
    const p = this.group.get(spec.x, spec.y) as Projectile | null;
    if (!p) return null;
    p.fire(spec);
    return p;
  }

  /** Called by the obstacle overlap: hostile shots break on cover. */
  onObstacle(p: Projectile): void {
    if (p.team === 'enemy' && p.active) {
      this.world().effects.burst('void', p.x, p.y, 4);
      p.expire();
    }
  }

  update(dt: number): void {
    const w = this.world();
    const b = ARENA.bounds;
    for (const obj of this.group.getChildren()) {
      const p = obj as Projectile;
      if (!p.active) continue;
      p.traveled += p.speed * dt;
      if (p.spin) p.rotation += p.spin * dt;
      if (p.homing > 0 && p.team === 'player') this.steer(p, dt, w);
      if (p.trail) {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.03;
          w.effects.burst(p.trail, p.x, p.y, 1);
        }
      }
      if (p.traveled >= p.range || p.x < b.x - 20 || p.y < b.y - 40 || p.x > b.x + b.w + 20 || p.y > b.y + b.h + 20) {
        if (p.team === 'player' && p.flags.has('explode') && p.abilityId === 'void_orb') w.combat.explode(p.x, p.y, p.explosionRadius, p.damage * p.explosionDamage, p.owner, p.abilityId);
        p.expire();
        continue;
      }
      if (p.team === 'player') this.hitEnemies(p, w);
      else this.hitPlayers(p, w);
    }
  }

  private steer(p: Projectile, dt: number, w: World): void {
    const target = w.enemyGrid.nearest(p.x, p.y, 160, (e) => !e.dying && !p.hitSet.has(e));
    if (!target) return;
    const body = p.body as Phaser.Physics.Arcade.Body;
    const desired = Math.atan2(target.y - 6 - p.y, target.x - p.x);
    const cur = Math.atan2(body.velocity.y, body.velocity.x);
    const diff = Phaser.Math.Angle.Wrap(desired - cur);
    const turn = Phaser.Math.Clamp(diff, -p.homing * dt, p.homing * dt);
    p.redirect(cur + turn);
  }

  private hitEnemies(p: Projectile, w: World): void {
    this.near.length = 0;
    w.enemyGrid.queryCircle(p.x, p.y, p.radius + 22, this.near);
    for (const e of this.near) {
      if (e.dying || p.hitSet.has(e)) continue;
      const r = p.radius + e.radius;
      if (dist2(p.x, p.y, e.x, e.y - e.radius * 0.6) > r * r) continue;
      p.hitSet.add(e);
      const angle = p.rotation;
      w.combat.hitEnemy(e, p.damage, {
        owner: p.owner,
        abilityId: p.abilityId,
        knockback: p.knockback,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
      });
      const explodeNow = p.flags.has('explode') && (p.pierce <= 0 || p.flags.has('explodeOnPierce'));
      if (explodeNow) w.combat.explode(p.x, p.y, p.explosionRadius, p.damage * p.explosionDamage, p.owner, p.abilityId, e);
      if (p.flags.has('chain') && p.chainCount > 0) {
        this.chain(p, e, w);
        return;
      }
      if (p.pierce > 0) {
        p.pierce--;
        continue;
      }
      w.effects.burst(p.trail ?? 'spark', p.x, p.y, 5);
      p.expire();
      return;
    }
  }

  /** Void Chain: the orb re-targets the nearest unhit enemy. */
  private chain(p: Projectile, from: Enemy, w: World): void {
    const next = w.enemyGrid.nearest(from.x, from.y, p.chainRange, (e) => !e.dying && !p.hitSet.has(e));
    p.chainCount--;
    if (!next) {
      p.expire();
      return;
    }
    w.effects.beam(from.x, from.y - 6, next.x, next.y - 6, 0xe0b3ff, 2, 0.18);
    if (p.flags.has('chainExplode')) w.combat.explode(from.x, from.y, p.explosionRadius * 0.7, p.damage * 0.4, p.owner, p.abilityId, from);
    p.damage *= 0.85;
    p.traveled = 0;
    p.range = p.chainRange * 1.5;
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(from.x, from.y - 6);
    p.redirect(Math.atan2(next.y - 6 - (from.y - 6), next.x - from.x));
  }

  private hitPlayers(p: Projectile, w: World): void {
    for (const pl of w.players) {
      if (!pl.alive) continue;
      const r = p.radius + 5;
      if (dist2(p.x, p.y, pl.x, pl.y - 8) > r * r) continue;
      if (w.combat.hurtPlayer(pl, p.damage, p.x, p.y)) {
        w.effects.burst('void', p.x, p.y, 6);
        p.expire();
        return;
      }
    }
  }

  clear(): void {
    for (const obj of this.group.getChildren()) (obj as Projectile).expire();
  }
}
