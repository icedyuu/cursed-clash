/**
 * Local Versus rules on top of the shared arena:
 *  - shared enemy ecosystem, independent progression (each Player owns its build)
 *  - catch-up XP for the trailing player, "Hunted" status for a runaway kill leader
 *  - mirrored resource drops so both players have equal access
 *  - a camera leash: both heroes always stay on the shared screen
 *  - death resolution with a simultaneous-death window and tie-breakers
 */
import Phaser from 'phaser';
import type { World } from './World';
import type { Player } from '../entities/Player';
import { VERSUS_BALANCE } from '../data/balance';
import { catchUpBonus, resolveVersus, type VersusOutcome } from './versusRules';
import { GAME_HEIGHT, GAME_WIDTH, ARENA } from '../game/GameConfig';

export class LocalMultiplayerSystem {
  readonly balance = VERSUS_BALANCE;
  private firstDeathAt = -1;
  private nextMirrorDrop = VERSUS_BALANCE.mirroredPickupEvery;
  outcome: VersusOutcome | null = null;

  constructor(private readonly world: () => World) {}

  xpBonusFor(p: Player): number {
    const other = this.world().players.find((o) => o !== p);
    if (!other) return 1;
    return catchUpBonus(p.level, other.level, this.balance.catchUpPerLevel, this.balance.catchUpMax);
  }

  update(): void {
    const w = this.world();
    const [a, b] = w.players;
    if (!a || !b) return;
    // Hunted: a big kill lead draws more enemies toward the leader.
    a.hunted = a.alive && a.kills - b.kills >= this.balance.huntedKillLead;
    b.hunted = b.alive && b.kills - a.kills >= this.balance.huntedKillLead;
    // Mirrored hearts: one reserved for each player, near each player.
    if (w.time >= this.nextMirrorDrop) {
      this.nextMirrorDrop = w.time + this.balance.mirroredPickupEvery;
      for (const p of w.livingPlayers()) {
        const ang = w.rng.next() * Math.PI * 2;
        w.xp.drop('heart', p.x + Math.cos(ang) * 60, p.y + Math.sin(ang) * 40, p.index);
      }
    }
    this.leash();
  }

  /** Keeps both living players inside one screen so the shared camera works. */
  private leash(): void {
    const w = this.world();
    const living = w.livingPlayers();
    if (living.length < 2) return;
    const [a, b] = living;
    const m = this.balance.leashMargin;
    const maxDx = GAME_WIDTH - m * 2 - 24;
    const maxDy = GAME_HEIGHT - m * 2 - 70; // HUD space
    const fix = (axis: 'x' | 'y', max: number) => {
      const d = b[axis] - a[axis];
      if (Math.abs(d) <= max) return;
      const over = (Math.abs(d) - max) / 2;
      const s = Math.sign(d);
      for (const [p, dir] of [
        [a, s],
        [b, -s],
      ] as [Player, number][]) {
        const body = p.body as Phaser.Physics.Arcade.Body;
        p[axis] += dir * over;
        if (axis === 'x') body.x += dir * over;
        else body.y += dir * over;
        // cancel velocity pushing them apart
        const v = axis === 'x' ? body.velocity.x : body.velocity.y;
        if (Math.sign(v) === -dir) {
          if (axis === 'x') body.velocity.x = 0;
          else body.velocity.y = 0;
        }
      }
    };
    fix('x', maxDx);
    fix('y', maxDy);
    const bb = ARENA.bounds;
    for (const p of living) {
      p.x = Phaser.Math.Clamp(p.x, bb.x + 4, bb.x + bb.w - 4);
      p.y = Phaser.Math.Clamp(p.y, bb.y + 4, bb.y + bb.h - 2);
    }
  }

  /** Call every frame; returns the outcome once the match is decided. */
  checkEnd(): VersusOutcome | null {
    if (this.outcome) return this.outcome;
    const w = this.world();
    const [a, b] = w.players;
    const dead = w.players.filter((p) => !p.alive);
    if (dead.length === 0) return null;
    if (this.firstDeathAt < 0) this.firstDeathAt = w.time;
    // wait a moment so near-simultaneous deaths are judged fairly
    if (dead.length === 1 && w.time - this.firstDeathAt < this.balance.simultaneousDeathWindow) return null;
    this.outcome = resolveVersus(a, b);
    return this.outcome;
  }
}
