/**
 * Builds every procedural texture (see art/ArtFactory) with a progress bar. If the asset manifest
 * points to replacement files they are loaded first and take precedence.
 */
import Phaser from 'phaser';
import { ArtFactory } from '../art/ArtFactory';
import { ASSET_MANIFEST } from '../data/assetManifest';
import { FONT } from '../game/GameConfig';
import { GameManager } from '../game/GameManager';
import { CHARACTERS } from '../data/characters';
import type { CharacterId } from '../data/types';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    for (const a of ASSET_MANIFEST) if (a.url) this.load.spritesheet(a.key, a.url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    const label = this.add.text(w / 2, h / 2 - 16, 'SUMMONING THE CURSE...', { fontFamily: FONT.title, fontSize: '8px', color: '#b98cff' }).setOrigin(0.5);
    const bar = this.add.graphics();
    const steps = ArtFactory.steps(this);
    let i = 0;
    const draw = () => {
      bar.clear();
      bar.fillStyle(0x1f1833, 1).fillRect(w / 2 - 100, h / 2, 200, 6);
      bar.fillStyle(0xb05cff, 1).fillRect(w / 2 - 100, h / 2, Math.round((200 * i) / steps.length), 6);
      bar.lineStyle(1, 0x5b2a9e, 1).strokeRect(w / 2 - 101, h / 2 - 1, 202, 8);
    };
    draw();
    // run one generation step per frame so the bar animates
    this.time.addEvent({
      delay: 1,
      repeat: steps.length - 1,
      callback: () => {
        steps[i++]();
        draw();
        if (i >= steps.length) {
          label.setText('READY');
          const q = new URLSearchParams(location.search);
          const jump = q.get('scene');
          // dev shortcut: ?scene=ArenaScene&mode=versus&chars=blood_reaper,frost_witch
          if (jump === 'ArenaScene' && (q.get('chars') || q.get('mode'))) {
            const mode = q.get('mode') === 'versus' ? 'versus' : 'solo';
            const chars = (q.get('chars') ?? 'voidwalker').split(',').filter((c) => c in CHARACTERS) as CharacterId[];
            while (chars.length < (mode === 'versus' ? 2 : 1)) chars.push('voidwalker');
            GameManager.startRun(mode, chars.slice(0, mode === 'versus' ? 2 : 1));
          }
          this.scene.start(jump ?? 'MainMenuScene');
        }
      },
    });
  }
}
