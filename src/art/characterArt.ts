/**
 * Procedural anime pixel-art for the three heroes. 32x32 frames, facing right
 * (the runtime flips horizontally). Each hero has its own silhouette:
 *  - Voidwalker: pointed hood + flared cloak + floating orb
 *  - Blood Reaper: spiky hair, trailing scarf, oversized cursed blade
 *  - Frost Witch: wide-brim hat, long white hair, crystal staff, bell dress
 */
import { PixelCanvas } from './pixel';
import { PAL } from './palette';
import { CHARACTER_ANIMS, humanoidPose, type Pose } from './anims';
import type { CharacterId } from '../data/types';
import { drawHollow, PSY } from './hollowArt';

export const CHAR_FRAME = 32;
const CX = 16;

const dir = (a: number, len: number): [number, number] => [Math.cos(a) * len, Math.sin(a) * len];

const drawVoidwalker = (p: PixelCanvas, pose: Pose): void => {
  const L = pose.lean;
  const B = pose.bob;
  const s = pose.sway;
  // back cloak flare
  p.poly(
    [
      [CX - 3 + L, 13 + B],
      [CX + 1 + L, 14 + B],
      [CX - 1, 29],
      [CX - 8 - s, 29],
      [CX - 7 - s, 25],
    ],
    PAL.void0,
  );
  for (let i = 0; i < 3; i++) p.px(CX - 7 - s + i * 2, 29, PAL.void3);
  // boots
  p.rect(CX - 3 + pose.legL, 28, 3, 2, PAL.steel0);
  p.rect(CX + 1 + pose.legR, 28, 3, 2, PAL.steel0);
  // robe body
  p.poly(
    [
      [CX - 4 + L, 13 + B],
      [CX + 4 + L, 13 + B],
      [CX + 6 + Math.round(L / 2), 28],
      [CX - 6 + Math.round(L / 2), 28],
    ],
    PAL.void1,
  );
  p.poly(
    [
      [CX - 4 + L, 13 + B],
      [CX - 2 + L, 13 + B],
      [CX - 3 + Math.round(L / 2), 28],
      [CX - 6 + Math.round(L / 2), 28],
    ],
    PAL.void0,
  );
  p.line(CX + 3 + L, 14 + B, CX + 5 + Math.round(L / 2), 27, PAL.void2);
  // hem trim + runes
  p.line(CX - 6 + Math.round(L / 2), 27, CX + 6 + Math.round(L / 2), 27, PAL.void3);
  p.line(CX - 5 + Math.round(L / 2), 28, CX + 5 + Math.round(L / 2), 28, PAL.void5);
  for (let y = 17; y < 26; y += 3) p.px(CX + 1 + Math.round(L * 0.7), y + B * (y < 20 ? 1 : 0), PAL.void4);
  // belt
  p.rect(CX - 4 + L, 19 + B, 8, 1, PAL.void3);
  p.px(CX + 1 + L, 19 + B, PAL.void6);
  // back arm
  p.line(CX - 3 + L, 15 + B, CX - 4 + L, 20 + B, PAL.void0, 2);
  // front arm toward cast angle
  const sh: [number, number] = [CX + 2 + L, 15 + B];
  const [hx, hy] = dir(pose.armAngle, 6);
  p.line(sh[0], sh[1], sh[0] + hx, sh[1] + hy, PAL.void2, 2);
  p.rect(Math.round(sh[0] + hx), Math.round(sh[1] + hy), 2, 2, PAL.skinShade);
  if (pose.glow > 0) {
    const [ox, oy] = dir(pose.armAngle, 9);
    const r = 1 + Math.round(pose.glow * 2);
    p.circle(sh[0] + ox, sh[1] + oy, r + 1, '#b05cff99');
    p.circle(sh[0] + ox, sh[1] + oy, r, PAL.void5);
    p.px(sh[0] + ox, sh[1] + oy, PAL.void6);
  } else if (!pose.hurt && pose.fallen === 0) {
    // familiar orb floating near the shoulder
    const oy = 12 + Math.round(Math.sin(pose.t) * 1.5);
    p.circle(CX + 8, oy, 1.5, PAL.void4);
    p.px(CX + 8, oy, PAL.void6);
  }
  // hood
  p.ellipse(CX + L, 9 + B, 5, 5, PAL.void1);
  p.ellipse(CX - 2 + L, 9 + B, 3, 4.5, PAL.void0);
  p.poly(
    [
      [CX - 2 + L, 5 + B],
      [CX - 7 + L - Math.min(1, s), 2 + B],
      [CX - 4 + L, 8 + B],
    ],
    PAL.void1,
  );
  // hood rim highlight
  p.line(CX + 2 + L, 4 + B, CX + 5 + L, 7 + B, PAL.void2);
  // face opening (shadowed) + glowing eyes, framed by the hood rim
  p.rect(CX + 1 + L, 8 + B, 3, 4, PAL.outline);
  p.line(CX + 4 + L, 7 + B, CX + 4 + L, 12 + B, PAL.void2);
  p.px(CX + 1 + L, 8 + B, PAL.snowShade);
  p.px(CX + 2 + L, 8 + B, PAL.snow);
  p.px(CX + 1 + L, 9 + B, PAL.snowShade);
  const eye = pose.hurt ? PAL.void4 : PAL.void6;
  p.px(CX + 2 + L, 10 + B, eye);
  p.px(CX + 3 + L, 10 + B, eye);
};

const drawReaper = (p: PixelCanvas, pose: Pose): void => {
  const L = pose.lean;
  const B = pose.bob;
  const s = pose.sway;
  // scarf trailing behind
  const len = pose.dash ? 12 : 8 + s;
  for (let i = 0; i < len; i++) {
    const x = CX - 1 + L - i;
    const y = 13 + B + Math.round(Math.sin(pose.t + i * 0.7) * (i / len) * 2) + Math.round(i * (pose.dash ? 0.1 : 0.35));
    p.px(x, y, PAL.blood3);
    p.px(x, y + 1, PAL.blood2);
    if (i < 3) p.px(x, y - 1, PAL.blood3);
  }
  // legs
  p.line(CX - 2 + Math.round(L / 2), 22, CX - 2 + pose.legL, 28, PAL.steel1, 2);
  p.line(CX + 1 + Math.round(L / 2), 22, CX + 1 + pose.legR, 28, PAL.steel1, 2);
  p.rect(CX - 3 + pose.legL, 28, 4, 2, PAL.steel0);
  p.rect(CX + pose.legR, 28, 4, 2, PAL.steel0);
  p.px(CX - 1 + pose.legL, 28, PAL.blood1);
  p.px(CX + 2 + pose.legR, 28, PAL.blood1);
  // coat tails
  p.poly(
    [
      [CX - 4 + L, 18 + B],
      [CX + 3 + L, 18 + B],
      [CX + 2 + Math.round(L / 2), 25],
      [CX - 6 - s, 26],
    ],
    PAL.steel0,
  );
  // torso
  p.rect(CX - 4 + L, 13 + B, 8, 8, PAL.steel1);
  p.rect(CX - 1 + L, 14 + B, 4, 4, PAL.steel2);
  p.px(CX + 1 + L, 14 + B, PAL.steel3);
  p.line(CX - 4 + L, 13 + B, CX - 4 + L, 20 + B, PAL.steel0);
  p.rect(CX - 4 + L, 20 + B, 8, 2, PAL.blood1);
  p.px(CX - 3 + L, 20 + B, PAL.blood2);
  p.px(CX - 3 + L, 22 + B, PAL.blood2);
  // back arm
  p.line(CX - 3 + L, 15 + B, CX - 4 + L, 19 + B, PAL.steel1, 2);
  // head
  p.ellipse(CX + 1 + L, 9 + B, 3.5, 3.5, PAL.skin);
  p.line(CX - 1 + L, 11 + B, CX + 3 + L, 12 + B, PAL.skinShade);
  // spiky hair
  p.poly(
    [
      [CX - 4 + L, 12 + B],
      [CX - 7 + L, 6 + B],
      [CX - 3 + L, 6 + B],
      [CX - 4 + L, 2 + B],
      [CX + 0 + L, 5 + B],
      [CX + 2 + L, 1 + B],
      [CX + 3 + L, 5 + B],
      [CX + 7 + L, 5 + B],
      [CX + 5 + L, 8 + B],
      [CX + 2 + L, 7 + B],
      [CX + 0 + L, 10 + B],
    ],
    PAL.hair,
  );
  p.line(CX - 3 + L, 4 + B, CX + 1 + L, 7 + B, PAL.blood1);
  p.px(CX + 2 + L, 2 + B, PAL.blood2);
  // eye
  p.px(CX + 3 + L, 9 + B, pose.hurt ? PAL.skinShade : PAL.blood3);
  p.px(CX + 3 + L, 8 + B, PAL.hair);
  // sword arm + blade
  const sh: [number, number] = [CX + 2 + L, 15 + B];
  const [ax, ay] = dir(pose.armAngle, 4);
  const hand: [number, number] = [sh[0] + ax, sh[1] + ay];
  if (pose.smear > 0) {
    for (let a = pose.armAngle - 1.6; a < pose.armAngle; a += 0.08) {
      const [x1, y1] = dir(a, 17);
      const [x2, y2] = dir(a, 11);
      p.line(sh[0] + x2, sh[1] + y2, sh[0] + x1, sh[1] + y1, '#ff8a8aaa');
    }
  }
  p.line(sh[0], sh[1], hand[0], hand[1], PAL.steel1, 2);
  const [bx, by] = dir(pose.armAngle, 18);
  const [ex, ey] = dir(pose.armAngle + Math.PI / 2, 1);
  p.line(hand[0], hand[1], hand[0] + bx, hand[1] + by, PAL.steel3, 2);
  p.line(hand[0] - ex, hand[1] - ey, hand[0] + bx - ex, hand[1] + by - ey, PAL.steel4);
  p.line(hand[0] + ex * 2, hand[1] + ey * 2, hand[0] + bx + ex * 2, hand[1] + by + ey * 2, PAL.blood3);
  for (let i = 5; i < 17; i += 4) {
    const [rx, ry] = dir(pose.armAngle, i);
    p.px(hand[0] + rx, hand[1] + ry, PAL.blood4);
  }
  const [gx, gy] = dir(pose.armAngle + Math.PI / 2, 2);
  p.line(hand[0] - gx, hand[1] - gy, hand[0] + gx, hand[1] + gy, PAL.blood1);
  p.rect(Math.round(hand[0]), Math.round(hand[1]), 2, 2, PAL.skinShade);
  if (pose.glow > 0) p.circle(hand[0] + bx * 0.6, hand[1] + by * 0.6, 1 + pose.glow * 2, '#ff334488');
};

const drawWitch = (p: PixelCanvas, pose: Pose): void => {
  const L = pose.lean;
  const B = pose.bob;
  const s = pose.sway;
  // long hair behind
  p.poly(
    [
      [CX - 4 + L, 7 + B],
      [CX + 1 + L, 7 + B],
      [CX - 1 + L, 21 + B],
      [CX - 5 - s, 24],
      [CX - 7 - Math.round(s / 2), 15 + B],
    ],
    PAL.snow,
  );
  p.line(CX - 3 + L, 10 + B, CX - 5 - s, 22, PAL.snowShade);
  // feet
  p.rect(CX - 3 + pose.legL, 28, 3, 2, PAL.frost1);
  p.rect(CX + 1 + pose.legR, 28, 3, 2, PAL.frost1);
  // bell dress
  const hemShift = Math.round(L / 2) - (pose.dash ? 1 : 0);
  p.poly(
    [
      [CX - 3 + L, 14 + B],
      [CX + 3 + L, 14 + B],
      [CX + 7 + hemShift, 28],
      [CX - 7 + hemShift - (pose.dash ? 2 : 0), 28],
    ],
    PAL.dress2,
  );
  p.poly(
    [
      [CX - 3 + L, 14 + B],
      [CX - 1 + L, 14 + B],
      [CX - 3 + hemShift, 28],
      [CX - 7 + hemShift - (pose.dash ? 2 : 0), 28],
    ],
    PAL.dress1,
  );
  p.line(CX - 7 + hemShift, 27, CX + 7 + hemShift, 27, PAL.dress0);
  p.line(CX - 6 + hemShift, 26, CX + 6 + hemShift, 26, PAL.frost3);
  for (let x = -5; x <= 5; x += 3) p.px(CX + x + hemShift, 24, PAL.dress1);
  // bodice
  p.rect(CX - 3 + L, 14 + B, 6, 5, PAL.frost1);
  p.px(CX + L, 16 + B, PAL.frost3);
  p.px(CX + L, 15 + B, PAL.frost4);
  // back arm
  p.line(CX - 3 + L, 15 + B, CX - 4 + L, 20 + B, PAL.dress1, 2);
  // head
  p.ellipse(CX + 1 + L, 10 + B, 3.5, 3.5, PAL.skin);
  p.rect(CX - 3 + L, 7 + B, 7, 2, PAL.snow);
  p.px(CX + 4 + L, 9 + B, PAL.snow);
  p.px(CX - 2 + L, 9 + B, PAL.snow);
  p.px(CX - 2 + L, 10 + B, PAL.snowShade);
  p.px(CX + 3 + L, 10 + B, pose.hurt ? PAL.skinShade : PAL.frost2);
  p.px(CX + 3 + L, 11 + B, pose.hurt ? PAL.skinShade : PAL.frost3);
  p.px(CX + 2 + L, 13 + B, PAL.skinShade);
  // hat: wide brim + bent cone
  p.ellipse(CX + L, 6 + B, 8, 1.5, PAL.frost0);
  p.line(CX - 6 + L, 5 + B, CX + 6 + L, 5 + B, PAL.frost1);
  p.poly(
    [
      [CX - 4 + L, 6 + B],
      [CX + 4 + L, 6 + B],
      [CX + 1 + L, 2 + B],
      [CX - 3 + L, -1 + B],
      [CX - 7 + L - Math.min(1, s), -1 + B],
      [CX - 3 + L, 1 + B],
    ],
    PAL.frost0,
  );
  p.line(CX - 3 + L, 4 + B, CX + 3 + L, 4 + B, PAL.frost3);
  p.px(CX - 6 + L - Math.min(1, s), -1 + B, PAL.frost3);
  // staff hand
  const sh: [number, number] = [CX + 2 + L, 15 + B];
  const [ax, ay] = dir(pose.armAngle, 4);
  const hand: [number, number] = [sh[0] + ax, sh[1] + ay];
  p.line(sh[0], sh[1], hand[0], hand[1], PAL.dress1, 2);
  const tilt = Math.round((pose.armAngle + 0.4) * -3);
  const top: [number, number] = [hand[0] + 2 + Math.max(0, -tilt), hand[1] - 12];
  const bottom: [number, number] = [hand[0] - 1, hand[1] + 7];
  p.line(bottom[0], bottom[1], top[0], top[1], PAL.steel4);
  p.poly(
    [
      [top[0], top[1] - 4],
      [top[0] + 2, top[1] - 1],
      [top[0], top[1] + 1],
      [top[0] - 2, top[1] - 1],
    ],
    PAL.frost3,
  );
  p.px(top[0], top[1] - 2, PAL.frost4);
  if (pose.glow > 0) {
    p.ring(top[0], top[1] - 1.5, 2 + pose.glow * 2, '#d4f7ffaa');
  }
  p.rect(Math.round(hand[0]), Math.round(hand[1]), 2, 2, PAL.skinShade);
};

interface CharArtSpec {
  draw: (p: PixelCanvas, pose: Pose) => void;
  rest: number;
  attack: number[];
  cast: number[];
  ember: string;
}

const SPECS: Record<CharacterId, CharArtSpec> = {
  voidwalker: { draw: drawVoidwalker, rest: 0.9, attack: [-0.4, -0.2, 0, 0.1], cast: [0.2, -0.3, -0.5, -0.1], ember: PAL.void5 },
  blood_reaper: { draw: drawReaper, rest: 1.05, attack: [-2.4, -0.9, 0.7, 1.5], cast: [-1.4, -1.6, -1.6, -1.2], ember: PAL.blood3 },
  frost_witch: { draw: drawWitch, rest: 0.5, attack: [0.2, -0.3, -0.5, 0], cast: [0.3, -0.2, -0.6, -0.2], ember: PAL.frost3 },
  hollow: { draw: drawHollow, rest: 1.3, attack: [1.0, 0.1, -0.2, 0.3], cast: [-0.3, -0.8, -1.1, -0.7], ember: PSY },
};

export interface GeneratedSheet {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  anims: { state: string; start: number; frames: number; rate: number; repeat: number }[];
}

export const generateCharacterSheet = (id: CharacterId): GeneratedSheet => {
  const spec = SPECS[id];
  const total = CHARACTER_ANIMS.reduce((a, s) => a + s.frames, 0);
  const p = new PixelCanvas(total * CHAR_FRAME, CHAR_FRAME);
  const anims: GeneratedSheet['anims'] = [];
  let idx = 0;
  for (const a of CHARACTER_ANIMS) {
    anims.push({ state: a.state, start: idx, frames: a.frames, rate: a.rate, repeat: a.repeat });
    for (let f = 0; f < a.frames; f++) {
      const pose = humanoidPose(a.state, f, spec.rest, spec.attack, spec.cast);
      p.frame(idx * CHAR_FRAME, 0, CHAR_FRAME, CHAR_FRAME);
      spec.draw(p, pose);
      p.outline(PAL.outline);
      if (pose.fallen > 0) p.squashFrame(1 - pose.fallen * 0.55, 30);
      if (pose.dissolve > 0) p.dissolveFrame(pose.dissolve, spec.ember, idx);
      idx++;
    }
  }
  p.frame(0, 0, p.width, p.height);
  return { canvas: p.commit(), frameWidth: CHAR_FRAME, frameHeight: CHAR_FRAME, frameCount: total, anims };
};

/** Larger portrait (2x) for character select: simply the idle frame scaled up later via setScale. */
export const CHARACTER_ART_IDS: CharacterId[] = ['voidwalker', 'blood_reaper', 'frost_witch', 'hollow'];
