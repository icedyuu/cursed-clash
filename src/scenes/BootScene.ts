/** Waits for the pixel fonts, then hands over to the preloader. */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const fonts = ['8px "Press Start 2P"', '8px "Silkscreen"'];
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), timeout])
      .catch(() => undefined)
      .finally(() => this.scene.start('PreloadScene'));
  }
}
