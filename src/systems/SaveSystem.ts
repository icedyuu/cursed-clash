/** LocalStorage persistence for settings, highscores and lifetime stats. Never throws. */
import type { CharacterId } from '../data/types';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
  autoAttack: boolean;
  showFps: boolean;
  fullscreenHint: boolean;
}

export interface HighscoreEntry {
  character: CharacterId;
  time: number;
  kills: number;
  level: number;
  bosses: number;
  date: string;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  highscores: HighscoreEntry[];
  stats: {
    runs: number;
    totalKills: number;
    bossesDefeated: number;
    versusWins: [number, number];
    versusDraws: number;
    bestTime: Partial<Record<CharacterId, number>>;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.75,
  screenShake: true,
  damageNumbers: true,
  autoAttack: false,
  showFps: false,
  fullscreenHint: true,
};

const KEY = 'cursed-clash-save-v1';

const fresh = (): SaveData => ({
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  highscores: [],
  stats: { runs: 0, totalKills: 0, bossesDefeated: 0, versusWins: [0, 0], versusDraws: 0, bestTime: {} },
});

/** Storage abstraction so the logic can be tested with an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memoryStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

export class SaveSystem {
  private data: SaveData;

  constructor(private readonly store: KeyValueStore = SaveSystem.defaultStore()) {
    this.data = this.load();
  }

  static defaultStore(): KeyValueStore {
    try {
      const ls = globalThis.localStorage;
      const probe = '__cc_probe__';
      ls.setItem(probe, '1');
      return ls;
    } catch {
      return memoryStore();
    }
  }

  private load(): SaveData {
    try {
      const raw = this.store.getItem(KEY);
      if (!raw) return fresh();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = fresh();
      return {
        version: 1,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        highscores: Array.isArray(parsed.highscores) ? parsed.highscores.slice(0, 10) : [],
        stats: { ...base.stats, ...(parsed.stats ?? {}) },
      };
    } catch {
      return fresh();
    }
  }

  private persist(): void {
    try {
      this.store.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked – progress just isn't persisted */
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get highscores(): readonly HighscoreEntry[] {
    return this.data.highscores;
  }

  get stats(): SaveData['stats'] {
    return this.data.stats;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
  }

  /** Records a solo run. Returns its rank (0-based) or -1 if it didn't place. */
  recordSoloRun(entry: HighscoreEntry): number {
    this.data.stats.runs++;
    this.data.stats.totalKills += entry.kills;
    this.data.stats.bossesDefeated += entry.bosses;
    const best = this.data.stats.bestTime[entry.character] ?? 0;
    if (entry.time > best) this.data.stats.bestTime[entry.character] = entry.time;
    const list = [...this.data.highscores, entry].sort((a, b) => b.time - a.time || b.kills - a.kills);
    const rank = list.indexOf(entry);
    this.data.highscores = list.slice(0, 10);
    this.persist();
    return rank < 10 ? rank : -1;
  }

  recordVersus(winner: 0 | 1 | null, kills: number, bosses: number): void {
    this.data.stats.runs++;
    this.data.stats.totalKills += kills;
    this.data.stats.bossesDefeated += bosses;
    if (winner === null) this.data.stats.versusDraws++;
    else this.data.stats.versusWins[winner]++;
    this.persist();
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.persist();
  }
}
