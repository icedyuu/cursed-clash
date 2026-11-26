/**
 * Tiny software pixel canvas. All procedural sprites are drawn through this so they share
 * the same rules: hard pixels, one shared outline colour, no anti-aliasing.
 */
export type Color = string; // '#rrggbb' or '#rrggbbaa'

const cache = new Map<string, number>();
export const rgba = (c: Color): number => {
  let v = cache.get(c);
  if (v !== undefined) return v;
  const h = c.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; // little-endian ABGR for Uint32 view
  cache.set(c, v);
  return v;
};

export class PixelCanvas {
  readonly data: Uint32Array;
  private readonly image: ImageData;
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Drawing origin offset – lets frame drawers use local coordinates. */
  ox = 0;
  oy = 0;
  /** Clip rect in absolute coords for the active frame. */
  private clip = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.image = this.ctx.createImageData(width, height);
    this.data = new Uint32Array(this.image.data.buffer);
    this.clip = { x: 0, y: 0, w: width, h: height };
  }

  /** Select a frame region; subsequent drawing is local to it and clipped. */
  frame(x: number, y: number, w: number, h: number): this {
    this.ox = x;
    this.oy = y;
    this.clip = { x, y, w, h };
    return this;
  }

  px(x: number, y: number, c: Color | number): void {
    const ax = Math.round(x) + this.ox;
    const ay = Math.round(y) + this.oy;
    if (ax < this.clip.x || ay < this.clip.y || ax >= this.clip.x + this.clip.w || ay >= this.clip.y + this.clip.h) return;
    this.data[ay * this.width + ax] = typeof c === 'number' ? c : rgba(c);
  }

  get(x: number, y: number): number {
    const ax = Math.round(x) + this.ox;
    const ay = Math.round(y) + this.oy;
    if (ax < 0 || ay < 0 || ax >= this.width || ay >= this.height) return 0;
    return this.data[ay * this.width + ax];
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    const v = rgba(c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, v);
  }

  /** Filled ellipse centred at cx,cy. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): void {
    const v = rgba(c);
    const rx2 = Math.max(0.25, rx * rx);
    const ry2 = Math.max(0.25, ry * ry);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1.0) this.px(x, y, v);
      }
    }
  }

  circle(cx: number, cy: number, r: number, c: Color): void {
    this.ellipse(cx, cy, r, r, c);
  }

  ring(cx: number, cy: number, r: number, c: Color, thickness = 1): void {
    const v = rgba(c);
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.5 && d >= r - thickness + 0.5) this.px(x, y, v);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, thickness = 1): void {
    const v = rgba(c);
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (thickness <= 1) this.px(x0, y0, v);
      else {
        const t = Math.floor(thickness / 2);
        for (let j = -t; j < thickness - t; j++) for (let i = -t; i < thickness - t; i++) this.px(x0 + i, y0 + j, v);
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Filled polygon (scanline, even-odd). */
  poly(points: [number, number][], c: Color): void {
    const v = rgba(c);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      const sy = y + 0.5;
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, v);
      }
    }
  }

  /** Adds a 1px outline around every opaque pixel in the current frame. */
  outline(c: Color, diagonal = false): void {
    const v = rgba(c);
    const { x: fx, y: fy, w, h } = this.clip;
    const marks: number[] = [];
    for (let y = fy; y < fy + h; y++) {
      for (let x = fx; x < fx + w; x++) {
        const i = y * this.width + x;
        if (this.data[i] >>> 24 !== 0) continue;
        const n = (xx: number, yy: number): boolean =>
          xx >= fx && yy >= fy && xx < fx + w && yy < fy + h && this.data[yy * this.width + xx] >>> 24 > 200 && this.data[yy * this.width + xx] !== v;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1) || (diagonal && (n(x - 1, y - 1) || n(x + 1, y + 1) || n(x + 1, y - 1) || n(x - 1, y + 1)))) {
          marks.push(i);
        }
      }
    }
    for (const i of marks) this.data[i] = v;
  }

  /** Copies a frame region to another position (for building animation frames from a base). */
  copyFrame(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.data[(dy + y) * this.width + dx + x] = this.data[(sy + y) * this.width + sx + x];
  }

  /** Squashes the current frame vertically toward its bottom (death collapse). */
  squashFrame(factor: number, anchorY: number): void {
    const { x: fx, y: fy, w, h } = this.clip;
    const copy = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) copy[y * w + x] = this.data[(fy + y) * this.width + fx + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.data[(fy + y) * this.width + fx + x] = 0;
    for (let y = 0; y < h; y++) {
      const srcY = Math.round(anchorY - (anchorY - y) / Math.max(0.05, factor));
      if (srcY < 0 || srcY >= h) continue;
      for (let x = 0; x < w; x++) {
        const v = copy[srcY * w + x];
        if (v >>> 24) this.data[(fy + y) * this.width + fx + x] = v;
      }
    }
  }

  /** Removes pixels by a deterministic noise threshold, tinting the survivors' edges. */
  dissolveFrame(t: number, ember: Color, seed = 1): void {
    if (t <= 0) return;
    const { x: fx, y: fy, w, h } = this.clip;
    const e = rgba(ember);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (fy + y) * this.width + fx + x;
        if (!(this.data[i] >>> 24)) continue;
        const n = hash2(x, y, seed);
        // Dissolve from the top down a little faster.
        const bias = (1 - y / h) * 0.25;
        if (n < t + bias - 0.12) this.data[i] = 0;
        else if (n < t + bias) this.data[i] = e;
      }
    }
  }

  /** Replace colour a with b inside the current frame (palette swaps). */
  swap(a: Color, b: Color): void {
    const va = rgba(a);
    const vb = rgba(b);
    const { x: fx, y: fy, w, h } = this.clip;
    for (let y = fy; y < fy + h; y++) for (let x = fx; x < fx + w; x++) if (this.data[y * this.width + x] === va) this.data[y * this.width + x] = vb;
  }

  commit(): HTMLCanvasElement {
    this.ctx.putImageData(this.image, 0, 0);
    return this.canvas;
  }
}

export const hash2 = (x: number, y: number, seed = 0): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
