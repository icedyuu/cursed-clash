/** Procedural monster sprites. Same outline + palette rules as the heroes. */
import { PixelCanvas } from './pixel';
import { PAL } from './palette';
import type { GeneratedSheet } from './characterArt';

interface MonsterAnim {
  state: string;
  frames: number;
  rate: number;
  repeat: number;
}

interface MonsterSpec {
  key: string;
  w: number;
  h: number;
  anims: MonsterAnim[];
  draw: (p: PixelCanvas, state: string, f: number) => void;
  ember: string;
  /** Optional palette swaps to make a variant sheet (e.g. enraged boss). */
  variants?: Record<string, [string, string][]>;
}

// ───────── Cursed Slime ─────────
const drawSlime = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 8;
  if (state === 'death') {
    const spread = f * 2;
    p.ellipse(cx, 13, 5 + spread, 2 - Math.min(1, f * 0.4), PAL.slime1);
    p.ellipse(cx, 12.5, 3 + spread * 0.6, 1, PAL.slime2);
    for (let i = 0; i < 4; i++) p.px(cx - 6 - f + i * (4 + f), 10 - f + (i % 2) * 2, PAL.slime2);
    return;
  }
  const shapes: [number, number][] = [
    [6, 4],
    [5, 5],
    [4.5, 5.5],
    [5.5, 4.5],
  ];
  const [rx, ry] = shapes[f];
  const cy = 14 - ry;
  p.ellipse(cx, cy, rx, ry, PAL.slime1);
  p.ellipse(cx, cy + ry * 0.45, rx - 0.5, ry * 0.55, PAL.slime0);
  p.ellipse(cx, cy - 0.5, rx - 1, ry - 1.2, PAL.slime1);
  p.ellipse(cx - rx * 0.35, cy - ry * 0.4, 1.2, 1, PAL.slime3);
  // cursed eyes + jagged grin
  p.px(cx - 2, cy, PAL.outline);
  p.px(cx + 2, cy, PAL.outline);
  p.px(cx - 2, cy - 1, PAL.eyeRed);
  p.px(cx + 2, cy - 1, PAL.eyeRed);
  p.line(cx - 2, cy + 2, cx + 2, cy + 2, PAL.slime0);
  p.px(cx - 1, cy + 3, PAL.slime0);
  p.px(cx + 1, cy + 3, PAL.slime0);
  // drip
  if (f % 2 === 0) p.px(cx + rx - 1, cy + ry, PAL.slime2);
};

// ───────── Shadow Wraith ─────────
const drawWraith = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 10;
  const bob = state === 'death' ? 0 : [0, -1, -1, 0][f % 4];
  const lunge = state === 'attack' ? 2 : 0;
  const t = f * 1.4;
  // tattered tail
  for (let i = 0; i < 9; i++) {
    const w = Math.max(1, 5 - i * 0.5);
    const x = cx - 1 + Math.round(Math.sin(t + i * 0.8) * (i * 0.25)) - Math.round(i * 0.3);
    p.rect(x - w / 2, 13 + i + bob, w, 1, i > 5 ? PAL.wraith1 : PAL.wraith2);
  }
  // body/hood
  p.ellipse(cx + lunge, 9 + bob, 5, 6, PAL.wraith2);
  p.ellipse(cx - 1 + lunge, 9 + bob, 4, 5, PAL.wraith1);
  p.poly(
    [
      [cx - 3 + lunge, 4 + bob],
      [cx - 6 + lunge, 1 + bob],
      [cx - 1 + lunge, 4 + bob],
    ],
    PAL.wraith2,
  );
  p.rect(cx + 1 + lunge, 7 + bob, 4, 4, PAL.wraith0);
  p.px(cx + 2 + lunge, 8 + bob, PAL.eyeRed);
  p.px(cx + 4 + lunge, 8 + bob, PAL.eyeRed);
  // claws reaching forward
  const reach = state === 'attack' ? 5 : 2 + (f % 2);
  p.line(cx + 3 + lunge, 12 + bob, cx + 4 + reach + lunge, 13 + bob, PAL.wraith3);
  p.px(cx + 5 + reach + lunge, 12 + bob, PAL.wraith3);
  p.px(cx + 5 + reach + lunge, 14 + bob, PAL.wraith3);
  p.px(cx + 3 + lunge, 3 + bob, PAL.wraith3);
};

// ───────── Bone Knight ─────────
const drawKnight = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 12;
  const walk = state === 'walk' ? [1, 0, -1, 0][f] : 0;
  const bob = state === 'walk' ? [0, 1, 0, 1][f] : 0;
  // legs (bones)
  p.line(cx - 2, 20, cx - 2 + walk, 26, PAL.boneShade, 2);
  p.line(cx + 2, 20, cx + 2 - walk, 26, PAL.boneShade, 2);
  p.rect(cx - 4 + walk, 26, 4, 2, PAL.steel1);
  p.rect(cx + 1 - walk, 26, 4, 2, PAL.steel1);
  // shield on back arm
  p.rect(cx - 9, 11 + bob, 5, 9, PAL.steel1);
  p.rect(cx - 8, 12 + bob, 3, 7, PAL.steel2);
  p.px(cx - 7, 15 + bob, PAL.ghost);
  // rusted breastplate
  p.rect(cx - 4, 11 + bob, 8, 9, PAL.steel2);
  p.rect(cx - 3, 12 + bob, 6, 2, PAL.steel3);
  p.line(cx - 4, 19 + bob, cx + 3, 19 + bob, PAL.blood1);
  // ribs visible through gap
  p.px(cx - 1, 15 + bob, PAL.bone);
  p.px(cx + 1, 15 + bob, PAL.bone);
  p.px(cx, 17 + bob, PAL.bone);
  // skull helmet
  p.ellipse(cx + 1, 7 + bob, 4, 4, PAL.bone);
  p.rect(cx - 3, 3 + bob, 8, 3, PAL.steel2);
  p.rect(cx - 3, 3 + bob, 8, 1, PAL.steel3);
  p.poly(
    [
      [cx - 3, 4 + bob],
      [cx - 7, 0 + bob],
      [cx - 1, 3 + bob],
    ],
    PAL.blood2,
  );
  p.rect(cx + 2, 6 + bob, 3, 2, PAL.outline);
  p.px(cx + 3, 6 + bob, PAL.ghost);
  p.line(cx + 1, 9 + bob, cx + 4, 9 + bob, PAL.boneShade);
  // sword arm
  let angle = 1.2;
  if (state === 'windup') angle = [-1.4, -1.9][f];
  if (state === 'strike') angle = [0.4, 1.3][f];
  const sx = cx + 3;
  const sy = 12 + bob;
  const hx = sx + Math.cos(angle) * 4;
  const hy = sy + Math.sin(angle) * 4;
  p.line(sx, sy, hx, hy, PAL.boneShade, 2);
  const len = 15;
  p.line(hx, hy, hx + Math.cos(angle) * len, hy + Math.sin(angle) * len, PAL.steel3, 2);
  p.line(hx, hy, hx + Math.cos(angle) * len, hy + Math.sin(angle) * len, PAL.steel4);
  p.line(hx - Math.sin(angle) * 2, hy + Math.cos(angle) * 2, hx + Math.sin(angle) * 2, hy - Math.cos(angle) * 2, PAL.gold1);
  if (state === 'windup') p.circle(hx + Math.cos(angle) * len, hy + Math.sin(angle) * len, 1.5, PAL.ghost);
  if (state === 'strike' && f === 0) {
    for (let a = -1.6; a < 0.4; a += 0.12) p.px(sx + Math.cos(a) * 17, sy + Math.sin(a) * 17, '#d4f7ffaa');
  }
};

// ───────── Void Caster ─────────
const drawCaster = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 10;
  const bob = [0, -1, -1, 0][f % 4];
  // robe (floating, no feet)
  p.poly(
    [
      [cx - 3, 10 + bob],
      [cx + 3, 10 + bob],
      [cx + 6, 25 + bob],
      [cx + 2, 24 + bob],
      [cx, 26 + bob],
      [cx - 2, 24 + bob],
      [cx - 6, 25 + bob],
    ],
    PAL.royal2,
  );
  p.poly(
    [
      [cx - 3, 10 + bob],
      [cx - 1, 10 + bob],
      [cx - 2, 24 + bob],
      [cx - 6, 25 + bob],
    ],
    PAL.royal1,
  );
  p.line(cx, 12 + bob, cx, 22 + bob, PAL.void5);
  p.px(cx, 16 + bob, PAL.void6);
  // hood + bone mask
  p.ellipse(cx, 7 + bob, 4.5, 5, PAL.royal1);
  p.ellipse(cx + 1, 7 + bob, 3, 3.5, PAL.bone);
  p.px(cx + 2, 6 + bob, PAL.outline);
  p.px(cx, 6 + bob, PAL.outline);
  p.px(cx + 1, 9 + bob, PAL.boneShade);
  p.line(cx - 1, 4 + bob, cx + 3, 4 + bob, PAL.void5);
  p.px(cx + 1, 3 + bob, PAL.void6);
  // staff
  const raise = state === 'cast' ? [2, 4, 5][f] : 0;
  const hx = cx + 5;
  const hy = 14 + bob - raise;
  p.line(hx, hy + 10, hx, hy - 8, PAL.wood2);
  p.circle(hx, hy - 9, 2 + (state === 'cast' ? 1 : 0), PAL.void4);
  p.px(hx, hy - 9, PAL.void6);
  if (state === 'cast') p.ring(hx, hy - 9, 3 + f, '#e0b3ff99');
  p.rect(hx - 1, hy, 2, 2, PAL.bone);
};

// ───────── Elite Abomination ─────────
const drawElite = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 20;
  const walk = state === 'walk' ? [1, 0, -1, 0][f] : 0;
  const bob = state === 'walk' ? [0, 1, 0, 1][f] : 0;
  const crouch = state === 'windup' ? 2 + f : 0;
  const lunge = state === 'attack' ? 3 : 0;
  // legs
  p.rect(cx - 9 + walk, 31, 5, 6, PAL.flesh0);
  p.rect(cx + 4 - walk, 31, 5, 6, PAL.flesh0);
  p.rect(cx - 10 + walk, 36, 6, 2, PAL.outline);
  p.rect(cx + 4 - walk, 36, 6, 2, PAL.outline);
  // hulking body
  p.ellipse(cx + lunge, 23 + bob + crouch, 13, 10, PAL.flesh1);
  p.ellipse(cx - 3 + lunge, 25 + bob + crouch, 9, 7, PAL.flesh0);
  p.ellipse(cx + 2 + lunge, 19 + bob + crouch, 9, 6, PAL.flesh2);
  // cursed cracks
  p.line(cx - 6 + lunge, 18 + bob + crouch, cx - 2 + lunge, 26 + bob + crouch, PAL.pink);
  p.line(cx + 5 + lunge, 22 + bob + crouch, cx + 9 + lunge, 27 + bob + crouch, PAL.pink);
  // horns
  p.poly(
    [
      [cx - 6 + lunge, 15 + bob + crouch],
      [cx - 12 + lunge, 5 + bob + crouch],
      [cx - 3 + lunge, 13 + bob + crouch],
    ],
    PAL.bone,
  );
  p.poly(
    [
      [cx + 4 + lunge, 13 + bob + crouch],
      [cx + 9 + lunge, 4 + bob + crouch],
      [cx + 8 + lunge, 14 + bob + crouch],
    ],
    PAL.bone,
  );
  // many eyes
  const eyes: [number, number][] = [
    [4, 17],
    [8, 19],
    [1, 20],
    [6, 23],
    [10, 15],
  ];
  for (const [ex, ey] of eyes) {
    p.rect(cx + ex + lunge, ey + bob + crouch, 2, 2, PAL.gold2);
    p.px(cx + ex + 1 + lunge, ey + bob + crouch, PAL.outline);
  }
  // maw
  const open = state === 'attack' ? 4 : state === 'windup' ? 2 : 1;
  p.rect(cx + 3 + lunge, 26 + bob + crouch, 9, open, PAL.outline);
  for (let i = 0; i < 4; i++) p.px(cx + 4 + i * 2 + lunge, 26 + bob + crouch, PAL.bone);
  // arms / claws
  const armY = 24 + bob + crouch + (state === 'attack' ? -4 : 0);
  p.line(cx + 10 + lunge, armY - 4, cx + 15 + lunge, armY + 3, PAL.flesh1, 3);
  p.line(cx + 15 + lunge, armY + 3, cx + 18 + lunge, armY + 2, PAL.bone);
  p.line(cx + 15 + lunge, armY + 3, cx + 18 + lunge, armY + 5, PAL.bone);
  p.line(cx - 11, 22 + bob + crouch, cx - 15, 30 + bob, PAL.flesh1, 3);
  if (state === 'windup') p.ring(cx, 22 + crouch, 14 + f, '#ff66cc88');
};

// ───────── The Hollow King ─────────
const drawKing = (p: PixelCanvas, state: string, f: number): void => {
  const cx = 32;
  const bob = state === 'death' ? 0 : [0, -1, -1, 0][f % 4];
  const t = f * 1.3;
  // cape
  const sway = Math.round(Math.sin(t) * 2);
  p.poly(
    [
      [cx - 9, 18 + bob],
      [cx + 9, 18 + bob],
      [cx + 15 + sway, 58],
      [cx + 9, 56],
      [cx + 4, 60],
      [cx - 2, 56],
      [cx - 8, 60],
      [cx - 13, 56],
      [cx - 18 + sway, 59],
    ],
    PAL.royal2,
  );
  p.poly(
    [
      [cx - 9, 18 + bob],
      [cx - 3, 18 + bob],
      [cx - 8, 60],
      [cx - 18 + sway, 59],
    ],
    PAL.royal1,
  );
  p.line(cx - 17 + sway, 58, cx + 14 + sway, 58, PAL.gold1);
  for (let i = -14; i <= 12; i += 4) p.px(cx + i + sway, 56, PAL.gold2);
  // gaunt torso + armor
  p.rect(cx - 7, 18 + bob, 14, 18, PAL.royal0);
  p.rect(cx - 6, 19 + bob, 12, 6, PAL.gold1);
  p.rect(cx - 5, 20 + bob, 10, 4, PAL.gold0);
  p.px(cx, 22 + bob, PAL.eyeRed);
  p.rect(cx - 6, 33 + bob, 12, 2, PAL.gold1);
  // ribs
  for (let i = 0; i < 3; i++) p.line(cx - 4, 27 + bob + i * 2, cx + 4, 27 + bob + i * 2, PAL.boneShade);
  // shoulders / pauldrons
  p.ellipse(cx - 9, 19 + bob, 4, 3, PAL.gold1);
  p.ellipse(cx + 9, 19 + bob, 4, 3, PAL.gold1);
  p.px(cx - 9, 18 + bob, PAL.gold3);
  p.px(cx + 9, 18 + bob, PAL.gold3);
  // long arms with claws
  let la = 1.9;
  let ra = 1.2;
  if (state === 'attack') {
    ra = [-0.9, -0.2, 0.9, 1.3][f];
    la = [2.2, 2.4, 2.0, 1.9][f];
  }
  if (state === 'cast') {
    ra = -1.1 - f * 0.08;
    la = -2.0 + f * 0.08;
  }
  const arm = (sx: number, sy: number, a: number) => {
    const ex = sx + Math.cos(a) * 9;
    const ey = sy + Math.sin(a) * 9;
    const hx = ex + Math.cos(a + 0.3) * 8;
    const hy = ey + Math.sin(a + 0.3) * 8;
    p.line(sx, sy, ex, ey, PAL.royal0, 3);
    p.line(ex, ey, hx, hy, PAL.boneShade, 2);
    for (let c = -1; c <= 1; c++) p.line(hx, hy, hx + Math.cos(a + c * 0.5) * 4, hy + Math.sin(a + c * 0.5) * 4, PAL.bone);
    return [hx, hy];
  };
  arm(cx - 10, 20 + bob, la);
  const [rhx, rhy] = arm(cx + 10, 20 + bob, ra);
  if (state === 'cast') {
    p.circle(rhx, rhy - 2, 3 + (f % 2), '#ff446699');
    p.circle(cx - 10 + Math.cos(la) * 17, 20 + bob + Math.sin(la) * 17 - 2, 3 + (f % 2), '#ff446699');
  }
  if (state === 'attack' && (f === 1 || f === 2)) {
    for (let a = -1; a < 1.2; a += 0.1) p.px(cx + 10 + Math.cos(a) * 24, 20 + bob + Math.sin(a) * 24, '#ffd36baa');
  }
  // hollow head: void with pin-prick eyes
  p.ellipse(cx, 11 + bob, 6, 7, PAL.royal1);
  p.ellipse(cx, 12 + bob, 4.5, 5.5, PAL.shadow);
  p.px(cx - 2, 11 + bob, state === 'cast' ? PAL.eyeRed : PAL.white);
  p.px(cx + 2, 11 + bob, state === 'cast' ? PAL.eyeRed : PAL.white);
  p.line(cx - 6, 7 + bob, cx - 7, 18 + bob, PAL.royal2);
  p.line(cx + 6, 7 + bob, cx + 7, 18 + bob, PAL.royal2);
  // floating broken crown
  const cy = 2 + bob + (f % 2);
  p.rect(cx - 6, cy + 3, 12, 2, PAL.gold1);
  p.poly(
    [
      [cx - 6, cy + 3],
      [cx - 6, cy - 1],
      [cx - 4, cy + 1],
      [cx - 2, cy - 2],
      [cx, cy + 1],
      [cx + 1, cy - 1],
      [cx + 2, cy + 3],
    ],
    PAL.gold2,
  );
  p.poly(
    [
      [cx + 3, cy + 3],
      [cx + 4, cy],
      [cx + 6, cy - 2],
      [cx + 6, cy + 3],
    ],
    PAL.gold1,
  );
  p.px(cx - 2, cy + 3, PAL.eyeRed);
  p.px(cx + 4, cy + 3, PAL.void5);
};

export const MONSTER_SPECS: MonsterSpec[] = [
  {
    key: 'enemy-slime',
    w: 16,
    h: 16,
    ember: PAL.slime2,
    draw: drawSlime,
    anims: [
      { state: 'move', frames: 4, rate: 7, repeat: -1 },
      { state: 'death', frames: 4, rate: 12, repeat: 0 },
    ],
  },
  {
    key: 'enemy-wraith',
    w: 20,
    h: 24,
    ember: PAL.wraith3,
    draw: drawWraith,
    anims: [
      { state: 'move', frames: 4, rate: 9, repeat: -1 },
      { state: 'attack', frames: 2, rate: 8, repeat: 0 },
      { state: 'death', frames: 4, rate: 12, repeat: 0 },
    ],
  },
  {
    key: 'enemy-knight',
    w: 32,
    h: 28,
    ember: PAL.ghost,
    draw: (p, s, f) => {
      p.ox += 4;
      drawKnight(p, s, f);
    },
    anims: [
      { state: 'move', frames: 4, rate: 6, repeat: -1 },
      { state: 'windup', frames: 2, rate: 4, repeat: 0 },
      { state: 'strike', frames: 2, rate: 12, repeat: 0 },
      { state: 'death', frames: 5, rate: 10, repeat: 0 },
    ],
  },
  {
    key: 'enemy-caster',
    w: 24,
    h: 30,
    ember: PAL.void5,
    draw: (p, s, f) => {
      p.ox += 2;
      p.oy += 2;
      drawCaster(p, s, f);
    },
    anims: [
      { state: 'move', frames: 4, rate: 6, repeat: -1 },
      { state: 'cast', frames: 3, rate: 6, repeat: 0 },
      { state: 'death', frames: 4, rate: 10, repeat: 0 },
    ],
  },
  {
    key: 'enemy-elite',
    w: 48,
    h: 40,
    ember: PAL.pink,
    draw: (p, s, f) => {
      p.ox += 2;
      drawElite(p, s, f);
    },
    anims: [
      { state: 'move', frames: 4, rate: 5, repeat: -1 },
      { state: 'windup', frames: 2, rate: 3, repeat: 0 },
      { state: 'attack', frames: 2, rate: 8, repeat: 0 },
      { state: 'death', frames: 6, rate: 9, repeat: 0 },
    ],
  },
  {
    key: 'boss-king',
    w: 72,
    h: 64,
    ember: PAL.gold2,
    draw: (p, s, f) => {
      p.ox += 4;
      drawKing(p, s, f);
    },
    anims: [
      { state: 'move', frames: 4, rate: 5, repeat: -1 },
      { state: 'attack', frames: 4, rate: 9, repeat: 0 },
      { state: 'cast', frames: 4, rate: 7, repeat: 0 },
      { state: 'death', frames: 8, rate: 7, repeat: 0 },
    ],
    variants: {
      'boss-king-rage': [
        [PAL.royal2, PAL.blood1],
        [PAL.royal1, PAL.blood0],
        [PAL.gold2, PAL.blood4],
        [PAL.white, PAL.eyeRed],
      ],
    },
  },
];

const deathPose = (state: string, f: number, frames: number): { fallen: number; dissolve: number } => {
  if (state !== 'death') return { fallen: 0, dissolve: 0 };
  const t = f / Math.max(1, frames - 1);
  return { fallen: Math.min(1, t * 1.6), dissolve: Math.max(0, t * 1.15 - 0.15) };
};

export const generateMonsterSheets = (): Record<string, GeneratedSheet> => {
  const out: Record<string, GeneratedSheet> = {};
  for (const spec of MONSTER_SPECS) {
    const total = spec.anims.reduce((a, s) => a + s.frames, 0);
    const build = (swaps?: [string, string][]): GeneratedSheet => {
      const p = new PixelCanvas(total * spec.w, spec.h);
      const anims: GeneratedSheet['anims'] = [];
      let idx = 0;
      for (const a of spec.anims) {
        anims.push({ state: a.state, start: idx, frames: a.frames, rate: a.rate, repeat: a.repeat });
        for (let f = 0; f < a.frames; f++) {
          p.frame(idx * spec.w, 0, spec.w, spec.h);
          // slimes splat rather than collapse
          const isDeathSplat = spec.key === 'enemy-slime' && a.state === 'death';
          spec.draw(p, isDeathSplat ? 'death' : a.state, a.state === 'death' && !isDeathSplat ? 0 : f);
          p.frame(idx * spec.w, 0, spec.w, spec.h);
          if (swaps) for (const [from, to] of swaps) p.swap(from, to);
          p.outline(PAL.outline);
          if (!isDeathSplat) {
            const d = deathPose(a.state, f, a.frames);
            if (d.fallen > 0) p.squashFrame(1 - d.fallen * 0.5, spec.h - 2);
            if (d.dissolve > 0) p.dissolveFrame(d.dissolve, spec.ember, idx + 7);
          }
          idx++;
        }
      }
      p.frame(0, 0, p.width, p.height);
      return { canvas: p.commit(), frameWidth: spec.w, frameHeight: spec.h, frameCount: total, anims };
    };
    out[spec.key] = build();
    if (spec.variants) for (const [vk, swaps] of Object.entries(spec.variants)) out[vk] = build(swaps);
  }
  return out;
};
