import '@fontsource/press-start-2p/400.css';
import '@fontsource/silkscreen/400.css';
import './styles.css';
import Phaser from 'phaser';
import { createGameConfig } from './game/GameConfigFactory';

const game = new Phaser.Game(createGameConfig());

/** Integer scaling for crisp pixels: largest whole multiple of 640x360 that fits the window. */
const fit = () => {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / 640, window.innerHeight / 360)));
  const scale = window.innerWidth < 640 || window.innerHeight < 360 ? Math.min(window.innerWidth / 640, window.innerHeight / 360) : s;
  game.canvas.style.width = `${Math.round(640 * scale)}px`;
  game.canvas.style.height = `${Math.round(360 * scale)}px`;
  game.scale.refresh();
};
game.events.once(Phaser.Core.Events.READY, fit);
window.addEventListener('resize', fit);
(window as unknown as { __game: Phaser.Game }).__game = game;
