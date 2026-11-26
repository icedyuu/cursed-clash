/**
 * Upgrade pool rolling, application and synergy resolution.
 * Pure logic (no Phaser) so it is unit-tested; Player owns one BuildState.
 */
import type { Rng } from '../core/rng';
import type { StatKey, StatModifier } from '../core/stats';
import { RARITIES, RARITY_ORDER } from '../data/rarities';
import { SYNERGIES } from '../data/synergies';
import { UPGRADES, UPGRADE_BY_ID } from '../data/upgrades';
import type { AbilityParamKey, CharacterId, Rarity, SynergyDef, UpgradeDef, UpgradeEffect } from '../data/types';

export interface AbilityMod {
  param: AbilityParamKey;
  op: 'add' | 'mul';
  value: number;
}

export interface BuildState {
  character: CharacterId;
  stacks: Record<string, number>;
  statMods: StatModifier[];
  abilityMods: Record<string, AbilityMod[]>;
  abilityFlags: Record<string, string[]>;
  synergies: string[];
  history: { id: string; rarity: Rarity }[];
}

export interface UpgradeChoice {
  upgrade: UpgradeDef;
  rarity: Rarity;
  /** Synergy this pick would complete, if any – shown on the card. */
  completesSynergy?: SynergyDef;
}

export const createBuild = (character: CharacterId): BuildState => ({
  character,
  stacks: {},
  statMods: [],
  abilityMods: {},
  abilityFlags: {},
  synergies: [],
  history: [],
});

const tier = (r: Rarity): number => RARITIES[r].tier;

export const isUpgradeAvailable = (build: BuildState, up: UpgradeDef): boolean => {
  if (up.characters && !up.characters.includes(build.character)) return false;
  if ((build.stacks[up.id] ?? 0) >= up.maxStacks) return false;
  if (up.requires && !up.requires.every((r) => (build.stacks[r] ?? 0) > 0)) return false;
  if (up.fusion && !up.fusion.every((f) => (build.stacks[f.id] ?? 0) >= f.rank)) return false;
  return true;
};

export const availableUpgrades = (build: BuildState): UpgradeDef[] => UPGRADES.filter((u) => isUpgradeAvailable(build, u));

/** Rolls a rarity, respecting an optional floor (chests/bosses) and the upgrade's own min/max. */
export const rollRarity = (rng: Rng, up: UpgradeDef, floor: Rarity = 'common', luck = 0): Rarity => {
  const minTier = Math.max(tier(floor), up.minRarity ? tier(up.minRarity) : 0);
  const maxTier = up.maxRarity ? tier(up.maxRarity) : 4;
  const options = RARITY_ORDER.filter((r) => tier(r) >= minTier && tier(r) <= maxTier);
  // Luck shifts weight toward higher tiers.
  const picked = rng.weighted(options, (r) => RARITIES[r].weight * (1 + luck * tier(r)));
  return picked ?? options[0];
};

/** Fusions that taking this upgrade moves closer (not yet owned), with progress after the pick. */
export const fusionProgress = (build: BuildState, upgradeId: string): { fusion: UpgradeDef; have: number; need: number }[] =>
  UPGRADES.filter((u) => u.fusion && !(build.stacks[u.id] > 0) && isCharOk(build, u) && u.fusion.some((f) => f.id === upgradeId && (build.stacks[f.id] ?? 0) < f.rank)).map((u) => {
    const parts = u.fusion!;
    const need = parts.reduce((a, f) => a + f.rank, 0);
    const have = parts.reduce((a, f) => a + Math.min(f.rank, (build.stacks[f.id] ?? 0) + (f.id === upgradeId ? 1 : 0)), 0);
    return { fusion: u, have, need };
  });

const isCharOk = (build: BuildState, up: UpgradeDef): boolean => !up.characters || up.characters.includes(build.character);

export const wouldCompleteSynergy = (build: BuildState, upgradeId: string): SynergyDef | undefined =>
  SYNERGIES.find(
    (s) =>
      !build.synergies.includes(s.id) &&
      s.requires.includes(upgradeId) &&
      s.requires.every((r) => r === upgradeId || (build.stacks[r] ?? 0) > 0),
  );

/**
 * Picks `count` distinct upgrades. Ability upgrades are slightly favoured so builds develop identity,
 * and upgrades that would complete a synergy get a small bonus weight.
 */
export const rollChoices = (
  build: BuildState,
  rng: Rng,
  count = 3,
  floor: Rarity = 'common',
  luck = 0,
): UpgradeChoice[] => {
  const pool = availableUpgrades(build);
  const chosen: UpgradeChoice[] = [];
  // An unlocked fusion is always offered (first card) until it is taken.
  const fusions = pool.filter((u) => u.category === 'fusion');
  if (fusions.length > 0 && count > 0) {
    const f = rng.pick(fusions);
    chosen.push({ upgrade: f, rarity: 'legendary' });
  }
  const remaining = pool.filter((u) => u.category !== 'fusion');
  while (chosen.length < count && remaining.length > 0) {
    const up = rng.weighted(remaining, (u) => {
      let w = u.category === 'stat' ? 1 : 1.25;
      if (wouldCompleteSynergy(build, u.id)) w *= 1.6;
      // Upgrades whose min rarity is above the floor are rarer to see.
      if (u.minRarity) w *= u.minRarity === 'rare' ? 0.55 : u.minRarity === 'uncommon' ? 0.8 : 0.4;
      return w;
    });
    if (!up) break;
    remaining.splice(remaining.indexOf(up), 1);
    chosen.push({ upgrade: up, rarity: rollRarity(rng, up, floor, luck), completesSynergy: wouldCompleteSynergy(build, up.id) });
  }
  return chosen;
};

export const scaledValue = (effect: UpgradeEffect, rarity: Rarity): number => {
  if (effect.type === 'flag') return 0;
  if (effect.type === 'heal') return effect.ratio * RARITIES[rarity].power;
  const scale = effect.scale === false ? 1 : RARITIES[rarity].power;
  const v = effect.value * scale;
  // Additive integer-like params (pierce, counts) round to whole numbers.
  if (effect.type === 'ability' && effect.op === 'add' && ['pierce', 'count', 'chainCount', 'stacksToFreeze'].includes(effect.param)) {
    return Math.sign(v) * Math.max(1, Math.round(Math.abs(v)));
  }
  return v;
};

const PERCENT_ADD_STATS: StatKey[] = ['critChance', 'critDamage', 'lifesteal'];
const PERCENT_ADD_PARAMS: AbilityParamKey[] = ['chance', 'ratio', 'slow', 'splashDamage'];

export const formatEffectValue = (effect: UpgradeEffect, rarity: Rarity): string => {
  const v = scaledValue(effect, rarity);
  const percent =
    effect.type === 'heal' ||
    (effect.type !== 'flag' && effect.op === 'mul') ||
    (effect.type === 'stat' && PERCENT_ADD_STATS.includes(effect.stat)) ||
    (effect.type === 'ability' && PERCENT_ADD_PARAMS.includes(effect.param));
  const abs = Math.abs(v);
  if (percent) return `${Math.round(abs * 100)}`;
  return Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
};

export const describeChoice = (choice: UpgradeChoice): string => {
  const numeric = choice.upgrade.effects.filter((e) => e.type !== 'flag');
  return choice.upgrade.description.replace(/\{(\d)\}/g, (_, i) => {
    const e = numeric[Number(i)];
    return e ? formatEffectValue(e, choice.rarity) : '';
  });
};

const applyEffect = (build: BuildState, effect: UpgradeEffect, rarity: Rarity, source: string): void => {
  switch (effect.type) {
    case 'stat':
      build.statMods.push({ stat: effect.stat, op: effect.op, value: scaledValue(effect, rarity), source });
      break;
    case 'ability':
      (build.abilityMods[effect.ability] ??= []).push({ param: effect.param, op: effect.op, value: scaledValue(effect, rarity) });
      break;
    case 'flag': {
      const flags = (build.abilityFlags[effect.ability] ??= []);
      if (!flags.includes(effect.flag)) flags.push(effect.flag);
      break;
    }
    case 'heal':
      // Healing is applied by the owner (Player) – it reads `pendingHealRatio`.
      break;
  }
};

export interface ApplyResult {
  healRatio: number;
  newSynergies: SynergyDef[];
}

export const applyUpgrade = (build: BuildState, upgradeId: string, rarity: Rarity): ApplyResult => {
  const up = UPGRADE_BY_ID[upgradeId];
  if (!up) throw new Error(`Unknown upgrade ${upgradeId}`);
  build.stacks[up.id] = (build.stacks[up.id] ?? 0) + 1;
  build.history.push({ id: up.id, rarity });
  let healRatio = 0;
  for (const e of up.effects) {
    if (e.type === 'heal') healRatio += scaledValue(e, rarity);
    else applyEffect(build, e, rarity, up.id);
  }
  const newSynergies: SynergyDef[] = [];
  for (const s of SYNERGIES) {
    if (build.synergies.includes(s.id)) continue;
    if (s.requires.every((r) => (build.stacks[r] ?? 0) > 0)) {
      build.synergies.push(s.id);
      for (const e of s.effects) applyEffect(build, e, 'common', s.id);
      newSynergies.push(s);
    }
  }
  return { healRatio, newSynergies };
};

/** Applies ability modifiers to base params with the same stacking rule as stats. */
export const computeAbilityParams = <T extends Partial<Record<AbilityParamKey, number>>>(base: T, mods: readonly AbilityMod[] = []): T => {
  const out: Partial<Record<AbilityParamKey, number>> = { ...base };
  const add: Partial<Record<AbilityParamKey, number>> = {};
  const mul: Partial<Record<AbilityParamKey, number>> = {};
  for (const m of mods) {
    const bucket = m.op === 'add' ? add : mul;
    bucket[m.param] = (bucket[m.param] ?? 0) + m.value;
  }
  const keys = new Set<AbilityParamKey>([...(Object.keys(out) as AbilityParamKey[]), ...(Object.keys(add) as AbilityParamKey[])]);
  for (const k of keys) {
    out[k] = ((out[k] ?? 0) + (add[k] ?? 0)) * (1 + Math.max(-0.75, mul[k] ?? 0));
  }
  return out as T;
};
