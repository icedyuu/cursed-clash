/** Pooled pickup: XP crystals, hearts, chests, magnets and the boss crown. */
import Phaser from 'phaser';
import { DEPTH } from '../game/GameConfig';
import type { Player } from './Player';

export type PickupKind = 'xp' | 'heart' | 'chest' | 'magnet' | 'crown' | 'fragment';

export class Pickup extends Phaser.GameObjects.Sprite {
  kind: PickupKind = 'xp';
  value = 1;
  target: Player | null = null;
  speed = 0;
  bornAt = 0;
  baseY = 0;
  /** Versus: a pickup reserved for one player (mirrored spawns). */
  reservedFor: 0 | 1 | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'gem-small', 0);
  }

  init(kind: PickupKind, x: number, y: number, value: number, texture: string, time: number): void {
    this.kind = kind;
    this.value = value;
    this.target = null;
    this.speed = 0;
    this.bornAt = time;
    this.baseY = y;
    this.reservedFor = null;
    this.setTexture(texture, 0).setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1).setOrigin(0.5, 0.8);
    this.setDepth(DEPTH.pickups + (kind === 'xp' ? 0 : 1));
    const loop = `${texture}:loop`;
    const anim = this.scene.anims.get(loop);
    // random phase so crystals don't pulse in lockstep (clamped: hearts/chests only have 2 frames)
    if (anim) this.play({ key: loop, startFrame: Math.floor(Math.random() * anim.frames.length) }, true);
  }

  release(): void {
    this.setActive(false).setVisible(false);
    this.anims.stop();
    this.target = null;
  }
}
