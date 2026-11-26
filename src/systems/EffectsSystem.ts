/**
 * Visual feedback: particles, transient shapes (slashes, rings), damage numbers,
 * afterimages, lights and screen shake. Everything is pooled or batched.
 */
import Phaser from 'phaser';
import { DEPTH, FONT } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';

export type ParticleKind = 'void' | 'blood' | 'frost' | 'slime' | 'shadow' | 'bone' | 'gold' | 'flesh' | 'xp' | 'dust' | 'spark' | 'king' | 'psychic' | 'hair';

const PARTICLES: Record<ParticleKind, { tint: number[]; blend: 'ADD' | 'NORMAL'; speed: [number, number]; life: [number, number]; scale: number; tex?: string }> = {
  void: { tint: [0xb05cff, 0xe0b3ff, 0x8a4fe0], blend: 'ADD', speed: [20, 90], life: [250, 600], scale: 1 },
  blood: { tint: [0xff3344, 0xc81e34, 0xff8a8a], blend: 'NORMAL', speed: [30, 110], life: [250, 500], scale: 1 },
  frost: { tint: [0x6fe3ff, 0xd4f7ff, 0x2f7fd6], blend: 'ADD', speed: [20, 100], life: [250, 650], scale: 1 },
  slime: { tint: [0x7be36b, 0x3f9e4f, 0xc8ff9e], blend: 'NORMAL', speed: [30, 90], life: [200, 450], scale: 1 },
  shadow: { tint: [0x453a6b, 0x6a5acd, 0x16122a], blend: 'NORMAL', speed: [20, 70], life: [300, 600], scale: 1 },
  bone: { tint: [0xe8e0c8, 0xb7ab8c, 0x66ffcc], blend: 'NORMAL', speed: [30, 100], life: [250, 500], scale: 1 },
  gold: { tint: [0xffd36b, 0xfff1b8, 0xb8862f], blend: 'ADD', speed: [30, 140], life: [300, 800], scale: 1 },
  flesh: { tint: [0xc0587a, 0xff66cc, 0x8a3a5a], blend: 'NORMAL', speed: [30, 120], life: [300, 700], scale: 1 },
  xp: { tint: [0x6fe3ff, 0xffffff], blend: 'ADD', speed: [10, 40], life: [150, 300], scale: 0.5 },
  dust: { tint: [0x5d547f, 0x3a3050], blend: 'NORMAL', speed: [5, 25], life: [250, 450], scale: 1 },
  spark: { tint: [0xffffff, 0xfff1b8], blend: 'ADD', speed: [60, 160], life: [100, 250], scale: 0.5, tex: 'spark' },
  king: { tint: [0xffd36b, 0xff3355, 0x4a1f52], blend: 'ADD', speed: [40, 180], life: [400, 1000], scale: 1.5 },
  psychic: { tint: [0x9d86e0, 0xd9ccff, 0x6a58a8], blend: 'ADD', speed: [15, 80], life: [300, 700], scale: 1 },
  hair: { tint: [0x07060a, 0x15121c, 0x2a2438], blend: 'NORMAL', speed: [40, 160], life: [400, 900], scale: 1 },
};

interface Shape {
  kind: 'ring' | 'arc' | 'circle' | 'line' | 'beam';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r0: number;
  r1: number;
  angle?: number;
  arc?: number;
  width: number;
  color: number;
  alpha: number;
  t: number;
  dur: number;
  fill?: boolean;
}

export class EffectsSystem {
  private emitters = new Map<ParticleKind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private shapes: Shape[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private numbers: Phaser.GameObjects.Text[] = [];
  private numberIdx = 0;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostIdx = 0;
  private lights: Phaser.GameObjects.Image[] = [];
  private lightIdx = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (const [kind, cfg] of Object.entries(PARTICLES) as [ParticleKind, (typeof PARTICLES)[ParticleKind]][]) {
      const em = scene.add.particles(0, 0, cfg.tex ?? 'px', {
        emitting: false,
        lifespan: { min: cfg.life[0], max: cfg.life[1] },
        speed: { min: cfg.speed[0], max: cfg.speed[1] },
        scale: { start: cfg.scale, end: 0 },
        alpha: { start: 1, end: 0.2 },
        tint: cfg.tint,
        blendMode: cfg.blend,
        maxParticles: 600,
      });
      em.setDepth(DEPTH.effects);
      this.emitters.set(kind, em);
    }
    this.gfx = scene.add.graphics().setDepth(DEPTH.effects - 1);
    for (let i = 0; i < 60; i++) {
      const t = scene.add
        .text(0, 0, '', { fontFamily: FONT.body, fontSize: '8px', color: '#ffffff', stroke: '#0d0816', strokeThickness: 2 })
        .setOrigin(0.5)
        .setDepth(DEPTH.numbers)
        .setVisible(false);
      this.numbers.push(t);
    }
    for (let i = 0; i < 40; i++) this.ghosts.push(scene.add.image(0, 0, 'px').setVisible(false).setDepth(DEPTH.entities - 1));
    for (let i = 0; i < 40; i++) this.lights.push(scene.add.image(0, 0, 'glow').setVisible(false).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.light));
  }

  burst(kind: ParticleKind, x: number, y: number, count: number, opts: { angle?: number; spread?: number } = {}): void {
    const em = this.emitters.get(kind);
    if (!em) return;
    if (opts.angle !== undefined) {
      const deg = Phaser.Math.RadToDeg(opts.angle);
      const sp = Phaser.Math.RadToDeg(opts.spread ?? 0.6);
      em.setEmitterAngle({ min: deg - sp, max: deg + sp });
    } else em.setEmitterAngle({ min: 0, max: 360 });
    em.emitParticleAt(x, y, count);
  }

  /** Ring that expands from r0 to r1. */
  ring(x: number, y: number, r0: number, r1: number, color: number, dur = 0.35, width = 2, alpha = 1): void {
    this.shapes.push({ kind: 'ring', x, y, r0, r1, color, dur, t: 0, width, alpha });
  }

  circle(x: number, y: number, r0: number, r1: number, color: number, dur = 0.2, alpha = 0.5): void {
    this.shapes.push({ kind: 'circle', x, y, r0, r1, color, dur, t: 0, width: 0, alpha, fill: true });
  }

  /** A crescent slash band. */
  slash(x: number, y: number, angle: number, arc: number, radius: number, color: number, dur = 0.16, width = 6): void {
    this.shapes.push({ kind: 'arc', x, y, r0: radius * 0.55, r1: radius, angle, arc, color, dur, t: 0, width, alpha: 1 });
  }

  beam(x: number, y: number, x2: number, y2: number, color: number, width = 3, dur = 0.15): void {
    this.shapes.push({ kind: 'beam', x, y, x2, y2, r0: 0, r1: 0, color, dur, t: 0, width, alpha: 1 });
  }

  number(x: number, y: number, amount: number, crit: boolean, color = '#ffffff'): void {
    if (!GameManager.save.settings.damageNumbers) return;
    const t = this.numbers[this.numberIdx];
    this.numberIdx = (this.numberIdx + 1) % this.numbers.length;
    this.scene.tweens.killTweensOf(t);
    t.setText(crit ? `${amount}!` : `${amount}`)
      .setFontFamily(crit ? FONT.title : FONT.body)
      .setFontSize(8)
      .setColor(crit ? '#ffd36b' : color)
      .setPosition(Math.round(x + Phaser.Math.Between(-4, 4)), Math.round(y - 6))
      .setScale(crit ? 1.25 : 1)
      .setAlpha(1)
      .setVisible(true);
    this.scene.tweens.add({
      targets: t,
      y: t.y - (crit ? 16 : 11),
      alpha: 0,
      scale: crit ? 1 : 0.9,
      duration: crit ? 700 : 520,
      ease: 'Cubic.easeOut',
      onComplete: () => t.setVisible(false),
    });
  }

  /** Free-floating text (heal numbers, "FROZEN", "+LEVEL"). */
  floatText(x: number, y: number, text: string, color: string, rise = 14, dur = 800): void {
    const t = this.numbers[this.numberIdx];
    this.numberIdx = (this.numberIdx + 1) % this.numbers.length;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setFontFamily(FONT.body).setFontSize(8).setColor(color).setPosition(Math.round(x), Math.round(y)).setScale(1).setAlpha(1).setVisible(true);
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: 0, duration: dur, ease: 'Sine.easeOut', onComplete: () => t.setVisible(false) });
  }

  afterimage(src: Phaser.GameObjects.Sprite, tint: number, alpha = 0.6, dur = 220): void {
    const g = this.ghosts[this.ghostIdx];
    this.ghostIdx = (this.ghostIdx + 1) % this.ghosts.length;
    this.scene.tweens.killTweensOf(g);
    g.setTexture(src.texture.key, src.frame.name)
      .setPosition(src.x, src.y)
      .setOrigin(src.originX, src.originY)
      .setFlipX(src.flipX)
      .setTintFill(tint)
      .setAlpha(alpha)
      .setDepth(src.depth - 1)
      .setVisible(true);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: dur, onComplete: () => g.setVisible(false) });
  }

  /** Short-lived additive light. */
  flashLight(x: number, y: number, color: number, radius: number, dur = 250, alpha = 0.7): void {
    const l = this.lights[this.lightIdx];
    this.lightIdx = (this.lightIdx + 1) % this.lights.length;
    this.scene.tweens.killTweensOf(l);
    l.setPosition(x, y).setTint(color).setAlpha(alpha).setScale((radius * 2) / 32).setVisible(true);
    this.scene.tweens.add({ targets: l, alpha: 0, duration: dur, onComplete: () => l.setVisible(false) });
  }

  shake(intensity: number, duration = 120): void {
    if (!GameManager.save.settings.screenShake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  update(dt: number): void {
    const g = this.gfx;
    g.clear();
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      s.t += dt;
      const p = Math.min(1, s.t / s.dur);
      if (p >= 1) {
        this.shapes.splice(i, 1);
        continue;
      }
      const a = s.alpha * (1 - p);
      switch (s.kind) {
        case 'ring': {
          const r = s.r0 + (s.r1 - s.r0) * Phaser.Math.Easing.Cubic.Out(p);
          g.lineStyle(Math.max(1, s.width * (1 - p * 0.5)), s.color, a);
          g.strokeCircle(s.x, s.y, r);
          break;
        }
        case 'circle': {
          const r = s.r0 + (s.r1 - s.r0) * Phaser.Math.Easing.Cubic.Out(p);
          g.fillStyle(s.color, a);
          g.fillCircle(s.x, s.y, r);
          break;
        }
        case 'arc': {
          const a0 = s.angle! - s.arc! / 2;
          const a1 = s.angle! + s.arc! / 2;
          // sweep in during the first 40%, then fade
          const sweep = Math.min(1, p / 0.4);
          const end = a0 + (a1 - a0) * sweep;
          const steps = 10;
          for (let k = 0; k < steps; k++) {
            const t0 = k / steps;
            const band = Math.sin(t0 * Math.PI);
            const r = s.r1 - 1 - k * 0;
            g.lineStyle(Math.max(1, s.width * band * (1 - p * 0.6)), k < steps / 2 ? s.color : 0xffffff, a * (0.6 + band * 0.4));
            g.beginPath();
            g.arc(s.x, s.y, r - k * (s.r1 - s.r0) * 0.05, a0, end);
            g.strokePath();
          }
          break;
        }
        case 'beam':
          g.lineStyle(Math.max(1, s.width * (1 - p)), s.color, a);
          g.lineBetween(s.x, s.y, s.x2!, s.y2!);
          g.lineStyle(1, 0xffffff, a);
          g.lineBetween(s.x, s.y, s.x2!, s.y2!);
          break;
        case 'line':
          break;
      }
    }
  }

  destroy(): void {
    this.shapes.length = 0;
  }
}
