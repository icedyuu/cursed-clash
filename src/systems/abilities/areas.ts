/** Placed areas (Black Hole, Event Horizon, Frozen Ground), Blood Moon and Absolute Zero. */
import type { Behavior, CastContext } from './context';
import type { Enemy } from '../../entities/Enemy';
import { ARENA } from '../../game/GameConfig';
import { audio } from '../../game/AudioManager';

const tmp: Enemy[] = [];

/** Mouse users place the area at the cursor (clamped to range); others cast it ahead. */
const targetPoint = (c: CastContext): { x: number; y: number } => {
  const range = c.params.range ?? 120;
  let x: number;
  let y: number;
  if (c.aimPoint) {
    const dx = c.aimPoint.x - c.p.x;
    const dy = c.aimPoint.y - (c.p.y - 8);
    const d = Math.hypot(dx, dy);
    const k = d > range ? range / d : 1;
    x = c.p.x + dx * k;
    y = c.p.y - 8 + dy * k;
  } else {
    x = c.p.x + c.aimX * range * 0.75;
    y = c.p.y - 8 + c.aimY * range * 0.75;
  }
  const b = ARENA.bounds;
  return { x: Math.max(b.x + 10, Math.min(b.x + b.w - 10, x)), y: Math.max(b.y + 10, Math.min(b.y + b.h - 10, y)) };
};

export const gravityWellBehavior: Behavior = (c) => {
  const { w, p, params, flags, inst } = c;
  const pt = targetPoint(c);
  const ult = flags.has('ultimate');
  w.zones.add({
    kind: 'gravity',
    owner: p,
    abilityId: inst.def.id,
    x: pt.x,
    y: pt.y,
    radius: (params.radius ?? 50) * p.stats.area,
    duration: (params.duration ?? 3) * p.stats.duration,
    tickInterval: params.tickInterval,
    tickDamage: params.tickDamage,
    pull: params.pull,
    collapseDamage: params.collapseDamage,
    flags,
  });
  w.effects.ring(pt.x, pt.y, 4, (params.radius ?? 50) * p.stats.area, 0xb05cff, 0.4, ult ? 4 : 2);
  w.effects.flashLight(pt.x, pt.y, 0xb05cff, ult ? 140 : 70, 500);
  if (ult) {
    w.effects.shake(params.shake ?? 0.006, 400);
    w.banner('EVENT HORIZON', '#e0b3ff');
  }
  audio.play(inst.def.sfx);
};

export const groundZoneBehavior: Behavior = (c) => {
  const { w, p, params, flags, inst } = c;
  const pt = targetPoint(c);
  w.zones.add({
    kind: 'frost',
    owner: p,
    abilityId: inst.def.id,
    x: pt.x,
    y: pt.y + 6,
    radius: (params.radius ?? 50) * p.stats.area,
    duration: (params.duration ?? 4) * p.stats.duration,
    slow: params.slow,
    buildup: params.buildup,
    freezeTime: params.freezeTime,
    tickInterval: params.tickInterval,
    tickDamage: (params.tickDamage ?? 0) * p.stats.damage,
    flags,
  });
  w.effects.ring(pt.x, pt.y + 6, 4, (params.radius ?? 50) * p.stats.area, 0xd4f7ff, 0.35, 2);
  w.effects.burst('frost', pt.x, pt.y, 20);
  audio.play(inst.def.sfx);
};

export const buffBehavior: Behavior = ({ w, p, params, inst }) => {
  const dur = (params.duration ?? 8) * p.stats.duration;
  p.addBuff(
    'blood_moon',
    [
      { stat: 'attackSpeed', op: 'mul', value: params.attackSpeedBonus ?? 0.6 },
      { stat: 'damage', op: 'mul', value: params.damageBonus ?? 0.5 },
      { stat: 'lifesteal', op: 'add', value: params.lifestealBonus ?? 0.15 },
      { stat: 'moveSpeed', op: 'mul', value: 0.15 },
    ],
    w.time + dur,
  );
  // the rising moon blasts nearby enemies
  const r = (params.radius ?? 60) * p.stats.area;
  tmp.length = 0;
  for (const e of w.enemyGrid.queryCircle(p.x, p.y, r, tmp)) {
    if (e.dying) continue;
    const d = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y));
    w.combat.hitEnemy(e, (params.damage ?? 30), { owner: p, abilityId: inst.def.id, knockback: 180, dirX: (e.x - p.x) / d, dirY: (e.y - p.y) / d });
    w.combat.applyBleed(e, 8, 4, p);
  }
  w.effects.circle(p.x, p.y - 8, 10, r, 0xff3344, 0.35, 0.5);
  w.effects.ring(p.x, p.y - 8, 8, r * 1.2, 0xff8a8a, 0.5, 4);
  w.effects.burst('blood', p.x, p.y - 10, 50);
  w.effects.shake(0.006, 300);
  w.effects.flashLight(p.x, p.y, 0xff3344, 120, 600);
  w.banner('BLOOD MOON', '#ff3344');
  w.scene.events.emit('blood-moon', p, dur);
  audio.play(inst.def.sfx);
};

export const freezeNovaBehavior: Behavior = ({ w, p, params, inst }) => {
  const r = (params.radius ?? 160) * p.stats.area;
  const delay = (params.duration ?? 0.5) * 1000;
  w.effects.ring(p.x, p.y - 8, r, 6, 0xd4f7ff, delay / 1000, 2);
  w.effects.circle(p.x, p.y - 8, r, 10, 0x6fe3ff, delay / 1000, 0.15);
  audio.play(inst.def.sfx);
  w.banner('ABSOLUTE ZERO', '#d4f7ff');
  w.scene.time.delayedCall(delay, () => {
    if (!p.alive) return;
    tmp.length = 0;
    const cx = p.x;
    const cy = p.y - 8;
    for (const e of w.enemyGrid.queryCircle(cx, cy, r, tmp)) {
      if (e.dying) continue;
      e.freeze(params.freezeTime ?? 3, w.time);
      w.combat.hitEnemy(e, params.damage ?? 60, { owner: p, abilityId: inst.def.id, knockback: 0, dirX: 0, dirY: 0 });
      w.effects.burst('frost', e.x, e.y - 6, 4);
    }
    w.effects.circle(cx, cy, 10, r, 0xd4f7ff, 0.4, 0.55);
    w.effects.ring(cx, cy, 10, r, 0xffffff, 0.5, 4);
    w.effects.burst('frost', cx, cy, 70);
    w.effects.shake(params.shake ?? 0.008, 350);
    w.effects.flashLight(cx, cy, 0x6fe3ff, r, 700, 0.9);
    w.hitStop(80);
  });
};
