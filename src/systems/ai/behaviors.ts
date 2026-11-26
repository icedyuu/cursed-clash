/** Enemy AI behaviours. Each reads tuning from EnemyDef.ai_params. */
import type { Enemy } from '../../entities/Enemy';
import type { World } from '../World';
import type { EnemyAi } from '../../data/types';
import { chase, onScreen, updateTarget } from './common';
import { inArc, distToSegment } from '../../core/math';
import { audio } from '../../game/AudioManager';

type Ai = (e: Enemy, dt: number, w: World) => void;

const speedOf = (e: Enemy): number => e.def.speed * e.speedMult;

/** Cursed Slime: hops toward the nearest player. */
const hop: Ai = (e, _dt, w) => {
  const p = updateTarget(e, w);
  if (!p) return void (e.desiredVx = e.desiredVy = 0);
  e.ai.phase ??= w.rng.next() * Math.PI * 2;
  const period = e.def.ai_params.hopPeriod ?? 0.9;
  const s = Math.sin(e.ai.phase + (w.time * Math.PI * 2) / period);
  chase(e, p.x, p.y, speedOf(e) * (0.3 + 1.1 * Math.max(0, s)));
};

/** Shadow Wraith: swoops in from the side instead of straight on. */
const flank: Ai = (e, _dt, w) => {
  const p = updateTarget(e, w);
  if (!p) return void (e.desiredVx = e.desiredVy = 0);
  e.ai.side ??= w.rng.chance(0.5) ? 1 : -1;
  e.ai.offset ??= 0.6 + w.rng.next() * 0.8;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const blend = e.def.ai_params.flankBlend ?? 120;
  const k = Math.min(1, Math.max(0, (d - 30) / blend));
  const fd = (e.def.ai_params.flankDistance ?? 70) * e.ai.offset * k;
  const tx = p.x + (-dy / d) * fd * e.ai.side;
  const ty = p.y + (dx / d) * fd * e.ai.side + Math.sin(w.time * 5 + e.ai.offset * 10) * 6;
  chase(e, tx, ty, speedOf(e));
  const anim = d < 34 ? 'attack' : 'move';
  const key = `${e.animBase}:${anim}`;
  if (e.anims.currentAnim?.key !== key) e.play(key, true);
};

/** Bone Knight: slow advance, telegraphed heavy cleave. */
const brute: Ai = (e, _dt, w) => {
  const p = updateTarget(e, w);
  const ap = e.def.ai_params;
  const t = w.time;
  if (e.ai.state === 1) {
    // winding up – stand still and let the telegraph play
    e.desiredVx = e.desiredVy = 0;
    return;
  }
  if (!p) return void (e.desiredVx = e.desiredVy = 0);
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < (ap.attackRange ?? 36) && t >= (e.ai.readyAt ?? 0) && !e.isFrozenAt(t)) {
    e.ai.state = 1;
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.setFlipX(Math.cos(angle) < 0);
    e.play(`${e.animBase}:windup`, true);
    audio.play('telegraph', { volume: 0.5 });
    w.telegraphs.add({
      shape: 'arc',
      x: e.x,
      y: e.y - 6,
      radius: ap.reach ?? 40,
      angle,
      arc: ap.arc ?? 2.2,
      dur: ap.windup ?? 0.75,
      color: 0x66ffcc,
      onDone: (tg) => {
        e.ai.state = 0;
        e.ai.readyAt = w.time + (ap.cooldown ?? 2.4);
        if (e.dying || !e.active || e.isFrozenAt(w.time)) return;
        e.play(`${e.animBase}:strike`, true);
        e.once('animationcomplete', () => !e.dying && e.play(`${e.animBase}:move`, true));
        audio.play('knight_slam');
        w.effects.slash(tg.x, tg.y, tg.angle!, tg.arc!, tg.radius, 0x66ffcc, 0.18, 5);
        for (const pl of w.players) {
          if (pl.alive && inArc(tg.x, tg.y, tg.angle!, tg.arc! / 2, tg.radius, pl.x, pl.y - 6, 5)) w.combat.hurtPlayer(pl, e.def.attackDamage * e.damageMult, e.x, e.y, { knockback: 200 });
        }
      },
    });
    e.desiredVx = e.desiredVy = 0;
    return;
  }
  chase(e, p.x, p.y, speedOf(e));
};

/** Void Caster: keeps its distance and fires slow, telegraphed bolts – only while on screen. */
const kite: Ai = (e, dt, w) => {
  const p = updateTarget(e, w);
  if (!p) return void (e.desiredVx = e.desiredVy = 0);
  const ap = e.def.ai_params;
  const range = ap.preferredRange ?? 140;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.ai.strafe ??= w.rng.chance(0.5) ? 1 : -1;
  e.ai.strafeSwap = (e.ai.strafeSwap ?? 2) - dt;
  if (e.ai.strafeSwap <= 0) {
    e.ai.strafe *= -1;
    e.ai.strafeSwap = 1.5 + w.rng.next() * 2;
  }
  const s = speedOf(e);
  if (e.ai.casting) {
    e.desiredVx = e.desiredVy = 0;
  } else if (d > range * 1.2) chase(e, p.x, p.y, s);
  else if (d < range * 0.75) {
    e.desiredVx = (-dx / d) * s;
    e.desiredVy = (-dy / d) * s;
  } else {
    e.desiredVx = (-dy / d) * s * 0.7 * e.ai.strafe;
    e.desiredVy = (dx / d) * s * 0.7 * e.ai.strafe;
  }
  e.ai.castTimer = (e.ai.castTimer ?? 1 + w.rng.next() * 2) - dt;
  if (e.ai.castTimer <= 0 && !e.ai.casting && d < range * 1.8 && onScreen(w, e.x, e.y) && !e.isFrozenAt(w.time)) {
    e.ai.casting = 1;
    e.ai.castTimer = ap.castInterval ?? 2.8;
    const angle = Math.atan2(p.y - 8 - (e.y - 14), p.x - e.x);
    e.setFlipX(dx < 0);
    e.play(`${e.animBase}:cast`, true);
    w.telegraphs.add({
      shape: 'line',
      x: e.x,
      y: e.y - 14,
      angle,
      length: 70,
      width: 6,
      radius: 0,
      dur: ap.windup ?? 0.6,
      color: 0xff3377,
      onDone: () => {
        e.ai.casting = 0;
        if (e.dying || !e.active || e.isFrozenAt(w.time)) return;
        e.play(`${e.animBase}:move`, true);
        audio.play('enemy_shoot');
        w.projectiles.spawn({
          texture: 'proj-enemy-bolt',
          team: 'enemy',
          owner: null,
          abilityId: 'enemy_bolt',
          x: e.x + Math.cos(angle) * 6,
          y: e.y - 14,
          angle,
          speed: ap.boltSpeed ?? 105,
          range: 320,
          radius: 4,
          damage: e.def.attackDamage * e.damageMult,
          knockback: 0,
          pierce: 0,
          trail: 'void',
        });
      },
    });
  }
};

/** Elite Abomination: chases and rotates charge / slam / burst attacks. */
const elite: Ai = (e, dt, w) => {
  const p = updateTarget(e, w);
  const ap = e.def.ai_params;
  const t = w.time;
  if (e.ai.charging) {
    // moving along the telegraphed line
    e.desiredVx = e.ai.cvx;
    e.desiredVy = e.ai.cvy;
    e.ai.chargeLeft -= dt;
    w.effects.burst('flesh', e.x, e.y - 4, 1);
    for (const pl of w.players) {
      if (pl.alive && distToSegment(pl.x, pl.y, e.x - e.ai.cvx * 0.05, e.y - e.ai.cvy * 0.05, e.x, e.y) < e.radius + 8) w.combat.hurtPlayer(pl, e.def.attackDamage * e.damageMult, e.x, e.y, { knockback: 260 });
    }
    if (e.ai.chargeLeft <= 0) {
      e.ai.charging = 0;
      e.play(`${e.animBase}:move`, true);
    }
    return;
  }
  if (e.ai.busy) {
    e.desiredVx = e.desiredVy = 0;
    return;
  }
  if (!p) return void (e.desiredVx = e.desiredVy = 0);
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  e.ai.next ??= t + 2;
  if (t >= e.ai.next && onScreen(w, e.x, e.y, 0) && !e.isFrozenAt(t)) {
    e.ai.next = t + (ap.attackCooldown ?? 3.2);
    const choice = d < (ap.slamRadius ?? 60) * 0.9 ? 'slam' : w.rng.pick(['charge', 'burst', d < 120 ? 'slam' : 'charge'] as const);
    e.ai.busy = 1;
    e.play(`${e.animBase}:windup`, true);
    audio.play('elite_roar', { volume: 0.6 });
    if (choice === 'charge') {
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      const len = Math.min(200, d + 60);
      w.telegraphs.add({
        shape: 'line',
        x: e.x,
        y: e.y - 4,
        angle,
        length: len,
        width: e.radius * 2 + 6,
        radius: 0,
        dur: ap.chargeWindup ?? 0.9,
        color: 0xff66cc,
        onDone: () => {
          e.ai.busy = 0;
          if (e.dying || e.isFrozenAt(w.time)) return;
          const sp = ap.chargeSpeed ?? 260;
          e.ai.charging = 1;
          e.ai.cvx = Math.cos(angle) * sp;
          e.ai.cvy = Math.sin(angle) * sp;
          e.ai.chargeLeft = len / sp;
          e.play(`${e.animBase}:attack`, true);
        },
      });
    } else if (choice === 'slam') {
      w.telegraphs.add({
        shape: 'circle',
        x: e.x,
        y: e.y - 4,
        radius: ap.slamRadius ?? 62,
        dur: ap.slamWindup ?? 1,
        color: 0xff66cc,
        onUpdate: (tg) => {
          tg.x = e.x;
          tg.y = e.y - 4;
        },
        onDone: (tg) => {
          e.ai.busy = 0;
          if (e.dying || e.isFrozenAt(w.time)) return;
          e.play(`${e.animBase}:attack`, true);
          e.once('animationcomplete', () => !e.dying && e.play(`${e.animBase}:move`, true));
          audio.play('boss_slam', { volume: 0.7 });
          w.effects.ring(tg.x, tg.y, 8, tg.radius, 0xff66cc, 0.35, 4);
          w.effects.burst('flesh', tg.x, tg.y, 30);
          w.effects.shake(0.006, 200);
          for (const pl of w.players) if (pl.alive && Math.hypot(pl.x - tg.x, pl.y - tg.y) < tg.radius) w.combat.hurtPlayer(pl, e.def.attackDamage * e.damageMult, tg.x, tg.y, { knockback: 240 });
        },
      });
    } else {
      w.telegraphs.add({
        shape: 'ring',
        x: e.x,
        y: e.y - 10,
        radius: 26,
        inner: 18,
        dur: 0.7,
        color: 0xff3377,
        onUpdate: (tg) => {
          tg.x = e.x;
          tg.y = e.y - 10;
        },
        onDone: () => {
          e.ai.busy = 0;
          if (e.dying || e.isFrozenAt(w.time)) return;
          e.play(`${e.animBase}:attack`, true);
          e.once('animationcomplete', () => !e.dying && e.play(`${e.animBase}:move`, true));
          audio.play('enemy_shoot', { pitch: 0.6 });
          const n = ap.burstCount ?? 10;
          const off = w.rng.next();
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            w.projectiles.spawn({
              texture: 'proj-enemy-bolt',
              team: 'enemy',
              owner: null,
              abilityId: 'elite_burst',
              x: e.x,
              y: e.y - 10,
              angle: a,
              speed: 90,
              range: 260,
              radius: 4,
              damage: e.def.attackDamage * 0.5 * e.damageMult,
              knockback: 0,
              pierce: 0,
            });
          }
        },
      });
    }
    e.desiredVx = e.desiredVy = 0;
    return;
  }
  chase(e, p.x, p.y, speedOf(e));
};

export const AI: Record<Exclude<EnemyAi, 'boss'>, Ai> = { hop, flank, brute, kite, elite };
