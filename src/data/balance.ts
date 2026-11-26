/** Global tuning constants kept out of the gameplay systems. */
export const PLAYER_BALANCE = {
  iframesOnHit: 0.7,
  contactKnockback: 140,
  ultMax: 100,
  ultPassivePerSecond: 0.45,
  ultPerXp: 1.6,
  ultPerDamage: 0.012,
  xpMagnetSpeed: 240,
  reviveNone: true,
};

export const XP_CURVE = {
  base: 3,
  linear: 4,
  exponent: 1.5,
  expScale: 1.0,
};

export const GEM_TIERS = [
  { min: 0, value: 1, texture: 'gem-small' },
  { min: 4, value: 5, texture: 'gem-medium' },
  { min: 20, value: 25, texture: 'gem-large' },
];

/** Versus balancing: instead of doubling enemies, scale several knobs moderately. */
export const VERSUS_BALANCE = {
  spawnRateMult: 1.55,
  enemyHpMult: 0.85,
  enemyDamageMult: 0.95,
  bossHpMult: 1.7,
  xpMult: 1.0,
  /** Catch-up: bonus XP per level behind the opponent. */
  catchUpPerLevel: 0.12,
  catchUpMax: 0.6,
  /** A player this many kills ahead becomes "Hunted": spawns bias toward them. */
  huntedKillLead: 25,
  huntedSpawnBias: 0.7,
  /** Seconds in which a second death still counts as simultaneous. */
  simultaneousDeathWindow: 0.6,
  /** Max distance players may drift apart (they share one screen). */
  leashMargin: 18,
  mirroredPickupEvery: 45,
};

export const UPGRADE_RULES = {
  choices: 3,
  /** Weight multipliers applied per rarity tier when luck boost is active (chests, bosses). */
  chestMinRarity: 'rare' as const,
  bossMinRarity: 'epic' as const,
};
