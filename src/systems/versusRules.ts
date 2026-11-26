/** Pure versus rules (unit tested). */
export interface VersusContender {
  index: 0 | 1;
  alive: boolean;
  deathTime: number; // -1 while alive
  survivalTime: number;
  kills: number;
}

export interface VersusOutcome {
  winner: 0 | 1 | null;
  reason: string;
}

/**
 * Last survivor wins. If both died (within the simultaneous window), compare survival
 * time first, then kills; a full tie is a draw.
 */
export const resolveVersus = (a: VersusContender, b: VersusContender, epsilon = 1 / 120): VersusOutcome => {
  if (a.alive && !b.alive) return { winner: a.index, reason: 'Last one standing' };
  if (b.alive && !a.alive) return { winner: b.index, reason: 'Last one standing' };
  if (a.alive && b.alive) return { winner: null, reason: 'Undecided' };
  const dt = a.survivalTime - b.survivalTime;
  if (Math.abs(dt) > epsilon) return { winner: dt > 0 ? a.index : b.index, reason: 'Survived longer (tie-break)' };
  if (a.kills !== b.kills) return { winner: a.kills > b.kills ? a.index : b.index, reason: 'More kills (tie-break)' };
  return { winner: null, reason: 'Perfect tie' };
};

/** Catch-up XP multiplier for the player who is behind in level. */
export const catchUpBonus = (myLevel: number, otherLevel: number, perLevel: number, max: number): number =>
  1 + Math.min(max, Math.max(0, otherLevel - myLevel) * perLevel);
