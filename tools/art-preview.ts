import { generateCharacterSheet, CHARACTER_ART_IDS } from '../src/art/characterArt';
import { generateMonsterSheets } from '../src/art/enemyArt';
import { generateEffectSheets } from '../src/art/effectArt';
import { generateUiSheets } from '../src/art/uiArt';
import { generateIconAtlas } from '../src/art/iconArt';
import { generateArenaFloor, generatePropSheets } from '../src/art/environmentArt';
const out = document.getElementById('out')!;
const add = (c: HTMLCanvasElement, scale: number) => {
  const s = document.createElement('canvas');
  s.width = c.width * scale; s.height = c.height * scale;
  const ctx = s.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, s.width, s.height);
  s.style.display = 'inline-block'; s.style.margin = '4px';
  out.appendChild(s);
};
const mode = new URLSearchParams(location.search).get('m') ?? 'chars';
if (mode === 'chars') for (const id of CHARACTER_ART_IDS) add(generateCharacterSheet(id).canvas, 3);
if (mode === 'monsters') for (const s of Object.values(generateMonsterSheets())) add(s.canvas, 3);
if (mode === 'fx') { for (const s of [...generateEffectSheets(), ...generatePropSheets()]) add(s.canvas, 4); add(generateIconAtlas().canvas, 4); for (const s of generateUiSheets()) if (s.key !== 'ui-vignette') add(s.canvas, 4); }
if (mode === 'floor') add(generateArenaFloor(), 1);
