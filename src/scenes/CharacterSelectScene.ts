/** Character selection for solo (one cursor) and versus (two independent cursors + ready-up). */
import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters';
import { Button, menuBackdrop, txt } from '../ui/widgets';
import { buildCharacterDetails } from '../ui/CharacterSelection';
import { SceneManager } from '../game/SceneManager';
import { GameManager, type GameMode } from '../game/GameManager';
import { menuIntent, tickInput } from '../game/InputManager';
import { audio } from '../game/AudioManager';
import type { CharacterId } from '../data/types';
import { IS_TOUCH } from '../ui/TouchControls';

interface Cursor {
  index: number;
  ready: boolean;
  frame: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  details?: Phaser.GameObjects.Container;
  color: number;
}

export class CharacterSelectScene extends Phaser.Scene {
  private mode: GameMode = 'solo';
  private cursors: Cursor[] = [];
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private starting = false;
  private openedFrame = 0;

  constructor() {
    super('CharacterSelectScene');
  }

  init(data: { mode: GameMode }): void {
    this.mode = data.mode ?? 'solo';
    this.cursors = [];
    this.sprites = [];
    this.starting = false;
  }

  private slotX(i: number): number {
    const n = CHARACTER_ORDER.length;
    const spacing = n > 3 ? 124 : 150;
    return GAME_WIDTH / 2 + (i - (n - 1) / 2) * spacing;
  }

  create(): void {
    menuBackdrop(this);
    this.openedFrame = this.game.loop.frame;
    txt(this, GAME_WIDTH / 2, 16, this.mode === 'versus' ? 'VERSUS - CHOOSE YOUR FIGHTERS' : 'CHOOSE YOUR CURSED', { size: 16, font: 'title', origin: [0.5, 0.5] });
    CHARACTER_ORDER.forEach((id, i) => {
      const x = this.slotX(i);
      const def = CHARACTERS[id];
      const ring = this.add.image(x, 112, 'glow-big').setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9, 0.35).setAlpha(0.6);
      this.tweens.add({ targets: ring, alpha: 0.3, duration: 1200 + i * 200, yoyo: true, repeat: -1 });
      this.add.ellipse(x, 112, 70, 18, 0x120b1f, 0.9).setStrokeStyle(1, def.color, 0.8);
      const s = this.add.sprite(x, 114, `hero-${id}`).setOrigin(0.5, 0.9).setScale(3);
      s.play(`hero-${id}:idle`);
      s.setInteractive({ useHandCursor: true });
      s.on('pointerdown', () => this.pointerPick(i));
      s.on('pointerover', () => {
        if (IS_TOUCH) return; // touch: first tap selects, second tap confirms
        if (!this.cursors[0].ready && this.cursors[0].index !== i) this.move(0, i - this.cursors[0].index);
      });
      this.sprites.push(s);
      txt(this, x, 124, def.name.replace('The ', '').toUpperCase(), { font: 'title', origin: [0.5, 0.5], color: `#${def.color.toString(16)}` });
      txt(this, x, 132, def.role.toUpperCase().split(' / ').join('\n'), { origin: [0.5, 0], align: 'center', color: COLORS.textDim, lineSpacing: 0 });
    });
    const n = this.mode === 'versus' ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const color = n === 1 ? 0xe0b3ff : k === 0 ? 0xb98cff : 0x66ffcc;
      this.cursors.push({
        index: n === 1 ? 0 : k === 0 ? 0 : 2,
        ready: false,
        frame: this.add.graphics(),
        label: txt(this, 0, 0, n === 1 ? '' : `P${k + 1}`, { font: 'title', origin: [0.5, 0.5], color: k === 0 ? COLORS.p1css : COLORS.p2css }),
        color,
      });
    }
    this.cursors.forEach((_, k) => this.refresh(k));
    txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 8, this.mode === 'versus' ? 'P1: A/D + SPACE    P2: ARROWS + ENTER    ESC: BACK' : IS_TOUCH ? 'TAP A HERO TO VIEW  -  TAP AGAIN TO START' : 'ARROWS/A-D + ENTER/SPACE OR CLICK    ESC: BACK', { origin: [0.5, 0.5], color: COLORS.textDark });
    if (IS_TOUCH) new Button(this, 44, GAME_HEIGHT - 12, 70, 16, 'BACK', () => SceneManager.fadeTo(this, 'GameModeScene'));
    SceneManager.fadeIn(this);
  }

  private pointerPick(i: number): void {
    const c = this.cursors[0];
    if (c.ready) return;
    if (IS_TOUCH && c.index !== i) {
      this.move(0, i - c.index);
      return;
    }
    c.index = i;
    this.refresh(0);
    this.confirm(0);
  }

  private move(k: number, delta: number): void {
    const c = this.cursors[k];
    if (c.ready) return;
    c.index = (c.index + delta + CHARACTER_ORDER.length) % CHARACTER_ORDER.length;
    audio.play('ui_move');
    this.refresh(k);
  }

  private refresh(k: number): void {
    const c = this.cursors[k];
    const x = this.slotX(c.index);
    const versus = this.mode === 'versus';
    const off = versus ? (k === 0 ? -3 : 3) : 0;
    c.frame.clear();
    c.frame.lineStyle(c.ready ? 2 : 1, c.color, 1);
    const fx = x - 42 + off;
    const fy = 30 + off;
    const fw = 84;
    const fh = 116;
    // corner brackets
    const L = 10;
    c.frame.beginPath();
    for (const [cx, cy, dx, dy] of [
      [fx, fy, 1, 1],
      [fx + fw, fy, -1, 1],
      [fx, fy + fh, 1, -1],
      [fx + fw, fy + fh, -1, -1],
    ] as [number, number, number, number][]) {
      c.frame.moveTo(cx + dx * L, cy);
      c.frame.lineTo(cx, cy);
      c.frame.lineTo(cx, cy + dy * L);
    }
    c.frame.strokePath();
    c.label.setPosition(x + (versus ? (k === 0 ? -28 : 28) : 0), 40).setText(versus ? `P${k + 1}${c.ready ? ' OK' : ''}` : '');
    // sprites: highlighted ones walk
    this.sprites.forEach((s, i) => {
      const id = CHARACTER_ORDER[i];
      const hl = this.cursors.some((cc) => cc.index === i);
      const want = `hero-${id}:${hl ? 'walk' : 'idle'}`;
      if (s.anims.currentAnim?.key !== want && !(s.anims.currentAnim?.key.endsWith('cast') && s.anims.isPlaying)) s.play(want);
      s.setAlpha(hl ? 1 : 0.6);
    });
    c.details?.destroy();
    const def = CHARACTERS[CHARACTER_ORDER[c.index]];
    c.details = versus ? buildCharacterDetails(this, def, k === 0 ? 12 : GAME_WIDTH / 2 + 4, 152, GAME_WIDTH / 2 - 16, 190, true) : buildCharacterDetails(this, def, 12, 152, GAME_WIDTH - 24, 190, false);
  }

  private confirm(k: number): void {
    const c = this.cursors[k];
    if (c.ready) return;
    c.ready = true;
    audio.unlock();
    audio.play('ui_select');
    const s = this.sprites[c.index];
    const id = CHARACTER_ORDER[c.index];
    s.play(`hero-${id}:cast`).once('animationcomplete', () => s.play(`hero-${id}:walk`));
    this.cameras.main.flash(120, 60, 30, 90);
    this.refresh(k);
    if (this.cursors.every((cc) => cc.ready)) this.begin();
  }

  private begin(): void {
    if (this.starting) return;
    this.starting = true;
    const chars = this.cursors.map((c) => CHARACTER_ORDER[c.index]) as CharacterId[];
    GameManager.startRun(this.mode, chars);
    this.time.delayedCall(450, () => SceneManager.fadeTo(this, 'ArenaScene', {}, 400));
  }

  update(): void {
    tickInput(this.game.loop.frame);
    if (this.starting || this.game.loop.frame <= this.openedFrame + 1) return;
    const t = this.game.loop.time;
    if (this.mode === 'solo') {
      const m = menuIntent('any', t);
      if (m.left) this.move(0, -1);
      if (m.right) this.move(0, 1);
      if (m.confirm) this.confirm(0);
      if (m.back) SceneManager.fadeTo(this, 'GameModeScene');
      return;
    }
    const back = menuIntent('any', t).back;
    for (const k of [0, 1] as const) {
      const m = menuIntent(k, t, true);
      if (m.left) this.move(k, -1);
      if (m.right) this.move(k, 1);
      if (m.confirm) this.confirm(k);
    }
    if (back) {
      const readyOnes = this.cursors.filter((c) => c.ready);
      if (readyOnes.length === 0) SceneManager.fadeTo(this, 'GameModeScene');
      else
        this.cursors.forEach((c, k) => {
          c.ready = false;
          this.refresh(k);
        });
    }
  }
}
