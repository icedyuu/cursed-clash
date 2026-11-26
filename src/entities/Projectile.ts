/** Pooled projectile used by both heroes and enemies. Behaviour flags come from ability data. */
import Phaser from 'phaser';
import { DEPTH } from '../game/GameConfig';
import type { Player } from './Player';
import type { Enemy } from './Enemy';
import type { ParticleKind } from '../systems/EffectsSystem';

export interface ProjectileSpec {
  texture: string;
  team: 'player' | 'enemy';
  owner: Player | null;
  abilityId: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  radius: number;
  damage: number;
  knockback: number;
  pierce: number;
  flags?: Set<string>;
  explosionRadius?: number;
  explosionDamage?: number;
  chainCount?: number;
  chainRange?: number;
  homing?: number;
  trail?: ParticleKind;
  /** Frost stacks/statuses etc. are applied by CombatSystem based on abilityId & owner. */
  spin?: number;
  tint?: number;
  scale?: number;
  light?: number;
}

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  team: 'player' | 'enemy' = 'player';
  owner: Player | null = null;
  abilityId = '';
  damage = 0;
  knockback = 0;
  pierce = 0;
  radius = 3;
  range = 0;
  traveled = 0;
  speed = 0;
  flags = new Set<string>();
  explosionRadius = 0;
  explosionDamage = 0;
  chainCount = 0;
  chainRange = 0;
  homing = 0;
  trail: ParticleKind | null = null;
  spin = 0;
  hitSet = new Set<Enemy>();
  trailTimer = 0;
  lightColor = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'proj-void-bolt', 0);
  }

  fire(s: ProjectileSpec): void {
    this.team = s.team;
    this.owner = s.owner;
    this.abilityId = s.abilityId;
    this.damage = s.damage;
    this.knockback = s.knockback;
    this.pierce = Math.floor(s.pierce);
    this.radius = s.radius;
    this.range = s.range;
    this.traveled = 0;
    this.speed = s.speed;
    this.flags = s.flags ?? new Set();
    this.explosionRadius = s.explosionRadius ?? 0;
    this.explosionDamage = s.explosionDamage ?? 0;
    this.chainCount = Math.floor(s.chainCount ?? 0);
    this.chainRange = s.chainRange ?? 0;
    this.homing = s.homing ?? 0;
    this.trail = s.trail ?? null;
    this.spin = s.spin ?? 0;
    this.hitSet.clear();
    this.trailTimer = 0;
    this.lightColor = s.light ?? 0;
    this.setTexture(s.texture, 0);
    const loop = `${s.texture}:loop`;
    if (this.scene.anims.exists(loop)) this.play(loop, true);
    else this.anims.stop();
    this.setActive(true).setVisible(true).setAlpha(1).setScale(s.scale ?? 1).setDepth(DEPTH.projectiles);
    if (s.tint) this.setTint(s.tint);
    else this.clearTint();
    this.setPosition(s.x, s.y);
    this.setRotation(s.angle);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(s.x, s.y);
    body.setCircle(Math.max(2, s.radius), this.width / 2 - Math.max(2, s.radius), this.height / 2 - Math.max(2, s.radius));
    body.setVelocity(Math.cos(s.angle) * s.speed, Math.sin(s.angle) * s.speed);
  }

  redirect(angle: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.setRotation(angle);
  }

  expire(): void {
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }
}
