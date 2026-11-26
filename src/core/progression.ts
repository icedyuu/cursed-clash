/** Pure progression math (no Phaser) – unit tested. */
import { GEM_TIERS, XP_CURVE } from '../data/balance';

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number): number =>
  Math.round(XP_CURVE.base + XP_CURVE.linear * level + XP_CURVE.expScale * Math.pow(level, XP_CURVE.exponent));

/** Crystal texture for an XP value (bigger crystals for merged / elite drops). */
export const gemTextureFor = (value: number): string => {
  let tex = GEM_TIERS[0].texture;
  for (const t of GEM_TIERS) if (value >= t.min) tex = t.texture;
  return tex;
};
