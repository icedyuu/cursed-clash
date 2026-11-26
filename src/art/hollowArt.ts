/**
 * Procedural art for THE HOLLOW and The Last Remnant (his wife's psyche).
 *
 * The Hollow: tall, slightly hunched, a smooth featureless head (NO eyes, mouth, nose or
 * expression), long arms with pale hands hanging low, a dark worn coat with a ragged hem
 * and a frayed scarf. Identity comes from posture and faint purple psychic motes.
 *
 * The Remnant: extremely long straight black hair, very pale skin, slender and elegant,
 * eyes closed, an ethereal gown that thins into nothing.
 */
import { PixelCanvas, hash2 } from './pixel';
import { PAL } from './palette';
import type { Pose } from './anims';
import type { SimpleSheet } from './effectArt';
import type { GeneratedSheet } from './characterArt';

const CX = 16;

const COAT0 = '#1a1520';
const COAT1 = '#2e2637';
const COAT2 = '#43384f';
const COAT3 = '#5c4e6a';
const RIM = '#6a58a8';
const SCARF = '#3d3445';
const SCARF2 = '#2a2430';
const TROUSER = '#17141c';
const SHOE = '#0c0a10';
const HEAD_L = '#e0dce6';
const HEAD_M = '#bcb6c6';
const HEAD_S = '#908a9c';
const HEAD_D = '#6b6478';
const HAND = '#c4bfcc';
const HAND_S = '#958fa2';
export const PSY = '#9d86e0';
export const PSY_L = '#d9ccff';

const dir = (a: number, len: number): [number, number] => [Math.cos(a) * len, Math.sin(a) * len];

export const drawHollow = (p: PixelCanvas, pose: Pose): void => {
  const L = pose.lean;
  const B = pose.bob;
  const s = pose.sway;
  // the head drifts a little on its own – an unsettling, listening tilt
  const tiltX = pose.hurt ? -1 : Math.round(Math.sin(pose.t * 0.8) * 0.6);
  const tiltY = pose.glow > 0.5 ? -1 : 0;

  // ── coat tail behind (ragged) ──
  p.poly(
    [
      [CX - 3 + L, 13 + B],
      [CX + 1 + L, 14 + B],
      [CX - 1, 28],
      [CX - 5 - s, 29],
      [CX - 8 - s, 28],
      [CX - 6 - Math.round(s / 2), 22],
    ],
    COAT0,
  );
  // frayed threads on the tail
  for (let i = 0; i < 4; i++) p.px(CX - 7 - s + i * 2, 29 + (i % 2), i % 2 ? COAT1 : COAT0);
  p.px(CX - 8 - s, 29, COAT1);

  // ── legs (thin) ──
  p.line(CX - 1 + Math.round(L / 2), 22, CX - 2 + pose.legL, 28, TROUSER, 2);
  p.line(CX + 2 + Math.round(L / 2), 22, CX + 2 + pose.legR, 28, TROUSER, 2);
  p.rect(CX - 3 + pose.legL, 28, 3, 2, SHOE);
  p.rect(CX + 2 + pose.legR, 28, 3, 2, SHOE);

  // ── long worn coat ──
  const hl = Math.round(L / 2);
  p.poly(
    [
      [CX - 4 + L, 12 + B],
      [CX + 3 + L, 12 + B],
      [CX + 4 + L, 16 + B],
      [CX + 5 + hl, 26],
      [CX + 1 + hl, 25],
      [CX - 1 + hl, 26],
      [CX - 5 + hl, 26],
    ],
    COAT1,
  );
  // shadowed back half + worn front edge
  p.poly(
    [
      [CX - 4 + L, 12 + B],
      [CX - 2 + L, 12 + B],
      [CX - 2 + hl, 26],
      [CX - 5 + hl, 26],
    ],
    COAT0,
  );
  p.line(CX + 3 + L, 13 + B, CX + 5 + hl, 25, COAT2);
  // faint psychic rim light along the front edge
  p.line(CX + 4 + L, 15 + B, CX + 5 + hl, 24, RIM);
  p.line(CX + 1 + L, 15 + B, CX + 1 + hl, 24, COAT0);
  // patches of wear
  p.px(CX + 3 + hl, 21, COAT3);
  p.px(CX - 3 + hl, 19 + B, COAT2);
  p.px(CX + 2 + L, 17 + B, COAT3);
  // ragged hem: bite pixels out of the bottom edge
  for (let x = -5; x <= 5; x++) {
    const n = hash2(x + 40, 7, 3);
    if (n < 0.35) p.px(CX + x + hl, 26, 0);
    else if (n > 0.8) p.px(CX + x + hl, 27, COAT1);
  }
  // belt-wrap
  p.line(CX - 4 + L, 19 + B, CX + 3 + L, 19 + B, SCARF2);

  // ── back arm: long and hanging ──
  p.line(CX - 3 + L, 14 + B, CX - 5 + L, 22 + B, COAT0, 2);
  p.rect(CX - 6 + L, 22 + B, 2, 2, HAND_S);

  // ── scarf / high collar, frayed end trailing ──
  p.rect(CX - 3 + L, 11 + B, 7, 2, SCARF);
  p.line(CX - 3 + L, 12 + B, CX + 3 + L, 12 + B, SCARF2);
  const tail = pose.dash ? 7 : 4 + s;
  for (let i = 0; i < tail; i++) {
    const x = CX - 3 + L - i;
    const y = 12 + B + Math.round(Math.sin(pose.t + i * 0.9) * (i / tail) * 1.5) + Math.round(i * (pose.dash ? 0.1 : 0.45));
    p.px(x, y, i % 3 === 2 ? SCARF2 : SCARF);
  }

  // ── neck: too long, too thin ──
  p.line(CX + 1 + L, 9 + B, CX + 1 + L, 11 + B, HEAD_S);

  // ── featureless head ──
  const hx = CX + 1 + L + tiltX;
  const hy = 6 + B + tiltY;
  p.ellipse(hx, hy, 3.5, 4, HEAD_M);
  // shading only – no eyes, no mouth, no nose
  p.ellipse(hx - 1, hy + 1, 2.5, 3, HEAD_S);
  p.ellipse(hx + 0.5, hy - 0.5, 2.5, 3, HEAD_M);
  p.line(hx - 1, hy - 3, hx + 1, hy - 3, HEAD_L);
  p.px(hx + 2, hy - 2, HEAD_L);
  p.px(hx + 2, hy - 1, HEAD_L);
  p.line(hx - 2, hy + 3, hx + 1, hy + 4, HEAD_D);
  p.px(hx - 3, hy + 1, HEAD_D);

  // ── front arm (long, pale hand) ──
  const sh: [number, number] = [CX + 2 + L, 14 + B];
  const [ax, ay] = dir(pose.armAngle, 7);
  const hand: [number, number] = [sh[0] + ax, sh[1] + ay];
  if (pose.smear > 0) {
    // mind lash flick: a faint lilac trail along the swing
    for (let a = pose.armAngle - 0.9; a < pose.armAngle; a += 0.12) {
      const [x1, y1] = dir(a, 11);
      p.px(sh[0] + x1, sh[1] + y1, '#9d86e0aa');
    }
  }
  p.line(sh[0], sh[1], hand[0], hand[1], COAT1, 2);
  p.rect(Math.round(hand[0]), Math.round(hand[1]), 2, 2, HAND);
  const [fx, fy] = dir(pose.armAngle, 2);
  p.px(hand[0] + 1 + fx, hand[1] + 1 + fy, HAND_S);

  // ── psychic energy (subtle) ──
  if (pose.glow > 0) {
    const r = 5 + Math.round(pose.glow * 2);
    p.ring(hx, hy, r, '#9d86e077');
    p.circle(hand[0] + 1, hand[1] + 1, 1 + pose.glow * 1.5, '#d9ccffaa');
    p.px(hand[0] + 1, hand[1] + 1, PAL.white);
    if (pose.glow >= 1) {
      p.px(hx - r, hy, PSY_L);
      p.px(hx + r, hy, PSY_L);
      p.px(hx, hy - r, PSY_L);
    }
  } else if (!pose.hurt && pose.fallen === 0) {
    // two motes drifting beside his head (never over it – the head stays blank)
    const b = Math.round(Math.sin(pose.t * 1.3) * 1.5);
    p.px(hx - 6, hy - 1 + b, '#9d86e0cc');
    p.px(hx + 6, hy + 1 - b, '#d9ccff99');
  }
};

// ───────────────────────── The Last Remnant ─────────────────────────

export const WIFE_W = 36;
export const WIFE_H = 64;

const HAIR0 = '#060509';
const HAIR1 = '#121019';
const HAIR2 = '#25212e';
const SKIN = '#f4f2f7';
const SKIN_S = '#d6d1de';
const GOWN = '#e6e2ee';
const GOWN_S = '#b9b1c7';
const GOWN_D = '#8f879e';

/** f: 0..3 float, 4..7 spread. */
const drawWife = (p: PixelCanvas, f: number): void => {
  const spread = f >= 4;
  const k = spread ? (f - 4) / 3 : 0;
  const bob = spread ? 0 : [0, 1, 1, 0][f];
  const sw = spread ? 0 : [0, 1, 0, -1][f];
  const X = 18;
  const top = 4 + bob;
  // ── hair: an extremely long straight curtain behind her ──
  const fan = spread ? 2 + Math.round(k * 12) : 0;
  p.poly(
    [
      [X - 4, top + 1],
      [X + 4, top + 1],
      [X + 7, top + 18],
      [X + 8 + Math.round(fan * 0.4), top + 38],
      [X + 9 + fan + sw, 63],
      [X - 9 - fan + sw, 63],
      [X - 8 - Math.round(fan * 0.4), top + 38],
      [X - 7, top + 18],
    ],
    HAIR0,
  );
  // straight strands with a faint sheen
  for (const off of [-6, -3, 3, 6]) {
    const bend = Math.round((off / 6) * fan * 0.9);
    p.line(X + off * 0.8, top + 10, X + off + bend + sw, 62, HAIR1);
  }
  p.line(X - 2, top + 3, X - 5, top + 20, HAIR2);
  p.line(X + 3, top + 3, X + 5, top + 16, HAIR2);
  if (spread) {
    // strands lifting off the curtain and spilling outward
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const y0 = top + 22 + i * 5;
      const len = 4 + Math.round(k * 9);
      p.line(X + side * 7, y0, X + side * (7 + len), y0 + 3 + i, HAIR0);
    }
  }

  // ── gown: slender, thinning to nothing ──
  p.poly(
    [
      [X - 3, top + 13],
      [X + 3, top + 13],
      [X + 5, top + 42],
      [X + 5 + sw, 58],
      [X - 5 + sw, 58],
      [X - 5, top + 42],
    ],
    GOWN,
  );
  p.poly(
    [
      [X - 3, top + 13],
      [X - 1, top + 13],
      [X - 2, 58],
      [X - 5 + sw, 58],
      [X - 5, top + 42],
    ],
    GOWN_S,
  );
  p.line(X + 1, top + 18, X + 2 + sw, 56, GOWN_S);
  p.line(X - 3, top + 22, X + 3, top + 22, GOWN_S);
  // ethereal hem: dissolving rows
  for (let y = 56; y < 63; y++) {
    for (let x = X - 6; x <= X + 6; x++) {
      const n = hash2(x, y, f + 11);
      const fade = (y - 55) / 8;
      if (n < fade) p.px(x + sw, y, 0);
      else if (y >= 58 && n < fade + 0.25) p.px(x + sw, y, GOWN_D);
      else if (y >= 58 && n < fade + 0.5) p.px(x + sw, y, '#e6e2ee88');
    }
  }

  // ── arms: thin and pale, opening outward when she spreads ──
  const reach = spread ? Math.round(k * 5) : 0;
  p.line(X - 3, top + 14, X - 4 - reach, top + 30 - reach, SKIN_S);
  p.line(X + 3, top + 14, X + 4 + reach, top + 30 - reach, SKIN);
  p.px(X - 4 - reach, top + 31 - reach, SKIN);
  p.px(X + 4 + reach, top + 31 - reach, SKIN);

  // ── neck + head ──
  p.rect(X - 1, top + 9, 2, 4, SKIN_S);
  p.px(X, top + 10, SKIN);
  p.ellipse(X, top + 5, 3, 4, SKIN);
  p.line(X - 2, top + 8, X + 2, top + 8, SKIN_S);
  // closed eyes, a quiet sorrow
  p.px(X - 1, top + 5, '#5b5468');
  p.px(X - 2, top + 5, '#8d869c');
  p.px(X + 1, top + 5, '#5b5468');
  p.px(X + 2, top + 5, '#8d869c');
  p.px(X, top + 7, '#cbb9c6');
  // ── front hair: a centre part and curtains framing the face ──
  p.ellipse(X, top + 2, 3.5, 2, HAIR0);
  p.px(X, top + 1, HAIR2);
  p.line(X - 3, top + 2, X - 3, top + 26, HAIR0, 2);
  p.line(X + 2, top + 2, X + 3, top + 26, HAIR0, 2);
  p.px(X - 2, top + 4, HAIR0);
  p.px(X + 2, top + 4, HAIR1);
};

export const generateWifeSheet = (): GeneratedSheet => {
  const frames = 8;
  const p = new PixelCanvas(WIFE_W * frames, WIFE_H);
  for (let f = 0; f < frames; f++) {
    p.frame(f * WIFE_W, 0, WIFE_W, WIFE_H);
    drawWife(p, f);
    p.outline('#1a1622');
  }
  p.frame(0, 0, p.width, p.height);
  return {
    canvas: p.commit(),
    frameWidth: WIFE_W,
    frameHeight: WIFE_H,
    frameCount: frames,
    anims: [
      { state: 'float', start: 0, frames: 4, rate: 4, repeat: -1 },
      { state: 'spread', start: 4, frames: 4, rate: 9, repeat: 0 },
    ],
  };
};

// ───────────────────────── effects + pickups ─────────────────────────

const sheet = (key: string, w: number, h: number, frames: number, draw: (p: PixelCanvas, f: number) => void, outline = true, rate = 10): SimpleSheet => {
  const p = new PixelCanvas(w * frames, h);
  for (let f = 0; f < frames; f++) {
    p.frame(f * w, 0, w, h);
    draw(p, f);
    if (outline) p.outline(PAL.outline);
  }
  p.frame(0, 0, p.width, p.height);
  return { key, canvas: p.commit(), frameWidth: w, frameHeight: h, frames, rate };
};

export const generateHollowSheets = (): SimpleSheet[] => [
  sheet('proj-mind-lash', 12, 6, 2, (p, f) => {
    p.line(0, 3, 9, 3, f ? '#9d86e099' : '#9d86e0cc');
    p.line(4, 3, 11, 3, PSY_L);
    p.px(11, 3, PAL.white);
    p.px(2 + f, 2, '#9d86e066');
    p.px(3 - f, 4, '#9d86e066');
  }, false),
  sheet('pickup-fragment', 9, 10, 4, (p, f) => {
    const w = [3, 2, 1, 2][f];
    p.poly([[4, 0], [4 + w, 4.5], [4, 9], [4 - w, 4.5]], PSY);
    p.line(4, 1, 4, 8, PSY_L);
    if (f === 0) p.px(4, 3, PAL.white);
  }, true, 8),
  sheet('fx-seal', 13, 13, 1, (p) => {
    p.ring(6, 6, 5, PSY_L);
    p.ring(6, 6, 3, '#9d86e0cc');
    p.line(2, 6, 10, 6, PSY_L);
    p.line(6, 2, 6, 10, '#9d86e0');
    p.px(6, 6, PAL.white);
  }, true),
];

type IconDraw = (p: PixelCanvas) => void;

export const HOLLOW_ICONS: Record<string, IconDraw> = {
  'icon-mind-lash': (p) => {
    p.line(2, 13, 13, 2, PSY);
    p.line(7, 8, 13, 2, PSY_L);
    p.px(13, 2, PAL.white);
    p.px(3, 9, '#9d86e099');
    p.px(6, 13, '#9d86e099');
  },
  'icon-psychic-burst': (p) => {
    p.ring(8, 8, 7, PSY);
    p.ring(8, 8, 5, PSY_L);
    p.ellipse(8, 8, 2.5, 3, HEAD_M);
    p.px(9, 6, HEAD_L);
  },
  'icon-outlet-seal': (p) => {
    p.ring(8, 8, 6, PSY_L);
    p.ring(8, 8, 4, PSY);
    p.line(1, 8, 14, 8, PSY_L);
    p.line(8, 3, 8, 13, PSY);
    p.px(8, 8, PAL.white);
  },
  'icon-last-remnant': (p) => {
    p.poly([[4, 2], [11, 2], [13, 15], [2, 15]], HAIR0);
    p.ellipse(7.5, 6, 2.5, 3.5, SKIN);
    p.px(6, 6, '#5b5468');
    p.px(9, 6, '#5b5468');
    p.line(5, 2, 4, 13, HAIR2);
    p.line(10, 2, 11, 13, HAIR2);
    p.rect(6, 11, 4, 4, GOWN);
  },
  'icon-psychic-fragments': (p) => {
    p.poly([[4, 3], [6, 7], [4, 11], [2, 7]], PSY);
    p.poly([[11, 1], [13.5, 6], [11, 10], [8.5, 6]], PSY_L);
    p.poly([[9, 9], [11, 12], [9, 15], [7, 12]], PSY);
    p.px(11, 4, PAL.white);
  },
};
