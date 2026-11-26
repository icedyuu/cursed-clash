/**
 * In-game HUD overlay (separate scene, fixed camera). Shows per-player health, XP, level,
 * ability cooldowns, ultimate charge, timer, kills, wave and the boss bar.
 */
import Phaser from 'phaser';
import type { ArenaScene } from '../scenes/ArenaScene';
import type { Player } from '../entities/Player';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { formatTime } from '../core/math';
import { txt } from './widgets';
import { GameManager } from '../game/GameManager';
import type { Boss } from '../entities/Boss';
import { audio } from '../game/AudioManager';
import { IS_TOUCH, touchOverlay, type TouchSlotInfo } from './TouchControls';
import { fragmentCapacity, fragmentParams } from '../systems/abilities/psychic';
import { psychicPhase } from '../systems/psychicState';

interface SlotView {
  slot: 'basic' | 'q' | 'e' | 'ult' | 'dash';
  x: number;
  y: number;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  key: Phaser.GameObjects.Text;
  cd: Phaser.GameObjects.Text;
}

interface PlayerView {
  p: Player;
  slots: SlotView[];
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  kills: Phaser.GameObjects.Text;
  barX: number;
  barY: number;
  barW: number;
  mirrored: boolean;
  lastLevel: number;
  /** Psychic Fragments + Overload row (The Hollow only). */
  res?: { y: number; label: Phaser.GameObjects.Text; state: Phaser.GameObjects.Text; lastFragments: number };
}

const KEYS_SOLO = { basic: 'LMB', q: 'Q', e: 'E', ult: 'R', dash: 'SPC' };
const KEYS_P1 = { basic: 'LMB', q: 'Q', e: 'E', ult: 'R', dash: 'SPC' };
const KEYS_P2 = { basic: 'IJKL', q: 'U', e: 'O', ult: 'P', dash: 'RSH' };

export class HUDScene extends Phaser.Scene {
  private arena!: ArenaScene;
  private g!: Phaser.GameObjects.Graphics;
  private views: PlayerView[] = [];
  private timer!: Phaser.GameObjects.Text;
  private wave!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private fps!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Image;
  private lowHp!: Phaser.GameObjects.Rectangle;
  private boss: Boss | null = null;
  private bannerQueue: { text: string; color: string; sub?: string }[] = [];
  private bannerBusy = false;
  private touchVisible = false;

  constructor() {
    super('HUDScene');
  }

  init(data: { arena: ArenaScene }): void {
    this.arena = data.arena;
    this.views = [];
    this.boss = null;
    this.bannerQueue = [];
    this.bannerBusy = false;
  }

  create(): void {
    this.touchVisible = false;
    this.vignette = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-vignette').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.85);
    this.lowHp = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff0022, 0).setOrigin(0);
    this.g = this.add.graphics();
    const versus = this.arena.mode === 'versus';
    this.arena.players.forEach((p) => this.views.push(this.buildPlayer(p, versus)));

    this.timer = txt(this, GAME_WIDTH / 2, 6, '00:00', { size: 16, font: 'title', origin: [0.5, 0] });
    this.wave = txt(this, GAME_WIDTH / 2, 26, 'WAVE 1', { origin: [0.5, 0], color: COLORS.textDim });
    this.killsText = txt(this, GAME_WIDTH / 2, 36, '', { origin: [0.5, 0], color: COLORS.textDim });
    this.bossName = txt(this, GAME_WIDTH / 2, 50, 'THE HOLLOW KING', { font: 'title', origin: [0.5, 0], color: COLORS.gold }).setVisible(false);
    this.bannerText = txt(this, GAME_WIDTH / 2, 108, '', { size: 16, font: 'title', origin: [0.5, 0.5] }).setAlpha(0);
    this.bannerSub = txt(this, GAME_WIDTH / 2, 128, '', { origin: [0.5, 0.5], color: COLORS.textDim }).setAlpha(0);
    this.toast = txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 66, '', { origin: [0.5, 0.5], color: COLORS.gold }).setAlpha(0);
    this.fps = txt(this, GAME_WIDTH - 4, GAME_HEIGHT - 10, '', { origin: [1, 0], color: COLORS.textDark });

    const ev = this.arena.events;
    ev.on('banner', this.onBanner, this);
    ev.on('boss-spawned', this.onBoss, this);
    ev.on('boss-defeated', this.onBossDown, this);
    ev.on('synergy', this.onSynergy, this);
    ev.on('player-hurt', this.onHurt, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off('banner', this.onBanner, this);
      ev.off('boss-spawned', this.onBoss, this);
      ev.off('boss-defeated', this.onBossDown, this);
      ev.off('synergy', this.onSynergy, this);
      ev.off('player-hurt', this.onHurt, this);
    });
  }

  private buildPlayer(p: Player, versus: boolean): PlayerView {
    const mirrored = versus && p.index === 1;
    const left = mirrored ? GAME_WIDTH - 6 : 6;
    const dir = mirrored ? -1 : 1;
    // portrait
    const pf = this.add.image(left + dir * 14, 18, 'ui-slot').setDisplaySize(26, 26);
    this.add.image(left + dir * 14, 22, `hero-${p.def.id}`, 0).setFlipX(mirrored);
    void pf;
    const nameColor = versus ? (p.index === 0 ? COLORS.p1css : COLORS.p2css) : COLORS.text;
    const name = txt(this, left + dir * 30, 5, `${versus ? `P${p.index + 1} ` : ''}${p.def.name.replace('The ', '').toUpperCase()}`, { origin: [mirrored ? 1 : 0, 0], color: nameColor });
    const level = txt(this, left + dir * 30, 30, 'LV 1', { origin: [mirrored ? 1 : 0, 0], color: COLORS.gold });
    const hpText = txt(this, left + dir * 30 + dir * 60, 30, '', { origin: [mirrored ? 1 : 0, 0], color: COLORS.textDim });
    const kills = txt(this, left + dir * 30, 40, '', { origin: [mirrored ? 1 : 0, 0], color: COLORS.textDim }).setVisible(versus);
    const barW = versus ? 110 : 130;
    const barX = mirrored ? left - 30 - barW : left + 30;
    // ability bar
    const keyset = versus ? (p.index === 0 ? KEYS_P1 : KEYS_P2) : KEYS_SOLO;
    const slots: SlotView[] = [];
    const order: SlotView['slot'][] = ['basic', 'q', 'e', 'ult', 'dash'];
    const size = 24;
    const total = order.length * (size + 3);
    const startX = versus ? (mirrored ? GAME_WIDTH - 8 - total + size / 2 : 8 + size / 2) : GAME_WIDTH / 2 - total / 2 + size / 2;
    order.forEach((slot, i) => {
      const x = startX + i * (size + 3);
      const y = GAME_HEIGHT - 20;
      const frame = this.add.image(x, y, 'ui-slot').setDisplaySize(size, size);
      const iconKey = slot === 'dash' ? 'icon-dash' : p.abilities[slot].def.icon;
      const icon = this.add.image(x, y, 'icons', iconKey);
      const key = txt(this, x, y - 16, keyset[slot], { origin: [0.5, 0.5], color: COLORS.textDim });
      const cd = txt(this, x, y, '', { origin: [0.5, 0.5], color: '#ffffff' });
      // on touch devices the on-screen buttons show cooldowns instead
      if (IS_TOUCH && !versus) [frame, icon, key, cd].forEach((o) => o.setVisible(false));
      slots.push({ slot, x, y, frame, icon, key, cd });
    });
    let res: PlayerView['res'];
    if (p.psychic) {
      const y = versus ? 51 : 41;
      const tx = mirrored ? left - 30 - barW - 4 : left + 30 + barW + 4;
      res = {
        y,
        label: txt(this, tx, y - 2, '', { origin: [mirrored ? 1 : 0, 0], color: '#b9a3ff' }),
        state: txt(this, tx, y + 6, '', { origin: [mirrored ? 1 : 0, 0], color: COLORS.textDim }),
        lastFragments: 0,
      };
    }
    return { p, slots, name, level, hpText, kills, barX, barY: 16, barW, mirrored, lastLevel: 1, res };
  }

  private onBanner(text: string, color: string, sub?: string): void {
    this.bannerQueue.push({ text, color, sub });
    if (!this.bannerBusy) this.nextBanner();
  }

  private nextBanner(): void {
    const b = this.bannerQueue.shift();
    if (!b) {
      this.bannerBusy = false;
      return;
    }
    this.bannerBusy = true;
    this.bannerText.setText(b.text).setColor(b.color).setScale(1.6).setAlpha(0);
    this.bannerSub.setText(b.sub ?? '').setAlpha(0);
    this.tweens.add({ targets: this.bannerText, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 300, delay: 150 });
    this.tweens.add({
      targets: [this.bannerText, this.bannerSub],
      alpha: 0,
      delay: 1500,
      duration: 350,
      onComplete: () => this.nextBanner(),
    });
  }

  private onBoss(boss: Boss): void {
    this.boss = boss;
    this.bossName.setVisible(true);
  }

  private onBossDown(): void {
    this.boss = null;
    this.bossName.setVisible(false);
  }

  private onSynergy(name: string, p: Player): void {
    this.toast.setText(`SYNERGY UNLOCKED: ${name.toUpperCase()}${this.arena.mode === 'versus' ? ` (P${p.index + 1})` : ''}`).setAlpha(1).setY(GAME_HEIGHT - 60);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, y: GAME_HEIGHT - 70, alpha: 0, delay: 2200, duration: 500 });
    audio.play('synergy');
  }

  private onHurt(): void {
    this.lowHp.setAlpha(0.18);
    this.tweens.add({ targets: this.lowHp, alpha: 0, duration: 250 });
  }

  update(): void {
    const a = this.arena;
    if (!a || !a.scene.isActive() && !a.scene.isPaused()) return;
    const g = this.g;
    g.clear();
    this.timer.setText(formatTime(a.runTime));
    this.wave.setText(`WAVE ${a.waves?.wave ?? 1}`);
    if (a.mode === 'versus') {
      const [p1, p2] = a.players;
      this.killsText.setText(`KILLS  ${p1.kills} - ${p2.kills}`);
    } else this.killsText.setText(`KILLS ${a.players[0].kills}`);
    for (const v of this.views) this.drawPlayer(v, g);
    this.drawBoss(g);
    this.updateTouch();
    const solo = a.players[0];
    if (a.mode === 'solo' && solo.alive && solo.hp / solo.stats.maxHp < 0.3) {
      this.vignette.setTint(0xff3355).setAlpha(0.7 + Math.sin(a.runTime * 6) * 0.15);
    } else this.vignette.clearTint().setAlpha(0.85);
    if (GameManager.save.settings.showFps) this.fps.setText(`${Math.round(this.game.loop.actualFps)} FPS  ${a.enemies.filter((e) => e.active).length} EN`);
    else this.fps.setText('');
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, color: number, back: number, mirrored = false): void {
    g.fillStyle(0x0d0816, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(back, 1).fillRect(x, y, w, h);
    const fw = Math.round(w * Phaser.Math.Clamp(ratio, 0, 1));
    g.fillStyle(color, 1).fillRect(mirrored ? x + w - fw : x, y, fw, h);
    g.fillStyle(0xffffff, 0.25).fillRect(mirrored ? x + w - fw : x, y, fw, 1);
  }

  /** Shows the touch controls only during live solo gameplay and feeds them cooldowns. */
  private updateTouch(): void {
    if (!IS_TOUCH) return;
    const a = this.arena;
    const p = a.players[0];
    const live = a.mode === 'solo' && !!p?.alive && !a.ended && !a.upgradeOpen && a.scene.isActive() && !a.scene.isPaused();
    if (live !== this.touchVisible) {
      this.touchVisible = live;
      if (live) touchOverlay.show();
      else touchOverlay.hide();
    }
    if (!live) return;
    const cd = (slot: 'q' | 'e'): TouchSlotInfo => {
      const inst = p.abilities[slot];
      return {
        icon: inst.def.icon,
        ratio: this.arena.abilities.cooldownRatio(p, slot),
        label: inst.cooldown > 0.2 ? (inst.cooldown < 10 ? inst.cooldown.toFixed(1) : `${Math.ceil(inst.cooldown)}`) : '',
      };
    };
    touchOverlay.update({
      q: cd('q'),
      e: cd('e'),
      ult: { icon: p.abilities.ult.def.icon, ratio: 1 - p.ultCharge / 100, label: p.ultReady ? '' : `${Math.floor(p.ultCharge)}%`, ready: p.ultReady },
      dash: { icon: 'icon-dash', ratio: p.dashCooldown / p.stats.dashCooldown, label: p.dashCooldown > 0 ? p.dashCooldown.toFixed(1) : '' },
    });
  }

  private drawPlayer(v: PlayerView, g: Phaser.GameObjects.Graphics): void {
    const p = v.p;
    const hpRatio = p.hp / p.stats.maxHp;
    this.bar(g, v.barX, v.barY, v.barW, 6, hpRatio, p.alive ? (hpRatio < 0.3 ? 0xff5577 : 0xff3355) : 0x45405a, 0x2a0d18, v.mirrored);
    this.bar(g, v.barX, v.barY + 9, v.barW, 3, p.xp / p.xpNeeded, 0x6fe3ff, 0x0f1d33, v.mirrored);
    v.level.setText(`LV ${p.level}`);
    v.hpText.setText(p.alive ? `${Math.ceil(p.hp)}/${Math.round(p.stats.maxHp)}` : 'DEFEATED');
    v.kills.setText(`KILLS ${p.kills}${p.hunted ? '  HUNTED' : ''}`).setColor(p.hunted ? '#ff5577' : COLORS.textDim);
    if (p.level !== v.lastLevel) {
      v.lastLevel = p.level;
      this.tweens.add({ targets: v.level, scale: 1.4, yoyo: true, duration: 150 });
    }
    const t = this.arena.runTime;
    if (v.res && p.psychic) this.drawPsychic(v, g, t);
    for (const s of v.slots) {
      if (!s.frame.visible) continue;
      let ratio = 0;
      let label = '';
      if (s.slot === 'dash') {
        ratio = p.dashCooldown / p.stats.dashCooldown;
        if (p.dashCooldown > 0) label = p.dashCooldown.toFixed(1);
      } else if (s.slot === 'ult') {
        ratio = 1 - p.ultCharge / 100;
        label = p.ultReady ? '' : `${Math.floor(p.ultCharge)}%`;
      } else {
        const inst = p.abilities[s.slot];
        ratio = this.arena.abilities.cooldownRatio(p, s.slot);
        if (inst.cooldown > 0.2 && s.slot !== 'basic') label = inst.cooldown < 10 ? inst.cooldown.toFixed(1) : `${Math.ceil(inst.cooldown)}`;
      }
      const size = 22;
      const x0 = s.x - size / 2;
      const y0 = s.y - size / 2;
      if (ratio > 0) {
        g.fillStyle(0x05020a, 0.7).fillRect(x0 + 1, y0 + 1, size - 2, Math.round((size - 2) * ratio));
      }
      if (s.slot === 'ult') {
        const ready = p.ultReady;
        g.lineStyle(1, ready ? 0xffd36b : 0x6b4a1a, ready ? 0.6 + Math.sin(t * 8) * 0.4 : 1);
        g.strokeRect(x0 - 1, y0 - 1, size + 2, size + 2);
        if (ready) g.fillStyle(0xffd36b, 0.15 + Math.sin(t * 8) * 0.1).fillRect(x0, y0, size, size);
      }
      s.icon.setAlpha(p.alive ? (ratio > 0 && s.slot !== 'basic' ? 0.55 : 1) : 0.3);
      s.cd.setText(label).setFontSize(8);
      s.cd.setFontFamily(FONT.body);
    }
  }

  /** The Hollow: fragment pips + overload meter under the portrait column. */
  private drawPsychic(v: PlayerView, g: Phaser.GameObjects.Graphics, t: number): void {
    const p = v.p;
    const s = p.psychic!;
    const r = v.res!;
    const cap = fragmentCapacity(p);
    const step = Math.min(6, Math.floor((v.barW + 2) / cap));
    const size = step - 2;
    for (let i = 0; i < cap; i++) {
      const x = v.mirrored ? v.barX + v.barW - (i + 1) * step + 2 : v.barX + i * step;
      const full = i < s.fragments;
      g.fillStyle(0x0d0816, 1).fillRect(x - 1, r.y - 1, size + 2, size + 2);
      g.fillStyle(full ? 0xb9a3ff : 0x241d33, 1).fillRect(x, r.y, size, size);
      if (full) g.fillStyle(0xffffff, 0.5).fillRect(x, r.y, 1, 1);
    }
    if (s.fragments > r.lastFragments) this.tweens.add({ targets: r.label, scale: 1.3, yoyo: true, duration: 90 });
    r.lastFragments = s.fragments;
    const phase = psychicPhase(s, this.arena.runTime);
    const ratio = s.overload / 100;
    const color = phase === 'overload' ? (Math.floor(t * 10) % 2 ? 0xffffff : 0xd9ccff) : phase === 'recovery' ? 0x4a4458 : ratio >= 0.8 ? (Math.floor(t * 6) % 2 ? 0xb9a3ff : 0x8a70d0) : 0x7a62c0;
    this.bar(g, v.barX, r.y + size + 3, v.barW, 2, phase === 'recovery' ? 1 - (s.recoveryUntil - this.arena.runTime) / Math.max(1, fragmentParams(p).recoveryDuration ?? 3.5) : ratio, color, 0x16111f, v.mirrored);
    r.label.setText(`${s.fragments}/${cap}`);
    r.state
      .setText(phase === 'overload' ? 'OVERLOAD' : phase === 'recovery' ? 'RECOVERING' : ratio >= 0.8 ? 'STRAIN' : '')
      .setColor(phase === 'overload' ? '#e6dcff' : phase === 'recovery' ? '#8a80a8' : '#b9a3ff');
  }

  private drawBoss(g: Phaser.GameObjects.Graphics): void {
    const b = this.boss;
    if (!b || !b.active || b.dying) {
      if (this.bossName.visible && (!b || b.dying)) this.bossName.setVisible(false);
      return;
    }
    const w = 240;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = 62;
    this.bar(g, x, y, w, 6, b.hp / b.maxHp, b.phase === 3 ? 0xff3355 : 0xffd36b, 0x2a1030);
    // phase markers
    g.fillStyle(0x0d0816, 1).fillRect(x + Math.round(w * 0.33), y, 1, 6).fillRect(x + Math.round(w * 0.66), y, 1, 6);
    this.bossName.setText(`THE HOLLOW KING  ${['I', 'II', 'III'][b.phase - 1]}`).setColor(b.invulnerable ? '#9a90c0' : b.phase === 3 ? '#ff5577' : '#ffd36b');
  }
}
