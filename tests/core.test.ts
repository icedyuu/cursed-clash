import { describe, expect, it } from 'vitest';
import { computeStats, DEFAULT_STATS } from '../src/core/stats';
import { applyArmor, lifestealHeal, rollHit } from '../src/core/damage';
import { createRng } from '../src/core/rng';
import { angleDiff, distToSegment, formatTime, inArc, normalizeMovement } from '../src/core/math';
import { SpatialGrid } from '../src/core/SpatialGrid';
import { gemTextureFor, xpToNext } from '../src/core/progression';

describe('stats', () => {
  it('uses defaults merged with the character base', () => {
    const s = computeStats({ maxHp: 125 }, []);
    expect(s.maxHp).toBe(125);
    expect(s.moveSpeed).toBe(DEFAULT_STATS.moveSpeed);
  });

  it('stacks as (base + Σadd) × (1 + Σmul)', () => {
    const s = computeStats({ maxHp: 100 }, [
      { stat: 'maxHp', op: 'add', value: 20 },
      { stat: 'maxHp', op: 'mul', value: 0.1 },
      { stat: 'maxHp', op: 'mul', value: 0.1 },
    ]);
    expect(s.maxHp).toBeCloseTo(144);
  });

  it('clamps stats to their limits', () => {
    const s = computeStats({}, [
      { stat: 'critChance', op: 'add', value: 5 },
      { stat: 'cooldown', op: 'mul', value: -0.99 },
    ]);
    expect(s.critChance).toBe(0.85);
    expect(s.cooldown).toBe(0.35);
  });
});

describe('damage', () => {
  it('armour has diminishing returns but always deals at least 1', () => {
    expect(applyArmor(20, 0)).toBe(20);
    expect(applyArmor(20, 20)).toBe(10);
    expect(applyArmor(1, 25)).toBe(1);
  });

  it('rollHit applies crit multiplier and variance bounds', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const h = rollHit(100, 1, 0.5, 2, rng);
      const lo = h.crit ? 184 : 92;
      const hi = h.crit ? 216 : 108;
      expect(h.amount).toBeGreaterThanOrEqual(lo);
      expect(h.amount).toBeLessThanOrEqual(hi);
    }
    expect(rollHit(100, 1, 1, 2, createRng(2), false).crit).toBe(false);
  });

  it('lifesteal scales with healing and is never negative', () => {
    expect(lifestealHeal(100, 0.1, 1.5)).toBeCloseTo(15);
    expect(lifestealHeal(-5, 0.1, 1)).toBe(0);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
  });

  it('weighted never picks zero-weight items and handles empty lists', () => {
    const r = createRng(7);
    for (let i = 0; i < 100; i++) expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
    expect(r.weighted([], () => 1)).toBeUndefined();
  });

  it('int is inclusive', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe('math', () => {
  it('diagonal movement is not faster than straight movement', () => {
    const d = normalizeMovement(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    const s = normalizeMovement(0.3, 0);
    expect(s.x).toBeCloseTo(0.3); // analog stick magnitude preserved below 1
  });

  it('angleDiff wraps around', () => {
    // shortest signed turn from a to b crosses the ±π seam
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it('inArc and distToSegment', () => {
    expect(inArc(0, 0, 0, Math.PI / 4, 20, 10, 0)).toBe(true);
    expect(inArc(0, 0, 0, Math.PI / 4, 20, -10, 0)).toBe(false);
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
  });

  it('formatTime', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(605.9)).toBe('10:05');
  });
});

describe('SpatialGrid', () => {
  it('finds items in radius and skips inactive ones', () => {
    const g = new SpatialGrid<{ x: number; y: number; active: boolean }>(48);
    const items = [
      { x: 10, y: 10, active: true },
      { x: 30, y: 10, active: true },
      { x: 400, y: 400, active: true },
      { x: 12, y: 12, active: false },
    ];
    g.rebuild(items);
    const out: typeof items = [];
    g.queryCircle(10, 10, 25, out);
    expect(out).toContain(items[0]);
    expect(out).toContain(items[1]);
    expect(out).not.toContain(items[2]);
    expect(out).not.toContain(items[3]);
  });
});

describe('progression', () => {
  it('xpToNext grows monotonically and the first level is quick', () => {
    expect(xpToNext(1)).toBeLessThanOrEqual(10);
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('gem tiers', () => {
    expect(gemTextureFor(1)).toBe('gem-small');
    expect(gemTextureFor(5)).toBe('gem-medium');
    expect(gemTextureFor(300)).toBe('gem-large');
  });
});
