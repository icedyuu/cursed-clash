/**
 * Character statistics and modifier stacking. Pure logic – no Phaser.
 * final = (base + sum(add)) * (1 + sum(mul)), then clamped per stat.
 */
export type StatKey =
  | 'maxHp'
  | 'moveSpeed'
  | 'damage'
  | 'cooldown'
  | 'critChance'
  | 'critDamage'
  | 'pickupRange'
  | 'area'
  | 'healing'
  | 'regen'
  | 'dashDistance'
  | 'dashCooldown'
  | 'attackSpeed'
  | 'armor'
  | 'xpGain'
  | 'duration'
  | 'lifesteal'
  | 'ultCharge'
  | 'projectiles'
  | 'projectileSpeed';

export type StatBlock = Record<StatKey, number>;

export interface StatModifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** Optional tag so temporary buffs can be removed. */
  source?: string;
}

export const DEFAULT_STATS: StatBlock = {
  maxHp: 100,
  moveSpeed: 90,
  damage: 1,
  cooldown: 1,
  critChance: 0.05,
  critDamage: 1.5,
  pickupRange: 36,
  area: 1,
  healing: 1,
  regen: 0,
  dashDistance: 70,
  dashCooldown: 1.6,
  attackSpeed: 1,
  armor: 0,
  xpGain: 1,
  duration: 1,
  lifesteal: 0,
  ultCharge: 1,
  projectiles: 0,
  projectileSpeed: 1,
};

const LIMITS: Partial<Record<StatKey, [number, number]>> = {
  cooldown: [0.35, 2],
  critChance: [0, 0.85],
  dashCooldown: [0.4, 5],
  attackSpeed: [0.3, 3.5],
  lifesteal: [0, 0.5],
  moveSpeed: [30, 220],
  area: [0.5, 3],
  armor: [0, 25],
  projectiles: [0, 8],
};

export const computeStats = (base: Partial<StatBlock>, mods: readonly StatModifier[]): StatBlock => {
  const result = { ...DEFAULT_STATS, ...base } as StatBlock;
  const add: Partial<StatBlock> = {};
  const mul: Partial<StatBlock> = {};
  for (const m of mods) {
    const bucket = m.op === 'add' ? add : mul;
    bucket[m.stat] = (bucket[m.stat] ?? 0) + m.value;
  }
  for (const key of Object.keys(result) as StatKey[]) {
    let v = (result[key] + (add[key] ?? 0)) * (1 + (mul[key] ?? 0));
    const lim = LIMITS[key];
    if (lim) v = Math.min(lim[1], Math.max(lim[0], v));
    result[key] = v;
  }
  return result;
};
