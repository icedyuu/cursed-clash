/** Shared pixel-UI building blocks: text, nine-slice panels, buttons and keyboard/gamepad menus. */
import Phaser from 'phaser';
import { COLORS, FONT } from '../game/GameConfig';
import { menuIntent, tickInput, type MenuIntent } from '../game/InputManager';
import { audio } from '../game/AudioManager';

export interface TextOpts {
  size?: 8 | 16 | 24 | 32;
  font?: 'title' | 'body';
  color?: string;
  align?: 'left' | 'center' | 'right';
  origin?: [number, number];
  wrap?: number;
  stroke?: boolean;
  lineSpacing?: number;
}

export const txt = (scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.Text => {
  const t = scene.add.text(Math.round(x), Math.round(y), s, {
    fontFamily: o.font === 'title' ? FONT.title : FONT.body,
    fontSize: `${o.size ?? 8}px`,
    color: o.color ?? COLORS.text,
    align: o.align ?? 'left',
    stroke: o.stroke === false ? undefined : '#0d0816',
    strokeThickness: o.stroke === false ? 0 : o.size && o.size >= 16 ? 3 : 2,
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: o.lineSpacing ?? 2,
  });
  t.setOrigin(...(o.origin ?? [0, 0]));
  return t;
};

export const panel = (scene: Phaser.Scene, x: number, y: number, w: number, h: number, key = 'ui-panel'): Phaser.GameObjects.NineSlice =>
  scene.add.nineslice(Math.round(x), Math.round(y), key, 0, Math.round(w), Math.round(h), 6, 6, 6, 6).setOrigin(0, 0);

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  selected = false;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    text: string,
    readonly onClick: () => void,
    icon?: string,
  ) {
    super(scene, Math.round(x), Math.round(y));
    this.bg = scene.add.nineslice(0, 0, 'ui-button', 0, w, h, 6, 6, 5, 5).setOrigin(0.5);
    this.label = txt(scene, icon ? 6 : 0, 0, text, { origin: [0.5, 0.5], color: COLORS.textDim });
    this.add([this.bg, this.label]);
    if (icon) this.add(scene.add.image(-w / 2 + 12, 0, 'icons', icon));
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.enabled && this.press());
    scene.add.existing(this);
  }

  setText(s: string): this {
    this.label.setText(s);
    return this;
  }

  setSelected(v: boolean): this {
    this.selected = v;
    this.bg.setTexture(v ? 'ui-button-hot' : 'ui-button');
    this.label.setColor(!this.enabled ? COLORS.textDark : v ? '#ffffff' : COLORS.textDim);
    this.label.setX(v ? 1 : 0);
    return this;
  }

  press(): void {
    audio.unlock();
    audio.play('ui_select');
    this.scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.92, yoyo: true, duration: 60 });
    this.onClick();
  }
}

/** Vertical (or horizontal) list of buttons navigable by keyboard, gamepad and mouse. */
export class MenuList {
  index = 0;
  onBack?: () => void;
  active = true;
  /** Input is ignored on the frame the menu appears (the key that opened it is still "pressed"). */
  private readonly createdFrame: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly buttons: Button[],
    private readonly horizontal = false,
  ) {
    buttons.forEach((b, i) =>
      b.on('pointerover', () => {
        if (this.active && this.index !== i) {
          this.select(i);
          audio.play('ui_move');
        }
      }),
    );
    this.createdFrame = scene.game.loop.frame;
    this.select(0);
  }

  select(i: number): void {
    this.index = (i + this.buttons.length) % this.buttons.length;
    this.buttons.forEach((b, k) => b.setSelected(k === this.index));
  }

  /** Call from scene.update. Returns the raw intent for extra handling. */
  update(): MenuIntent {
    tickInput(this.scene.game.loop.frame);
    const m = menuIntent('any', this.scene.game.loop.time);
    if (!this.active || this.scene.game.loop.frame <= this.createdFrame + 1) return m;
    const prev = this.horizontal ? m.left : m.up;
    const next = this.horizontal ? m.right : m.down;
    if (prev) {
      this.select(this.index - 1);
      audio.play('ui_move');
    }
    if (next) {
      this.select(this.index + 1);
      audio.play('ui_move');
    }
    if (m.confirm) this.buttons[this.index].press();
    if (m.back && this.onBack) {
      audio.play('ui_back');
      this.onBack();
    }
    return m;
  }
}

/** Animated dark backdrop shared by menu scenes: floor, fog and floating embers. */
export const menuBackdrop = (scene: Phaser.Scene): void => {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const floor = scene.add.tileSprite(0, 0, w, h, 'arena-floor').setOrigin(0).setAlpha(0.5);
  floor.tilePositionX = 300;
  floor.tilePositionY = 200;
  scene.tweens.add({ targets: floor, tilePositionX: 560, tilePositionY: 300, duration: 60000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.add.rectangle(0, 0, w, h, 0x07040d, 0.55).setOrigin(0);
  for (let i = 0; i < 6; i++) {
    const f = scene.add
      .image(Math.random() * w, Math.random() * h, 'fog')
      .setTint(i % 2 ? 0x3a2560 : 0x1f2a4a)
      .setScale(3 + Math.random() * 2)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: f, x: f.x + 120, duration: 14000 + Math.random() * 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  scene.add.particles(0, 0, 'px', {
    x: { min: 0, max: w },
    y: h + 4,
    lifespan: 7000,
    speedY: { min: -14, max: -30 },
    speedX: { min: -6, max: 6 },
    scale: { start: 1, end: 0 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xb05cff, 0x6fe3ff, 0xff3344, 0xe0b3ff],
    frequency: 140,
    blendMode: 'ADD',
  });
  scene.add.image(w / 2, h / 2, 'ui-vignette').setDisplaySize(w, h).setAlpha(0.9);
};

/** Stylised CURSED CLASH logo. */
export const logo = (scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.Container => {
  const c = scene.add.container(x, y);
  const glow = scene.add.image(0, 4, 'glow-big').setTint(0x8a4fe0).setBlendMode(Phaser.BlendModes.ADD).setScale(3.2, 1.1).setAlpha(0.5);
  const top = txt(scene, 0, -14, 'CURSED', { size: 24, font: 'title', origin: [0.5, 0.5], color: '#e0b3ff' });
  const bottom = txt(scene, 0, 14, 'CLASH', { size: 32, font: 'title', origin: [0.5, 0.5], color: '#ffffff' });
  for (const t of [top, bottom]) {
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    if (t === top) {
      grad.addColorStop(0, '#f2e0ff');
      grad.addColorStop(1, '#a35cff');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#ff8a8a');
      grad.addColorStop(1, '#c81e34');
    }
    t.setFill(grad);
    t.setStroke('#0d0816', 6);
    t.setShadow(0, 3, '#05020a', 0, true, true);
  }
  const slash = scene.add.graphics();
  slash.fillStyle(0xff3344, 1);
  slash.fillTriangle(-104, 34, 108, 22, 108, 26);
  slash.fillStyle(0x6fe3ff, 1);
  slash.fillTriangle(-96, 38, 100, 30, 100, 31);
  c.add([glow, slash, top, bottom]);
  c.setScale(scale);
  scene.tweens.add({ targets: glow, alpha: 0.25, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
};
