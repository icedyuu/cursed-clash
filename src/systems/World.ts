/** The shared context every gameplay system receives. Implemented by ArenaScene. */
import type Phaser from 'phaser';
import type { Rng } from '../core/rng';
import type { SpatialGrid } from '../core/SpatialGrid';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';
import type { TelegraphSystem } from './TelegraphSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { ZoneSystem } from './ZoneSystem';
import type { XPSystem } from './XPSystem';
import type { WaveSystem } from './WaveSystem';
import type { AbilitySystem } from './AbilitySystem';
import type { LocalMultiplayerSystem } from './LocalMultiplayerSystem';
import type { GameMode } from '../game/GameManager';

export interface World {
  scene: Phaser.Scene;
  mode: GameMode;
  /** Run time in seconds (pauses with the game). */
  time: number;
  rng: Rng;
  players: Player[];
  enemies: Enemy[];
  enemyGrid: SpatialGrid<Enemy>;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  combat: CombatSystem;
  effects: EffectsSystem;
  telegraphs: TelegraphSystem;
  projectiles: ProjectileSystem;
  zones: ZoneSystem;
  xp: XPSystem;
  waves: WaveSystem;
  abilities: AbilitySystem;
  versus: LocalMultiplayerSystem | null;
  bossesDefeated: number;
  spawnEnemy(id: string, x: number, y: number, opts?: { hpMult?: number; elite?: boolean }): Enemy | null;
  livingPlayers(): Player[];
  nearestPlayer(x: number, y: number): Player | null;
  isBlocked(x: number, y: number, radius: number): boolean;
  hitStop(ms: number): void;
  banner(text: string, color?: string, sub?: string): void;
}
