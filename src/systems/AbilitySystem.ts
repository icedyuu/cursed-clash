/**
 * Generic ability framework: every ability is data (AbilityDef) + a behaviour function.
 * This system resolves final parameters (base → upgrades → player stats), handles
 * cooldowns / ultimate charge, and dispatches to the behaviour.
 */
import { pointerWorld } from '../game/InputManager';
import type { Player, AbilityInstance } from '../entities/Player';
import type { AbilityBehavior, AbilityParams } from '../data/types';
import type { World } from './World';
import type { Behavior } from './abilities/context';
import { computeAbilityParams } from './UpgradeSystem';
import { projectileBehavior } from './abilities/projectile';
import { meleeBehavior } from './abilities/melee';
import { dashStrikeBehavior } from './abilities/movement';
import { buffBehavior, freezeNovaBehavior, gravityWellBehavior, groundZoneBehavior } from './abilities/areas';
import { lastRemnantBehavior, outletSealBehavior, psychicBurstBehavior, tickHollow } from './abilities/psychic';
import { PLAYER_BALANCE } from '../data/balance';
import { audio } from '../game/AudioManager';

const BEHAVIORS: Record<AbilityBehavior, Behavior | null> = {
  projectile: projectileBehavior,
  meleeArc: meleeBehavior,
  dashStrike: dashStrikeBehavior,
  gravityWell: gravityWellBehavior,
  groundZone: groundZoneBehavior,
  buff: buffBehavior,
  freezeNova: freezeNovaBehavior,
  psychicBurst: psychicBurstBehavior,
  outletSeal: outletSealBehavior,
  lastRemnant: lastRemnantBehavior,
  passive: null,
};

export type CastSlot = 'basic' | 'q' | 'e' | 'ult';

export class AbilitySystem {
  constructor(private readonly world: () => World) {}

  /** Base params with upgrade modifiers applied (no player stats) – used for UI previews. */
  upgradedParams(p: Player, inst: AbilityInstance): AbilityParams {
    return computeAbilityParams(inst.def.params, p.build.abilityMods[inst.def.id]);
  }

  flags(p: Player, inst: AbilityInstance): Set<string> {
    return new Set([...(inst.def.flags ?? []), ...(p.build.abilityFlags[inst.def.id] ?? [])]);
  }

  /** Fully resolved params including player stats. */
  finalParams(p: Player, inst: AbilityInstance, slot: CastSlot): AbilityParams {
    const s = p.stats;
    const out = { ...this.upgradedParams(p, inst) };
    if (out.damage !== undefined) out.damage *= s.damage;
    if (out.tickDamage !== undefined) out.tickDamage *= s.damage;
    if (out.collapseDamage !== undefined) out.collapseDamage *= s.damage;
    if (out.bleedDps !== undefined) out.bleedDps *= s.damage;
    if (out.cooldown !== undefined) out.cooldown = slot === 'basic' ? out.cooldown / s.attackSpeed : out.cooldown * s.cooldown;
    if (inst.def.behavior === 'projectile') {
      if (out.speed !== undefined) out.speed *= s.projectileSpeed;
      if (out.range !== undefined) out.range *= s.projectileSpeed;
      if (inst.def.multishot) out.count = (out.count ?? 1) + s.projectiles;
    }
    if (out.explosionRadius !== undefined) out.explosionRadius *= 1; // area applied in CombatSystem.explode
    return out;
  }

  cooldownRatio(p: Player, slot: CastSlot): number {
    if (slot === 'ult') return 1 - p.ultCharge / PLAYER_BALANCE.ultMax;
    const inst = p.abilities[slot];
    return inst.maxCooldown > 0 ? Math.max(0, inst.cooldown / inst.maxCooldown) : 0;
  }

  update(p: Player, dt: number): void {
    for (const slot of ['basic', 'q', 'e'] as const) {
      const a = p.abilities[slot];
      a.cooldown = Math.max(0, a.cooldown - dt);
    }
    if (!p.alive) return;
    if (p.psychic) tickHollow(p, dt, this.world());
    const it = p.intent;
    if (it.ult && p.ultReady) this.cast(p, 'ult');
    if (it.q) this.cast(p, 'q');
    if (it.e) this.cast(p, 'e');
    if (it.attack) this.cast(p, 'basic');
  }

  cast(p: Player, slot: CastSlot): boolean {
    const w = this.world();
    const inst = p.abilities[slot];
    if (slot !== 'ult' && inst.cooldown > 0) {
      if (slot !== 'basic' && inst.cooldown > 0.15) audio.play('ui_move', { pitch: 0.5, volume: 0.5 });
      return false;
    }
    if (p.forcedMove && slot !== 'ult') return false;
    const behavior = BEHAVIORS[inst.def.behavior];
    if (!behavior) return false;
    const params = this.finalParams(p, inst, slot);
    const flags = this.flags(p, inst);
    const angle = Math.atan2(p.aim.y, p.aim.x);
    inst.casts++;
    const aimPoint = p.intent.aimSource === 'mouse' ? pointerWorld(w.scene) : p.intent.aimSource === 'auto' ? (p.intent.aimTarget ?? null) : null;
    if (behavior({ w, p, inst, params, flags, aimX: p.aim.x, aimY: p.aim.y, angle, aimPoint }) === false) {
      inst.casts--;
      return false;
    }
    if (slot === 'ult') {
      p.ultCharge = 0;
    } else {
      inst.cooldown = params.cooldown ?? 1;
      inst.maxCooldown = inst.cooldown;
    }
    p.facing = p.aim.x < 0 ? -1 : 1;
    p.playAction(inst.def.anim, slot === 'basic' ? 0.1 : 0.2);
    return true;
  }
}
