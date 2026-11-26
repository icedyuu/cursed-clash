/** Melee arcs: Reaper Strike, Crimson Slash (+Twin Fang, Crimson Wave, Hemorrhage, Blood Arc, Phantom Blade, Whirlwind). */
import type { Behavior, CastContext } from './context';
import type { Enemy } from '../../entities/Enemy';
import { inArc } from '../../core/math';
import { audio } from '../../game/AudioManager';

const tmp: Enemy[] = [];

/** Every Nth Reaper Strike becomes the Whirlwind fusion spin. */
export const WHIRL_EVERY = 4;

interface SwingOpts {
  mult?: number;
  arc?: number;
  rangeMult?: number;
  color?: number;
  width?: number;
  dur?: number;
  /** Only hit enemies further away than this (shockwave ring). */
  minRange?: number;
  wave?: boolean;
  bleed?: number;
}

const swing = (c: CastContext, angle: number, o: SwingOpts = {}): number => {
  const { w, p, params, flags, inst } = c;
  const basic = inst.def.slot === 'basic';
  const mult = o.mult ?? 1;
  const range = (params.range ?? 30) * (1 + (p.stats.area - 1) * 0.6) * (o.rangeMult ?? 1);
  const arc = o.arc ?? params.arc ?? 1.8;
  const cx = p.x;
  const cy = p.y - 10;
  w.effects.slash(cx, cy, angle, arc, range, o.color ?? (basic ? 0xff3344 : 0xff8a8a), o.dur ?? (basic ? 0.14 : 0.2), o.width ?? (basic ? 4 : 7));
  tmp.length = 0;
  let hits = 0;
  for (const e of w.enemyGrid.queryCircle(cx, cy, range + 20, tmp)) {
    if (e.dying) continue;
    if (!inArc(cx, cy, angle, arc / 2, range, e.x, e.y - e.radius * 0.5, e.radius)) continue;
    const d = Math.max(1, Math.hypot(e.x - cx, e.y - cy));
    if (o.minRange && d < o.minRange) continue;
    w.combat.hitEnemy(e, (params.damage ?? 10) * mult, { owner: p, abilityId: inst.def.id, knockback: params.knockback ?? 60, dirX: (e.x - cx) / d, dirY: (e.y - cy) / d });
    if (flags.has('bleed') || o.bleed) w.combat.applyBleed(e, Math.max(params.bleedDps ?? 4, o.bleed ?? 0), 3, p);
    hits++;
  }
  if (hits > 0 && !basic) w.hitStop(40);
  if (flags.has('wave') && o.wave !== false) {
    w.projectiles.spawn({
      texture: 'proj-blood-wave',
      team: 'player',
      owner: p,
      abilityId: `${inst.def.id}_wave`,
      x: cx + Math.cos(angle) * 10,
      y: cy + Math.sin(angle) * 10,
      angle,
      speed: params.speed ?? 220,
      range: 150,
      radius: basic ? 7 : 10,
      damage: (params.damage ?? 10) * (params.waveDamage ?? 0.5) * mult,
      knockback: 40,
      pierce: flags.has('wavePierce') ? 99 : basic ? 1 : 3,
      trail: 'blood',
      scale: basic ? 0.7 : 1,
    });
  }
  return range;
};

/** Blood Arc infusion: thicker, longer-lasting slash with blood spray and a glow. */
const bloodArc = (c: CastContext, angle: number, inf: number, range: number): void => {
  const { w, p } = c;
  const cx = p.x;
  const cy = p.y - 10;
  const arc = c.params.arc ?? 1.8;
  // inner white-hot edge on top of the red band
  w.effects.slash(cx, cy, angle, arc * 0.9, range * 0.85, 0xffd0d6, 0.16, 2 + inf);
  for (let k = 0; k < inf * 3; k++) {
    const a = angle - arc / 2 + (arc * (k + 0.5)) / (inf * 3);
    w.effects.burst('blood', cx + Math.cos(a) * range, cy + Math.sin(a) * range, 2, { angle: a, spread: 0.3 });
  }
  if (inf >= 2) w.effects.flashLight(cx + Math.cos(angle) * range * 0.6, cy + Math.sin(angle) * range * 0.6, 0xff3344, range * 0.9, 160, 0.55);
};

export const meleeBehavior: Behavior = (c) => {
  const { w, p, params, flags, angle, inst } = c;
  const basic = inst.def.slot === 'basic';
  const inf = basic ? Math.round(params.infusion ?? 0) : 0;

  // Fusion: Reaper's Whirlwind replaces every Nth basic swing with a 360° spin.
  if (basic && flags.has('whirl') && inst.casts % WHIRL_EVERY === 0) {
    swing(c, angle, { arc: Math.PI * 2, rangeMult: 1.7, mult: 2.2, color: 0xff3344, width: 9, dur: 0.3, bleed: 8 });
    const r = (params.range ?? 30) * 1.7 * (1 + (p.stats.area - 1) * 0.6);
    w.effects.ring(p.x, p.y - 10, r * 0.3, r * 1.1, 0xff8a8a, 0.35, 4);
    w.effects.circle(p.x, p.y - 10, r * 0.2, r, 0xc81e34, 0.25, 0.35);
    w.effects.flashLight(p.x, p.y - 10, 0xff3344, r * 1.4, 260, 0.8);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      w.effects.burst('blood', p.x + Math.cos(a) * r, p.y - 10 + Math.sin(a) * r, 2, { angle: a + Math.PI / 2, spread: 0.3 });
    }
    w.effects.afterimage(p, 0xff3344, 0.7, 260);
    w.effects.shake(0.004, 120);
    audio.play('heavy_slash', { pitch: 1.1 });
    return;
  }

  const width = basic && inf > 0 ? 4 + inf * 2 : undefined;
  const dur = basic && inf > 0 ? 0.14 + inf * 0.03 : undefined;
  const color = basic && inf > 0 ? 0xff1f3d : undefined;
  const range = swing(c, angle, { width, dur, color });
  if (inf > 0) bloodArc(c, angle, inf, range);
  // Blood Arc rank 3: a crimson shockwave hits enemies just beyond the blade.
  if (inf >= 3) {
    w.scene.time.delayedCall(70, () => {
      if (!p.alive) return;
      swing(c, angle, { rangeMult: 1.6, minRange: range * 0.85, mult: 0.45, color: 0x8a0f24, width: 5, dur: 0.22, wave: false });
    });
  }
  audio.play(inst.def.sfx, { pitch: 0.9 + Math.random() * 0.2 });
  if (params.shake) w.effects.shake(params.shake, 100);
  // Phantom Blade: a spectral echo repeats the swing.
  if (basic && flags.has('echo')) {
    w.scene.time.delayedCall(130, () => {
      if (!p.alive) return;
      w.effects.afterimage(p, 0xc080ff, 0.55, 220);
      swing(c, angle, { mult: params.splashDamage ?? 0.35, rangeMult: 1.15, color: 0xc080ff, width: 4 + inf, dur: 0.18, wave: false });
      audio.play(inst.def.sfx, { pitch: 1.35, volume: 0.5 });
    });
  }
  if (flags.has('twin')) {
    w.scene.time.delayedCall(140, () => {
      if (!p.alive) return;
      swing(c, angle + Math.PI, { mult: 0.8 });
      audio.play(inst.def.sfx, { pitch: 1.15 });
    });
  }
};
