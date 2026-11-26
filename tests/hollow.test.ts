import { describe, expect, it } from 'vitest';
import { addFragments, feedOverload, newPsychicState, psychicPhase, takeFragments, tickPsychic, type PsychicTuning } from '../src/systems/psychicState';
import { CHARACTERS, CHARACTER_ORDER } from '../src/data/characters';
import { ABILITIES } from '../src/data/abilities';
import { HOLLOW_UPGRADES } from '../src/data/hollow';
import { applyUpgrade, computeAbilityParams, createBuild, availableUpgrades } from '../src/systems/UpgradeSystem';

const tune: PsychicTuning = { capacity: 10, overloadDuration: 6, recoveryDuration: 3.5, strainRatio: 0.8, strainRate: 2.5 };

describe('The Hollow: psychic fragments', () => {
  it('stores fragments up to capacity and consumes them', () => {
    const s = newPsychicState();
    expect(addFragments(s, 4, 10)).toBe(4);
    expect(addFragments(s, 10, 10)).toBe(6);
    expect(s.fragments).toBe(10);
    expect(takeFragments(s, 3)).toBe(3);
    expect(takeFragments(s, 99)).toBe(7);
    expect(s.fragments).toBe(0);
  });

  it('overload triggers at 100, then recovery, then back to normal', () => {
    const s = newPsychicState();
    expect(feedOverload(s, 60, 0, tune)).toBe(false);
    expect(feedOverload(s, 50, 1, tune)).toBe(true);
    expect(psychicPhase(s, 1)).toBe('overload');
    // no gains while overloaded or recovering
    expect(feedOverload(s, 50, 2, tune)).toBe(false);
    let prev = psychicPhase(s, 1);
    expect(tickPsychic(s, 0.1, 4, tune, prev)).toBeNull();
    expect(s.overload).toBeCloseTo(50, 0);
    prev = 'overload';
    expect(tickPsychic(s, 0.1, 7.1, tune, prev)).toBe('recovery');
    expect(psychicPhase(s, 7.1)).toBe('recovery');
    expect(feedOverload(s, 100, 8, tune)).toBe(false);
    expect(tickPsychic(s, 0.1, 10.6, tune, 'recovery')).toBe('recovered');
    expect(psychicPhase(s, 10.6)).toBe('normal');
    expect(s.overload).toBe(0);
  });

  it('a crowded mind strains: overload builds on its own near capacity', () => {
    const s = newPsychicState();
    addFragments(s, 8, 10);
    let t = 0;
    let ev = null;
    for (let i = 0; i < 60 * 50 && !ev; i++) ev = tickPsychic(s, 1 / 60, (t += 1 / 60), tune, 'normal');
    expect(ev).toBe('overload');
    expect(t).toBeGreaterThan(30);
    // with few fragments it decays instead
    const q = newPsychicState();
    feedOverload(q, 40, 0, tune);
    tickPsychic(q, 1, 10, tune, 'normal');
    expect(q.overload).toBeLessThan(40);
  });
});

describe('The Hollow: data', () => {
  it('is the fourth playable character with all abilities defined', () => {
    expect(CHARACTER_ORDER).toEqual(['voidwalker', 'blood_reaper', 'frost_witch', 'hollow']);
    const h = CHARACTERS.hollow;
    expect(h.difficulty).toBe('High');
    for (const id of Object.values(h.abilities)) expect(ABILITIES[id], id).toBeDefined();
    expect(ABILITIES.psychic_burst.behavior).toBe('psychicBurst');
    expect(ABILITIES.outlet_seal.behavior).toBe('outletSeal');
    expect(ABILITIES.last_remnant.behavior).toBe('lastRemnant');
  });

  it('his upgrades only appear for him and change real params', () => {
    for (const u of HOLLOW_UPGRADES) expect(u.characters).toEqual(['hollow']);
    const other = createBuild('voidwalker');
    expect(availableUpgrades(other).some((u) => HOLLOW_UPGRADES.includes(u))).toBe(false);
    const b = createBuild('hollow');
    applyUpgrade(b, 'fragment_capacity', 'common');
    applyUpgrade(b, 'seal_spread', 'rare');
    expect(computeAbilityParams(ABILITIES.psychic_fragments.params, b.abilityMods.psychic_fragments).capacity).toBe(12);
    expect(computeAbilityParams(ABILITIES.outlet_seal.params, b.abilityMods.outlet_seal).count).toBe(2);
  });
});
