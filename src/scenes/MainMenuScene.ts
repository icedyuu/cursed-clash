import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { Button, MenuList, logo, menuBackdrop, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';
import { GameManager } from '../game/GameManager';
import { audio } from '../game/AudioManager';
import { formatTime } from '../core/math';
import { CHARACTER_ORDER } from '../data/characters';
import { IS_TOUCH } from '../ui/TouchControls';

export class MainMenuScene extends Phaser.Scene {
  private menu!: MenuList;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    menuBackdrop(this);
    // heroes standing in the mist
    const gap = CHARACTER_ORDER.length > 3 ? 40 : 46;
    CHARACTER_ORDER.forEach((id, i) => {
      const x = 470 + i * gap - (CHARACTER_ORDER.length > 3 ? 8 : 0);
      const dy = i % 2 === 1 ? 10 : 0;
      const s = this.add.sprite(x, 250 + dy, `hero-${id}`).setScale(2).setFlipX(true);
      s.play({ key: `hero-${id}:idle`, startFrame: i % 4 });
      this.add.image(x, 252 + dy, 'shadow-m').setScale(2).setDepth(-1).setAlpha(0.8);
      this.time.addEvent({ delay: 3000 + i * 1300, loop: true, callback: () => s.play(`hero-${id}:cast`).once('animationcomplete', () => s.play(`hero-${id}:idle`)) });
    });
    const king = this.add.sprite(520, 120, 'boss-king').setAlpha(0.18).setScale(2.2).setTint(0x6b3fd1);
    king.play('boss-king:move');
    this.tweens.add({ targets: king, y: 112, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    logo(this, 170, 74);
    const go = (key: string, data?: object) => () => SceneManager.fadeTo(this, key, data);
    const buttons = [
      new Button(this, 170, 150, 160, 20, 'PLAY', go('GameModeScene')),
      new Button(this, 170, 176, 160, 20, 'CHARACTER GALLERY', go('GalleryScene')),
      new Button(this, 170, 202, 160, 20, 'SETTINGS', go('SettingsScene', { returnTo: 'MainMenuScene' })),
      new Button(this, 170, 228, 160, 20, 'CREDITS', go('CreditsScene')),
    ];
    this.menu = new MenuList(this, buttons);

    const st = GameManager.save.stats;
    const best = Math.max(0, ...Object.values(st.bestTime).map((v) => v ?? 0));
    txt(this, 170, 260, best > 0 ? `BEST SURVIVAL ${formatTime(best)}   RUNS ${st.runs}   KILLS ${st.totalKills}` : 'SURVIVE THE CURSE. OUTLAST YOUR RIVAL.', { origin: [0.5, 0.5], color: COLORS.textDim });
    const hint = txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, IS_TOUCH ? 'TAP TO SELECT' : 'ARROWS/WASD + ENTER  -  MOUSE  -  GAMEPAD', { origin: [0.5, 0.5], color: COLORS.textDark });
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
    txt(this, GAME_WIDTH - 4, 4, 'v1.0', { origin: [1, 0], color: COLORS.textDark });

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      audio.unlock();
      audio.playMusic('menu');
    };
    this.input.once('pointerdown', unlock);
    this.input.keyboard?.once('keydown', unlock);
    if (audio.unlocked) audio.playMusic('menu');
    SceneManager.fadeIn(this);
  }

  update(): void {
    this.menu.update();
  }
}
