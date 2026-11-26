/** Global run configuration + services shared across scenes. */
import { SaveSystem } from '../systems/SaveSystem';
import type { CharacterId, Rarity } from '../data/types';
import { audio } from './AudioManager';

export type GameMode = 'solo' | 'versus';

export interface RunConfig {
  mode: GameMode;
  characters: CharacterId[];
  seed: number;
}

export interface PlayerSummary {
  index: 0 | 1;
  character: CharacterId;
  survivalTime: number;
  kills: number;
  level: number;
  damageDealt: number;
  upgrades: { id: string; rarity: Rarity }[];
  synergies: string[];
  alive: boolean;
}

export interface RunResult {
  mode: GameMode;
  time: number;
  bossesDefeated: number;
  players: PlayerSummary[];
  /** Versus: 0/1 winner, null = draw. Solo: undefined. */
  winner?: 0 | 1 | null;
  winReason?: string;
  highscoreRank?: number;
}

class GameManagerImpl {
  readonly save = new SaveSystem();
  run: RunConfig = { mode: 'solo', characters: ['voidwalker'], seed: 1 };
  lastResult: RunResult | null = null;

  constructor() {
    audio.applySettings(this.save.settings);
  }

  startRun(mode: GameMode, characters: CharacterId[]): RunConfig {
    this.run = { mode, characters, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 };
    return this.run;
  }
}

export const GameManager = new GameManagerImpl();
