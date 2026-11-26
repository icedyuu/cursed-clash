/** Settings: volumes, accessibility toggles, save reset. Opened from the menu or the pause screen. */
import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { Button, MenuList, menuBackdrop, panel, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';
import { GameManager } from '../game/GameManager';
import { audio } from '../game/AudioManager';
import type { Settings } from '../systems/SaveSystem';
import { IS_TOUCH } from '../ui/TouchControls';

type NumKey = 'masterVolume' | 'musicVolume' | 'sfxVolume';
type BoolKey = 'screenShake' | 'damageNumbers' | 'autoAttack' | 'showFps';

export class SettingsScene extends Phaser.Scene {
  private menu!: MenuList;
  private returnTo = 'MainMenuScene';
  private overlay = false;
  private confirmReset = false;

  constructor() {
    super('SettingsScene');
  }

  init(data: { returnTo?: string; overlay?: boolean }): void {
    this.returnTo = data.returnTo ?? 'MainMenuScene';
    this.overlay = !!data.overlay;
    this.confirmReset = false;
  }

  create(): void {
    if (this.overlay) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x07040d, 0.85).setOrigin(0);
    else menuBackdrop(this);
    txt(this, GAME_WIDTH / 2, 22, 'SETTINGS', { size: 16, font: 'title', origin: [0.5, 0.5] });
    panel(this, GAME_WIDTH / 2 - 170, 40, 340, 270, 'ui-panel-dark');
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const bar = (v: number) => '|'.repeat(Math.round(v * 10)).padEnd(10, '.');
    const label = (k: NumKey | BoolKey, name: string) => {
      const v = GameManager.save.settings[k];
      return typeof v === 'number' ? `${name}  ${bar(v)}  ${pct(v)}` : `${name}  ${v ? 'ON' : 'OFF'}`;
    };
    const items: [NumKey | BoolKey, string][] = [
      ['masterVolume', 'MASTER'],
      ['musicVolume', 'MUSIC'],
      ['sfxVolume', 'SFX'],
      ['screenShake', 'SCREEN SHAKE'],
      ['damageNumbers', 'DAMAGE NUMBERS'],
      ['autoAttack', 'AUTO-ATTACK (P1)'],
      ['showFps', 'SHOW FPS'],
    ];
    const buttons: Button[] = [];
    items.forEach(([k, name], i) => {
      const b = new Button(this, GAME_WIDTH / 2, 62 + i * 26, 300, 20, label(k, name), () => this.change(k, 1, b, name, label));
      b.setData('key', k).setData('name', name);
      buttons.push(b);
    });
    const reset = new Button(this, GAME_WIDTH / 2, 62 + items.length * 26 + 6, 300, 20, 'RESET HIGHSCORES & STATS', () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        reset.setText('PRESS AGAIN TO CONFIRM');
        return;
      }
      GameManager.save.reset();
      reset.setText('SAVE DATA RESET');
    });
    buttons.push(reset);
    buttons.push(new Button(this, GAME_WIDTH / 2, 62 + items.length * 26 + 36, 140, 20, 'BACK', () => this.back()));
    this.menu = new MenuList(this, buttons);
    this.menu.onBack = () => this.back();
    txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, IS_TOUCH ? 'TAP TO CHANGE  -  SETTINGS SAVE AUTOMATICALLY' : 'LEFT/RIGHT TO ADJUST  -  ENTER TO TOGGLE  -  SETTINGS SAVE AUTOMATICALLY', { origin: [0.5, 0.5], color: COLORS.textDark });
    if (!this.overlay) SceneManager.fadeIn(this);
  }

  private change(k: NumKey | BoolKey, dir: number, b: Button, name: string, label: (k: NumKey | BoolKey, name: string) => string): void {
    const s = GameManager.save.settings;
    const patch: Partial<Settings> = {};
    if (typeof s[k] === 'number') {
      let v = Math.round(((s[k] as number) + dir * 0.1) * 10) / 10;
      if (v > 1) v = dir > 0 && (s[k] as number) >= 1 ? 0 : 1;
      if (v < 0) v = 0;
      (patch as Record<string, number>)[k] = v;
    } else (patch as Record<string, boolean>)[k] = !s[k];
    GameManager.save.updateSettings(patch);
    audio.applySettings(GameManager.save.settings);
    b.setText(label(k, name));
  }

  private back(): void {
    if (this.overlay) {
      this.scene.stop();
      this.scene.resume(this.returnTo);
    } else SceneManager.fadeTo(this, this.returnTo);
  }

  update(): void {
    const m = this.menu.update();
    const b = this.menu.buttons[this.menu.index];
    const k = b.getData('key') as NumKey | BoolKey | undefined;
    if (!k || typeof GameManager.save.settings[k] !== 'number') return;
    const name = b.getData('name') as string;
    const label = (kk: NumKey | BoolKey, nm: string) => {
      const v = GameManager.save.settings[kk] as number;
      return `${nm}  ${'|'.repeat(Math.round(v * 10)).padEnd(10, '.')}  ${Math.round(v * 100)}%`;
    };
    if (m.left) this.change(k, -1, b, name, label);
    if (m.right) this.change(k, 1, b, name, label);
  }
}
