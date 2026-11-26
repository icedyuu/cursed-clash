/** Projectile abilities: Void Bolt, Void Orb, Frost Shard, Ice Lance. */
import type { Behavior } from './context';
import type { ParticleKind } from '../EffectsSystem';
import { audio } from '../../game/AudioManager';

const VISUALS: Record<string, { texture: string; trail: ParticleKind; scale?: number; light?: number }> = {
  void_bolt: { texture: 'proj-void-bolt', trail: 'void' },
  void_orb: { texture: 'proj-void-orb', trail: 'void', light: 0xb05cff },
  frost_shard: { texture: 'proj-frost-shard', trail: 'frost' },
  ice_lance: { texture: 'proj-ice-lance', trail: 'frost', light: 0x6fe3ff },
  mind_lash: { texture: 'proj-mind-lash', trail: 'psychic' },
};

export const projectileBehavior: Behavior = ({ w, p, inst, params, flags, angle }) => {
  const id = inst.def.id;
  const vis = VISUALS[id] ?? VISUALS.void_bolt;
  const count = Math.max(1, Math.round(params.count ?? 1));
  const spread = params.spread ?? 0.15;
  const ox = p.x + Math.cos(angle) * 8;
  const oy = p.y - 12 + Math.sin(angle) * 6;
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
      pierce: params.pierce ?? 0,
      flags,
      explosionRadius: params.explosionRadius,
      explosionDamage: params.explosionDamage,
      chainCount: params.chainCount,
      chainRange: params.chainRange,
      trail: vis.trail,
      spin: id === 'void_orb' ? 6 : 0,
      light: vis.light,
    });
  }
  w.effects.burst(vis.trail, ox, oy, id === 'void_orb' || id === 'ice_lance' ? 8 : 3, { angle, spread: 0.5 });
  if (params.shake) w.effects.shake(params.shake, 80);
  audio.play(inst.def.sfx);
};
