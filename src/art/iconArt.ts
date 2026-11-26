/** 16x16 glyph icons for abilities and upgrades, packed in one atlas with named frames. */
import { PixelCanvas } from './pixel';
import { PAL } from './palette';

type IconDraw = (p: PixelCanvas) => void;

const V = PAL.void5;
const VL = PAL.void6;
const R = PAL.blood3;
const RL = PAL.blood4;
const F = PAL.frost3;
const FL = PAL.frost4;
const G = PAL.gold2;
const S = PAL.steel4;

const ICONS: Record<string, IconDraw> = {
  'icon-heart': (p) => {
    p.circle(5, 6, 3, R);
    p.circle(10, 6, 3, R);
    p.poly([[2, 7], [13.5, 7], [7.5, 14]], R);
    p.px(4, 5, RL);
  },
  'icon-boot': (p) => {
    p.rect(5, 2, 5, 9, PAL.wood2);
    p.rect(5, 10, 9, 4, PAL.wood2);
    p.rect(5, 12, 9, 2, PAL.wood);
    p.line(1, 5, 4, 5, FL);
    p.line(0, 8, 4, 8, FL);
  },
  'icon-sword': (p) => {
    p.line(3, 13, 12, 4, S, 2);
    p.line(12, 3, 13, 2, PAL.white);
    p.line(2, 10, 6, 14, G);
    p.px(2, 14, PAL.wood2);
  },
  'icon-hourglass': (p) => {
    p.rect(3, 1, 10, 2, G);
    p.rect(3, 13, 10, 2, G);
    p.poly([[4, 3], [12, 3], [8, 8]], F);
    p.poly([[8, 8], [12, 13], [4, 13]], PAL.frost2);
    p.px(8, 8, FL);
  },
  'icon-eye': (p) => {
    p.ellipse(8, 8, 7, 4, PAL.snow);
    p.circle(8, 8, 3, R);
    p.circle(8, 8, 1.5, PAL.outline);
    p.px(7, 7, PAL.white);
  },
  'icon-skull': (p) => {
    p.circle(8, 7, 5, PAL.bone);
    p.rect(5, 10, 6, 4, PAL.bone);
    p.rect(5, 6, 2, 2, PAL.outline);
    p.rect(9, 6, 2, 2, PAL.outline);
    p.px(6, 13, PAL.outline);
    p.px(9, 13, PAL.outline);
  },
  'icon-magnet': (p) => {
    p.ring(8, 8, 6, R, 3);
    p.rect(1, 8, 15, 8, '#00000000');
    p.rect(2, 8, 3, 6, R);
    p.rect(11, 8, 3, 6, R);
    p.rect(2, 12, 3, 2, S);
    p.rect(11, 12, 3, 2, S);
  },
  'icon-area': (p) => {
    p.ring(8, 8, 7, V);
    p.ring(8, 8, 4, VL);
    p.px(8, 8, PAL.white);
  },
  'icon-cross': (p) => {
    p.rect(6, 2, 4, 12, PAL.slime2);
    p.rect(2, 6, 12, 4, PAL.slime2);
    p.rect(7, 3, 1, 3, PAL.slime3);
  },
  'icon-wing': (p) => {
    p.poly([[2, 4], [14, 2], [12, 6], [14, 7], [10, 10], [11, 12], [3, 12]], PAL.snow);
    p.line(4, 6, 12, 4, PAL.snowShade);
    p.line(4, 9, 10, 8, PAL.snowShade);
  },
  'icon-flame': (p) => {
    p.poly([[8, 1], [13, 9], [11, 14], [5, 14], [3, 9], [6, 6]], R);
    p.poly([[8, 6], [11, 11], [8, 14], [5, 11]], PAL.gold2);
  },
  'icon-shield': (p) => {
    p.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], PAL.steel3);
    p.poly([[4, 4], [12, 4], [12, 8], [8, 12], [4, 8]], PAL.steel2);
    p.line(8, 4, 8, 11, G);
  },
  'icon-book': (p) => {
    p.rect(2, 2, 12, 12, PAL.void3);
    p.rect(4, 3, 9, 10, PAL.bone);
    p.line(6, 5, 11, 5, PAL.void2);
    p.line(6, 7, 11, 7, PAL.void2);
    p.line(6, 9, 10, 9, PAL.void2);
  },
  'icon-clock': (p) => {
    p.circle(8, 8, 6, PAL.void2);
    p.ring(8, 8, 6, VL);
    p.line(8, 8, 8, 4, PAL.white);
    p.line(8, 8, 11, 9, PAL.white);
  },
  'icon-fang': (p) => {
    p.poly([[3, 2], [7, 2], [5, 13]], PAL.bone);
    p.poly([[9, 2], [13, 2], [11, 13]], PAL.bone);
    p.px(5, 13, R);
    p.px(11, 13, R);
    p.px(11, 14, R);
  },
  'icon-soul': (p) => {
    p.poly([[8, 1], [12, 7], [11, 12], [8, 14], [5, 12], [4, 7]], PAL.ghost);
    p.circle(8, 10, 3, '#b3ffe6');
    p.px(7, 9, PAL.outline);
    p.px(9, 9, PAL.outline);
  },
  'icon-multi': (p) => {
    for (const y of [3, 8, 13]) {
      p.line(2, y, 11, y, S);
      p.poly([[11, y - 2], [15, y], [11, y + 2]], F);
    }
  },
  'icon-arrow': (p) => {
    p.line(1, 8, 11, 8, S, 2);
    p.poly([[10, 3], [15, 8], [10, 13]], F);
    p.line(1, 5, 4, 5, FL);
    p.line(1, 11, 4, 11, FL);
  },
  'icon-void-bolt': (p) => {
    p.circle(10, 8, 3, V);
    p.px(10, 8, VL);
    p.line(1, 8, 6, 8, PAL.void3);
    p.line(3, 6, 6, 7, PAL.void3);
  },
  'icon-void-orb': (p) => {
    p.circle(8, 8, 6, PAL.void3);
    p.circle(8, 8, 4, V);
    p.circle(8, 8, 2, PAL.outline);
    p.px(4, 4, VL);
    p.px(12, 11, VL);
  },
  'icon-explosion': (p) => {
    p.poly([[8, 0], [10, 5], [16, 4], [11, 8], [15, 13], [9, 11], [6, 16], [6, 10], [0, 11], [5, 7], [1, 2], [7, 4]], R);
    p.circle(8, 8, 3, G);
  },
  'icon-chain': (p) => {
    p.ring(5, 5, 3, VL);
    p.ring(11, 11, 3, VL);
    p.line(6, 8, 8, 10, V, 2);
  },
  'icon-black-hole': (p) => {
    p.circle(8, 8, 7, PAL.void3);
    for (let a = 0; a < 12; a += 0.4) p.px(8 + Math.cos(a) * a * 0.55, 8 + Math.sin(a) * a * 0.55, VL);
    p.circle(8, 8, 2, PAL.outline);
  },
  'icon-event-horizon': (p) => {
    p.circle(8, 8, 7, V);
    p.circle(8, 8, 5, PAL.outline);
    p.ring(8, 8, 7, VL);
    p.line(0, 8, 15, 8, PAL.gold2);
    p.circle(8, 8, 3, PAL.outline);
  },
  'icon-void-resonance': (p) => {
    p.circle(8, 8, 2, VL);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      p.px(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, V);
      p.px(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, PAL.void3);
    }
  },
  'icon-crimson-slash': (p) => {
    for (let a = -2.2; a < 0.6; a += 0.08) {
      p.px(7 + Math.cos(a) * 7, 9 + Math.sin(a) * 7, R);
      p.px(7 + Math.cos(a) * 6, 9 + Math.sin(a) * 6, RL);
    }
    p.line(3, 14, 9, 8, S);
  },
  'icon-reaper-strike': (p) => {
    p.line(3, 13, 13, 3, PAL.steel3, 2);
    p.line(4, 13, 14, 3, R);
    p.line(2, 10, 6, 14, PAL.blood1);
  },
  'icon-wave': (p) => {
    for (let y = 1; y < 15; y++) {
      const t = Math.abs(y - 8) / 7;
      p.rect(Math.round(11 - t * t * 8), y, 3, 1, R);
    }
    p.line(2, 8, 6, 8, RL);
  },
  'icon-drop': (p) => {
    p.poly([[8, 1], [12, 9], [4, 9]], R);
    p.circle(8, 10, 4, R);
    p.px(6, 9, RL);
  },
  'icon-blood-rush': (p) => {
    p.poly([[4, 4], [14, 8], [4, 12]], R);
    p.line(0, 6, 6, 6, RL);
    p.line(0, 10, 6, 10, RL);
    p.line(2, 8, 9, 8, PAL.white);
  },
  'icon-blood-moon': (p) => {
    p.circle(8, 8, 7, PAL.blood2);
    p.circle(10, 6, 6, PAL.blood0);
    p.px(4, 9, RL);
    p.px(5, 12, RL);
  },
  'icon-bloodlust': (p) => {
    p.circle(5, 6, 3, R);
    p.circle(10, 6, 3, R);
    p.poly([[2, 7], [13.5, 7], [7.5, 14]], R);
    p.poly([[8, 2], [11, 6], [5, 6]], PAL.bone);
  },
  'icon-frost-shard': (p) => {
    p.poly([[1, 8], [8, 4], [15, 8], [8, 12]], F);
    p.line(4, 8, 12, 8, FL);
  },
  'icon-ice-lance': (p) => {
    p.poly([[1, 13], [3, 10], [14, 1], [6, 12]], F);
    p.line(3, 12, 13, 2, FL);
  },
  'icon-shatter': (p) => {
    p.poly([[5, 5], [9, 3], [11, 7], [7, 10]], F);
    p.poly([[1, 9], [4, 8], [4, 12]], FL);
    p.poly([[12, 11], [15, 10], [13, 14]], FL);
    p.poly([[10, 1], [13, 1], [12, 3]], FL);
  },
  'icon-frostbite': (p) => {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      p.line(8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, F);
    }
    p.px(8, 8, FL);
  },
  'icon-frozen-ground': (p) => {
    p.ellipse(8, 11, 7, 3, PAL.frost2);
    p.ellipse(8, 11, 5, 2, F);
    p.poly([[4, 11], [5, 4], [6, 11]], FL);
    p.poly([[9, 11], [10, 2], [11, 11]], FL);
  },
  'icon-absolute-zero': (p) => {
    p.circle(8, 8, 7, PAL.frost1);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      p.line(8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, FL);
    }
    p.circle(8, 8, 2, PAL.white);
  },
  'icon-fusion-halo': (p) => {
    p.circle(8, 8, 2, VL);
    p.ring(8, 8, 6, PAL.void3);
    p.circle(8, 2, 2, V);
    p.circle(3, 11, 2, V);
    p.circle(13, 11, 2, V);
    p.px(8, 2, G);
    p.px(3, 11, G);
    p.px(13, 11, G);
  },
  'icon-fusion-singularity': (p) => {
    p.circle(10, 8, 5, PAL.void3);
    p.circle(10, 8, 3, PAL.outline);
    p.ring(10, 8, 5, VL);
    p.line(0, 5, 4, 7, V);
    p.line(0, 11, 4, 9, V);
    p.line(1, 8, 5, 8, G);
  },
  'icon-fusion-whirl': (p) => {
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      const r = 3 + a * 0.75;
      p.px(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, a > 4 ? RL : R);
    }
    p.line(6, 10, 10, 6, S);
    p.px(8, 8, G);
  },
  'icon-fusion-geyser': (p) => {
    p.ellipse(8, 13, 6, 2, PAL.blood2);
    p.rect(6, 4, 4, 9, R);
    p.rect(7, 3, 2, 9, RL);
    p.px(4, 3, R);
    p.px(12, 2, R);
    p.px(3, 6, RL);
    p.px(13, 6, RL);
    p.px(8, 1, G);
  },
  'icon-fusion-comet': (p) => {
    p.line(1, 14, 9, 6, PAL.frost2, 2);
    p.line(3, 14, 10, 7, FL);
    p.circle(11, 5, 4, F);
    p.circle(11, 5, 2, FL);
    p.px(11, 4, PAL.white);
    p.px(5, 7, G);
  },
  'icon-fusion-aura': (p) => {
    p.ellipse(8, 9, 7, 6, PAL.frost1);
    p.ring(8, 9, 6, F);
    p.circle(8, 9, 2, FL);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      p.px(8 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, PAL.white);
    }
    p.px(8, 1, G);
  },
  'icon-dash': (p) => {
    p.poly([[6, 3], [14, 8], [6, 13]], PAL.snow);
    p.line(1, 5, 5, 5, PAL.snowShade);
    p.line(0, 8, 5, 8, PAL.snowShade);
    p.line(1, 11, 5, 11, PAL.snowShade);
  },
};

export const ICON_SIZE = 16;
export const ICON_KEYS = Object.keys(ICONS);

export const generateIconAtlas = (): { canvas: HTMLCanvasElement; frames: Record<string, { x: number; y: number }> } => {
  const cols = 8;
  const rows = Math.ceil(ICON_KEYS.length / cols);
  const p = new PixelCanvas(cols * ICON_SIZE, rows * ICON_SIZE);
  const frames: Record<string, { x: number; y: number }> = {};
  ICON_KEYS.forEach((k, i) => {
    const x = (i % cols) * ICON_SIZE;
    const y = Math.floor(i / cols) * ICON_SIZE;
    frames[k] = { x, y };
    p.frame(x, y, ICON_SIZE, ICON_SIZE);
    ICONS[k](p);
    p.outline(PAL.outline);
  });
  p.frame(0, 0, p.width, p.height);
  return { canvas: p.commit(), frames };
};
