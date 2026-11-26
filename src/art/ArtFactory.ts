/**
 * Registers every procedurally generated texture + animation with Phaser.
 * Gameplay code only references texture keys, so art can be replaced without touching logic.
 */
import Phaser from 'phaser';
import { generateCharacterSheet, CHARACTER_ART_IDS, type GeneratedSheet } from './characterArt';
import { generateMonsterSheets } from './enemyArt';
import { generateEffectSheets, type SimpleSheet } from './effectArt';
import { generateUiSheets } from './uiArt';
import { generateIconAtlas, ICON_SIZE } from './iconArt';
import { generateArenaFloor, generatePropSheets } from './environmentArt';
import { manifestEntry } from '../data/assetManifest';

const addFrames = (scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number): number => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  const cols = Math.floor(canvas.width / fw);
  const rows = Math.floor(canvas.height / fh);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(i++, 0, c * fw, r * fh, fw, fh);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return i;
};

const registerSheet = (scene: Phaser.Scene, key: string, sheet: GeneratedSheet): void => {
  // A replacement sprite sheet loaded in PreloadScene wins over the generated one.
  if (!(manifestEntry(key)?.url && scene.textures.exists(key))) addFrames(scene, key, sheet.canvas, sheet.frameWidth, sheet.frameHeight);
  for (const a of sheet.anims) {
    const animKey = `${key}:${a.state}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: a.frames }, (_, i) => ({ key, frame: a.start + i })),
      frameRate: a.rate,
      repeat: a.repeat,
    });
  }
};

const registerSimple = (scene: Phaser.Scene, s: SimpleSheet): void => {
  addFrames(scene, s.key, s.canvas, s.frameWidth, s.frameHeight);
  // Soft light textures stay smooth; everything else is hard-pixel.
  if (s.key.startsWith('glow') || s.key === 'fog') scene.textures.get(s.key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (s.frames > 1) {
    const animKey = `${s.key}:loop`;
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({ key: animKey, frames: Array.from({ length: s.frames }, (_, i) => ({ key: s.key, frame: i })), frameRate: s.rate ?? 8, repeat: -1 });
    }
  }
};

export const ArtFactory = {
  /** Generates everything. Split into steps so the preload bar can advance. */
  steps(scene: Phaser.Scene): (() => void)[] {
    return [
      ...CHARACTER_ART_IDS.map((id) => () => registerSheet(scene, `hero-${id}`, generateCharacterSheet(id))),
      () => {
        for (const [key, sheet] of Object.entries(generateMonsterSheets())) registerSheet(scene, key, sheet);
      },
      () => generateEffectSheets().forEach((s) => registerSimple(scene, s)),
      () => generateUiSheets().forEach((s) => registerSimple(scene, s)),
      () => generatePropSheets().forEach((s) => registerSimple(scene, s)),
      () => {
        const atlas = generateIconAtlas();
        if (scene.textures.exists('icons')) scene.textures.remove('icons');
        const tex = scene.textures.addCanvas('icons', atlas.canvas)!;
        for (const [name, f] of Object.entries(atlas.frames)) tex.add(name, 0, f.x, f.y, ICON_SIZE, ICON_SIZE);
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      },
      () => {
        if (scene.textures.exists('arena-floor')) scene.textures.remove('arena-floor');
        scene.textures.addCanvas('arena-floor', generateArenaFloor())!.setFilter(Phaser.Textures.FilterMode.NEAREST);
      },
    ];
  },
};
