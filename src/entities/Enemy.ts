/** Pooled enemy. Behaviour lives in systems/ai; this class holds state, statuses and rendering. */
import Phaser from 'phaser';
import { DEPTH } from '../game/GameConfig';
import type { EnemyDef } from '../data/types';
import type { Player } from './Player';
import type { World } from '../systems/World';

export interface Bleed {
  dps: number;
  until: number;
  owner: Player | null;
  heals: boolean;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def!: EnemyDef;
  hp = 1;
  maxHp = 1;
  radius = 6;
  damageMult = 1;
  speedMult = 1;
  isElite = false;
  isBoss = false;
  dying = false;
  target: Player | null = null;

  // movement
  desiredVx = 0;
  desiredVy = 0;
  knockVx = 0;
  knockVy = 0;
  pullVx = 0;
  pullVy = 0;

  // statuses
  slowAmount = 0;
  slowUntil = 0;
  frostStacks = 0;
  frostUntil = 0;
  frostSlow = 0;
  frozenUntil = 0;
  shatterReadyAt = 0;
  vulnerableUntil = 0;
  zoneBuildup = 0;
  bleeds: Bleed[] = [];
  bleedTick = 0;
  /** The Hollow: Outlet Seal (special attacks interrupted) and Last Remnant restraint. */
  sealedUntil = 0;
  sealOwner: Player | null = null;
  rootedUntil = 0;
  sealMark?: Phaser.GameObjects.Image;

  /** Free-form per-AI state. */
  ai: Record<string, number> = {};
  flashUntil = 0;
  lastHitBy: Player | null = null;
  spawnTime = 0;
  /** Texture key whose animations this enemy plays (bosses swap it for palette variants). */
  animBase = '';
  shadow!: Phaser.GameObjects.Image;
  hpBar?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy-slime', 0);
  }

  /** (Re)initialises a pooled instance. */
  spawn(def: EnemyDef, x: number, y: number, hpMult: number, damageMult: number, speedMult: number, time: number): void {
    this.def = def;
    this.isBoss = def.ai === 'boss';
    this.isElite = def.ai === 'elite';
    this.maxHp = Math.round(def.hp * hpMult);
    this.hp = this.maxHp;
    this.damageMult = damageMult;
    this.speedMult = speedMult;
    this.radius = def.bodyRadius;
    this.dying = false;
    this.target = null;
    this.desiredVx = this.desiredVy = this.knockVx = this.knockVy = this.pullVx = this.pullVy = 0;
    this.slowAmount = this.slowUntil = this.frostStacks = this.frostUntil = this.frozenUntil = this.frostSlow = 0;
    this.shatterReadyAt = this.vulnerableUntil = this.zoneBuildup = 0;
    this.sealedUntil = this.rootedUntil = 0;
    this.sealOwner = null;
    this.sealMark?.setVisible(false);
    this.bleeds.length = 0;
    this.bleedTick = 0;
    this.ai = {};
    this.flashUntil = 0;
    this.lastHitBy = null;
    this.spawnTime = time;
    this.setTexture(def.texture, 0);
    this.setActive(true).setVisible(true).setAlpha(1).clearTint().setScale(1).setAngle(0);
    this.setPosition(x, y);
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    const fw = this.frame.width;
    const fh = this.frame.height;
    body.setCircle(this.radius, fw / 2 - this.radius, fh * 0.85 - this.radius);
    body.setCollideWorldBounds(true);
    this.animBase = def.texture;
    this.play(`${def.texture}:move`, true);
    if (!this.shadow) this.shadow = this.scene.add.image(x, y, 'shadow-s').setDepth(DEPTH.shadows);
    const shadowKey = this.radius >= 18 ? 'shadow-xl' : this.radius >= 12 ? 'shadow-l' : this.radius >= 8 ? 'shadow-m' : 'shadow-s';
    this.shadow.setTexture(shadowKey).setVisible(true).setAlpha(1);
    if (this.isElite && !this.hpBar) this.hpBar = this.scene.add.graphics().setDepth(DEPTH.numbers - 1);
    this.hpBar?.setVisible(this.isElite);
    // spawn-in effect: rise from the ground
    this.setAlpha(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 260 });
  }

  isFrozenAt(t: number): boolean {
    return this.frozenUntil > t;
  }

  /** Frozen, sealed or restrained enemies cannot start (or finish) special attacks. */
  isDisabledAt(t: number): boolean {
    return this.frozenUntil > t || this.sealedUntil > t || this.rootedUntil > t;
  }

  isSealedAt(t: number): boolean {
    return this.sealedUntil > t;
  }

  /** Control duration multiplier: bosses and elites shrug control off faster. */
  controlResist(bossResist: number, eliteResist: number): number {
    return this.isBoss ? bossResist : this.isElite ? eliteResist : 1;
  }

  /** Outlet Seal. `duration` is already resist-scaled. */
  seal(duration: number, t: number, owner: Player | null): void {
    // a seal without owner (her restraint) keeps an active Outlet Seal's owner, clears a stale one
    if (owner) this.sealOwner = owner;
    else if (this.sealedUntil <= t) this.sealOwner = null;
    this.sealedUntil = Math.max(this.sealedUntil, t + duration);
    if (!this.sealMark) this.sealMark = this.scene.add.image(this.x, this.y, 'fx-seal').setDepth(DEPTH.numbers - 3);
    this.sealMark.setVisible(true).setAlpha(1).setScale(1.6);
    this.scene.tweens.add({ targets: this.sealMark, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** Held in place by her hair (Last Remnant). `duration` is already resist-scaled. */
  root(duration: number, t: number): void {
    this.rootedUntil = Math.max(this.rootedUntil, t + duration);
  }

  slowFactorAt(t: number): number {
    if (this.frozenUntil > t || this.rootedUntil > t) return 0;
    let s = this.slowUntil > t ? this.slowAmount : 0;
    if (this.frostUntil > t) s = Math.max(s, this.frostSlow);
    return Math.max(0.15, 1 - Math.min(0.85, s));
  }

  applySlow(amount: number, duration: number, t: number): void {
    if (amount >= this.slowAmount || this.slowUntil < t) this.slowAmount = amount;
    this.slowUntil = Math.max(this.slowUntil, t + duration);
  }

  freeze(duration: number, t: number): void {
    const resist = this.isBoss ? 0.25 : this.isElite ? 0.5 : 1;
    this.frozenUntil = Math.max(this.frozenUntil, t + duration * resist);
    this.frostStacks = 0;
  }

  knockback(dx: number, dy: number, force: number): void {
    const f = force * (1 - this.def.knockbackResist);
    this.knockVx += dx * f;
    this.knockVy += dy * f;
  }

  /** Physics/visual integration after AI chose a desired velocity. */
  integrate(dt: number, w: World): void {
    const t = w.time;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const slow = this.slowFactorAt(t);
    const frozen = this.frozenUntil > t || this.rootedUntil > t;
    // knockback & pull decay exponentially
    const decay = Math.exp(-dt * 9);
    this.knockVx *= decay;
    this.knockVy *= decay;
    const vx = (frozen ? 0 : this.desiredVx * slow) + this.knockVx + this.pullVx;
    const vy = (frozen ? 0 : this.desiredVy * slow) + this.knockVy + this.pullVy;
    body.setVelocity(vx, vy);
    this.pullVx = 0;
    this.pullVy = 0;
    if (Math.abs(this.desiredVx) > 2) this.setFlipX(this.desiredVx < 0);
    // visuals
    this.setDepth(DEPTH.entities + this.y);
    this.shadow.setPosition(this.x, this.y + 1);
    if (this.flashUntil > t) this.setTintFill(0xffffff);
    else if (this.rootedUntil > t) this.setTint(Math.floor(t * 18 + this.spawnTime * 7) % 3 === 0 ? 0xffffff : 0x6f5f9a);
    else if (frozen) this.setTint(0x9feaff);
    else if (this.frostUntil > t && this.frostStacks > 0) this.setTint(0xc8f4ff);
    else if (this.sealedUntil > t) this.setTint(0xa898c8);
    else if (this.vulnerableUntil > t) this.setTint(0xe0b3ff);
    else if (this.isElite) this.setTint(0xffe0ea);
    else this.clearTint();
    if (this.sealMark?.visible) {
      if (this.sealedUntil > t) {
        const left = this.sealedUntil - t;
        this.sealMark.setPosition(Math.round(this.x), Math.round(this.y - this.displayHeight * 0.85 - 7)).setAlpha(left < 0.8 ? (Math.floor(t * 12) % 2 ? 0.3 : 0.9) : 0.9);
        this.sealMark.setDepth(DEPTH.numbers - 3);
      } else this.sealMark.setVisible(false);
    }
    if (frozen && this.frozenUntil > t) this.anims.pause();
    else if (this.anims.isPaused) this.anims.resume();
    if (this.hpBar && this.isElite) {
      const g = this.hpBar;
      g.clear();
      const w2 = 28;
      const x = Math.round(this.x - w2 / 2);
      const y = Math.round(this.y - this.displayHeight * 0.85 - 6);
      g.fillStyle(0x0d0816, 1).fillRect(x - 1, y - 1, w2 + 2, 4);
      g.fillStyle(0x4a1a35, 1).fillRect(x, y, w2, 2);
      g.fillStyle(0xff66cc, 1).fillRect(x, y, Math.max(0, Math.round((w2 * this.hp) / this.maxHp)), 2);
    }
  }

  /** Starts the death animation; the pool reclaims the instance afterwards. */
  kill(): void {
    if (this.dying) return;
    this.dying = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.clearTint();
    this.anims.resume();
    this.hpBar?.clear().setVisible(false);
    this.sealMark?.setVisible(false);
    this.play(`${this.animBase}:death`, true);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.despawn());
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 300 });
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.shadow?.setVisible(false);
    this.hpBar?.setVisible(false);
    this.sealMark?.setVisible(false);
  }
}
