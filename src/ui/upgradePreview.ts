/** "Current → next" previews for upgrade cards. */
import type { Player } from '../entities/Player';
import { computeStats, type StatKey } from '../core/stats';
import { computeAbilityParams, scaledValue, type UpgradeChoice } from '../systems/UpgradeSystem';
import { getAbility } from '../data/abilities';
import type { AbilityParamKey } from '../data/types';

const STAT_LABEL: Record<StatKey, [string, 'int' | 'pct' | 'dec' | 'pctAbs' | 's']> = {
  maxHp: ['MAX HP', 'int'],
  moveSpeed: ['SPEED', 'int'],
  damage: ['DAMAGE', 'pct'],
  cooldown: ['COOLDOWN', 'pct'],
  critChance: ['CRIT', 'pctAbs'],
  critDamage: ['CRIT DMG', 'pctAbs'],
  pickupRange: ['PICKUP', 'int'],
  area: ['AREA', 'pct'],
  healing: ['HEALING', 'pct'],
  regen: ['REGEN/S', 'dec'],
  dashDistance: ['DASH', 'int'],
  dashCooldown: ['DASH CD', 's'],
  attackSpeed: ['ATK SPD', 'pct'],
  armor: ['ARMOR', 'dec'],
  xpGain: ['XP GAIN', 'pct'],
  duration: ['DURATION', 'pct'],
  lifesteal: ['LIFESTEAL', 'pctAbs'],
  ultCharge: ['ULT RATE', 'pct'],
  projectiles: ['+PROJ', 'int'],
  projectileSpeed: ['PROJ SPD', 'pct'],
};

const PARAM_LABEL: Partial<Record<AbilityParamKey, [string, 'int' | 'pct' | 'dec' | 'pctAbs' | 's' | 'deg']>> = {
  damage: ['DMG', 'int'],
  count: ['COUNT', 'int'],
  pierce: ['PIERCE', 'int'],
  radius: ['RADIUS', 'int'],
  duration: ['TIME', 's'],
  pull: ['PULL', 'int'],
  tickDamage: ['DOT', 'dec'],
  cooldown: ['CD', 's'],
  range: ['RANGE', 'int'],
  arc: ['ARC', 'deg'],
  bleedDps: ['BLEED', 'dec'],
  chance: ['CHANCE', 'pctAbs'],
  ratio: ['LEECH', 'pctAbs'],
  stacksToFreeze: ['STACKS', 'int'],
  freezeTime: ['FREEZE', 's'],
  buildup: ['FREEZE IN', 's'],
  explosionDamage: ['BLAST', 'pctAbs'],
  waveDamage: ['WAVE', 'pctAbs'],
};

const fmt = (v: number, kind: string): string => {
  switch (kind) {
    case 'pct':
      return `${Math.round(v * 100)}%`;
    case 'pctAbs':
      return `${Math.round(v * 100)}%`;
    case 'dec':
      return v.toFixed(1);
    case 's':
      return `${v.toFixed(1)}s`;
    case 'deg':
      return `${Math.round((v * 180) / Math.PI)}°`;
    default:
      return `${Math.round(v)}`;
  }
};

export const previewChoice = (p: Player, c: UpgradeChoice): string => {
  const e = c.upgrade.effects.find((x) => x.type === 'stat' || x.type === 'ability');
  if (!e) return 'NEW EFFECT';
  if (e.type === 'stat') {
    const [label, kind] = STAT_LABEL[e.stat];
    const before = computeStats(p.def.stats, p.build.statMods)[e.stat];
    const after = computeStats(p.def.stats, [...p.build.statMods, { stat: e.stat, op: e.op, value: scaledValue(e, c.rarity) }])[e.stat];
    return `${label} ${fmt(before, kind)} > ${fmt(after, kind)}`;
  }
  if (e.type === 'ability') {
    const def = getAbility(e.ability);
    const mods = p.build.abilityMods[e.ability] ?? [];
    const before = computeAbilityParams(def.params, mods)[e.param] ?? 0;
    const after = computeAbilityParams(def.params, [...mods, { param: e.param, op: e.op, value: scaledValue(e, c.rarity) }])[e.param] ?? 0;
    const [label, kind] = PARAM_LABEL[e.param] ?? [e.param.toUpperCase(), 'dec'];
    const hasFlag = c.upgrade.effects.some((x) => x.type === 'flag');
    if (hasFlag && (p.build.stacks[c.upgrade.id] ?? 0) === 0) return 'NEW EFFECT';
    return `${label} ${fmt(before, kind)} > ${fmt(after, kind)}`;
  }
  return '';
};
