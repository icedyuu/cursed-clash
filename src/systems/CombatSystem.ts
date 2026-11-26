/**
 * Damage resolution for both sides: crits, knockback, statuses, lifesteal, passives,
 * kill rewards and feedback (flash, numbers, sounds, shake).
 */
import type Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { World } from './World';
import { applyArmor, rollHit } from '../core/damage';
import { computeAbilityParams } from './UpgradeSystem';
import { PLAYER_BALANCE } from '../data/balance';
import { audio } from '../game/AudioManager';
import type { ParticleKind } from './EffectsSystem';
import { onKillForFragments } from './abilities/psychic';

export interface HitOptions {
  owner: Player | null;
  abilityId: string;
  knockback: number;
  dirX: number;
  dirY: number;
  isDot?: boolean;
  canCrit?: boolean;
  /** Skip passive on-hit effects (used by secondary procs to prevent loops). */
  noProc?: boolean;
}

const DEATH_PARTICLES: Record<string, ParticleKind> = {
  slime: 'slime',
  shadow: 'shadow',
  bone: 'bone',
  void: 'void',
  flesh: 'flesh',
  king: 'king',
};

export class CombatSystem {
  private tmp: Enemy[] = [];

  constructor(private readonly world: () => World) {}

  private passiveParams(p: Player) {
    return computeAbilityParams(p.passive.params, p.build.abilityMods[p.passive.id]);
  }

  private passiveFlags(p: Player): string[] {
    return p.build.abilityFlags[p.passive.id] ?? [];
  }

  /** Main entry for damaging an enemy. Returns damage dealt. */
  hitEnemy(e: Enemy, base: number, o: HitOptions): number {
    const w = this.world();
    if (e.dying || !e.active || base <= 0) return 0;
    if (e.isBoss && (e as Enemy & { invulnerable?: boolean }).invulnerable) {
      w.effects.burst('spark', e.x, e.y - 20, 2);
      return 0;
    }
    const p = o.owner;
    const stats = p?.stats;
    let mult = 1;
    if (e.vulnerableUntil > w.time) mult *= 1.4;
    // Frost Witch "Shatter": frozen enemies take +50% and burst into shards (once per freeze).
    let shatter = false;
    if (p && !o.isDot && p.def.id === 'frost_witch' && this.passiveFlags(p).includes('shatter') && e.isFrozenAt(w.time) && w.time >= e.shatterReadyAt) {
      mult *= 1.5;
      shatter = true;
      e.shatterReadyAt = e.frozenUntil;
    }
    const hit = rollHit(base, mult, stats?.critChance ?? 0, stats?.critDamage ?? 1.5, w.rng, !o.isDot && o.canCrit !== false && !!p);
    const amount = Math.min(hit.amount, Math.ceil(e.hp));
    e.hp -= hit.amount;
    e.lastHitBy = p ?? e.lastHitBy;
    e.flashUntil = w.time + (o.isDot ? 0.03 : 0.07);
    if (o.knockback > 0) e.knockback(o.dirX, o.dirY, o.knockback);

    // feedback
    w.effects.number(e.x, e.y - e.displayHeight * 0.7, hit.amount, hit.crit, o.isDot ? '#c8a0ff' : '#ffffff');
    if (!o.isDot) {
      audio.play(hit.crit ? 'crit' : 'hit', { pitch: 0.9 + w.rng.next() * 0.25 });
      w.effects.burst(hit.crit ? 'spark' : DEATH_PARTICLES[e.def.deathTheme] ?? 'spark', e.x, e.y - 6, hit.crit ? 6 : 3);
      if (hit.crit && base > 20) w.hitStop(35);
    }

    if (p) {
      p.damageDealt += amount;
      if (o.abilityId !== p.abilities.ult.def.id) p.addUltCharge(amount * PLAYER_BALANCE.ultPerDamage);
      this.lifesteal(p, amount, o, w);
      if (o.abilityId === 'shatter_shard_freeze') e.frostStacks += 2;
      if (!o.isDot && !o.noProc) this.applyFrostbite(p, e, w);
      if (shatter) this.shatterBurst(p, e, w);
    }
    if (e.hp <= 0) this.killEnemy(e, p);
    return amount;
  }

  private lifesteal(p: Player, amount: number, o: HitOptions, w: World): void {
    let ratio = o.isDot ? 0 : p.stats.lifesteal;
    if (p.def.id === 'blood_reaper') {
      const bl = this.passiveParams(p).ratio ?? 0;
      if (!o.isDot || this.passiveFlags(p).includes('bleedHeals')) ratio += bl;
    }
    if (ratio <= 0) return;
    const want = amount * ratio * p.stats.healing;
    const heal = Math.min(want, p.lifestealBudget);
    if (heal <= 0) return;
    p.lifestealBudget -= heal;
    p.heal(heal, w, false);
    if (heal > 1.5 && w.rng.chance(0.3)) w.effects.burst('blood', p.x, p.y - 12, 2);
  }

  private applyFrostbite(p: Player, e: Enemy, w: World): void {
    if (p.def.id !== 'frost_witch' || e.isFrozenAt(w.time)) return;
    const fp = this.passiveParams(p);
    if (e.frostUntil < w.time) e.frostStacks = 0;
    e.frostStacks++;
    e.frostUntil = w.time + (fp.duration ?? 3.5);
    e.frostSlow = Math.min(0.6, e.frostStacks * (fp.slow ?? 0.09));
    const need = Math.max(2, Math.round(fp.stacksToFreeze ?? 5));
    if (e.frostStacks >= need) {
      e.freeze(fp.freezeTime ?? 1.4, w.time);
      w.effects.burst('frost', e.x, e.y - 6, 8);
      w.effects.floatText(e.x, e.y - e.displayHeight, 'FROZEN', '#d4f7ff', 10, 600);
      audio.play('freeze');
    }
  }

  private shatterBurst(p: Player, e: Enemy, w: World): void {
    const freezes = this.passiveFlags(p).includes('shardsFreeze');
    w.effects.burst('frost', e.x, e.y - 6, 14);
    audio.play('freeze', { pitch: 0.7 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + w.rng.next() * 0.4;
      w.projectiles.spawn({
        texture: 'proj-frost-shard',
        team: 'player',
        owner: p,
        abilityId: freezes ? 'shatter_shard_freeze' : 'shatter_shard',
        x: e.x,
        y: e.y - 6,
        angle: a,
        speed: 220,
        range: 70,
        radius: 3,
        damage: 6 * p.stats.damage,
        knockback: 20,
        pierce: 1,
        trail: 'frost',
      });
    }
  }

  applyBleed(e: Enemy, dps: number, duration: number, owner: Player | null): void {
    const w = this.world();
    if (e.dying) return;
    const heals = !!owner && owner.def.id === 'blood_reaper' && this.passiveFlags(owner).includes('bleedHeals');
    // refresh strongest bleed per owner rather than stacking infinitely
    const existing = e.bleeds.find((b) => b.owner === owner);
    if (existing) {
      existing.dps = Math.max(existing.dps, dps);
      existing.until = w.time + duration;
    } else e.bleeds.push({ dps, until: w.time + duration, owner, heals });
  }

  /** Ticks bleeds on an enemy (called from the enemy update loop). */
  tickStatuses(e: Enemy, dt: number): void {
    const w = this.world();
    if (e.bleeds.length === 0) return;
    e.bleedTick -= dt;
    if (e.bleedTick > 0) return;
    e.bleedTick = 0.5;
    for (let i = e.bleeds.length - 1; i >= 0; i--) {
      const b = e.bleeds[i];
      if (b.until <= w.time) {
        e.bleeds.splice(i, 1);
        continue;
      }
      w.effects.burst('blood', e.x, e.y - 6, 2);
      this.hitEnemy(e, b.dps * 0.5 * (b.owner?.stats.damage ?? 1), { owner: b.owner, abilityId: 'bleed', knockback: 0, dirX: 0, dirY: 0, isDot: true });
      if (e.dying) return;
    }
  }

  /** Area damage used by orbs, collapses, resonance. `exclude` already took the direct hit. */
  explode(x: number, y: number, radius: number, damage: number, owner: Player | null, abilityId: string, exclude?: Enemy): void {
    const w = this.world();
    if (radius <= 0) return;
    const r = radius * (owner?.stats.area ?? 1);
    w.effects.circle(x, y, r * 0.3, r, 0xb05cff, 0.22, 0.45);
    w.effects.ring(x, y, r * 0.4, r, 0xe0b3ff, 0.25, 2);
    w.effects.burst('void', x, y, 10);
    w.effects.flashLight(x, y, 0xb05cff, r * 1.2, 200);
    audio.play('explosion', { volume: 0.6 });
    this.tmp.length = 0;
    for (const e of w.enemyGrid.queryCircle(x, y, r + 8, this.tmp)) {
      if (e === exclude || e.dying) continue;
      const d = Math.max(1, Math.hypot(e.x - x, e.y - y));
      this.hitEnemy(e, damage, { owner, abilityId, knockback: 70, dirX: (e.x - x) / d, dirY: (e.y - y) / d, noProc: true });
    }
  }

  killEnemy(e: Enemy, killer: Player | null): void {
    const w = this.world();
    if (e.dying) return;
    const credited = killer ?? e.lastHitBy;
    e.kill();
    const theme = DEATH_PARTICLES[e.def.deathTheme] ?? 'void';
    w.effects.burst(theme, e.x, e.y - 6, e.isElite || e.isBoss ? 40 : 10);
    audio.play('enemy_death', { pitch: e.isElite ? 0.6 : 0.9 + w.rng.next() * 0.3 });
    // rewards
    const xpMult = w.versus ? w.versus.balance.xpMult : 1;
    w.xp.dropXp(e.x, e.y, Math.max(1, Math.round(e.def.xp * xpMult)));
    const drops = e.def.drops ?? {};
    if (drops.heart && w.rng.chance(drops.heart)) w.xp.drop('heart', e.x + 6, e.y);
    if (drops.magnet && w.rng.chance(drops.magnet)) w.xp.drop('magnet', e.x - 6, e.y);
    if (drops.chest && w.rng.chance(drops.chest) && !e.isBoss) w.xp.drop('chest', e.x, e.y + 4);
    if (credited) {
      credited.kills++;
      credited.addUltCharge(e.def.xp * 0.8);
      this.voidResonance(credited, e, w);
    }
    onKillForFragments(e, credited, w);
    if (e.isElite) {
      w.effects.shake(0.006, 250);
      w.effects.ring(e.x, e.y - 10, 8, 70, 0xff66cc, 0.6, 3);
    }
    w.scene.events.emit('enemy-killed', e, credited);
  }

  private voidResonance(p: Player, e: Enemy, w: World): void {
    if (p.def.id !== 'voidwalker') return;
    const vp = this.passiveParams(p);
    if (!w.rng.chance(vp.chance ?? 0.3)) return;
    const explode = this.passiveFlags(p).includes('explode');
    const count = Math.round(vp.count ?? 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + w.rng.next();
      w.projectiles.spawn({
        texture: 'proj-resonance',
        team: 'player',
        owner: p,
        abilityId: 'resonance_particle',
        x: e.x,
        y: e.y - 6,
        angle: a,
        speed: vp.speed ?? 140,
        range: 300,
        radius: 3,
        damage: (vp.damage ?? 8) * p.stats.damage,
        knockback: 15,
        pierce: 0,
        homing: 9,
        trail: 'void',
        flags: explode ? new Set(['explode']) : undefined,
        explosionRadius: 22,
        explosionDamage: 0.8,
      });
    }
    w.effects.burst('void', e.x, e.y - 6, 8);
  }

  /** Damage to a hero. Returns true if the hit landed. */
  hurtPlayer(p: Player, amount: number, fromX: number, fromY: number, opts: { knockback?: number } = {}): boolean {
    const w = this.world();
    if (!p.alive || p.invulnerable) return false;
    const dmg = applyArmor(amount, p.stats.armor);
    p.hp -= dmg;
    p.invulnUntil = w.time + PLAYER_BALANCE.iframesOnHit;
    p.hurtUntil = w.time + 0.2;
    const d = Math.max(1, Math.hypot(p.x - fromX, p.y - fromY));
    const kb = opts.knockback ?? PLAYER_BALANCE.contactKnockback;
    if (kb > 0) {
      const body = p.body as Phaser.Physics.Arcade.Body;
      body.velocity.x += ((p.x - fromX) / d) * kb;
      body.velocity.y += ((p.y - fromY) / d) * kb;
    }
    w.effects.number(p.x, p.y - 26, dmg, false, '#ff5577');
    w.effects.burst('blood', p.x, p.y - 12, 8);
    w.effects.shake(0.004, 120);
    w.effects.flashLight(p.x, p.y - 10, 0xff3355, 30, 150, 0.5);
    audio.play('player_hurt');
    w.scene.events.emit('player-hurt', p);
    if (p.hp <= 0) {
      p.die(w);
      w.scene.events.emit('player-died', p);
    }
    return true;
  }
}
