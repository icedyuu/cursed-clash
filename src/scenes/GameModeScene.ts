import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { Button, MenuList, menuBackdrop, panel, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';
import { CONTROLS_P2, CONTROLS_PAD, CONTROLS_SOLO } from '../ui/controlsText';
import { pads } from '../game/InputManager';
import { IS_TOUCH } from '../ui/TouchControls';

export class GameModeScene extends Phaser.Scene {
  private menu!: MenuList;
  private padInfo!: Phaser.GameObjects.Text;

  constructor() {
    super('GameModeScene');
  }

  create(): void {
    menuBackdrop(this);
    txt(this, GAME_WIDTH / 2, 22, 'SELECT MODE', { size: 16, font: 'title', origin: [0.5, 0.5] });
    const card = (x: number, title: string, color: string, lines: string[]) => {
      panel(this, x - 140, 44, 280, 210, 'ui-panel-dark');
      txt(this, x, 58, title, { font: 'title', origin: [0.5, 0.5], color });
      lines.forEach((l, i) => txt(this, x - 128, 74 + i * 11, l, { color: i === 0 ? COLORS.text : COLORS.textDim, wrap: 256 }));
    };
    if (IS_TOUCH) {
      // phones/tablets: solo only (versus needs keyboards or gamepads)
      card(GAME_WIDTH / 2, 'SOLO SURVIVAL', COLORS.void, [
        'SURVIVE ENDLESS CURSED WAVES.',
        '',
        'MOVE          LEFT THUMB (JOYSTICK)',
        'ATTACK        AUTOMATIC + AUTO-AIM',
        'ABILITIES     Q / E BUTTONS',
        'ULTIMATE      ULT BUTTON (WHEN CHARGED)',
        'DASH          DASH BUTTON',
        '',
        'LEVEL UP, BUILD SYNERGIES, SLAY THE',
        'HOLLOW KING AND CHASE YOUR HIGHSCORE.',
      ]);
      const buttons = [
        new Button(this, GAME_WIDTH / 2, 276, 180, 24, 'PLAY SOLO', () => SceneManager.fadeTo(this, 'CharacterSelectScene', { mode: 'solo' })),
        new Button(this, GAME_WIDTH / 2, 318, 100, 20, 'BACK', () => SceneManager.fadeTo(this, 'MainMenuScene')),
      ];
      this.menu = new MenuList(this, buttons, true);
      this.menu.onBack = () => SceneManager.fadeTo(this, 'MainMenuScene');
      SceneManager.fadeIn(this);
      return;
    }
    card(165, 'SOLO SURVIVAL', COLORS.void, [
      'SURVIVE ENDLESS CURSED WAVES.',
      '',
      ...CONTROLS_SOLO.map(([a, b]) => `${a.padEnd(14, ' ')}${b}`),
      '',
      'LEVEL UP, BUILD SYNERGIES, SLAY THE',
      'HOLLOW KING AND CHASE YOUR HIGHSCORE.',
    ]);
    card(475, 'LOCAL VERSUS', '#66ffcc', [
      'SAME ARENA. SAME CURSE. ONE SURVIVOR.',
      '',
      'P1: WASD + MOUSE, Q/E/R, SPACE',
      ...CONTROLS_P2.map(([a, b]) => `P2 ${a.padEnd(12, ' ')}${b}`),
      '',
      'GAMEPADS: 1 PAD -> P2, 2 PADS -> P1+P2',
      'FIRST TO FALL LOSES. TIES: TIME, KILLS.',
    ]);
    const buttons = [
      new Button(this, 165, 276, 180, 22, 'PLAY SOLO', () => SceneManager.fadeTo(this, 'CharacterSelectScene', { mode: 'solo' })),
      new Button(this, 475, 276, 180, 22, 'PLAY VERSUS', () => SceneManager.fadeTo(this, 'CharacterSelectScene', { mode: 'versus' })),
      new Button(this, GAME_WIDTH / 2, 318, 100, 18, 'BACK', () => SceneManager.fadeTo(this, 'MainMenuScene')),
    ];
    this.menu = new MenuList(this, buttons, true);
    this.menu.onBack = () => SceneManager.fadeTo(this, 'MainMenuScene');
    this.padInfo = txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 10, '', { origin: [0.5, 0.5], color: COLORS.textDark });
    void CONTROLS_PAD;
    SceneManager.fadeIn(this);
  }

  update(): void {
    const m = this.menu.update();
    if (IS_TOUCH) return;
    if (m.down && this.menu.index < 2) this.menu.select(2);
    else if (m.up && this.menu.index === 2) this.menu.select(0);
    this.padInfo.setText(`${pads.connected.length} GAMEPAD${pads.connected.length === 1 ? '' : 'S'} CONNECTED`);
  }
}
