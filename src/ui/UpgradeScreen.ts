/**
 * Level-up / reward selection. Pauses the arena; in versus both players pick independently
 * and simultaneously on their half of the screen. The arena resumes once all picks are done.
 */
import Phaser from 'phaser';
import type { ArenaScene } from '../scenes/ArenaScene';
import type { Player } from '../entities/Player';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { applyUpgrade, describeChoice, fusionProgress, rollChoices, type UpgradeChoice } from '../systems/UpgradeSystem';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { RARITIES } from '../data/rarities';
import { menuIntent, tickInput } from '../game/InputManager';
import { audio } from '../game/AudioManager';
import { txt } from './widgets';
import { previewChoice } from './upgradePreview';
import { IS_TOUCH } from './TouchControls';

interface Side {
  p: Player;
  cards: Phaser.GameObjects.Container[];
  choices: UpgradeChoice[];
  index: number;
  done: boolean;
  busy: boolean;
  title: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  x0: number;
  width: number;
  reward: 'rare' | 'epic' | null;
}

export class UpgradeScene extends Phaser.Scene {
  private arena!: ArenaScene;
  private sides: Side[] = [];
  private versus = false;
  private closing = false;
  private openedAt = 0;

  constructor() {
    super('UpgradeScene');
  }

  init(data: { arena: ArenaScene; players: number[] }): void {
    this.arena = data.arena;
    this.versus = this.arena.mode === 'versus';
    this.sides = [];
    this.closing = false;
    this.openedAt = this.game.loop.time;
    this.registry.set('upgradePlayers', data.players);
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x07040d, 0.72).setOrigin(0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-vignette').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const ids = this.registry.get('upgradePlayers') as number[];
    if (this.versus) {
      this.add.rectangle(GAME_WIDTH / 2, 30, 1, GAME_HEIGHT - 60, 0x41356e, 0.8);
      for (const p of this.arena.players) {
        const x0 = p.index === 0 ? 0 : GAME_WIDTH / 2;
        const side = this.makeSide(p, x0, GAME_WIDTH / 2);
        if (!ids.includes(p.index) || !p.alive) {
          side.done = true;
          side.status.setText(p.alive ? 'KEEP FIGHTING... (PAUSED)' : 'DEFEATED');
        } else this.nextRoll(side);
      }
    } else {
      const side = this.makeSide(this.arena.players[0], 0, GAME_WIDTH);
      this.nextRoll(side);
    }
    this.add.existing(txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 14, this.versus ? 'P1: A/D + SPACE     P2: ARROWS + ENTER     PADS: D-PAD + A' : IS_TOUCH ? 'TAP A CARD TO TAKE IT' : 'A/D OR ARROWS TO CHOOSE  -  SPACE/ENTER/CLICK TO TAKE', { origin: [0.5, 0.5], color: COLORS.textDark }));
  }

  private makeSide(p: Player, x0: number, width: number): Side {
    const title = txt(this, x0 + width / 2, 22, '', { size: 16, font: 'title', origin: [0.5, 0.5], color: COLORS.gold });
    const status = txt(this, x0 + width / 2, GAME_HEIGHT / 2, '', { origin: [0.5, 0.5], color: COLORS.textDim });
    const side: Side = { p, cards: [], choices: [], index: 1, done: false, busy: false, title, status, x0, width, reward: null };
    this.sides.push(side);
    return side;
  }

  private nextRoll(side: Side): void {
    const p = side.p;
    side.cards.forEach((c) => c.destroy());
    side.cards = [];
    let floor: 'common' | 'rare' | 'epic' = 'common';
    side.reward = null;
    if (p.pendingRewards.length > 0) {
      side.reward = p.pendingRewards.shift()!;
      floor = side.reward;
    } else if (p.pendingLevelUps > 0) p.pendingLevelUps--;
    else {
      side.done = true;
      side.title.setText('');
      side.status.setText(this.versus ? 'READY!' : '');
      this.checkAllDone();
      return;
    }
    const label = side.reward === 'epic' ? 'CROWN BLESSING' : side.reward === 'rare' ? 'CURSED CHEST' : 'LEVEL UP!';
    const who = this.versus ? `P${p.index + 1} ` : '';
    side.title.setText(`${who}${label}`).setColor(side.reward ? '#ffd36b' : this.versus ? (p.index === 0 ? COLORS.p1css : COLORS.p2css) : COLORS.gold);
    side.title.setScale(1.3);
    this.tweens.add({ targets: side.title, scale: 1, duration: 250, ease: 'Back.easeOut' });
    side.choices = rollChoices(p.build, this.arena.rng, 3, floor, side.reward ? 0.6 : 0);
    side.index = Math.min(1, side.choices.length - 1);
    if (side.choices.length === 0) {
      // Everything maxed – fall back to a heal.
      p.heal(p.stats.maxHp * 0.3, this.arena.world);
      this.time.delayedCall(10, () => this.nextRoll(side));
      return;
    }
    const n = side.choices.length;
    const cw = this.versus ? 98 : 150;
    const ch = this.versus ? 208 : 210;
    const gap = this.versus ? 5 : 14;
    const total = n * cw + (n - 1) * gap;
    const startX = side.x0 + side.width / 2 - total / 2;
    side.choices.forEach((c, i) => {
      const card = this.buildCard(side, c, startX + i * (cw + gap), 52, cw, ch, i);
      side.cards.push(card);
    });
    this.highlight(side);
  }

  private buildCard(side: Side, c: UpgradeChoice, x: number, y: number, w: number, h: number, i: number): Phaser.GameObjects.Container {
    const r = RARITIES[c.rarity];
    const cont = this.add.container(Math.round(x + w / 2), Math.round(y + h / 2));
    const glow = this.add.image(0, 0, 'glow-big').setTint(r.color).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(w * 1.5, h * 1.2).setAlpha(0);
    const frame = this.add.nineslice(0, 0, 'ui-card-fill', 0, w, h, 6, 6, 6, 6).setTint(r.color);
    const inner = this.add.rectangle(0, 0, w - 6, h - 6, 0x120b1f, 0.92);
    const head = this.add.rectangle(0, -h / 2 + 12, w - 6, 16, r.color, 0.25);
    const isFusion = c.upgrade.category === 'fusion';
    const rarity = txt(this, 0, -h / 2 + 12, isFusion ? 'FUSION' : r.name.toUpperCase(), { origin: [0.5, 0.5], color: isFusion ? '#ffffff' : r.css });
    const iconGlow = this.add.image(0, -h / 2 + 46, 'glow').setTint(r.color).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.7);
    const icon = this.add.image(0, -h / 2 + 46, 'icons', c.upgrade.icon).setScale(2);
    const name = txt(this, 0, -h / 2 + 72, c.upgrade.name.toUpperCase(), { origin: [0.5, 0], color: '#ffffff', wrap: w - 12, align: 'center' });
    const desc = txt(this, 0, -h / 2 + 100, describeChoice(c), { origin: [0.5, 0], color: COLORS.textDim, wrap: w - 12, align: 'center' });
    const prev = txt(this, 0, h / 2 - 34, isFusion ? 'NEW FUSED ABILITY' : previewChoice(side.p, c), { origin: [0.5, 0.5], color: COLORS.gold, wrap: w - 8, align: 'center' });
    const stacks = side.p.build.stacks[c.upgrade.id] ?? 0;
    const fp = isFusion ? [] : fusionProgress(side.p.build, c.upgrade.id);
    let lvlText = stacks > 0 ? `RANK ${stacks} > ${stacks + 1}` : c.upgrade.category === 'stat' ? 'NEW STAT' : 'NEW ABILITY BOON';
    let lvlColor: string = COLORS.textDark;
    if (isFusion) {
      lvlText = (c.upgrade.fusion ?? []).map((f) => UPGRADE_BY_ID[f.id].name.replace(/^.*: /, '').toUpperCase()).join(' + ');
      lvlColor = '#ffb340';
    } else if (c.completesSynergy) {
      lvlText = `* ${c.completesSynergy.name.toUpperCase()}`;
      lvlColor = '#6fe3ff';
    } else if (fp.length > 0) {
      const f = fp[0];
      lvlText = `> ${f.fusion.name.replace('Fusion: ', '').toUpperCase()} ${f.have}/${f.need}`;
      lvlColor = '#ffb340';
    }
    const lvl = txt(this, 0, h / 2 - 12, lvlText, { origin: [0.5, 0.5], color: lvlColor, wrap: w - 8, align: 'center' });
    cont.add([glow, frame, inner, head, rarity, iconGlow, icon, name, desc, prev, lvl]);
    if (isFusion) {
      // shimmering multi-colour frame so fusions stand out from normal cards
      const hues = [0xb05cff, 0xff3344, 0x6fe3ff, 0xffb340];
      let k = 0;
      this.time.addEvent({ delay: 220, loop: true, callback: () => frame.active && frame.setTint(hues[k++ % hues.length]) });
      head.setFillStyle(0xffb340, 0.45);
      this.tweens.add({ targets: icon, scale: 2.4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    cont.setData('glow', glow).setData('frame', frame).setData('baseY', cont.y);
    cont.setSize(w, h).setInteractive({ useHandCursor: true });
    cont.on('pointerover', () => {
      if (side.done || side.busy || side.index === i) return;
      side.index = i;
      this.highlight(side);
      audio.play('ui_move');
    });
    cont.on('pointerdown', () => {
      if (side.done || side.busy || this.game.loop.time - this.openedAt < 350) return;
      side.index = i;
      this.pick(side);
    });
    // entrance
    cont.setAlpha(0).setY(cont.y + 20);
    this.tweens.add({ targets: cont, alpha: 1, y: cont.getData('baseY'), duration: 260, delay: i * 70, ease: 'Cubic.easeOut' });
    if (c.rarity === 'legendary' || c.rarity === 'epic') this.tweens.add({ targets: iconGlow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    return cont;
  }

  private highlight(side: Side): void {
    side.cards.forEach((c, i) => {
      const sel = i === side.index;
      const glow = c.getData('glow') as Phaser.GameObjects.Image;
      this.tweens.killTweensOf(glow);
      glow.setAlpha(sel ? 0.35 : 0);
      if (sel) this.tweens.add({ targets: glow, alpha: 0.15, duration: 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: c, y: (c.getData('baseY') as number) - (sel ? 6 : 0), scale: sel ? 1.03 : 1, duration: 120 });
    });
  }

  private pick(side: Side): void {
    const choice = side.choices[side.index];
    if (!choice || side.busy) return;
    side.busy = true;
    const p = side.p;
    const res = applyUpgrade(p.build, choice.upgrade.id, choice.rarity);
    p.recomputeStats();
    if (res.healRatio > 0) p.heal(p.stats.maxHp * res.healRatio * 0.5, this.arena.world);
    audio.play('upgrade_pick');
    if (choice.upgrade.category === 'fusion') {
      this.arena.banner(choice.upgrade.name.toUpperCase(), '#ffb340', choice.upgrade.description);
      this.arena.world.effects.ring(p.x, p.y - 10, 6, 80, 0xffb340, 0.6, 4);
      this.arena.world.effects.burst('gold', p.x, p.y - 10, 30);
      audio.play('synergy');
    }
    for (const s of res.newSynergies) {
      this.arena.events.emit('synergy', s.name, p);
      this.arena.banner(`SYNERGY: ${s.name.toUpperCase()}`, '#6fe3ff', s.description);
    }
    const card = side.cards[side.index];
    side.cards.forEach((c, i) => {
      if (i !== side.index) this.tweens.add({ targets: c, alpha: 0, y: c.y + 14, duration: 180 });
    });
    this.tweens.add({ targets: card, scale: 1.12, duration: 120, yoyo: true });
    this.tweens.add({
      targets: card,
      alpha: 0,
      delay: 260,
      duration: 160,
      onComplete: () => {
        side.busy = false;
        this.nextRoll(side);
      },
    });
  }

  private checkAllDone(): void {
    if (this.closing) return;
    if (!this.sides.every((s) => s.done)) return;
    this.closing = true;
    this.time.delayedCall(this.versus ? 350 : 60, () => {
      this.scene.stop();
      this.arena.onUpgradesDone();
    });
  }

  update(): void {
    tickInput(this.game.loop.frame);
    const t = this.game.loop.time;
    // brief input grace period so a held attack/dash key doesn't instantly pick a card
    if (t - this.openedAt < 350) return;
    for (const side of this.sides) {
      if (side.done || side.busy || side.cards.length === 0) continue;
      const m = this.versus ? menuIntent(side.p.index, t, true) : menuIntent('any', t);
      if (m.left || m.up) {
        side.index = (side.index - 1 + side.cards.length) % side.cards.length;
        this.highlight(side);
        audio.play('ui_move');
      }
      if (m.right || m.down) {
        side.index = (side.index + 1) % side.cards.length;
        this.highlight(side);
        audio.play('ui_move');
      }
      if (m.confirm) this.pick(side);
    }
  }
}
