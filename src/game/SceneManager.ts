/** Scene transition helpers so every menu change fades consistently. */
import Phaser from 'phaser';

export const SceneManager = {
  fadeTo(scene: Phaser.Scene, key: string, data?: object, duration = 260): void {
    if ((scene as Phaser.Scene & { __leaving?: boolean }).__leaving) return;
    (scene as Phaser.Scene & { __leaving?: boolean }).__leaving = true;
    scene.cameras.main.fadeOut(duration, 7, 4, 13);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      scene.scene.start(key, data);
    });
  },
  fadeIn(scene: Phaser.Scene, duration = 260): void {
    (scene as Phaser.Scene & { __leaving?: boolean }).__leaving = false;
    scene.cameras.main.fadeIn(duration, 7, 4, 13);
  },
};
