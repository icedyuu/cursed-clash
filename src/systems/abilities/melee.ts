/** Melee arcs: Reaper Strike, Crimson Slash (+Twin Fang, Crimson Wave, Hemorrhage). */
import type { Behavior, CastContext } from './context';
import type { Enemy } from '../../entities/Enemy';
import { inArc } from '../../core/math';
import { audio } from '../../game/AudioManager';

const tmp: Enemy[] = [];

const swing = (c: CastContext, angle: number, mult = 1): void => {
  const { w, p, params, flags, inst } = c;
  const range = (params.range ?? 30) * (1 + (p.stats.area - 1) * 0.6);
  const arc = params.arc ?? 1.8;
  const cx = p.x;
  const cy = p.y - 10;
  w.effects.slash(cx, cy, angle, arc, range, inst.def.slot === 'basic' ? 0xff3344 : 0xff8a8a, inst.def.slot === 'basic' ? 0.14 : 0.2, inst.def.slot === 'basic' ? 4 : 7);
  tmp.length = 0;
  let hits = 0;
  for (const e of w.enemyGrid.queryCircle(cx, cy, range + 20, tmp)) {
    if (e.dying) continue;
    if (!inArc(cx, cy, angle, arc / 2, range, e.x, e.y - e.radius * 0.5, e.radius)) continue;
    const d = Math.max(1, Math.hypot(e.x - cx, e.y - cy));
    w.combat.hitEnemy(e, (params.damage ?? 10) * mult, { owner: p, abilityId: inst.def.id, knockback: params.knockback ?? 60, dirX: (e.x - cx) / d, dirY: (e.y - cy) / d });
    if (flags.has('bleed')) w.combat.applyBleed(e, params.bleedDps ?? 4, 3, p);
    hits++;
  }
  if (hits > 0 && inst.def.slot !== 'basic') w.hitStop(40);
  if (flags.has('wave')) {
    w.projectiles.spawn({
      texture: 'proj-blood-wave',
      team: 'player',
      owner: p,
      abilityId: `${inst.def.id}_wave`,
      x: cx + Math.cos(angle) * 10,
      y: cy + Math.sin(angle) * 10,
      angle,
      speed: params.speed ?? 220,
      range: 150,
      radius: inst.def.slot === 'basic' ? 7 : 10,
      damage: (params.damage ?? 10) * (params.waveDamage ?? 0.5) * mult,
      knockback: 40,
      pierce: flags.has('wavePierce') ? 99 : inst.def.slot === 'basic' ? 1 : 3,
      trail: 'blood',
      scale: inst.def.slot === 'basic' ? 0.7 : 1,
    });
  }
};

export const meleeBehavior: Behavior = (c) => {
  const { w, p, params, flags, angle, inst } = c;
  swing(c, angle);
  audio.play(inst.def.sfx, { pitch: 0.9 + Math.random() * 0.2 });
  if (params.shake) w.effects.shake(params.shake, 100);
  if (flags.has('twin')) {
    w.scene.time.delayedCall(140, () => {
      if (!p.alive) return;
      swing(c, angle + Math.PI, 0.8);
      audio.play(inst.def.sfx, { pitch: 1.15 });
    });
  }
};
