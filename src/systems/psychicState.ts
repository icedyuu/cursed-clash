/**
 * The Hollow's resource: Psychic Fragments and Psychic Overload.
 * Pure state machine (no Phaser) so it is unit-tested; systems/abilities/psychic.ts
 * applies the resulting buffs and visuals.
 *
 *   normal ──(meter reaches 100)──▶ overload ──(duration ends)──▶ recovery ──▶ normal
 */
export const OVERLOAD_MAX = 100;

export interface PsychicState {
  fragments: number;
  /** 0..100 meter; while overloaded it shows the remaining overload time. */
  overload: number;
  overloadUntil: number;
  recoveryUntil: number;
  /** Run time of the last meter gain (meter decays slowly when idle). */
  lastGainAt: number;
}

export interface PsychicTuning {
  capacity: number;
  overloadDuration: number;
  recoveryDuration: number;
  /** fragments/capacity ratio at which the mind starts to strain. */
  strainRatio: number;
  /** meter per second while straining */
  strainRate: number;
}

export type PsychicPhase = 'normal' | 'overload' | 'recovery';

export const newPsychicState = (): PsychicState => ({ fragments: 0, overload: 0, overloadUntil: 0, recoveryUntil: 0, lastGainAt: -99 });

export const psychicPhase = (s: PsychicState, t: number): PsychicPhase => (s.overloadUntil > t ? 'overload' : s.recoveryUntil > t ? 'recovery' : 'normal');

/** Adds fragments up to capacity. Returns how many were actually stored. */
export const addFragments = (s: PsychicState, n: number, capacity: number): number => {
  const cap = Math.max(1, Math.round(capacity));
  const before = s.fragments;
  s.fragments = Math.min(cap, s.fragments + Math.max(0, Math.round(n)));
  return s.fragments - before;
};

/** Removes up to `max` fragments. Returns how many were consumed. */
export const takeFragments = (s: PsychicState, max: number): number => {
  const n = Math.max(0, Math.min(s.fragments, Math.floor(max)));
  s.fragments -= n;
  return n;
};

/** Feeds the overload meter. Returns true when this gain triggered Psychic Overload. */
export const feedOverload = (s: PsychicState, amount: number, t: number, tuning: PsychicTuning): boolean => {
  if (amount <= 0 || psychicPhase(s, t) !== 'normal') return false;
  s.overload = Math.min(OVERLOAD_MAX, s.overload + amount);
  s.lastGainAt = t;
  if (s.overload >= OVERLOAD_MAX) {
    s.overloadUntil = t + tuning.overloadDuration;
    s.recoveryUntil = s.overloadUntil + tuning.recoveryDuration;
    return true;
  }
  return false;
};

/**
 * Advances the meter. Returns 'overload' when strain triggered it, 'recovery' on the frame
 * overload ends, 'recovered' when the weakened state ends, otherwise null.
 */
export const tickPsychic = (s: PsychicState, dt: number, t: number, tuning: PsychicTuning, prevPhase: PsychicPhase): 'overload' | 'recovery' | 'recovered' | null => {
  const phase = psychicPhase(s, t);
  if (phase === 'overload') {
    s.overload = OVERLOAD_MAX * Math.max(0, (s.overloadUntil - t) / Math.max(0.01, tuning.overloadDuration));
    return null;
  }
  if (phase === 'recovery') {
    s.overload = 0;
    return prevPhase === 'overload' ? 'recovery' : null;
  }
  // normal
  const cap = Math.max(1, Math.round(tuning.capacity));
  if (s.fragments / cap >= tuning.strainRatio) {
    // a crowded mind strains on its own – the deterioration the fragments bring
    if (feedOverload(s, tuning.strainRate * dt, t, tuning)) return 'overload';
  } else if (t - s.lastGainAt > 3) {
    s.overload = Math.max(0, s.overload - 1.5 * dt);
  }
  if (prevPhase === 'recovery') return 'recovered';
  return null;
};
