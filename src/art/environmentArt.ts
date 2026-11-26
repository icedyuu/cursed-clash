/** Arena floor, walls and props. The arena layout is mirrored so versus is fair. */
import { PixelCanvas, hash2 } from './pixel';
import { PAL } from './palette';
import { ARENA } from '../game/GameConfig';
import type { SimpleSheet } from './effectArt';

const TILE = 16;

export const generateArenaFloor = (): HTMLCanvasElement => {
  const { width: W, height: H, bounds } = ARENA;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, PAL.floor1);
  // stone tiles
  for (let ty = 0; ty < H / TILE; ty++) {
    for (let tx = 0; tx < W / (TILE * 2) + 2; tx++) {
      const x = tx * TILE * 2 + (ty % 2 ? TILE : 0) - TILE;
      const y = ty * TILE;
      const n = hash2(tx, ty, 3);
      const base = n < 0.45 ? PAL.floor1 : n < 0.8 ? PAL.floor2 : PAL.floor3;
      // offset every other row for a brick-ish layout
      p.rect(x, y, TILE * 2, TILE, base);
      p.rect(x, y, TILE * 2, 1, PAL.floor0);
      p.rect(x, y, 1, TILE, PAL.floor0);
      if (n > 0.7) p.rect(x + 1, y + 1, TILE * 2 - 2, 1, PAL.floor3);
      // speckles
      for (let i = 0; i < 3; i++) {
        const sx = Math.floor(hash2(tx, ty, 10 + i) * 30) + 1;
        const sy = Math.floor(hash2(tx, ty, 20 + i) * 14) + 1;
        p.px(x + sx, y + sy, hash2(tx, ty, 30 + i) > 0.5 ? PAL.floor0 : PAL.floor3);
      }
      // cracks
      if (hash2(tx, ty, 7) > 0.86) {
        let cx = x + 3 + Math.floor(hash2(tx, ty, 8) * 10);
        let cy = y + 2;
        for (let i = 0; i < 10; i++) {
          p.px(cx, cy, PAL.floor0);
          cx += hash2(tx + i, ty, 9) > 0.5 ? 1 : -1;
          cy += 1;
        }
      }
    }
  }
  // moss creeping from the walls (noise blobs)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x - bounds.x, bounds.x + bounds.w - x, y - bounds.y, bounds.y + bounds.h - y);
      const n = hash2(x >> 2, y >> 2, 77) * 0.6 + hash2(x >> 3, y >> 3, 78) * 0.4;
      if (edge < 70 && n > 0.62 + edge / 220) p.px(x, y, n > 0.8 ? PAL.moss2 : PAL.moss);
    }
  }
  // central summoning circle
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  p.ring(cx, cy, 118, PAL.void1, 3);
  p.ring(cx, cy, 112, PAL.void2, 1);
  p.ring(cx, cy, 80, PAL.void1, 2);
  p.ring(cx, cy, 30, PAL.void2, 2);
  const pts: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 7;
    pts.push([cx + Math.cos(a) * 110, cy + Math.sin(a) * 110]);
  }
  for (let i = 0; i < 7; i++) {
    const a = pts[i];
    const b = pts[(i + 3) % 7];
    p.line(a[0], a[1], b[0], b[1], PAL.void1);
  }
  for (let i = 0; i < 28; i++) {
    const a = (i * Math.PI * 2) / 28;
    const rx = cx + Math.cos(a) * 96;
    const ry = cy + Math.sin(a) * 96;
    // tiny rune glyphs
    p.rect(rx - 1, ry - 2, 3, 1, PAL.rune);
    p.px(rx + (i % 3) - 1, ry - 1, PAL.rune);
    p.rect(rx - 1, ry + (i % 2), 3, 1, PAL.void3);
  }
  // blood & bones decals (mirrored)
  const decal = (x: number, y: number, seed: number) => {
    const kind = hash2(seed, 1, 5);
    if (kind < 0.45) {
      p.ellipse(x, y, 7 + kind * 8, 3 + kind * 4, '#3a0a1477');
      p.ellipse(x + 3, y + 1, 3, 2, '#4a0d1a88');
    } else {
      p.line(x - 4, y, x + 4, y + 2, PAL.boneDark);
      p.px(x - 5, y - 1, PAL.boneShade);
      p.px(x + 5, y + 3, PAL.boneShade);
      p.circle(x + 7, y - 2, 2, PAL.boneShade);
      p.px(x + 7, y - 2, PAL.outline);
    }
  };
  for (let i = 0; i < 14; i++) {
    const x = bounds.x + 30 + hash2(i, 2, 91) * (bounds.w / 2 - 60);
    const y = bounds.y + 30 + hash2(i, 3, 92) * (bounds.h - 60);
    decal(x, y, i);
    decal(bounds.x + bounds.w - (x - bounds.x), y, i);
  }
  // ── walls ──
  // top wall face (3/4 view)
  p.rect(0, 0, W, bounds.y, '#140f1f');
  for (let y = 8; y < bounds.y - 4; y += 8) {
    const off = (y / 8) % 2 === 0 ? 0 : 8;
    for (let x = -off; x < W; x += 16) {
      p.rect(x + 1, y + 1, 14, 6, hash2(x, y, 4) > 0.5 ? '#2a2238' : '#251e33');
      p.rect(x + 1, y + 1, 14, 1, '#3a3050');
    }
  }
  p.rect(0, 0, W, 8, '#0b0714');
  p.rect(0, 7, W, 1, '#3a3050');
  p.rect(0, bounds.y - 4, W, 4, '#0b0714');
  // arched alcoves with void light
  for (let i = 0; i < 6; i++) {
    const ax = bounds.x + 90 + i * ((bounds.w - 180) / 5);
    p.rect(ax - 8, 14, 16, 30, '#0b0714');
    p.ellipse(ax, 15, 8, 6, '#0b0714');
    p.rect(ax - 5, 20, 10, 22, '#2d1650');
    p.ellipse(ax, 20, 5, 4, '#2d1650');
    p.rect(ax - 2, 26, 4, 14, '#5b2a9e');
    p.px(ax, 30, PAL.void6);
  }
  // side + bottom rims (top surface)
  const rim = (x: number, y: number, w: number, h: number) => {
    p.rect(x, y, w, h, '#0e0a18');
    for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) if (hash2(xx, yy, 12) > 0.6) p.rect(xx + 1, yy + 1, 6, 6, '#181226');
  };
  rim(0, bounds.y, bounds.x, H - bounds.y);
  rim(bounds.x + bounds.w, bounds.y, W - bounds.x - bounds.w, H - bounds.y);
  rim(0, bounds.y + bounds.h, W, H - bounds.y - bounds.h);
  p.rect(bounds.x - 1, bounds.y, 1, bounds.h, '#3a3050');
  p.rect(bounds.x + bounds.w, bounds.y, 1, bounds.h, '#3a3050');
  p.rect(bounds.x - 1, bounds.y + bounds.h, bounds.w + 2, 1, '#3a3050');
  // floor shadow under top wall
  for (let i = 0; i < 6; i++) p.rect(bounds.x, bounds.y + i, bounds.w, 1, `#05020a${(160 - i * 25).toString(16).padStart(2, '0')}`);
  return p.commit();
};

const one = (key: string, w: number, h: number, frames: number, draw: (p: PixelCanvas, f: number) => void, rate = 8): SimpleSheet => {
  const p = new PixelCanvas(w * frames, h);
  for (let f = 0; f < frames; f++) {
    p.frame(f * w, 0, w, h);
    draw(p, f);
    p.outline(PAL.outline);
  }
  p.frame(0, 0, p.width, p.height);
  return { key, canvas: p.commit(), frameWidth: w, frameHeight: h, frames, rate };
};

export const generatePropSheets = (): SimpleSheet[] => [
  one('prop-pillar', 26, 52, 1, (p) => {
    p.rect(1, 42, 24, 9, '#2a2238');
    p.rect(1, 42, 24, 2, '#3a3050');
    p.rect(4, 10, 18, 33, '#2b2440');
    p.rect(4, 10, 4, 33, '#1d1829');
    p.rect(18, 10, 3, 33, '#3a3050');
    for (let y = 14; y < 42; y += 6) p.rect(9, y, 1, 4, '#1d1829');
    p.rect(2, 4, 22, 7, '#2a2238');
    p.rect(2, 4, 22, 2, '#3a3050');
    // broken top
    p.rect(2, 3, 6, 1, '#3a3050');
    p.rect(14, 2, 8, 2, '#3a3050');
    // crystal vein
    p.line(13, 16, 15, 28, PAL.void4);
    p.line(15, 28, 12, 36, PAL.void4);
    p.px(14, 22, PAL.void6);
    // ivy
    for (let y = 12; y < 40; y += 2) p.px(5 + ((y * 7) % 3), y, PAL.moss2);
  }),
  one('prop-statue', 32, 50, 1, (p) => {
    p.rect(4, 40, 24, 9, '#2a2238');
    p.rect(4, 40, 24, 2, '#3a3050');
    p.poly([[9, 40], [23, 40], [20, 18], [12, 18]], '#4a4560');
    p.poly([[9, 40], [13, 40], [14, 18], [12, 18]], '#35314a');
    p.ellipse(16, 14, 5, 6, '#4a4560');
    p.ellipse(17, 15, 3, 4, '#25213a');
    p.px(18, 14, PAL.void6);
    // broken wings
    p.poly([[11, 20], [2, 10], [4, 22], [9, 28]], '#57526e');
    p.poly([[21, 20], [28, 14], [27, 20]], '#57526e');
    p.line(14, 24, 18, 24, '#35314a');
  }),
  one('prop-grave', 16, 20, 1, (p) => {
    p.rect(2, 16, 12, 3, '#1d1829');
    p.rect(3, 6, 10, 11, '#3a3550');
    p.ellipse(8, 6, 5, 4, '#3a3550');
    p.rect(3, 6, 2, 11, '#2b2740');
    p.rect(7, 6, 2, 8, '#24203a');
    p.rect(5, 8, 6, 2, '#24203a');
    p.px(11, 14, PAL.moss2);
    p.px(10, 15, PAL.moss2);
  }),
  one('prop-brazier', 18, 28, 4, (p, f) => {
    p.rect(8, 14, 2, 12, PAL.steel2);
    p.rect(4, 25, 10, 2, PAL.steel1);
    p.poly([[2, 10], [16, 10], [13, 15], [5, 15]], PAL.steel2);
    p.rect(2, 10, 14, 1, PAL.steel3);
    const fl = [0, 1, 2, 1][f];
    p.poly([[4, 10], [14, 10], [11 + fl, 3 - fl], [9, 6], [7 - fl, 1 + fl]], PAL.void4);
    p.poly([[6, 10], [12, 10], [10, 4], [8, 6]], PAL.void6);
    p.px(9, 8, PAL.white);
  }, 8),
  one('prop-crystal', 18, 22, 1, (p) => {
    p.poly([[3, 21], [5, 8], [8, 21]], PAL.void3);
    p.poly([[6, 21], [9, 2], [13, 21]], PAL.void4);
    p.poly([[11, 21], [14, 10], [16, 21]], PAL.void3);
    p.line(9, 4, 9, 19, PAL.void6);
    p.rect(2, 20, 15, 2, '#1d1829');
  }),
  one('prop-candles', 14, 12, 3, (p, f) => {
    const flick = [0, 1, 0][f];
    for (const [x, h] of [
      [2, 6],
      [6, 9],
      [10, 5],
    ] as [number, number][]) {
      p.rect(x, 12 - h, 2, h, PAL.bone);
      p.px(x, 11 - h - flick, PAL.gold2);
      p.px(x + 1, 10 - h, PAL.gold3);
    }
  }, 6),
];

/** Obstacle layout (mirrored horizontally). Positions are the base centre of each prop. */
export interface PropPlacement {
  key: string;
  x: number;
  y: number;
  solid: boolean;
  /** Collision box size at the prop base. */
  bw: number;
  bh: number;
  light?: number;
}

export const arenaLayout = (): PropPlacement[] => {
  const { bounds } = ARENA;
  const L = bounds.x;
  const T = bounds.y;
  const half: PropPlacement[] = [
    { key: 'prop-pillar', x: L + 230, y: T + 190, solid: true, bw: 20, bh: 10 },
    { key: 'prop-pillar', x: L + 230, y: T + 520, solid: true, bw: 20, bh: 10 },
    { key: 'prop-statue', x: L + 120, y: T + 360, solid: true, bw: 22, bh: 10 },
    { key: 'prop-grave', x: L + 380, y: T + 110, solid: true, bw: 12, bh: 6 },
    { key: 'prop-grave', x: L + 400, y: T + 600, solid: true, bw: 12, bh: 6 },
    { key: 'prop-grave', x: L + 90, y: T + 600, solid: true, bw: 12, bh: 6 },
    { key: 'prop-crystal', x: L + 70, y: T + 120, solid: true, bw: 12, bh: 6, light: 0xb05cff },
    { key: 'prop-brazier', x: L + 440, y: T + 300, solid: true, bw: 10, bh: 6, light: 0xb05cff },
    { key: 'prop-brazier', x: L + 440, y: T + 440, solid: true, bw: 10, bh: 6, light: 0xb05cff },
    { key: 'prop-candles', x: L + 300, y: T + 360, solid: false, bw: 0, bh: 0, light: 0xffd36b },
  ];
  const mirrored = half.map((p) => ({ ...p, x: bounds.x + bounds.w - (p.x - bounds.x) }));
  return [...half, ...mirrored];
};
