/** Projectile abilities: Void Bolt, Void Orb, Frost Shard, Ice Lance (+ infusions and fusions). */
import type { Behavior, CastContext } from './context';
import type { ParticleKind } from '../EffectsSystem';
import { audio } from '../../game/AudioManager';

const VISUALS: Record<string, { texture: string; trail: ParticleKind; scale?: number; light?: number; theme: 'void' | 'frost' }> = {
  void_bolt: { texture: 'proj-void-bolt', trail: 'void', light: 0xb05cff, theme: 'void' },
  void_orb: { texture: 'proj-void-orb', trail: 'void', light: 0xb05cff, theme: 'void' },
  frost_shard: { texture: 'proj-frost-shard', trail: 'frost', light: 0x6fe3ff, theme: 'frost' },
  ice_lance: { texture: 'proj-ice-lance', trail: 'frost', light: 0x6fe3ff, theme: 'frost' },
};

/** Every Nth basic attack becomes the fusion super-shot. */
export const FUSION_SHOT_EVERY = 5;

/** Singularity Cannon (Voidwalker) / Glacial Comet (Frost Witch). */
const fusionShot = (c: CastContext, ox: number, oy: number): void => {
  const { w, p, params, angle, inst } = c;
  const frost = inst.def.id === 'frost_shard';
  w.projectiles.spawn({
    texture: frost ? 'proj-ice-lance' : 'proj-void-orb',
    team: 'player',
    owner: p,
    abilityId: frost ? 'glacial_comet' : 'singularity_cannon',
    x: ox,
    y: oy,
    angle,
    speed: frost ? 250 : 150,
    range: frost ? 300 : 250,
    radius: frost ? 9 : 11,
    damage: (params.damage ?? 8) * 4,
    knockback: frost ? 60 : 20,
    pierce: 999,
    flags: new Set(frost ? ['freezeHit', 'endBlast'] : ['singularity', 'endBlast']),
    explosionRadius: frost ? 40 : 52,
    explosionDamage: frost ? 0.8 : 1.2,
    trail: frost ? 'frost' : 'void',
    trailEvery: 0.012,
    trailCount: 3,
    spin: frost ? 0 : 8,
    scale: frost ? 1.8 : 2.2,
    light: frost ? 0x6fe3ff : 0xb05cff,
    glowScale: 1.6,
    theme: frost ? 'frost' : 'void',
  });
  w.effects.ring(ox, oy, 4, 30, frost ? 0xd4f7ff : 0xe0b3ff, 0.3, 3);
  w.effects.flashLight(ox, oy, frost ? 0x6fe3ff : 0xb05cff, 40, 260, 0.9);
  w.effects.shake(0.003, 90);
  audio.play(frost ? 'lance' : 'orb', { pitch: 0.7 });
};

export const projectileBehavior: Behavior = (c) => {
  const { w, p, inst, params, flags, angle } = c;
  const id = inst.def.id;
  const vis = VISUALS[id] ?? VISUALS.void_bolt;
  const count = Math.max(1, Math.round(params.count ?? 1));
  const spread = params.spread ?? 0.15;
  const ox = p.x + Math.cos(angle) * 8;
  const oy = p.y - 12 + Math.sin(angle) * 6;
  // Basic-attack infusion (Overcharge / Glacier Core): bigger, brighter shots with denser trails.
  const inf = Math.round(params.infusion ?? 0);
  const basic = inst.def.slot === 'basic';
  const scale = basic ? 1 + inf * 0.4 : 1;
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? angle : angle + (i - (count - 1) / 2) * spread;
    w.projectiles.spawn({
      texture: vis.texture,
      team: 'player',
      owner: p,
      abilityId: id,
      x: ox,
      y: oy,
      angle: a,
      speed: params.speed ?? 200,
      range: params.range ?? 220,
      radius: params.radius ?? 3,
      damage: params.damage ?? 5,
      knockback: params.knockback ?? 20,
      pierce: (params.pierce ?? 0) + (basic && inf >= 3 ? 1 : 0),
      flags,
      explosionRadius: params.explosionRadius,
      explosionDamage: params.explosionDamage,
      chainCount: params.chainCount,
      chainRange: params.chainRange,
      trail: vis.trail,
      trailEvery: basic && inf > 0 ? 0.03 / (1 + inf * 0.7) : 0.03,
      trailCount: basic && inf >= 2 ? 2 : 1,
      spin: id === 'void_orb' ? 6 : 0,
      scale,
      light: !basic || inf > 0 ? vis.light : undefined,
      glowScale: basic ? 0.8 + inf * 0.25 : 1,
      splash: params.splashDamage,
      theme: vis.theme,
    });
  }
  w.effects.burst(vis.trail, ox, oy, id === 'void_orb' || id === 'ice_lance' ? 8 : 3 + inf * 2, { angle, spread: 0.5 });
  if (basic && inf >= 2) w.effects.flashLight(ox, oy, vis.light ?? 0xffffff, 10 + inf * 4, 120, 0.6);
  if (basic && (flags.has('cannon') || flags.has('comet')) && inst.casts % FUSION_SHOT_EVERY === 0) fusionShot(c, ox, oy);
  if (params.shake) w.effects.shake(params.shake, 80);
  audio.play(inst.def.sfx);
};
