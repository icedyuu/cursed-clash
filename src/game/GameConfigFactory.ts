import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './GameConfig';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameModeScene } from '../scenes/GameModeScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';
import { ArenaScene } from '../scenes/ArenaScene';
import { HUDScene } from '../ui/HUD';
import { UpgradeScene } from '../ui/UpgradeScreen';
import { PauseScene } from '../ui/PauseMenu';
import { GameOverScene } from '../scenes/GameOverScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { GalleryScene } from '../scenes/GalleryScene';
import { CreditsScene } from '../scenes/CreditsScene';

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.WEBGL,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#07040d',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  physics: { default: 'arcade', arcade: { debug: false, fps: 60 } },
  input: { gamepad: false, mouse: { preventDefaultWheel: true } },
  audio: { noAudio: true },
  fps: { target: 60, smoothStep: true },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameModeScene,
    CharacterSelectScene,
    ArenaScene,
    HUDScene,
    UpgradeScene,
    PauseScene,
    GameOverScene,
    SettingsScene,
    GalleryScene,
    CreditsScene,
  ],
});
