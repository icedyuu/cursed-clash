/** Character detail panel used by Character Select and the Gallery. */
import Phaser from 'phaser';
import type { CharacterDef } from '../data/types';
import { getAbility } from '../data/abilities';
import { COLORS } from '../game/GameConfig';
import { panel, txt } from './widgets';

export const buildCharacterDetails = (scene: Phaser.Scene, def: CharacterDef, x: number, y: number, w: number, h: number, compact: boolean): Phaser.GameObjects.Container => {
  const c = scene.add.container(0, 0);
  c.add(panel(scene, x, y, w, h, 'ui-panel-dark'));
  const color = `#${def.color.toString(16).padStart(6, '0')}`;
  c.add(txt(scene, x + 8, y + 7, def.name.toUpperCase(), { font: 'title', color }));
  c.add(txt(scene, x + 8, y + 19, `${def.role.toUpperCase()}  -  ${def.title.toUpperCase()}`, { color: COLORS.textDim }));
  const rows: [string, string][] = [
    ['PASSIVE', def.abilities.passive],
    ['BASIC', def.abilities.basic],
    ['Q', def.abilities.q],
    ['E', def.abilities.e],
    ['ULT', def.abilities.ult],
  ];
  let yy = y + 33;
  const textW = compact ? w - 34 : w - 190;
  for (const [label, id] of rows) {
    const a = getAbility(id);
    c.add(scene.add.image(x + 16, yy + 7, 'icons', a.icon));
    c.add(txt(scene, x + 28, yy, `${label}: ${a.name.toUpperCase()}`, { color: label === 'ULT' ? COLORS.gold : COLORS.text }));
    if (!compact) {
      const d = txt(scene, x + 28, yy + 10, a.description, { color: COLORS.textDim, wrap: textW });
      c.add(d);
      yy += 12 + d.height;
    } else yy += 13;
  }
  // ratings
  const rx = compact ? x + 8 : x + w - 150;
  let ry = compact ? yy + 4 : y + 36;
  const g = scene.add.graphics();
  c.add(g);
  for (const [k, v] of Object.entries(def.ratings)) {
    c.add(txt(scene, rx, ry, k.toUpperCase(), { color: COLORS.textDim }));
    for (let i = 0; i < 5; i++) {
      g.fillStyle(i < v ? def.color : 0x2a2238, 1).fillRect(rx + 62 + i * 13, ry + 1, 11, 6);
    }
    ry += 11;
  }
  if (!compact) {
    const s = def.stats;
    c.add(txt(scene, rx, ry + 6, `HP ${s.maxHp}  SPEED ${s.moveSpeed}  ARMOR ${s.armor ?? 0}`, { color: COLORS.text }));
    c.add(txt(scene, rx, ry + 17, `DASH: ${def.dash.style.toUpperCase()}   CRIT ${Math.round((s.critChance ?? 0.05) * 100)}%`, { color: COLORS.text }));
    c.add(txt(scene, rx, ry + 32, def.playstyle, { color: COLORS.textDim, wrap: 140 }));
  }
  return c;
};
