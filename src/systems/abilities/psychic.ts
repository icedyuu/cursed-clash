/**
 * THE HOLLOW: Psychic Fragments, Psychic Overload, Psychic Burst, Outlet Seal and
 * The Last Remnant. Data lives in data/hollow.ts; state machine in systems/psychicState.ts.
 */
import Phaser from 'phaser';
import type { Behavior, CastContext } from './context';
import type { Enemy } from '../../entities/Enemy';
import type { Player } from '../../entities/Player';
import type { World } from '../World';
import type { AbilityParams } from '../../data/types';
import { computeAbilityParams } from '../UpgradeSystem';
import { DEPTH } from '../../game/GameConfig';
import type { Projectile } from '../../entities/Projectile';
import { audio } from '../../game/AudioManager';
import { addFragments, feedOverload, psychicPhase, takeFragments, tickPsychic, type PsychicTuning } from '../psychicState';

const PSY = 0x9d86e0;
const PSY_LIGHT = 0xd9ccff;
const PSY_DARK = 0x4a3a78;
const HAIR = 0x07060a;
const HAIR_SHEEN = 0x3a3150;
const PALE = 0xeeeaf4;

const tmp: Enemy[] = [];

// ───────────────────────── resource helpers ─────────────────────────

export const isHollow = (p: Player | null | undefined): p is Player => !!p && !!p.psychic;

export const fragmentParams = (p: Player): AbilityParams => computeAbilityParams(p.passive.params, p.build.abilityMods[p.passive.id]);

export const fragmentCapacity = (p: Player): number => Math.max(1, Math.round(fragmentParams(p).capacity ?? 10));

const tuning = (p: Player): PsychicTuning => {
  const fp = fragmentParams(p);
  return {
    capacity: fragmentCapacity(p),
    overloadDuration: (fp.overloadDuration ?? 6) * p.stats.duration,
    recoveryDuration: Math.max(1, fp.recoveryDuration ?? 3.5),
    strainRatio: fp.ratio ?? 0.8,
    strainRate: fp.tickDamage ?? 2.5,
  };
};

export const isOverloaded = (p: Player, t: number): boolean => !!p.psychic && psychicPhase(p.psychic, t) === 'overload';

/** Each held fragment empowers him a little (a permanent buff refreshed on change). */
const refreshFragmentBuff = (p: Player): void => {
  const fp = fragmentParams(p);
  const n = p.psychic?.fragments ?? 0;
  p.addBuff('psychic_fragments', n > 0 ? [{ stat: 'damage', op: 'mul', value: n * (fp.damagePerFragment ?? 0.02) }] : [], Number.POSITIVE_INFINITY);
};

const startOverload = (p: Player, w: World): void => {
  const s = p.psychic!;
  const fp = fragmentParams(p);
  p.addBuff(
    'psychic_overload',
    [
      { stat: 'damage', op: 'mul', value: fp.overloadDamage ?? 0.35 },
      { stat: 'area', op: 'mul', value: fp.overloadArea ?? 0.25 },
      { stat: 'cooldown', op: 'mul', value: -0.25 },
      { stat: 'moveSpeed', op: 'mul', value: 0.08 },
    ],
    s.overloadUntil,
  );
  w.effects.ring(p.x, p.y - 12, 6, 80, PSY_LIGHT, 0.5, 3);
  w.effects.ring(p.x, p.y - 12, 4, 50, 0xffffff, 0.35, 2);
  w.effects.burst('psychic', p.x, p.y - 14, 40);
  w.effects.flashLight(p.x, p.y - 12, PSY, 110, 500, 0.9);
  w.effects.shake(0.004, 200);
  w.effects.floatText(p.x, p.y - 40, 'PSYCHIC OVERLOAD', '#d9ccff', 16, 1000);
  audio.play('overload');
  w.scene.events.emit('psychic-overload', p);
};

const startRecovery = (p: Player, w: World): void => {
  const s = p.psychic!;
  const fp = fragmentParams(p);
  const pen = fp.recoveryPenalty ?? 0.2;
  p.addBuff(
    'psychic_recovery',
    [
      { stat: 'damage', op: 'mul', value: -pen },
      { stat: 'moveSpeed', op: 'mul', value: -0.15 },
      { stat: 'attackSpeed', op: 'mul', value: -0.15 },
    ],
    s.recoveryUntil,
  );
  w.effects.burst('shadow', p.x, p.y - 12, 16);
  w.effects.floatText(p.x, p.y - 36, 'recovering...', '#8a80a8', 10, 900);
  audio.play('overload_end');
};

/** Adds overload; triggers Psychic Overload at 100. */
export const gainOverload = (p: Player, amount: number, w: World): void => {
  if (!p.psychic || !p.alive) return;
  if (feedOverload(p.psychic, amount, w.time, tuning(p))) startOverload(p, w);
};

export const gainFragments = (p: Player, n: number, w: World): void => {
  if (!p.psychic) return;
  const stored = addFragments(p.psychic, n, fragmentCapacity(p));
  refreshFragmentBuff(p);
  // a full mind still feels the extra voices
  gainOverload(p, (fragmentParams(p).overloadGain ?? 5) * (stored > 0 ? stored : 0.5 * n), w);
};

export const consumeFragments = (p: Player, max: number, w: World): number => {
  if (!p.psychic) return 0;
  const n = takeFragments(p.psychic, max);
  if (n > 0) {
    refreshFragmentBuff(p);
    gainOverload(p, (fragmentParams(p).overloadGain ?? 5) * 1.6 * n, w);
  }
  return n;
};

/** Per-frame upkeep, called from AbilitySystem.update. */
export const tickHollow = (p: Player, dt: number, w: World): void => {
  const s = p.psychic;
  if (!s || !p.alive) return;
  const t = w.time;
  const prev = p.psychicPhase;
  const ev = tickPsychic(s, dt, t, tuning(p), prev);
  p.psychicPhase = psychicPhase(s, t);
  if (ev === 'overload') startOverload(p, w);
  else if (ev === 'recovery') startRecovery(p, w);
  // ambient visuals
  if (p.psychicPhase === 'overload') {
    if (Math.floor(t * 30) !== Math.floor((t - dt) * 30)) {
      w.effects.burst('psychic', p.x + w.rng.range(-6, 6), p.y - 8 - w.rng.range(0, 14), 1, { angle: -Math.PI / 2, spread: 0.4 });
    }
    if (Math.floor(t * 6) !== Math.floor((t - dt) * 6)) w.effects.ring(p.x, p.y - 12, 6, 22, PSY_LIGHT, 0.3, 1, 0.6);
  } else if (s.fragments > 0 && Math.floor(t * 3) !== Math.floor((t - dt) * 3)) {
    // fragments orbit faintly around his head
    const a = t * 2.4;
    w.effects.burst('psychic', p.x + Math.cos(a) * 9, p.y - 24 + Math.sin(a) * 3, 1, { angle: -Math.PI / 2, spread: 0.2 });
  }
};

/** Kill hook (CombatSystem.killEnemy): maybe release a Psychic Fragment for the sealer/killer. */
export const onKillForFragments = (e: Enemy, killer: Player | null, w: World): void => {
  // a sealed enemy's fragment belongs to whoever sealed it
  const sealed = e.sealOwner && e.sealedUntil > w.time - 0.25 ? e.sealOwner : null;
  if (sealed && sealed.alive && hasFlag(sealed, 'outlet_seal', 'prison')) prisonBurst(e, sealed, w);
  const owner = isHollow(sealed) ? sealed : isHollow(killer) ? killer : null;
  if (!owner || !owner.alive) return;
  const fp = fragmentParams(owner);
  let chance = fp.chance ?? 0.16;
  if (sealed === owner) {
    const ep = computeAbilityParams(owner.abilities.e.def.params, owner.build.abilityMods[owner.abilities.e.def.id]);
    chance = Math.max(chance, ep.sealChance ?? 0.75);
  }
  if (isOverloaded(owner, w.time)) chance += 0.1;
  const n = e.isBoss ? 5 : e.isElite ? 2 : w.rng.chance(chance) ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const a = w.rng.next() * Math.PI * 2;
    w.xp.drop('fragment', e.x + Math.cos(a) * (n > 1 ? 8 : 0), e.y + Math.sin(a) * (n > 1 ? 5 : 0), owner.index);
  }
  if (n > 0) w.effects.burst('psychic', e.x, e.y - 8, 6);
};

// ───────────────────────── infusions + fusions ─────────────────────────

const hasFlag = (p: Player | null, ability: string, flag: string): boolean => !!p && (p.build.abilityFlags[ability] ?? []).includes(flag);

/** Fusion "Mind Prison": sealed enemies take more damage from everyone. */
export const sealDamageMult = (e: Enemy, t: number): number => (e.sealedUntil > t && hasFlag(e.sealOwner, 'outlet_seal', 'prison') ? 1.3 : 1);

/** Fusion "Mind Prison": a sealed enemy's death bursts and seals its neighbours. */
const prisonBurst = (e: Enemy, owner: Player, w: World): void => {
  w.combat.explode(e.x, e.y - 6, 40, 14 * owner.stats.damage, owner, 'mind_prison', e, 'psychic');
  w.effects.ring(e.x, e.y - 6, 4, 46, PSY_LIGHT, 0.35, 2);
  tmp.length = 0;
  for (const n of w.enemyGrid.queryCircle(e.x, e.y, 46, tmp)) {
    if (n === e || n.dying) continue;
    n.seal(1.6 * n.controlResist(0.3, 0.55), w.time, owner);
  }
};

/** Infusion "Stolen Echo": the needle pops and briefly seals what it hit. */
export const onMindLashHit = (pr: Projectile, e: Enemy, w: World): void => {
  if (!(pr.splash > 0 && pr.flags.has('psyburst') && pr.abilityId === 'mind_lash')) return;
  w.combat.explode(pr.x, pr.y, 20, pr.damage * pr.splash, pr.owner, 'mind_echo', e, 'psychic');
  if (!e.dying) e.seal(0.5 * e.controlResist(0.3, 0.55), w.time, pr.owner);
};

/** Fusion "Choir of the Sealed": a fan of seeking needles. */
export const choirVolley = (p: Player, x: number, y: number, angle: number, damage: number, w: World): void => {
  for (let i = 0; i < 5; i++) {
    w.projectiles.spawn({
      texture: 'proj-mind-lash',
      team: 'player',
      owner: p,
      abilityId: 'choir_needle',
      x,
      y,
      angle: angle + (i - 2) * 0.45,
      speed: 190,
      range: 260,
      radius: 3,
      damage: damage * 0.9,
      knockback: 20,
      pierce: 1,
      homing: 7,
      trail: 'psychic',
      scale: 1.2,
      light: PSY,
      theme: 'psychic',
    });
  }
  w.effects.ring(x, y, 3, 24, PSY_LIGHT, 0.3, 2);
  w.effects.flashLight(x, y, PSY, 36, 240, 0.8);
  w.effects.floatText(p.x, p.y - 40, '"...all of you, speak."', '#cfc6e6', 10, 900);
  audio.play('psychic_burst', { pitch: 1.4, volume: 0.6 });
};

// ───────────────────────── Q: Psychic Burst ─────────────────────────

export const psychicBurstBehavior: Behavior = ({ w, p, params, inst }) => {
  const consumed = consumeFragments(p, params.consume ?? 3, w);
  const over = isOverloaded(p, w.time);
  const fr = 1 + consumed * (params.fragmentRadius ?? 0.07);
  const r = (params.radius ?? 58) * p.stats.area * fr;
  const dmg = (params.damage ?? 24) * (1 + consumed * (params.fragmentDamage ?? 0.3));
  const cx = p.x;
  const cy = p.y - 10;
  const pulse = (radius: number, damage: number, kb: number): void => {
    tmp.length = 0;
    for (const e of w.enemyGrid.queryCircle(cx, cy, radius + 10, tmp)) {
      if (e.dying) continue;
      const d = Math.hypot(e.x - cx, e.y - 4 - cy);
      if (d > radius + e.radius) continue;
      const k = Math.max(1, d);
      w.combat.hitEnemy(e, damage, { owner: p, abilityId: inst.def.id, knockback: kb, dirX: (e.x - cx) / k, dirY: (e.y - cy) / k });
      w.effects.burst('psychic', e.x, e.y - 6, 3);
    }
  };
  pulse(r, dmg, params.knockback ?? 170);
  // visuals: a concentrated implosion then a hard shell of psychic force
  w.effects.circle(cx, cy, 4, r, PSY, 0.22, 0.35);
  w.effects.ring(cx, cy, 6, r, PSY_LIGHT, 0.32, 3);
  w.effects.ring(cx, cy, 4, r * 0.75, 0xffffff, 0.22, 1);
  w.effects.ring(cx, cy, r * 1.15, r * 0.6, PSY_DARK, 0.25, 2, 0.8);
  w.effects.burst('psychic', cx, cy, 26 + consumed * 6);
  w.effects.flashLight(cx, cy, PSY, r * 1.1, 260);
  if (consumed > 0) {
    w.effects.floatText(p.x, p.y - 34, `-${consumed}`, '#d9ccff', 10, 600);
    for (let i = 0; i < consumed; i++) {
      const a = (i / consumed) * Math.PI * 2;
      w.effects.burst('psychic', cx + Math.cos(a) * 16, cy + Math.sin(a) * 10, 5, { angle: a, spread: 0.2 });
    }
  }
  w.effects.shake((params.shake ?? 0.004) * (over ? 1.6 : 1), 140);
  if (over) {
    // Overload: the burst echoes a second time
    w.scene.time.delayedCall(200, () => {
      if (!p.alive) return;
      pulse(r * 1.25, dmg * 0.45, (params.knockback ?? 170) * 0.5);
      w.effects.ring(cx, cy, r * 0.5, r * 1.25, 0xffffff, 0.3, 2);
      w.effects.ring(cx, cy, r * 0.4, r * 1.2, PSY_LIGHT, 0.35, 3);
      w.effects.burst('psychic', cx, cy, 20);
    });
  }
  w.hitStop(30);
  gainOverload(p, params.overloadGain ?? 9, w);
  audio.play(inst.def.sfx, { pitch: over ? 0.85 : 1 });
};

// ───────────────────────── E: Outlet Seal ─────────────────────────

/** Picks the enemy under the cursor / auto-aim target, else the best enemy along the aim line. */
const pickSealTarget = (c: CastContext, range: number, assist: number): Enemy | null => {
  const { w, p } = c;
  tmp.length = 0;
  const near = w.enemyGrid.queryCircle(p.x, p.y, range + 20, tmp).filter((e) => !e.dying && e.active);
  if (near.length === 0) return null;
  if (c.aimPoint) {
    let best: Enemy | null = null;
    let bd = (assist + 14) ** 2;
    for (const e of near) {
      const d = (e.x - c.aimPoint.x) ** 2 + (e.y - 6 - c.aimPoint.y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return best;
  }
  // along the aim direction: favour enemies close to the aim line, then distance; elites/bosses first
  let best: Enemy | null = null;
  let bs = Infinity;
  for (const e of near) {
    const dx = e.x - p.x;
    const dy = e.y - 6 - (p.y - 10);
    const d = Math.hypot(dx, dy);
    if (d > range + e.radius) continue;
    const along = dx * c.aimX + dy * c.aimY;
    if (along < -10) continue;
    const off = Math.abs(dx * -c.aimY + dy * c.aimX);
    if (off > assist + e.radius + along * 0.35) continue;
    const score = off * 1.5 + d * 0.4 - (e.isBoss ? 60 : e.isElite ? 30 : 0) - (e.isSealedAt(w.time) ? -40 : 0);
    if (score < bs) {
      bs = score;
      best = e;
    }
  }
  return best;
};

const applySeal = (p: Player, e: Enemy, params: AbilityParams, w: World, abilityId: string, strength = 1): void => {
  const resist = e.controlResist(params.bossResist ?? 0.3, params.eliteResist ?? 0.55);
  const dur = (params.duration ?? 4) * p.stats.duration * resist * strength * (isOverloaded(p, w.time) ? 1.5 : 1);
  e.seal(dur, w.time, p);
  e.applySlow((params.slow ?? 0.45) * (resist < 1 ? 0.6 : 1), dur, w.time);
  w.combat.hitEnemy(e, params.damage ?? 10, { owner: p, abilityId, knockback: 0, dirX: 0, dirY: 0 });
  w.effects.ring(e.x, e.y - 8, 18, 4, PSY_LIGHT, 0.3, 2);
  w.effects.ring(e.x, e.y - 8, 2, 12, PSY, 0.25, 1);
  w.effects.burst('psychic', e.x, e.y - 8, 8);
  w.effects.floatText(e.x, e.y - e.displayHeight - 2, resist < 1 ? 'SEALED (RESIST)' : 'SEALED', '#d9ccff', 10, 700);
};

export const outletSealBehavior: Behavior = (c) => {
  const { w, p, params, inst } = c;
  const range = params.range ?? 170;
  const target = pickSealTarget(c, range, params.radius ?? 28);
  if (!target) {
    // nothing to seal: a faint fizzle, no cooldown spent
    w.effects.ring(p.x + c.aimX * 20, p.y - 10 + c.aimY * 20, 2, 10, PSY_DARK, 0.2, 1);
    return false;
  }
  applySeal(p, target, params, w, inst.def.id);
  w.effects.beam(p.x, p.y - 22, target.x, target.y - 8, PSY, 2, 0.22);
  w.effects.beam(p.x, p.y - 22, target.x, target.y - 8, PSY_LIGHT, 1, 0.12);
  // extra seals (upgrades / overload) jump to the nearest unsealed enemies
  let extra = Math.max(0, Math.round((params.count ?? 1) - 1)) + (isOverloaded(p, w.time) ? 2 : 0);
  if (extra > 0) {
    tmp.length = 0;
    const around = w.enemyGrid
      .queryCircle(target.x, target.y, 70, tmp)
      .filter((e) => e !== target && !e.dying && !e.isSealedAt(w.time))
      .sort((a, b) => (a.x - target.x) ** 2 + (a.y - target.y) ** 2 - ((b.x - target.x) ** 2 + (b.y - target.y) ** 2));
    for (const e of around) {
      if (extra-- <= 0) break;
      applySeal(p, e, params, w, inst.def.id, 0.75);
      w.effects.beam(target.x, target.y - 8, e.x, e.y - 8, PSY, 1, 0.2);
    }
  }
  w.effects.flashLight(target.x, target.y - 8, PSY, 40, 300);
  gainOverload(p, params.overloadGain ?? 7, w);
  audio.play(inst.def.sfx);
};

// ───────────────────────── ULT: The Last Remnant ─────────────────────────

const LINES_START = ['"Hold them for me."', '"Stay. Just a moment longer."', '"...you are still here."'];
const LINES_END = ['"...come back to me."', '"Not yet. Not yet."', '"I keep you. I keep you."'];

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  speed: number;
}

/**
 * The ultimate is a small timed sequence driven by run time (so it pauses with the game
 * and hit-stop): manifest → hair spreads and restrains → drain → psychic release → she
 * dissolves back into him.
 */
export const lastRemnantBehavior: Behavior = ({ w, p, params, inst }) => {
  const scene = w.scene;
  const t0 = w.time;
  const castT = params.castTime ?? 0.7;
  const holdT = params.restrainTime ?? 1.9;
  const releaseAt = castT + holdT;
  const endAt = releaseAt + 1.1;
  const radius = (params.radius ?? 175) * p.stats.area;
  const absorbed = consumeFragments(p, 999, w);
  const fragMult = 1 + absorbed * (params.fragmentDamage ?? 0.08);
  const side = p.facing < 0 ? 1 : -1;
  const hx = Phaser.Math.Clamp(p.x + side * 16, 40, 1140);
  const hy = p.y - 4;

  p.invulnUntil = Math.max(p.invulnUntil, t0 + castT + 0.5);
  w.banner('THE LAST REMNANT', '#d9ccff', 'she is still here');
  audio.play(inst.def.sfx);
  w.effects.floatText(p.x, p.y - 44, LINES_START[Math.floor(w.rng.next() * LINES_START.length)], '#cfc6e6', 10, 1600);

  // world darkens around them (screen-space, so it follows the arena camera)
  const dark = scene.add.rectangle(0, 0, 4000, 4000, 0x05020a, 0).setScrollFactor(0).setDepth(DEPTH.zones + 1);
  const floorHair = scene.add.graphics().setDepth(DEPTH.zones + 2);
  const wraps = scene.add.graphics().setDepth(DEPTH.projectiles - 1);
  const aura = scene.add.image(hx, hy - 30, 'glow-big').setTint(0xcfc6e6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.9, 1.3);
  const her = scene.add.sprite(hx, hy + 6, 'remnant-wife').setOrigin(0.5, 1).setAlpha(0).setFlipX(side > 0);
  her.play('remnant-wife:float');

  let targets: Enemy[] = [];
  let spread = false;
  let released = false;
  let nextTick = t0 + castT;
  const motes: Mote[] = [];
  const strandSeeds = Array.from({ length: 20 }, (_, i) => ({ a: (i / 20) * Math.PI * 2 + w.rng.range(-0.12, 0.12), len: w.rng.range(0.75, 1.05), ph: w.rng.next() * 6 }));

  let done = false;
  const cleanup = (): void => {
    if (done) return;
    done = true;
    scene.events.off('update', update);
    scene.events.off('shutdown', cleanup);
    for (const m of motes) m.img.destroy();
    motes.length = 0;
    dark.destroy();
    floorHair.destroy();
    wraps.destroy();
    aura.destroy();
    her.destroy();
  };

  const strand = (g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, grow: number, phase: number, amp: number): void => {
    const segs = 10;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const pts: [number, number][] = [];
    for (let k = 0; k <= segs; k++) {
      const u = (k / segs) * grow;
      const wv = Math.sin(u * 7 + phase) * amp * Math.sin(Math.PI * Math.min(1, u * 1.2));
      pts.push([x0 + dx * u + nx * wv, y0 + dy * u + ny * wv]);
    }
    g.lineStyle(2, HAIR, 0.95);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.strokePath();
    g.lineStyle(1, HAIR_SHEEN, 0.55);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] - 1);
    for (const [x, y] of pts) g.lineTo(x, y - 1);
    g.strokePath();
  };

  const release = (): void => {
    released = true;
    her.play('remnant-wife:spread');
    tmp.length = 0;
    const hit = new Set<Enemy>(targets.filter((e) => !e.dying));
    for (const e of w.enemyGrid.queryCircle(hx, hy - 10, radius, tmp)) if (!e.dying) hit.add(e);
    for (const e of hit) {
      const d = Math.max(1, Math.hypot(e.x - hx, e.y - hy));
      w.combat.hitEnemy(e, (params.damage ?? 95) * fragMult, { owner: p, abilityId: inst.def.id, knockback: params.knockback ?? 220, dirX: (e.x - hx) / d, dirY: (e.y - hy) / d });
      w.effects.burst('psychic', e.x, e.y - 8, 5);
    }
    w.effects.circle(hx, hy - 10, 10, radius, PSY, 0.45, 0.5);
    w.effects.circle(hx, hy - 10, 6, radius * 0.6, PALE, 0.25, 0.6);
    w.effects.ring(hx, hy - 10, 10, radius, 0xffffff, 0.55, 5);
    w.effects.ring(hx, hy - 10, 8, radius * 1.1, PSY_LIGHT, 0.7, 3);
    w.effects.ring(hx, hy - 10, radius * 1.2, 10, PSY_DARK, 0.5, 2);
    w.effects.burst('psychic', hx, hy - 20, 80);
    w.effects.burst('hair', hx, hy - 30, 40);
    w.effects.flashLight(hx, hy - 10, PSY_LIGHT, radius, 800, 1);
    w.effects.shake(params.shake ?? 0.01, 450);
    w.hitStop(90);
    audio.play('psychic_release');
    // her remnant scatters into motes that drift home to him
    for (let i = 0; i < 18; i++) {
      const x = hx + w.rng.range(-10, 10);
      const y = hy - w.rng.range(4, 56);
      const img = scene.add.image(x, y, 'px').setTint(i % 3 ? PALE : PSY_LIGHT).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects).setScale(1 + (i % 2));
      motes.push({ img, x, y, speed: 60 + w.rng.next() * 60 });
    }
    gainOverload(p, params.overloadGain ?? 40, w);
  };

  const update = (): void => {
    if (!scene.sys.isActive() && !scene.sys.isPaused()) return cleanup();
    const t = w.time - t0;
    // manifestation: she rises, the world dims
    const fadeIn = Phaser.Math.Clamp(t / castT, 0, 1);
    const fadeOut = t > releaseAt ? Phaser.Math.Clamp((t - releaseAt) / 0.7, 0, 1) : 0;
    const presence = fadeIn * (1 - fadeOut);
    dark.setAlpha(0.42 * presence);
    aura.setAlpha(0.35 * presence + Math.sin(t * 5) * 0.04 * presence);
    her.setAlpha(0.92 * presence);
    her.y = hy + 6 - fadeIn * 6 + Math.sin(t * 2.2) * 1.5;
    her.setDepth(DEPTH.entities + hy + 2);
    if (t > releaseAt && Math.floor(t * 40) % 2 === 0 && fadeOut < 1) {
      // dissolving: shed pale pixels upward
      w.effects.burst('psychic', hx + w.rng.range(-8, 8), hy - w.rng.range(0, 56), 1, { angle: -Math.PI / 2, spread: 0.3 });
    }

    // hair spreads across the arena and binds
    if (!spread && t >= castT) {
      spread = true;
      her.play('remnant-wife:spread');
      tmp.length = 0;
      targets = w.enemyGrid
        .queryCircle(hx, hy - 10, radius, tmp)
        .filter((e) => !e.dying)
        .sort((a, b) => (a.x - hx) ** 2 + (a.y - hy) ** 2 - ((b.x - hx) ** 2 + (b.y - hy) ** 2));
      for (const e of targets) {
        const res = e.controlResist(params.bossResist ?? 0.35, params.eliteResist ?? 0.6);
        e.root((holdT + 0.15) * res, w.time);
        // silenced while bound; no Outlet-Seal fragment bonus (that stays E's job)
        e.seal((holdT + 0.6) * res, w.time, null);
      }
      audio.play('hair_bind');
      w.effects.burst('hair', hx, hy - 30, 30);
    }
    floorHair.clear();
    wraps.clear();
    if (spread && !released) {
      const grow = Phaser.Math.Clamp((t - castT) / 0.35, 0, 1);
      // ambient strands pouring over the floor
      for (const s of strandSeeds) {
        const r = radius * s.len;
        strand(floorHair, hx, hy - 2, hx + Math.cos(s.a) * r, hy - 2 + Math.sin(s.a) * r * 0.75, grow, s.ph + t * 3, 5);
      }
      // binding strands to (up to) the 28 nearest restrained enemies
      const shown = targets.slice(0, 28);
      shown.forEach((e, i) => {
        if (e.dying || !e.active) return;
        const ox = ((i % 5) - 2) * 2;
        strand(floorHair, hx + ox, hy - 46, e.x, e.y - 6, grow, i * 1.7 + t * 4, 4);
        if (grow >= 1) {
          const wv = e.radius * 1.4;
          wraps.lineStyle(2, HAIR, 0.95);
          wraps.strokeEllipse(e.x, e.y - 4, wv * 2, 5);
          wraps.strokeEllipse(e.x, e.y - 9 - Math.sin(t * 9 + i) * 1, wv * 1.7, 4);
          wraps.lineStyle(1, HAIR_SHEEN, 0.6);
          wraps.strokeEllipse(e.x, e.y - 6, wv * 1.8, 4);
        }
      });
      // suppression: drain and distort their energy
      if (w.time >= nextTick && grow >= 1) {
        nextTick = w.time + (params.tickInterval ?? 0.35);
        for (const e of targets) {
          if (e.dying) continue;
          e.knockback(w.rng.range(-1, 1), w.rng.range(-1, 1), 40);
          w.combat.hitEnemy(e, (params.tickDamage ?? 6) * p.stats.damage, { owner: p, abilityId: inst.def.id, knockback: 0, dirX: 0, dirY: 0, isDot: true });
          const a = Math.atan2(hy - 30 - e.y, hx - e.x);
          w.effects.burst('psychic', e.x, e.y - 8, 2, { angle: a, spread: 0.15 });
        }
      }
    }
    if (!released && t >= releaseAt) release();

    // motes return to The Hollow
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      const tx = p.x;
      const ty = p.y - 14;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy);
      m.speed += 260 * (1 / 60);
      if (d < 6) {
        m.img.destroy();
        motes.splice(i, 1);
        if (motes.length === 0 && p.alive) {
          w.effects.ring(p.x, p.y - 14, 18, 4, PALE, 0.35, 2);
          w.effects.flashLight(p.x, p.y - 14, PSY_LIGHT, 40, 400);
          w.effects.floatText(p.x, p.y - 42, LINES_END[Math.floor(w.rng.next() * LINES_END.length)], '#cfc6e6', 10, 1500);
        }
        continue;
      }
      const step = Math.min(d, m.speed / 60);
      m.x += (dx / d) * step + Math.sin(w.time * 6 + i) * 0.6;
      m.y += (dy / d) * step;
      m.img.setPosition(m.x, m.y);
    }
    if (t >= endAt && motes.length === 0) cleanup();
    else if (t >= endAt + 3) cleanup();
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', cleanup);
};
