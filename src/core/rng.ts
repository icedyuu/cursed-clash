/** Seedable RNG (mulberry32) so logic can be tested deterministically. */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
}

export const createRng = (seed = Date.now()): Rng => {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    weighted: (items, weight) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weight(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
  };
};

export const globalRng = createRng();
