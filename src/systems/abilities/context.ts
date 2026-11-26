import type { Player, AbilityInstance } from '../../entities/Player';
import type { AbilityParams } from '../../data/types';
import type { World } from '../World';

export interface CastContext {
  w: World;
  p: Player;
  inst: AbilityInstance;
  /** Final params after upgrades and player stats. */
  params: AbilityParams;
  flags: Set<string>;
  aimX: number;
  aimY: number;
  angle: number;
  /** Mouse world point if the player aims with the mouse (for targeted areas). */
  aimPoint: { x: number; y: number } | null;
}

export type Behavior = (c: CastContext) => void;
