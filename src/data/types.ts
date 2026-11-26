/** Shared data-definition types. Everything gameplay-related is described by these configs. */
import type { StatBlock, StatKey } from '../core/stats';

export type CharacterId = 'voidwalker' | 'blood_reaper' | 'frost_witch';
export type AbilitySlot = 'basic' | 'q' | 'e' | 'ult' | 'passive';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type AbilityBehavior =
  | 'projectile'
  | 'meleeArc'
  | 'dashStrike'
  | 'gravityWell'
  | 'groundZone'
  | 'buff'
  | 'freezeNova'
  | 'passive';

export type AbilityParamKey =
  | 'damage'
  | 'cooldown'
  | 'range'
  | 'radius'
  | 'speed'
  | 'duration'
  | 'knockback'
  | 'pierce'
  | 'count'
  | 'spread'
  | 'arc'
  | 'pull'
  | 'tickInterval'
  | 'tickDamage'
  | 'slow'
  | 'freezeTime'
  | 'buildup'
  | 'explosionRadius'
  | 'explosionDamage'
  | 'chainCount'
  | 'chainRange'
  | 'bleedDps'
  | 'width'
  | 'collapseDamage'
  | 'chance'
  | 'ratio'
  | 'stacksToFreeze'
  | 'attackSpeedBonus'
  | 'damageBonus'
  | 'lifestealBonus'
  | 'waveDamage'
  | 'shake'
  /** Basic-attack infusion rank (drives bigger, flashier visuals). */
  | 'infusion'
  /** Damage ratio of secondary hits (splits, bursts, echoes). */
  | 'splashDamage';

export type AbilityParams = Partial<Record<AbilityParamKey, number>>;

export interface AbilityDef {
  id: string;
  name: string;
  slot: AbilitySlot;
  behavior: AbilityBehavior;
  description: string;
  icon: string;
  params: AbilityParams;
  /** Flags enable optional behaviour branches (explode, chain, pierce...). */
  flags?: string[];
  /** Visual theme used by effects. */
  theme: 'void' | 'blood' | 'frost';
  anim: 'attack' | 'cast';
  sfx: string;
  /** Additional projectiles from the "projectiles" stat apply to this ability. */
  multishot?: boolean;
}

export type DashStyle = 'blink' | 'burst' | 'glide';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  role: string;
  playstyle: string;
  lore: string;
  theme: 'void' | 'blood' | 'frost';
  color: number;
  accent: number;
  stats: Partial<StatBlock>;
  /** Movement responsiveness (higher = snappier). */
  acceleration: number;
  dash: { style: DashStyle; duration: number };
  abilities: { basic: string; q: string; e: string; ult: string; passive: string };
  /** Normalised 0-5 ratings for the character select screen. */
  ratings: { damage: number; defense: number; mobility: number; control: number };
}

export type EnemyAi = 'hop' | 'flank' | 'brute' | 'kite' | 'elite' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  ai: EnemyAi;
  texture: string;
  hp: number;
  speed: number;
  contactDamage: number;
  attackDamage: number;
  bodyRadius: number;
  xp: number;
  knockbackResist: number;
  /** Mass for separation; heavier enemies push lighter ones. */
  mass: number;
  color: number;
  deathTheme: 'slime' | 'shadow' | 'bone' | 'void' | 'flesh' | 'king';
  /** AI tuning bag (ranges, timings) – read by behaviour modules. */
  ai_params: Record<string, number>;
  drops?: { heart?: number; chest?: number; magnet?: number };
}

export type UpgradeEffect =
  | { type: 'stat'; stat: StatKey; op: 'add' | 'mul'; value: number; scale?: boolean }
  | { type: 'ability'; ability: string; param: AbilityParamKey; op: 'add' | 'mul'; value: number; scale?: boolean }
  | { type: 'flag'; ability: string; flag: string }
  | { type: 'heal'; ratio: number };

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** {0},{1}... are replaced with the rarity-scaled values of effects in order. */
  description: string;
  characters?: CharacterId[];
  minRarity?: Rarity;
  maxRarity?: Rarity;
  maxStacks: number;
  requires?: string[];
  effects: UpgradeEffect[];
  category: 'stat' | 'ability' | 'passive' | 'fusion';
  /** Fusion: the upgrades (and ranks) that must be owned before this is offered. */
  fusion?: { id: string; rank: number }[];
}

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  requires: string[];
  effects: UpgradeEffect[];
}
