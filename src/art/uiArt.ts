/** Nine-slice panels, ability slots and HUD frames – drawn to match the game palette. */
import { PixelCanvas } from './pixel';
import { PAL } from './palette';
import type { SimpleSheet } from './effectArt';

const one = (key: string, w: number, h: number, draw: (p: PixelCanvas) => void): SimpleSheet => {
  const p = new PixelCanvas(w, h);
  draw(p);
  return { key, canvas: p.commit(), frameWidth: w, frameHeight: h, frames: 1 };
};

const panel = (p: PixelCanvas, w: number, h: number, fill: string, border: string, light: string, corner: string): void => {
  p.rect(1, 1, w - 2, h - 2, fill);
  p.rect(2, 0, w - 4, 1, PAL.outline);
  p.rect(2, h - 1, w - 4, 1, PAL.outline);
  p.rect(0, 2, 1, h - 4, PAL.outline);
  p.rect(w - 1, 2, 1, h - 4, PAL.outline);
  p.px(1, 1, PAL.outline);
  p.px(w - 2, 1, PAL.outline);
  p.px(1, h - 2, PAL.outline);
  p.px(w - 2, h - 2, PAL.outline);
  p.rect(2, 1, w - 4, 1, border);
  p.rect(2, h - 2, w - 4, 1, border);
  p.rect(1, 2, 1, h - 4, border);
  p.rect(w - 2, 2, 1, h - 4, border);
  p.rect(3, 2, w - 6, 1, light);
  // corner gems
  for (const [x, y] of [
    [3, 3],
    [w - 4, 3],
    [3, h - 4],
    [w - 4, h - 4],
  ] as [number, number][]) p.px(x, y, corner);
};

export const generateUiSheets = (): SimpleSheet[] => [
  one('ui-panel', 24, 24, (p) => panel(p, 24, 24, '#140e22ee', PAL.void3, PAL.void2, PAL.void5)),
  one('ui-panel-dark', 24, 24, (p) => panel(p, 24, 24, '#0b0714f2', PAL.void1, PAL.void2, PAL.void3)),
  one('ui-panel-gold', 24, 24, (p) => panel(p, 24, 24, '#1a1020f2', PAL.gold1, PAL.gold2, PAL.gold3)),
  // white-bordered card, tinted per rarity at runtime
  one('ui-card', 24, 24, (p) => panel(p, 24, 24, '#ffffff', '#ffffff', '#ffffff', '#ffffff')),
  one('ui-card-fill', 24, 24, (p) => panel(p, 24, 24, '#160f25f5', '#ffffff', '#ffffff', '#ffffff')),
  one('ui-button', 24, 16, (p) => panel(p, 24, 16, '#21173a', PAL.void3, PAL.void4, PAL.void5)),
  one('ui-button-hot', 24, 16, (p) => panel(p, 24, 16, '#3a2366', PAL.void5, PAL.void6, PAL.white)),
  one('ui-slot', 22, 22, (p) => {
    panel(p, 22, 22, '#0d0918ee', PAL.steel2, PAL.steel3, PAL.steel3);
  }),
  one('ui-bar', 8, 8, (p) => p.rect(0, 0, 8, 8, PAL.white)),
  one('ui-vignette', 320, 180, (p) => {
    for (let y = 0; y < 180; y++) {
      for (let x = 0; x < 320; x++) {
        const dx = (x - 160) / 160;
        const dy = (y - 90) / 90;
        const d = Math.sqrt(dx * dx * 0.9 + dy * dy * 1.1);
        const a = Math.max(0, Math.min(1, (d - 0.62) / 0.55));
        if (a > 0) {
          const al = Math.round(a * a * 200);
          p.px(x, y, `#05020a${al.toString(16).padStart(2, '0')}`);
        }
      }
    }
  }),
];
