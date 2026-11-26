/**
 * THE HOLLOW – psychic sealer. All of his abilities, his passive resource
 * (Psychic Fragments + Psychic Overload) and his upgrades are plain data here;
 * behaviour modules in systems/abilities/psychic.ts read these params.
 */
import type { AbilityDef, UpgradeDef } from './types';

const deg = (d: number): number => (d * Math.PI) / 180;

export const HOLLOW_ABILITIES: Record<string, AbilityDef> = {
  mind_lash: {
    id: 'mind_lash',
    name: 'Mind Lash',
    slot: 'basic',
    behavior: 'projectile',
    description: 'A needle of borrowed thought. Pierces one enemy.',
    icon: 'icon-mind-lash',
    theme: 'psychic',
    anim: 'attack',
    sfx: 'mind_lash',
    multishot: true,
    params: { damage: 8, cooldown: 0.44, speed: 215, range: 200, radius: 3, knockback: 25, spread: deg(10), count: 1, pierce: 1 },
  },
  psychic_burst: {
    id: 'psychic_burst',
    name: 'Psychic Burst',
    slot: 'q',
    behavior: 'psychicBurst',
    description: 'Psychic explosion around you with knockback. Eats up to 3 fragments for more damage.',
    icon: 'icon-psychic-burst',
    theme: 'psychic',
    anim: 'cast',
    sfx: 'psychic_burst',
    params: {
      damage: 24,
      cooldown: 3.4,
      radius: 58,
      knockback: 170,
      /** fragments consumed per cast */
      consume: 3,
      /** +damage per consumed fragment */
      fragmentDamage: 0.3,
      /** +radius per consumed fragment */
      fragmentRadius: 0.07,
      overloadGain: 9,
      shake: 0.004,
    },
  },
  outlet_seal: {
    id: 'outlet_seal',
    name: 'Outlet Seal',
    slot: 'e',
    behavior: 'outletSeal',
    description: 'Seals a target: slowed, special attacks interrupted, likely to drop a fragment.',
    icon: 'icon-outlet-seal',
    theme: 'psychic',
    anim: 'cast',
    sfx: 'outlet_seal',
    params: {
      damage: 10,
      cooldown: 6,
      range: 170,
      /** aim-assist radius around the cursor / aim line */
      radius: 28,
      duration: 4,
      slow: 0.45,
      /** number of enemies sealed per cast */
      count: 1,
      /** fragment chance when a sealed enemy dies */
      sealChance: 0.75,
      /** control duration multipliers */
      bossResist: 0.3,
      eliteResist: 0.55,
      overloadGain: 7,
    },
  },
  last_remnant: {
    id: 'last_remnant',
    name: 'The Last Remnant',
    slot: 'ult',
    behavior: 'lastRemnant',
    description: 'His wife’s psyche manifests. Her hair binds and drains all nearby, then she detonates.',
    icon: 'icon-last-remnant',
    theme: 'psychic',
    anim: 'cast',
    sfx: 'ultimate_psychic',
    flags: ['ultimate'],
    params: {
      cooldown: 1,
      damage: 95,
      radius: 175,
      /** manifestation time before the hair spreads */
      castTime: 0.7,
      /** how long the hair restrains and drains */
      restrainTime: 1.9,
      tickInterval: 0.35,
      tickDamage: 6,
      knockback: 220,
      /** +damage per fragment she absorbs (all held fragments) */
      fragmentDamage: 0.08,
      bossResist: 0.35,
      eliteResist: 0.6,
      overloadGain: 40,
      shake: 0.01,
    },
  },
  psychic_fragments: {
    id: 'psychic_fragments',
    name: 'Psychic Fragments',
    slot: 'passive',
    behavior: 'passive',
    description: 'Kills drop fragments that empower him and build Psychic Overload, then a weak recovery.',
    icon: 'icon-psychic-fragments',
    theme: 'psychic',
    anim: 'cast',
    sfx: 'none',
    params: {
      capacity: 10,
      /** base fragment chance on kill */
      chance: 0.16,
      damagePerFragment: 0.02,
      /** overload per collected fragment (consumed fragments give 1.6x) */
      overloadGain: 5,
      overloadDuration: 6,
      overloadDamage: 0.35,
      overloadArea: 0.25,
      recoveryDuration: 3.5,
      recoveryPenalty: 0.2,
      /** fragments ratio above which his mind starts to strain (overload builds by itself) */
      ratio: 0.8,
      tickDamage: 2.5,
    },
  },
};

const H: UpgradeDef['characters'] = ['hollow'];

export const HOLLOW_UPGRADES: UpgradeDef[] = [
  { id: 'burst_power', name: 'Psychic Burst: Pressure', icon: 'icon-psychic-burst', category: 'ability', characters: H, maxStacks: 6, description: 'Psychic Burst deals +{0}% damage.', effects: [{ type: 'ability', ability: 'psychic_burst', param: 'damage', op: 'mul', value: 0.22 }] },
  { id: 'burst_radius', name: 'Psychic Burst: Wide Mind', icon: 'icon-psychic-burst', category: 'ability', characters: H, maxStacks: 4, description: 'Psychic Burst radius +{0}%.', effects: [{ type: 'ability', ability: 'psychic_burst', param: 'radius', op: 'mul', value: 0.15 }] },
  { id: 'burst_hunger', name: 'Psychic Burst: Hunger', icon: 'icon-psychic-fragments', category: 'ability', characters: H, minRarity: 'uncommon', maxStacks: 2, description: 'Psychic Burst consumes +{0} more fragment, each worth +{1}% more.', effects: [{ type: 'ability', ability: 'psychic_burst', param: 'consume', op: 'add', value: 1, scale: false }, { type: 'ability', ability: 'psychic_burst', param: 'fragmentDamage', op: 'mul', value: 0.15 }] },
  { id: 'seal_duration', name: 'Outlet Seal: Deep Seal', icon: 'icon-outlet-seal', category: 'ability', characters: H, maxStacks: 4, description: 'Outlet Seal lasts +{0}% longer and slows {1}% more.', effects: [{ type: 'ability', ability: 'outlet_seal', param: 'duration', op: 'mul', value: 0.2 }, { type: 'ability', ability: 'outlet_seal', param: 'slow', op: 'mul', value: 0.08 }] },
  { id: 'seal_spread', name: 'Outlet Seal: Shared Silence', icon: 'icon-outlet-seal', category: 'ability', characters: H, minRarity: 'rare', maxStacks: 3, description: 'Outlet Seal also seals +{0} nearby enemy.', effects: [{ type: 'ability', ability: 'outlet_seal', param: 'count', op: 'add', value: 1, scale: false }] },
  { id: 'seal_cooldown', name: 'Outlet Seal: Reflex', icon: 'icon-hourglass', category: 'ability', characters: H, maxStacks: 3, description: 'Outlet Seal cooldown -{0}%.', effects: [{ type: 'ability', ability: 'outlet_seal', param: 'cooldown', op: 'mul', value: -0.1 }] },
  { id: 'fragment_capacity', name: 'Crowded Mind', icon: 'icon-psychic-fragments', category: 'passive', characters: H, maxStacks: 3, description: 'Hold +{0} more Psychic Fragments.', effects: [{ type: 'ability', ability: 'psychic_fragments', param: 'capacity', op: 'add', value: 2, scale: false }] },
  { id: 'fragment_chance', name: 'Open Wounds', icon: 'icon-psychic-fragments', category: 'passive', characters: H, maxStacks: 4, description: 'Fragment chance on kill +{0}%.', effects: [{ type: 'ability', ability: 'psychic_fragments', param: 'chance', op: 'add', value: 0.04 }] },
  { id: 'fractured_focus', name: 'Fractured Focus', icon: 'icon-psychic-fragments', category: 'passive', characters: H, minRarity: 'uncommon', maxStacks: 3, description: 'Psychic Overload lasts +{0}% longer, recovery is {1}% shorter.', effects: [{ type: 'ability', ability: 'psychic_fragments', param: 'overloadDuration', op: 'mul', value: 0.15 }, { type: 'ability', ability: 'psychic_fragments', param: 'recoveryDuration', op: 'mul', value: -0.15 }] },
  // basic-attack infusions (same system as the other heroes)
  { id: 'lash_resonance', name: 'Mind Lash: Resonant Needle', icon: 'icon-mind-lash', category: 'ability', characters: H, maxStacks: 3, description: 'Mind Lash grows into a bright, humming spike and deals +{0}% damage. Rank 3: it pierces once more.', effects: [{ type: 'ability', ability: 'mind_lash', param: 'damage', op: 'mul', value: 0.14 }, { type: 'ability', ability: 'mind_lash', param: 'radius', op: 'add', value: 1, scale: false }, { type: 'ability', ability: 'mind_lash', param: 'infusion', op: 'add', value: 1, scale: false }] },
  { id: 'lash_echo', name: 'Mind Lash: Stolen Echo', icon: 'icon-outlet-seal', category: 'ability', characters: H, minRarity: 'uncommon', maxStacks: 1, description: 'Mind Lash pops on impact for {0}% damage around the target and briefly seals what it hits.', effects: [{ type: 'flag', ability: 'mind_lash', flag: 'psyburst' }, { type: 'ability', ability: 'mind_lash', param: 'splashDamage', op: 'add', value: 0.3 }] },
  { id: 'remnant_embrace', name: 'The Last Remnant: Embrace', icon: 'icon-last-remnant', category: 'ability', characters: H, minRarity: 'rare', maxStacks: 2, description: 'Her reach +{0}% and the final release +{1}% damage.', effects: [{ type: 'ability', ability: 'last_remnant', param: 'radius', op: 'mul', value: 0.12 }, { type: 'ability', ability: 'last_remnant', param: 'damage', op: 'mul', value: 0.2 }] },
  // fusions: offered once their parts reach the listed ranks
  { id: 'fusion_mind_prison', name: 'Fusion: Mind Prison', icon: 'icon-fusion-prison', category: 'fusion', characters: H, minRarity: 'legendary', maxStacks: 1, fusion: [{ id: 'seal_duration', rank: 2 }, { id: 'seal_spread', rank: 1 }], description: 'Sealed enemies take +30% damage. When one dies, its outlet bursts and seals everything nearby.', effects: [{ type: 'flag', ability: 'outlet_seal', flag: 'prison' }] },
  { id: 'fusion_choir', name: 'Fusion: Choir of the Sealed', icon: 'icon-fusion-choir', category: 'fusion', characters: H, minRarity: 'legendary', maxStacks: 1, fusion: [{ id: 'lash_resonance', rank: 3 }, { id: 'burst_power', rank: 2 }], description: 'Every 5th Mind Lash releases the voices inside him: five seeking psychic needles.', effects: [{ type: 'flag', ability: 'mind_lash', flag: 'choir' }] },
];
