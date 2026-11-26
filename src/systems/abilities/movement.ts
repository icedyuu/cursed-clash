/** Blood Rush: a dash that damages everything along its path. */
import type { Behavior } from './context';
import type { Enemy } from '../../entities/Enemy';
import { distToSegment } from '../../core/math';
import { audio } from '../../game/AudioManager';

const tmp: Enemy[] = [];

export const dashStrikeBehavior: Behavior = ({ w, p, params, flags, angle, inst }) => {
  const range = params.range ?? 110;
  const dur = params.duration ?? 0.18;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // stop at obstacles
  let len = 0;
  for (let s = 4; s <= range; s += 4) {
    if (w.isBlocked(p.x + dx * s, p.y + dy * s, 5)) break;
    len = s;
  }
  const sx = p.x;
  const sy = p.y;
  const ex = p.x + dx * len;
  const ey = p.y + dy * len;
  p.forcedMove = { vx: (dx * len) / dur, vy: (dy * len) / dur, until: w.time + dur };
  p.invulnUntil = w.time + dur + 0.15;
  audio.play(inst.def.sfx);
  w.effects.shake(params.shake ?? 0.003, 120);
  const width = params.width ?? 18;
  tmp.length = 0;
  const hitAll = () => {
    tmp.length = 0;
    for (const e of w.enemyGrid.queryCircle((sx + ex) / 2, (sy + ey) / 2, len / 2 + width + 10, tmp)) {
      if (e.dying) continue;
      if (distToSegment(e.x, e.y - 4, sx, sy - 4, ex, ey - 4) > width / 2 + e.radius) continue;
      const nx = -dy;
      const ny = dx;
      const side = (e.x - sx) * nx + (e.y - sy) * ny >= 0 ? 1 : -1;
      w.combat.hitEnemy(e, params.damage ?? 20, { owner: p, abilityId: inst.def.id, knockback: params.knockback ?? 100, dirX: nx * side, dirY: ny * side });
      w.combat.applyBleed(e, params.bleedDps ?? 6, 2.5, p);
    }
  };
  // resolve hits when the dash finishes so enemies visibly get carved
  w.scene.time.delayedCall(dur * 1000 * 0.6, hitAll);
  w.effects.beam(sx, sy - 10, ex, ey - 10, 0xff3344, 6, 0.3);
  w.effects.burst('blood', sx, sy - 8, 12, { angle: angle + Math.PI, spread: 0.6 });
  if (flags.has('trail')) {
    w.zones.add({ kind: 'bloodTrail', owner: p, abilityId: inst.def.id, x: sx, y: sy - 2, x2: ex, y2: ey - 2, radius: 9, duration: 3 * p.stats.duration, bleedDps: (params.bleedDps ?? 6) * 1.2 });
  }
};
