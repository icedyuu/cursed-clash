import type { Enemy } from '../../entities/Enemy';
import type { Player } from '../../entities/Player';
import type { World } from '../World';

/** Nearest living player, re-evaluated periodically; hunted players attract nearby enemies. */
export const updateTarget = (e: Enemy, w: World): Player | null => {
  const t = w.time;
  if (e.target && e.target.alive && (e.ai.retargetAt ?? 0) > t) return e.target;
  e.ai.retargetAt = t + 0.6 + w.rng.next() * 0.4;
  let best: Player | null = null;
  let bd = Infinity;
  for (const p of w.players) {
    if (!p.alive) continue;
    let d = Math.hypot(p.x - e.x, p.y - e.y);
    if (p.hunted) d *= 0.7;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  e.target = best;
  return best;
};

export const chase = (e: Enemy, tx: number, ty: number, speed: number): void => {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) {
    e.desiredVx = e.desiredVy = 0;
    return;
  }
  e.desiredVx = (dx / d) * speed;
  e.desiredVy = (dy / d) * speed;
};

/** True if the point is comfortably inside the camera view (used to avoid off-screen attacks). */
export const onScreen = (w: World, x: number, y: number, inset = 12): boolean => {
  const v = w.scene.cameras.main.worldView;
  return x > v.x + inset && x < v.right - inset && y > v.y + inset && y < v.bottom - inset;
};
