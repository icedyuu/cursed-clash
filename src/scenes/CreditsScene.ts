import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { Button, MenuList, logo, menuBackdrop, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';

export class CreditsScene extends Phaser.Scene {
  private menu!: MenuList;

  constructor() {
    super('CreditsScene');
  }

  create(): void {
    menuBackdrop(this);
    logo(this, GAME_WIDTH / 2, 56, 0.8);
    const lines: [string, string][] = [
      ['GAME DESIGN, CODE, PIXEL ART, AUDIO', 'Built for Beni with Claude'],
      ['ENGINE', 'Phaser 3 + TypeScript + Vite'],
      ['ART', 'All sprites are generated procedurally at startup'],
      ['MUSIC & SFX', 'Synthesised live with the Web Audio API'],
      ['FONTS', 'Press Start 2P & Silkscreen (SIL Open Font License)'],
      ['', ''],
      ['THANK YOU FOR PLAYING', 'May the curse spare you'],
    ];
    lines.forEach(([a, b], i) => {
      txt(this, GAME_WIDTH / 2, 110 + i * 26, a, { origin: [0.5, 0.5], color: COLORS.gold });
      txt(this, GAME_WIDTH / 2, 121 + i * 26, b, { origin: [0.5, 0.5], color: COLORS.textDim });
    });
    this.menu = new MenuList(this, [new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 24, 120, 20, 'BACK', () => SceneManager.fadeTo(this, 'MainMenuScene'))]);
    this.menu.onBack = () => SceneManager.fadeTo(this, 'MainMenuScene');
    SceneManager.fadeIn(this);
  }

  update(): void {
    this.menu.update();
  }
}
