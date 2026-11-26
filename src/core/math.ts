/** Small, dependency-free math helpers shared by gameplay systems. */
export interface Vec2 {
  x: number;
  y: number;
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt(dist2(ax, ay, bx, by));

/** Normalises a vector; returns {0,0} for a zero vector. */
export const normalize = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
};

/** Movement input normalisation: diagonals are never faster than cardinals, analog magnitude is kept. */
export const normalizeMovement = (x: number, y: number): Vec2 => {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
};

/** Exponential damping that is frame-rate independent. */
export const damp = (current: number, target: number, smoothing: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-smoothing * dt));

export const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** True if point (px,py) lies in the circular sector at (cx,cy) facing `angle` with half-width `halfArc`. */
export const inArc = (
  cx: number,
  cy: number,
  angle: number,
  halfArc: number,
  radius: number,
  px: number,
  py: number,
  padding = 0,
): boolean => {
  const d = dist(cx, cy, px, py);
  if (d > radius + padding) return false;
  if (d < padding + 4) return true;
  return Math.abs(angleDiff(angle, Math.atan2(py - cy, px - cx))) <= halfArc;
};

/** Distance from point to segment, used for line telegraphs and dash strikes. */
export const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  return dist(px, py, ax + abx * t, ay + aby * t);
};

export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};
