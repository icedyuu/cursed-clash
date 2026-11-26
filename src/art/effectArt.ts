/** Projectiles, pickups, particles and light textures. */
import { PixelCanvas } from './pixel';
import { PAL } from './palette';

export interface SimpleSheet {
  key: string;
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  rate?: number;
}

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

const radial = (key: string, size: number, stops: [number, string][]): SimpleSheet => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return { key, canvas: c, frameWidth: size, frameHeight: size, frames: 1 };
};

export const generateEffectSheets = (): SimpleSheet[] => [
  sheet('px', 2, 2, 1, (p) => p.rect(0, 0, 2, 2, PAL.white), false),
  sheet('spark', 5, 5, 1, (p) => {
    p.line(2, 0, 2, 4, '#ffffffaa');
    p.line(0, 2, 4, 2, '#ffffffaa');
    p.px(2, 2, PAL.white);
  }, false),
  sheet('ember', 3, 3, 1, (p) => {
    p.rect(0, 0, 3, 3, '#ffffff88');
    p.px(1, 1, PAL.white);
  }, false),
  radial('glow', 32, [
    [0, 'rgba(255,255,255,0.9)'],
    [0.35, 'rgba(255,255,255,0.35)'],
    [1, 'rgba(255,255,255,0)'],
  ]),
  radial('glow-big', 128, [
    [0, 'rgba(255,255,255,0.55)'],
    [0.5, 'rgba(255,255,255,0.18)'],
    [1, 'rgba(255,255,255,0)'],
  ]),
  radial('fog', 128, [
    [0, 'rgba(255,255,255,0.35)'],
    [0.6, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0)'],
  ]),
  // shadows
  sheet('shadow-s', 12, 5, 1, (p) => p.ellipse(5.5, 2, 5.5, 2, '#05020a88'), false),
  sheet('shadow-m', 18, 6, 1, (p) => p.ellipse(8.5, 2.5, 8.5, 2.5, '#05020a88'), false),
  sheet('shadow-l', 30, 9, 1, (p) => p.ellipse(14.5, 4, 14.5, 4, '#05020a88'), false),
  sheet('shadow-xl', 48, 13, 1, (p) => p.ellipse(23.5, 6, 23.5, 6, '#05020a99'), false),
  // projectiles (pointing right; rotated at runtime)
  sheet('proj-void-bolt', 8, 8, 2, (p, f) => {
    p.circle(3.5, 3.5, 3 - f * 0.5, PAL.void4);
    p.circle(3.5, 3.5, 1.5, PAL.void6);
    p.px(3, 3, PAL.white);
  }, false),
  sheet('proj-void-orb', 16, 16, 4, (p, f) => {
    p.circle(7.5, 7.5, 6, PAL.void3);
    p.circle(7.5, 7.5, 4.5, PAL.void5);
    p.circle(7.5, 7.5, 2.5, PAL.outline);
    const a = (f * Math.PI) / 2;
    for (let i = 0; i < 3; i++) {
      const aa = a + (i * Math.PI * 2) / 3;
      p.px(7.5 + Math.cos(aa) * 5, 7.5 + Math.sin(aa) * 5, PAL.void6);
    }
    p.px(7, 7, PAL.void6);
  }),
  sheet('proj-resonance', 6, 6, 2, (p, f) => {
    p.circle(2.5, 2.5, 2 - f * 0.5, PAL.void5);
    p.px(2, 2, PAL.white);
  }, false),
  sheet('proj-frost-shard', 10, 6, 1, (p) => {
    p.poly([[0, 3], [5, 0], [10, 3], [5, 6]], PAL.frost3);
    p.line(2, 3, 8, 3, PAL.frost4);
  }),
  sheet('proj-ice-lance', 24, 8, 2, (p, f) => {
    p.poly([[0, 4], [6, 1], [24, 4], [6, 7]], PAL.frost2);
    p.poly([[3, 4], [8, 2], [22, 4], [8, 6]], PAL.frost3);
    p.line(6, 4, 21, 4, PAL.frost4);
    p.px(2 + f * 3, 2, PAL.white);
  }),
  sheet('proj-blood-wave', 12, 26, 2, (p, f) => {
    for (let y = 0; y < 26; y++) {
      const t = Math.abs(y - 12.5) / 12.5;
      const x = Math.round(8 - t * t * 7);
      const w = Math.max(1, Math.round(4 * (1 - t)));
      p.rect(x - w, y, w, 1, PAL.blood2);
      p.rect(x, y, 2, 1, f ? PAL.blood4 : PAL.blood3);
    }
  }),
  sheet('proj-enemy-bolt', 10, 10, 2, (p, f) => {
    p.circle(4.5, 4.5, 4, '#ff3377');
    p.circle(4.5, 4.5, 2.5, f ? '#ffb3d0' : '#ff7aa8');
    p.px(4, 4, PAL.white);
  }),
  sheet('proj-boss-orb', 14, 14, 2, (p, f) => {
    p.circle(6.5, 6.5, 6, PAL.blood2);
    p.circle(6.5, 6.5, 4, f ? PAL.gold2 : PAL.blood4);
    p.circle(6.5, 6.5, 2, PAL.gold3);
  }),
  // pickups
  sheet('gem-small', 7, 9, 4, (p, f) => {
    p.poly([[3.5, 0], [7, 4.5], [3.5, 9], [0, 4.5]], PAL.frost2);
    p.poly([[3.5, 1], [5.5, 4.5], [3.5, 7], [3.5, 4]], PAL.frost3);
    p.px(2 + (f % 2), 3 + (f > 1 ? 1 : 0), PAL.white);
  }, true, 8),
  sheet('gem-medium', 8, 11, 4, (p, f) => {
    p.poly([[4, 0], [8, 5], [4, 11], [0, 5]], PAL.void3);
    p.poly([[4, 1], [6.5, 5], [4, 9], [4, 5]], PAL.void5);
    p.px(2 + (f % 2), 3 + (f > 1 ? 2 : 0), PAL.white);
  }, true, 8),
  sheet('gem-large', 10, 13, 4, (p, f) => {
    p.poly([[5, 0], [10, 6], [5, 13], [0, 6]], PAL.blood2);
    p.poly([[5, 1], [8, 6], [5, 11], [5, 6]], PAL.gold2);
    p.px(3 + (f % 2), 4 + (f > 1 ? 2 : 0), PAL.white);
    p.px(6, 9, PAL.gold3);
  }, true, 8),
  sheet('pickup-heart', 11, 10, 2, (p, f) => {
    const s = f ? 0 : 0.5;
    p.circle(3, 3, 2.5 + s, PAL.blood3);
    p.circle(7, 3, 2.5 + s, PAL.blood3);
    p.poly([[0.5, 4], [10.5, 4], [5.5, 9.5]], PAL.blood3);
    p.px(2, 2, PAL.blood4);
    p.px(3, 2, PAL.white);
  }, true, 4),
  sheet('pickup-chest', 16, 14, 2, (p, f) => {
    p.rect(1, 5, 14, 8, PAL.wood);
    p.rect(1, 2, 14, 4, PAL.wood2);
    p.rect(1, 5, 14, 1, PAL.gold1);
    p.rect(7, 4, 2, 4, PAL.gold2);
    p.rect(1, 2, 1, 11, PAL.gold1);
    p.rect(14, 2, 1, 11, PAL.gold1);
    p.px(8, 6, f ? PAL.void6 : PAL.void5);
    if (f) for (let i = 0; i < 3; i++) p.px(4 + i * 4, 0, PAL.gold3);
  }, true, 3),
  sheet('pickup-magnet', 12, 12, 2, (p, f) => {
    p.ring(6, 6, 5, PAL.blood3, 3);
    p.rect(0, 6, 12, 6, '#00000000');
    p.rect(1, 6, 3, 4, PAL.blood3);
    p.rect(8, 6, 3, 4, PAL.blood3);
    p.rect(1, 9, 3, 2, PAL.steel4);
    p.rect(8, 9, 3, 2, PAL.steel4);
    if (f) p.px(6, 2, PAL.white);
  }, true, 3),
  sheet('pickup-crown', 18, 13, 2, (p, f) => {
    p.poly([[1, 12], [1, 3], [5, 7], [9, 1], [13, 7], [17, 3], [17, 12]], PAL.gold2);
    p.rect(1, 10, 16, 2, PAL.gold1);
    p.px(9, 6, f ? PAL.eyeRed : PAL.blood4);
    p.px(5, 9, PAL.void5);
    p.px(13, 9, PAL.frost3);
  }, true, 3),
  // aim reticles
  sheet('ui-reticle-p1', 11, 11, 1, (p) => {
    p.ring(5, 5, 4, PAL.void6);
    p.px(5, 5, PAL.white);
    p.px(5, 0, PAL.white);
    p.px(5, 10, PAL.white);
    p.px(0, 5, PAL.white);
    p.px(10, 5, PAL.white);
  }, false),
  sheet('ui-arrow', 9, 7, 1, (p) => {
    p.poly([[0, 0], [9, 3.5], [0, 7], [2, 3.5]], PAL.white);
  }, false),
];
