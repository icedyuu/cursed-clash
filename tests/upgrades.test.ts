import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { computeStats } from '../src/core/stats';
import {
  applyUpgrade,
  availableUpgrades,
  computeAbilityParams,
  createBuild,
  describeChoice,
  fusionProgress,
  rollChoices,
  rollRarity,
  scaledValue,
} from '../src/systems/UpgradeSystem';
import { UPGRADES, UPGRADE_BY_ID } from '../src/data/upgrades';
import { SYNERGIES } from '../src/data/synergies';
import { ABILITIES } from '../src/data/abilities';
import { CHARACTERS, CHARACTER_ORDER } from '../src/data/characters';
import { RARITY_ORDER } from '../src/data/rarities';
import type { CharacterId } from '../src/data/types';

describe('upgrade data integrity', () => {
  it('has unique ids and valid references', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
    for (const u of UPGRADES) {
      for (const r of u.requires ?? []) expect(UPGRADE_BY_ID[r], `${u.id} requires ${r}`).toBeDefined();
      for (const e of u.effects) if (e.type === 'ability' || e.type === 'flag') expect(ABILITIES[e.ability], `${u.id} → ${e.ability}`).toBeDefined();
      expect(u.maxStacks).toBeGreaterThan(0);
    }
  });

  it('offers 25-30 upgrades to every character', () => {
    for (const c of CHARACTER_ORDER) {
      const n = UPGRADES.filter((u) => u.category !== 'fusion' && (!u.characters || u.characters.includes(c))).length;
      expect(n, c).toBeGreaterThanOrEqual(25);
      expect(n, c).toBeLessThanOrEqual(32);
    }
  });

  it('every character ability exists', () => {
    for (const c of CHARACTER_ORDER) for (const id of Object.values(CHARACTERS[c].abilities)) expect(ABILITIES[id], id).toBeDefined();
  });

  it('every synergy is reachable by at least one character', () => {
    for (const s of SYNERGIES) {
      const ok = CHARACTER_ORDER.some((c) => s.requires.every((r) => !UPGRADE_BY_ID[r].characters || UPGRADE_BY_ID[r].characters!.includes(c)));
      expect(ok, s.id).toBe(true);
    }
  });

  it('descriptions have no unresolved placeholders at any rarity', () => {
    for (const u of UPGRADES)
      for (const r of RARITY_ORDER) {
        const text = describeChoice({ upgrade: u, rarity: r });
        expect(text, `${u.id}/${r}`).not.toMatch(/\{\d\}|NaN|undefined/);
      }
  });
});

describe('rolling', () => {
  it('rolls 3 distinct, available choices', () => {
    const build = createBuild('voidwalker');
    const rng = createRng(11);
    for (let i = 0; i < 50; i++) {
      const choices = rollChoices(build, rng, 3);
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((c) => c.upgrade.id)).size).toBe(3);
      for (const c of choices) expect(!c.upgrade.characters || c.upgrade.characters.includes('voidwalker')).toBe(true);
    }
  });

  it('never offers other characters’ upgrades', () => {
    const chars: CharacterId[] = ['blood_reaper', 'frost_witch'];
    for (const ch of chars) {
      const avail = availableUpgrades(createBuild(ch));
      expect(avail.every((u) => !u.characters || u.characters.includes(ch))).toBe(true);
    }
  });

  it('respects rarity floors', () => {
    const rng = createRng(5);
    const up = UPGRADES.find((u) => !u.minRarity && !u.maxRarity)!;
    for (let i = 0; i < 100; i++) expect(['rare', 'epic', 'legendary']).toContain(rollRarity(rng, up, 'rare'));
  });

  it('stops offering maxed upgrades', () => {
    const build = createBuild('voidwalker');
    const up = UPGRADES.find((u) => !u.characters && !u.requires)!;
    for (let i = 0; i < up.maxStacks; i++) applyUpgrade(build, up.id, 'common');
    expect(availableUpgrades(build).some((u) => u.id === up.id)).toBe(false);
  });

  it('upgrades with prerequisites only appear once the prerequisite is owned', () => {
    const dep = UPGRADES.find((u) => u.requires && u.requires.length > 0);
    if (!dep) return;
    const ch = dep.characters?.[0] ?? 'voidwalker';
    const build = createBuild(ch);
    expect(availableUpgrades(build).some((u) => u.id === dep.id)).toBe(false);
    for (const r of dep.requires!) applyUpgrade(build, r, 'common');
    expect(availableUpgrades(build).some((u) => u.id === dep.id)).toBe(true);
  });
});

describe('applying', () => {
  it('higher rarities give larger values', () => {
    const up = UPGRADES.find((u) => u.effects[0].type === 'stat')!;
    const e = up.effects[0];
    expect(Math.abs(scaledValue(e, 'legendary'))).toBeGreaterThan(Math.abs(scaledValue(e, 'common')));
  });

  it('stat upgrades change computed stats', () => {
    const up = UPGRADES.find((u) => !u.characters && u.effects.some((e) => e.type === 'stat' && e.stat === 'maxHp'));
    expect(up).toBeDefined();
    const build = createBuild('blood_reaper');
    const before = computeStats(CHARACTERS.blood_reaper.stats, build.statMods).maxHp;
    applyUpgrade(build, up!.id, 'rare');
    expect(computeStats(CHARACTERS.blood_reaper.stats, build.statMods).maxHp).toBeGreaterThan(before);
  });

  it('ability upgrades change ability params', () => {
    const up = UPGRADES.find((u) => u.effects.some((e) => e.type === 'ability' && e.param === 'damage' && e.value > 0))!;
    const eff = up.effects.find((e) => e.type === 'ability' && e.param === 'damage')!;
    if (eff.type !== 'ability') throw new Error('unreachable');
    const build = createBuild(up.characters?.[0] ?? 'voidwalker');
    for (const r of up.requires ?? []) applyUpgrade(build, r, 'common');
    const base = ABILITIES[eff.ability].params;
    const before = computeAbilityParams(base, build.abilityMods[eff.ability]).damage ?? 0;
    applyUpgrade(build, up.id, 'common');
    expect(computeAbilityParams(base, build.abilityMods[eff.ability]).damage ?? 0).toBeGreaterThan(before);
  });

  it('computeAbilityParams uses the add-then-multiply rule and caps negative multipliers', () => {
    expect(computeAbilityParams({ damage: 10 }, [{ param: 'damage', op: 'add', value: 5 }, { param: 'damage', op: 'mul', value: 0.2 }]).damage).toBeCloseTo(18);
    expect(computeAbilityParams({ cooldown: 4 }, [{ param: 'cooldown', op: 'mul', value: -2 }]).cooldown).toBeCloseTo(1);
  });

  it('completes every synergy exactly once when its requirements are owned', () => {
    for (const s of SYNERGIES) {
      const ch = CHARACTER_ORDER.find((c) => s.requires.every((r) => !UPGRADE_BY_ID[r].characters || UPGRADE_BY_ID[r].characters!.includes(c)))!;
      const build = createBuild(ch);
      const got: string[] = [];
      // satisfy prerequisites of the required upgrades first
      for (const r of s.requires) for (const pre of UPGRADE_BY_ID[r].requires ?? []) if (!build.stacks[pre]) got.push(...applyUpgrade(build, pre, 'common').newSynergies.map((x) => x.id));
      for (const r of s.requires) if (!build.stacks[r]) got.push(...applyUpgrade(build, r, 'common').newSynergies.map((x) => x.id));
      expect(build.synergies, s.id).toContain(s.id);
      expect(got.filter((id) => id === s.id)).toHaveLength(1);
      // applying again must not re-trigger
      const again = applyUpgrade(build, s.requires[0], 'common').newSynergies.map((x) => x.id);
      expect(again).not.toContain(s.id);
    }
  });

  it('rolls flag a choice that would complete a synergy', () => {
    const s = SYNERGIES[0];
    const ch = CHARACTER_ORDER.find((c) => s.requires.every((r) => !UPGRADE_BY_ID[r].characters || UPGRADE_BY_ID[r].characters!.includes(c)))!;
    const build = createBuild(ch);
    for (const r of s.requires.slice(1)) {
      for (const pre of UPGRADE_BY_ID[r].requires ?? []) applyUpgrade(build, pre, 'common');
      applyUpgrade(build, r, 'common');
    }
    for (const pre of UPGRADE_BY_ID[s.requires[0]].requires ?? []) applyUpgrade(build, pre, 'common');
    const rng = createRng(9);
    let flagged = false;
    for (let i = 0; i < 200 && !flagged; i++) flagged = rollChoices(build, rng).some((c) => c.upgrade.id === s.requires[0] && c.completesSynergy?.id === s.id);
    expect(flagged).toBe(true);
  });
});

describe('fusions', () => {
  const fusions = UPGRADES.filter((u) => u.category === 'fusion');

  it('every hero has at least two fusions with valid, reachable parts', () => {
    for (const c of CHARACTER_ORDER) expect(fusions.filter((f) => f.characters?.includes(c)).length, c).toBeGreaterThanOrEqual(2);
    for (const f of fusions) {
      expect(f.fusion && f.fusion.length >= 2, f.id).toBe(true);
      for (const part of f.fusion!) {
        const up = UPGRADE_BY_ID[part.id];
        expect(up, `${f.id} → ${part.id}`).toBeDefined();
        expect(part.rank, `${f.id} rank of ${part.id}`).toBeLessThanOrEqual(up.maxStacks);
        expect(!up.characters || up.characters.includes(f.characters![0]), `${f.id} part ${part.id} usable by hero`).toBe(true);
      }
    }
  });

  const unlock = (fusionId: string) => {
    const f = UPGRADE_BY_ID[fusionId];
    const build = createBuild(f.characters![0]);
    for (const part of f.fusion!) for (let i = 0; i < part.rank; i++) applyUpgrade(build, part.id, 'common');
    return { f, build };
  };

  it('is hidden until all parts reach their rank, then offered first on every roll until taken', () => {
    for (const fu of fusions) {
      const { f, build } = unlock(fu.id);
      expect(availableUpgrades(build).some((u) => u.id === f.id), f.id).toBe(true);
      const rng = createRng(3);
      for (let i = 0; i < 20; i++) {
        const choices = rollChoices(build, rng, 3);
        expect(choices[0].upgrade.category, f.id).toBe('fusion');
        expect(choices).toHaveLength(3);
        expect(new Set(choices.map((c) => c.upgrade.id)).size).toBe(3);
      }
      applyUpgrade(build, f.id, 'legendary');
      expect(availableUpgrades(build).some((u) => u.id === f.id)).toBe(false);
      // one rank short of the last part → not available
      const short = createBuild(f.characters![0]);
      const parts = f.fusion!;
      parts.forEach((part, idx) => {
        const n = idx === parts.length - 1 ? part.rank - 1 : part.rank;
        for (let i = 0; i < n; i++) applyUpgrade(short, part.id, 'common');
      });
      expect(availableUpgrades(short).some((u) => u.id === f.id), `${f.id} early`).toBe(false);
    }
  });

  it('applying a fusion sets its ability flag', () => {
    for (const fu of fusions) {
      const { f, build } = unlock(fu.id);
      applyUpgrade(build, f.id, 'legendary');
      for (const e of f.effects) if (e.type === 'flag') expect(build.abilityFlags[e.ability], f.id).toContain(e.flag);
    }
  });

  it('never offers fusions to other heroes', () => {
    for (const fu of fusions) {
      const other = CHARACTER_ORDER.find((c) => !fu.characters!.includes(c))!;
      expect(availableUpgrades(createBuild(other)).some((u) => u.id === fu.id)).toBe(false);
    }
  });

  it('reports progress toward a fusion on its part cards', () => {
    const f = UPGRADE_BY_ID.fusion_singularity;
    const build = createBuild('voidwalker');
    const prog = fusionProgress(build, 'bolt_overcharge');
    const entry = prog.find((x) => x.fusion.id === f.id)!;
    expect(entry.have).toBe(1);
    expect(entry.need).toBe(5);
  });
});

describe('basic attack infusions', () => {
  it('each hero has an infusion that raises the infusion rank of its basic attack', () => {
    for (const c of CHARACTER_ORDER) {
      const basic = CHARACTERS[c].abilities.basic;
      const inf = UPGRADES.find((u) => u.characters?.includes(c) && u.effects.some((e) => e.type === 'ability' && e.ability === basic && e.param === 'infusion'));
      expect(inf, c).toBeDefined();
      const build = createBuild(c);
      for (let i = 0; i < inf!.maxStacks; i++) applyUpgrade(build, inf!.id, 'common');
      expect(computeAbilityParams(ABILITIES[basic].params, build.abilityMods[basic]).infusion).toBe(inf!.maxStacks);
    }
  });
});
