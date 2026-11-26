/** Data-driven synergies: when every required upgrade is owned, the effects apply once. */
import type { SynergyDef } from './types';

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'singularity_rounds',
    name: 'Singularity Rounds',
    description: 'Piercing Void Orbs explode on EVERY enemy they pass through.',
    requires: ['void_piercing', 'void_explosion'],
    effects: [{ type: 'flag', ability: 'void_orb', flag: 'explodeOnPierce' }],
  },
  {
    id: 'void_storm',
    name: 'Void Storm',
    description: 'Void Chain jumps +2 times and each jump explodes.',
    requires: ['void_chain', 'void_multicast'],
    effects: [
      { type: 'ability', ability: 'void_orb', param: 'chainCount', op: 'add', value: 2, scale: false },
      { type: 'flag', ability: 'void_orb', flag: 'chainExplode' },
    ],
  },
  {
    id: 'crushing_gravity',
    name: 'Crushing Gravity',
    description: 'Enemies trapped in a Black Hole take +40% damage from everything, and the hole collapses violently.',
    requires: ['hole_decay', 'hole_pull'],
    effects: [
      { type: 'flag', ability: 'black_hole', flag: 'vulnerable' },
      { type: 'flag', ability: 'black_hole', flag: 'collapse' },
    ],
  },
  {
    id: 'resonant_void',
    name: 'Resonant Void',
    description: 'Void Resonance particles explode on impact.',
    requires: ['resonance_surge', 'void_explosion'],
    effects: [{ type: 'flag', ability: 'void_resonance', flag: 'explode' }],
  },
  {
    id: 'crimson_cyclone',
    name: 'Crimson Cyclone',
    description: 'Blood waves pierce everything and Twin Fang releases waves in both directions.',
    requires: ['twin_slash', 'crimson_wave'],
    effects: [
      { type: 'flag', ability: 'crimson_slash', flag: 'wavePierce' },
      { type: 'flag', ability: 'reaper_strike', flag: 'wavePierce' },
    ],
  },
  {
    id: 'hemorrhage_feast',
    name: 'Hemorrhage Feast',
    description: 'Bleed damage is +50% stronger and triggers Bloodlust healing.',
    requires: ['hemorrhage', 'rush_trail'],
    effects: [
      { type: 'flag', ability: 'bloodlust', flag: 'bleedHeals' },
      { type: 'ability', ability: 'reaper_strike', param: 'bleedDps', op: 'mul', value: 0.5, scale: false },
      { type: 'ability', ability: 'crimson_slash', param: 'bleedDps', op: 'mul', value: 0.5, scale: false },
      { type: 'ability', ability: 'blood_rush', param: 'bleedDps', op: 'mul', value: 0.5, scale: false },
    ],
  },
  {
    id: 'glacial_shatter',
    name: 'Glacial Shatter',
    description: 'Shatter shards apply heavy frost, and Frozen Ground freezes 30% faster.',
    requires: ['shatter', 'permafrost'],
    effects: [
      { type: 'flag', ability: 'frostbite', flag: 'shardsFreeze' },
      { type: 'ability', ability: 'frozen_ground', param: 'buildup', op: 'mul', value: -0.3, scale: false },
    ],
  },
  {
    id: 'blizzard',
    name: 'Blizzard',
    description: 'Frozen Ground hurls ice shards at enemies inside it.',
    requires: ['glacial_spikes', 'lance_split'],
    effects: [{ type: 'flag', ability: 'frozen_ground', flag: 'blizzard' }],
  },
  {
    id: 'storm_caller',
    name: 'Storm Caller',
    description: 'All basic projectiles pierce +1 enemy.',
    requires: ['multishot', 'velocity'],
    effects: [
      { type: 'ability', ability: 'void_bolt', param: 'pierce', op: 'add', value: 1, scale: false },
      { type: 'ability', ability: 'frost_shard', param: 'pierce', op: 'add', value: 1, scale: false },
    ],
  },
  {
    id: 'undying',
    name: 'Undying',
    description: '+1.5 health regen per second and +3 armor.',
    requires: ['vitality', 'iron_skin'],
    effects: [
      { type: 'stat', stat: 'regen', op: 'add', value: 1.5, scale: false },
      { type: 'stat', stat: 'armor', op: 'add', value: 3, scale: false },
    ],
  },
  {
    id: 'blood_frenzy',
    name: 'Blood Frenzy',
    description: '+15% attack speed and +3% lifesteal.',
    requires: ['vampirism', 'fury'],
    effects: [
      { type: 'stat', stat: 'attackSpeed', op: 'mul', value: 0.15, scale: false },
      { type: 'stat', stat: 'lifesteal', op: 'add', value: 0.03, scale: false },
    ],
  },
];
