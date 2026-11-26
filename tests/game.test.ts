import { describe, expect, it } from 'vitest';
import { catchUpBonus, resolveVersus, type VersusContender } from '../src/systems/versusRules';
import { SaveSystem, type KeyValueStore } from '../src/systems/SaveSystem';
import { DIFFICULTY, ENDLESS, SPAWN_SEGMENTS, WAVE_EVENTS, difficultyAt, segmentAt, spawnIntervalAt } from '../src/data/waves';
import { ENEMIES } from '../src/data/enemies';
import { VERSUS_BALANCE } from '../src/data/balance';

const c = (index: 0 | 1, alive: boolean, survivalTime: number, kills: number): VersusContender => ({
  index,
  alive,
  deathTime: alive ? -1 : survivalTime,
  survivalTime,
  kills,
});

describe('versus rules', () => {
  it('the survivor wins', () => {
    expect(resolveVersus(c(0, true, 100, 1), c(1, false, 90, 50)).winner).toBe(0);
    expect(resolveVersus(c(0, false, 90, 50), c(1, true, 100, 1)).winner).toBe(1);
  });
  it('undecided while both live', () => {
    expect(resolveVersus(c(0, true, 1, 1), c(1, true, 1, 1)).winner).toBeNull();
  });
  it('both dead: longer survival wins, then kills, then draw', () => {
    expect(resolveVersus(c(0, false, 100.5, 1), c(1, false, 100.0, 99)).winner).toBe(0);
    const k = resolveVersus(c(0, false, 100, 10), c(1, false, 100, 12));
    expect(k.winner).toBe(1);
    expect(k.reason).toMatch(/kills/i);
    expect(resolveVersus(c(0, false, 100, 10), c(1, false, 100, 10)).winner).toBeNull();
  });
  it('catch-up bonus only helps the trailing player and is capped', () => {
    expect(catchUpBonus(5, 3, 0.12, 0.6)).toBe(1);
    expect(catchUpBonus(3, 5, 0.12, 0.6)).toBeCloseTo(1.24);
    expect(catchUpBonus(1, 30, 0.12, 0.6)).toBeCloseTo(1.6);
  });
});

const memStore = (): KeyValueStore & { raw: Map<string, string> } => {
  const raw = new Map<string, string>();
  return { raw, getItem: (k) => raw.get(k) ?? null, setItem: (k, v) => void raw.set(k, v) };
};

describe('SaveSystem', () => {
  it('persists settings and survives reload', () => {
    const store = memStore();
    new SaveSystem(store).updateSettings({ masterVolume: 0.3 });
    expect(new SaveSystem(store).settings.masterVolume).toBe(0.3);
  });

  it('keeps the top 10 highscores sorted by time', () => {
    const s = new SaveSystem(memStore());
    for (let i = 0; i < 14; i++) s.recordSoloRun({ character: 'voidwalker', time: i * 10, kills: i, level: 1, bosses: 0, date: '2026-01-01' });
    expect(s.highscores).toHaveLength(10);
    expect(s.highscores[0].time).toBe(130);
    expect(s.stats.runs).toBe(14);
    expect(s.stats.bestTime.voidwalker).toBe(130);
    expect(s.recordSoloRun({ character: 'frost_witch', time: 1, kills: 0, level: 1, bosses: 0, date: '2026-01-01' })).toBe(-1);
  });

  it('records versus results and draws', () => {
    const s = new SaveSystem(memStore());
    s.recordVersus(0, 10, 0);
    s.recordVersus(1, 10, 1);
    s.recordVersus(null, 10, 0);
    expect(s.stats.versusWins).toEqual([1, 1]);
    expect(s.stats.versusDraws).toBe(1);
    expect(s.stats.bossesDefeated).toBe(1);
  });

  it('recovers from corrupt data and blocked storage', () => {
    const store = memStore();
    store.setItem('cursed-clash-save-v1', '{not json');
    expect(new SaveSystem(store).highscores).toEqual([]);
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const s = new SaveSystem(throwing);
    expect(() => s.updateSettings({ screenShake: false })).not.toThrow();
  });

  it('reset clears progress but keeps settings', () => {
    const s = new SaveSystem(memStore());
    s.updateSettings({ sfxVolume: 0.1 });
    s.recordVersus(0, 5, 0);
    s.reset();
    expect(s.stats.runs).toBe(0);
    expect(s.settings.sfxVolume).toBe(0.1);
  });
});

describe('wave timeline', () => {
  it('segments are contiguous from 0 and reference real enemies', () => {
    expect(SPAWN_SEGMENTS[0].from).toBe(0);
    for (let i = 1; i < SPAWN_SEGMENTS.length; i++) expect(SPAWN_SEGMENTS[i].from).toBe(SPAWN_SEGMENTS[i - 1].to);
    for (const s of SPAWN_SEGMENTS) for (const e of s.enemies) expect(ENEMIES[e.id], e.id).toBeDefined();
  });

  it('the first boss arrives between 8 and 10 minutes and endless follows', () => {
    const boss = WAVE_EVENTS.find((e) => e.type === 'boss')!;
    expect(boss.time).toBeGreaterThanOrEqual(480);
    expect(boss.time).toBeLessThanOrEqual(600);
    expect(ENDLESS.startAt).toBeGreaterThan(boss.time);
  });

  it('difficulty only ever increases and accelerates in endless', () => {
    let prev = difficultyAt(0);
    for (let t = 30; t <= 1800; t += 30) {
      const d = difficultyAt(t);
      expect(d.hp).toBeGreaterThan(prev.hp);
      expect(d.damage).toBeGreaterThanOrEqual(prev.damage);
      expect(d.speed).toBeLessThanOrEqual(DIFFICULTY.maxSpeedMult);
      prev = d;
    }
    const slopeEarly = difficultyAt(300).hp - difficultyAt(240).hp;
    const slopeEndless = difficultyAt(1200).hp - difficultyAt(1140).hp;
    expect(slopeEndless).toBeGreaterThan(slopeEarly);
  });

  it('spawn interval is positive everywhere and segmentAt handles endless time', () => {
    for (let t = 0; t < 3600; t += 7) expect(spawnIntervalAt(t)).toBeGreaterThan(0.1);
    expect(segmentAt(99999)).toBe(SPAWN_SEGMENTS[SPAWN_SEGMENTS.length - 1]);
  });

  it('versus scales several knobs instead of doubling enemies', () => {
    expect(VERSUS_BALANCE.spawnRateMult).toBeLessThan(2);
    expect(VERSUS_BALANCE.spawnRateMult).toBeGreaterThan(1);
    expect(VERSUS_BALANCE.enemyHpMult).toBeLessThan(1);
    expect(VERSUS_BALANCE.bossHpMult).toBeGreaterThan(1);
  });
});
