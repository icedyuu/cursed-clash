/** Pure damage math. */
import type { Rng } from './rng';

export interface HitResult {
  amount: number;
  crit: boolean;
}

export const rollHit = (
  base: number,
  damageMult: number,
  critChance: number,
  critDamage: number,
  rng: Rng,
  canCrit = true,
): HitResult => {
  const crit = canCrit && rng.chance(critChance);
  // ±8% variance keeps numbers lively without making builds unpredictable.
  const variance = 0.92 + rng.next() * 0.16;
  const amount = Math.max(1, Math.round(base * damageMult * variance * (crit ? critDamage : 1)));
  return { amount, crit };
};

/** Flat armour with diminishing returns; always at least 1 damage. */
export const applyArmor = (amount: number, armor: number): number =>
  Math.max(1, Math.round(amount * (20 / (20 + Math.max(0, armor)))));

export const lifestealHeal = (damageDealt: number, ratio: number, healing: number): number =>
  Math.max(0, damageDealt * ratio * healing);
