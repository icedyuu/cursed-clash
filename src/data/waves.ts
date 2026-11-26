/** Difficulty curve and spawn timeline. All times in seconds. */
export interface SpawnSegment {
  from: number;
  to: number;
  /** Seconds between spawn groups at the start/end of the segment (linearly interpolated). */
  interval: [number, number];
  groupSize: [number, number];
  enemies: { id: string; weight: number }[];
}

export type WaveEvent =
  | { time: number; type: 'swarm'; enemy: string; count: number; pattern: 'ring' | 'line' }
  | { time: number; type: 'elite' }
  | { time: number; type: 'boss' }
  | { time: number; type: 'banner'; text: string };

export const SPAWN_SEGMENTS: SpawnSegment[] = [
  { from: 0, to: 60, interval: [1.7, 1.3], groupSize: [2, 3], enemies: [{ id: 'slime', weight: 1 }] },
  { from: 60, to: 120, interval: [1.3, 1.05], groupSize: [2, 4], enemies: [{ id: 'slime', weight: 3 }, { id: 'wraith', weight: 0.6 }] },
  {
    from: 120,
    to: 240,
    interval: [1.1, 0.85],
    groupSize: [3, 6],
    enemies: [
      { id: 'slime', weight: 3 },
      { id: 'wraith', weight: 2 },
      { id: 'bone_knight', weight: 0.7 },
    ],
  },
  {
    from: 240,
    to: 360,
    interval: [0.9, 0.75],
    groupSize: [4, 7],
    enemies: [
      { id: 'slime', weight: 2.5 },
      { id: 'wraith', weight: 2 },
      { id: 'bone_knight', weight: 1 },
      { id: 'void_caster', weight: 1 },
    ],
  },
  {
    from: 360,
    to: 480,
    interval: [0.8, 0.65],
    groupSize: [4, 8],
    enemies: [
      { id: 'slime', weight: 2 },
      { id: 'wraith', weight: 2.2 },
      { id: 'bone_knight', weight: 1.3 },
      { id: 'void_caster', weight: 1.2 },
    ],
  },
  {
    from: 480,
    to: 600,
    interval: [0.9, 0.8],
    groupSize: [3, 6],
    enemies: [
      { id: 'slime', weight: 2 },
      { id: 'wraith', weight: 2 },
      { id: 'bone_knight', weight: 1.2 },
      { id: 'void_caster', weight: 1 },
    ],
  },
  {
    from: 600,
    to: Number.POSITIVE_INFINITY,
    interval: [0.65, 0.45],
    groupSize: [5, 9],
    enemies: [
      { id: 'slime', weight: 2 },
      { id: 'wraith', weight: 2.5 },
      { id: 'bone_knight', weight: 1.6 },
      { id: 'void_caster', weight: 1.4 },
    ],
  },
];

export const WAVE_EVENTS: WaveEvent[] = [
  { time: 2, type: 'banner', text: 'The curse awakens' },
  { time: 75, type: 'swarm', enemy: 'slime', count: 18, pattern: 'ring' },
  { time: 125, type: 'banner', text: 'Shadows gather' },
  { time: 170, type: 'swarm', enemy: 'wraith', count: 14, pattern: 'ring' },
  { time: 245, type: 'banner', text: 'The void casters arrive' },
  { time: 300, type: 'swarm', enemy: 'bone_knight', count: 6, pattern: 'line' },
  { time: 365, type: 'banner', text: 'Abominations stir' },
  { time: 390, type: 'elite' },
  { time: 450, type: 'swarm', enemy: 'wraith', count: 22, pattern: 'ring' },
  { time: 465, type: 'elite' },
  { time: 540, type: 'boss' },
];

/** After the scripted timeline, these repeat forever. */
export const ENDLESS = {
  startAt: 600,
  eliteEvery: 75,
  swarmEvery: 50,
  bossEvery: 330,
};

export const DIFFICULTY = {
  /** Enemy HP multiplier per minute. */
  hpPerMinute: 0.11,
  /** Extra HP scaling per minute after the endless threshold. */
  hpPerMinuteEndless: 0.28,
  damagePerMinute: 0.06,
  damagePerMinuteEndless: 0.12,
  speedPerMinute: 0.012,
  maxSpeedMult: 1.35,
  enemyCap: { solo: 170, versus: 200 },
  /** Boss HP multiplier for each subsequent boss. */
  bossRepeatHp: 1.6,
};

export const difficultyAt = (t: number) => {
  const minutes = t / 60;
  const endless = Math.max(0, (t - ENDLESS.startAt) / 60);
  return {
    hp: 1 + minutes * DIFFICULTY.hpPerMinute + endless * DIFFICULTY.hpPerMinuteEndless,
    damage: 1 + minutes * DIFFICULTY.damagePerMinute + endless * DIFFICULTY.damagePerMinuteEndless,
    speed: Math.min(DIFFICULTY.maxSpeedMult, 1 + minutes * DIFFICULTY.speedPerMinute),
  };
};

export const segmentAt = (t: number): SpawnSegment => {
  for (const s of SPAWN_SEGMENTS) if (t >= s.from && t < s.to) return s;
  return SPAWN_SEGMENTS[SPAWN_SEGMENTS.length - 1];
};

export const spawnIntervalAt = (t: number): number => {
  const s = segmentAt(t);
  const span = Number.isFinite(s.to) ? s.to - s.from : 600;
  const p = Math.min(1, (t - s.from) / span);
  return s.interval[0] + (s.interval[1] - s.interval[0]) * p;
};
