/**
 * Asset manifest. Every visual the game uses is listed here with its frame size.
 * By default all assets are generated procedurally (art/*). To swap in hand-made art,
 * put a PNG in public/assets/ and set `url` – PreloadScene loads it instead of generating,
 * as long as the frame size and frame order match the generated layout.
 */
export interface AssetEntry {
  key: string;
  frameWidth: number;
  frameHeight: number;
  /** Optional replacement sprite sheet (relative to the site root). */
  url?: string;
  group: 'hero' | 'monster' | 'effect' | 'ui' | 'prop' | 'environment' | 'icon';
}

export const ASSET_MANIFEST: AssetEntry[] = [
  { key: 'hero-voidwalker', frameWidth: 32, frameHeight: 32, group: 'hero' },
  { key: 'hero-blood_reaper', frameWidth: 32, frameHeight: 32, group: 'hero' },
  { key: 'hero-frost_witch', frameWidth: 32, frameHeight: 32, group: 'hero' },
  { key: 'enemy-slime', frameWidth: 16, frameHeight: 16, group: 'monster' },
  { key: 'enemy-wraith', frameWidth: 20, frameHeight: 24, group: 'monster' },
  { key: 'enemy-knight', frameWidth: 32, frameHeight: 28, group: 'monster' },
  { key: 'enemy-caster', frameWidth: 24, frameHeight: 30, group: 'monster' },
  { key: 'enemy-elite', frameWidth: 48, frameHeight: 40, group: 'monster' },
  { key: 'boss-king', frameWidth: 72, frameHeight: 64, group: 'monster' },
  { key: 'boss-king-rage', frameWidth: 72, frameHeight: 64, group: 'monster' },
  { key: 'arena-floor', frameWidth: 1184, frameHeight: 768, group: 'environment' },
  { key: 'icons', frameWidth: 16, frameHeight: 16, group: 'icon' },
];

export const manifestEntry = (key: string): AssetEntry | undefined => ASSET_MANIFEST.find((a) => a.key === key);
