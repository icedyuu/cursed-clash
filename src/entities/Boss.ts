/**
 * THE HOLLOW KING – three-phase boss.
 *  Phase 1: walks, summons minions, telegraphed claw sweeps.
 *  Phase 2: Crown Fall (telegraphed impacts that leave cursed pools) + shockwave rings.
 *  Phase 3: faster, shorter cooldowns, combines everything plus radial orb bursts and a charge.
 * Every attack is telegraphed via TelegraphSystem.
 */
import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { World } from '../systems/World';
import { chase, updateTarget } from '../systems/ai/common';
import { inArc, distToSegment } from '../core/math';
import { audio } from '../game/AudioManager';
import { ARENA } from '../game/GameConfig';

type BossAttack = 'summon' | 'sweep' | 'crownfall' | 'shockwave' | 'orbs' | 'charge';

export class Boss extends Enemy {
  phase = 1;
  invulnerable = false;
  private busyUntil = 0;
  private nextAttackAt = 0;
  private lastAttack: BossAttack | null = null;
  private charge: { vx: number; vy: number; until: number } | null = null;
  defeated = false;

  get phaseSpeed(): number {
    return this.phase === 3 ? 1.45 : this.phase === 2 ? 1.15 : 1;
  }
  get cooldownMult(): number {
    return this.phase === 3 ? 0.55 : this.phase === 2 ? 0.8 : 1;
  }

  startEncounter(w: World): void {
    this.phase = 1;
    this.invulnerable = true;
    this.defeated = false;
    this.nextAttackAt = w.time + 3;
    this.busyUntil = w.time + 2.4;
    this.setTexture('boss-king', 0);
    this.play(`${this.animBase}:cast`, true);
    this.setScale(1);
    this.radius = this.def.bodyRadius;
    w.effects.shake(0.01, 900);
    w.effects.ring(this.x, this.y - 20, 10, 160, 0xffd36b, 1, 4);
    w.effects.burst('king', this.x, this.y - 30, 60);
    audio.play('boss_intro');
    w.scene.time.delayedCall(2400, () => {
      this.invulnerable = false;
      if (!this.dying) this.play(`${this.animBase}:move`, true);
    });
  }

  updateBoss(_dt: number, w: World): void {
    if (this.dying) return;
    const t = w.time;
    // phase transitions at 66% / 33%
    const ratio = this.hp / this.maxHp;
    const wantPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (wantPhase > this.phase) this.enterPhase(wantPhase, w);

    if (this.charge) {
      this.desiredVx = this.charge.vx;
      this.desiredVy = this.charge.vy;
      w.effects.afterimage(this, 0xff3355, 0.4, 250);
      for (const pl of w.players) {
        if (pl.alive && distToSegment(pl.x, pl.y, this.x, this.y, this.x - this.charge.vx * 0.06, this.y - this.charge.vy * 0.06) < this.radius + 10) w.combat.hurtPlayer(pl, this.def.attackDamage * this.damageMult, this.x, this.y, { knockback: 300 });
      }
      if (t >= this.charge.until) {
        this.charge = null;
        this.play(`${this.animBase}:move`, true);
      }
      return;
    }
    const p = updateTarget(this, w);
    if (t < this.busyUntil || this.invulnerable || !p) {
      this.desiredVx = this.desiredVy = 0;
      return;
    }
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (t >= this.nextAttackAt && !this.isFrozenAt(t)) {
      this.chooseAttack(d, w);
      return;
    }
    if (d > 50) chase(this, p.x, p.y, this.def.speed * this.speedMult * this.phaseSpeed);
    else this.desiredVx = this.desiredVy = 0;
  }

  private chooseAttack(d: number, w: World): void {
    const options: BossAttack[] = ['summon'];
    if (d < 90) options.push('sweep', 'sweep');
    if (this.phase >= 2) options.push('crownfall', 'crownfall', 'shockwave');
    if (this.phase >= 3) options.push('orbs', 'charge', 'orbs');
    let pick = w.rng.pick(options);
    if (pick === this.lastAttack && options.length > 1) pick = w.rng.pick(options);
    this.lastAttack = pick;
    this.desiredVx = this.desiredVy = 0;
    const cd = this.cooldownMult;
    switch (pick) {
      case 'summon':
        this.summon(w);
        this.nextAttackAt = w.time + 3.2 * cd;
        break;
      case 'sweep':
        this.sweep(w);
        this.nextAttackAt = w.time + 1.8 * cd;
        break;
      case 'crownfall':
        this.crownFall(w);
        if (this.phase === 3) this.summon(w, 2);
        this.nextAttackAt = w.time + 3.4 * cd;
        break;
      case 'shockwave':
        this.shockwave(w);
        this.nextAttackAt = w.time + 3 * cd;
        break;
      case 'orbs':
        this.orbBurst(w);
        this.nextAttackAt = w.time + 2.6 * cd;
        break;
      case 'charge':
        this.chargeAttack(w);
        this.nextAttackAt = w.time + 2.8 * cd;
        break;
    }
  }

  private enterPhase(phase: number, w: World): void {
    this.phase = phase;
    this.invulnerable = true;
    this.busyUntil = w.time + 1.8;
    this.charge = null;
    // phase 3 switches every animation to the palette-swapped "rage" sheet
    if (phase === 3) this.animBase = 'boss-king-rage';
    this.play(`${this.animBase}:cast`, true);
    audio.play('boss_phase');
    w.effects.shake(0.012, 700);
    w.effects.ring(this.x, this.y - 20, 10, 200, phase === 3 ? 0xff3355 : 0xffd36b, 0.9, 5);
    w.effects.burst('king', this.x, this.y - 30, 80);
    w.effects.flashLight(this.x, this.y - 20, phase === 3 ? 0xff3355 : 0xffd36b, 200, 900);
    w.banner(phase === 2 ? 'PHASE II' : 'PHASE III', phase === 3 ? '#ff3355' : '#ffd36b', phase === 2 ? 'The floor itself is cursed' : 'The Hollow King is enraged');
    // shove players away (no damage) so the transition is readable
    for (const pl of w.players) {
      if (!pl.alive) continue;
      const dx = pl.x - this.x;
      const dy = pl.y - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d < 120) {
        const body = pl.body as Phaser.Physics.Arcade.Body;
        body.velocity.x += (dx / d) * 260;
        body.velocity.y += (dy / d) * 260;
      }
    }
    w.scene.time.delayedCall(1800, () => {
      this.invulnerable = false;
      if (!this.dying) this.play(`${this.texture.key}:move`, true);
    });
  }

  private anim(kind: 'attack' | 'cast'): void {
    const key = this.texture.key;
    this.play(`${key}:${kind}`, true);
    this.once('animationcomplete', () => !this.dying && !this.charge && this.play(`${key}:move`, true));
  }

  private summon(w: World, count?: number): void {
    const n = count ?? (this.phase === 1 ? 4 : 5);
    this.anim('cast');
    this.busyUntil = w.time + 1.1;
    audio.play('boss_summon');
    const b = ARENA.bounds;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + w.rng.next();
      const x = Phaser.Math.Clamp(this.x + Math.cos(a) * 70, b.x + 20, b.x + b.w - 20);
      const y = Phaser.Math.Clamp(this.y + Math.sin(a) * 50, b.y + 20, b.y + b.h - 20);
      w.telegraphs.add({
        shape: 'circle',
        x,
        y,
        radius: 10,
        dur: 0.9,
        color: 0xb05cff,
        onDone: () => {
          if (this.dying) return;
          w.spawnEnemy(this.phase >= 2 && i % 2 === 0 ? 'wraith' : 'slime', x, y);
          w.effects.burst('void', x, y, 10);
        },
      });
    }
  }

  private sweep(w: World): void {
    const p = this.target;
    if (!p) return;
    const angle = Math.atan2(p.y - this.y, p.x - this.x);
    this.setFlipX(Math.cos(angle) < 0);
    this.busyUntil = w.time + 1.0;
    audio.play('telegraph');
    w.telegraphs.add({
      shape: 'arc',
      x: this.x,
      y: this.y - 14,
      radius: 78,
      angle,
      arc: 2.6,
      dur: this.phase === 3 ? 0.6 : 0.8,
      color: 0xffd36b,
      onDone: (tg) => {
        if (this.dying) return;
        this.anim('attack');
        audio.play('heavy_slash', { pitch: 0.6 });
        w.effects.slash(tg.x, tg.y, tg.angle!, tg.arc!, tg.radius, 0xffd36b, 0.22, 8);
        w.effects.shake(0.005, 150);
        for (const pl of w.players) {
          if (pl.alive && inArc(tg.x, tg.y, tg.angle!, tg.arc! / 2, tg.radius, pl.x, pl.y - 6, 5)) w.combat.hurtPlayer(pl, this.def.attackDamage * this.damageMult, this.x, this.y, { knockback: 280 });
        }
      },
    });
  }

  private crownFall(w: World): void {
    this.anim('cast');
    this.busyUntil = w.time + 1.2;
    audio.play('boss_summon', { pitch: 0.7 });
    const targets: { x: number; y: number }[] = [];
    for (const pl of w.livingPlayers()) {
      targets.push({ x: pl.x, y: pl.y });
      const extra = this.phase === 3 ? 3 : 2;
      for (let i = 0; i < extra; i++) targets.push({ x: pl.x + w.rng.range(-90, 90), y: pl.y + w.rng.range(-70, 70) });
    }
    const b = ARENA.bounds;
    targets.forEach((tp, i) => {
      const x = Phaser.Math.Clamp(tp.x, b.x + 20, b.x + b.w - 20);
      const y = Phaser.Math.Clamp(tp.y, b.y + 20, b.y + b.h - 20);
      w.scene.time.delayedCall(i * 120, () => {
        if (this.dying) return;
        w.telegraphs.add({
          shape: 'circle',
          x,
          y,
          radius: 32,
          dur: 1.1,
          color: 0xff3355,
          onDone: () => {
            if (this.dying) return;
            audio.play('boss_slam', { volume: 0.6 });
            w.effects.ring(x, y, 4, 34, 0xffd36b, 0.3, 3);
            w.effects.burst('king', x, y, 18);
            w.effects.shake(0.004, 100);
            for (const pl of w.players) if (pl.alive && Math.hypot(pl.x - x, pl.y - y) < 32) w.combat.hurtPlayer(pl, this.def.attackDamage * 0.8 * this.damageMult, x, y, { knockback: 180 });
            // lingering cursed pool (dangerous floor zone)
            w.zones.add({ kind: 'curse', owner: null, abilityId: 'cursed_pool', x, y, radius: 26, duration: this.phase === 3 ? 7 : 6, tickInterval: 0.5, tickDamage: 6 * this.damageMult, armDelay: 0.3 });
          },
        });
      });
    });
  }

  private shockwave(w: World): void {
    this.anim('cast');
    this.busyUntil = w.time + 1.4;
    audio.play('telegraph', { pitch: 0.6 });
    const cx = this.x;
    const cy = this.y - 10;
    w.telegraphs.add({
      shape: 'ring',
      x: cx,
      y: cy,
      radius: 140,
      inner: 50,
      dur: 1.25,
      color: 0xffd36b,
      onDone: () => {
        if (this.dying) return;
        audio.play('boss_slam');
        w.effects.ring(cx, cy, 50, 140, 0xffd36b, 0.4, 6);
        w.effects.shake(0.008, 250);
        for (const pl of w.players) {
          const d = Math.hypot(pl.x - cx, pl.y - cy);
          if (pl.alive && d > 50 && d < 140) w.combat.hurtPlayer(pl, this.def.attackDamage * this.damageMult, cx, cy, { knockback: 240 });
        }
      },
    });
  }

  private orbBurst(w: World): void {
    this.anim('cast');
    this.busyUntil = w.time + 0.9;
    const cx = this.x;
    const cy = this.y - 26;
    w.telegraphs.add({
      shape: 'ring',
      x: cx,
      y: cy,
      radius: 22,
      inner: 14,
      dur: 0.7,
      color: 0xff3355,
      onDone: () => {
        if (this.dying) return;
        audio.play('enemy_shoot', { pitch: 0.5 });
        const n = 16;
        const off = w.rng.next();
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          w.projectiles.spawn({
            texture: 'proj-boss-orb',
            team: 'enemy',
            owner: null,
            abilityId: 'boss_orb',
            x: cx,
            y: cy,
            angle: a,
            speed: 85,
            range: 380,
            radius: 5,
            damage: this.def.attackDamage * 0.45 * this.damageMult,
            knockback: 0,
            pierce: 0,
            trail: 'king',
          });
        }
      },
    });
  }

  private chargeAttack(w: World): void {
    const p = this.target;
    if (!p) return;
    const angle = Math.atan2(p.y - this.y, p.x - this.x);
    const len = 220;
    this.busyUntil = w.time + 1.0;
    this.anim('attack');
    w.telegraphs.add({
      shape: 'line',
      x: this.x,
      y: this.y - 6,
      angle,
      length: len,
      width: this.radius * 2 + 8,
      radius: 0,
      dur: 0.85,
      color: 0xff3355,
      onDone: () => {
        if (this.dying || this.isFrozenAt(w.time)) return;
        const sp = 330;
        this.charge = { vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, until: w.time + len / sp };
        audio.play('rush', { pitch: 0.5 });
      },
    });
  }
}
