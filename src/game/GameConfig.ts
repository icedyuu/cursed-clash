/** Engine-level constants. Gameplay tuning lives in data/. */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

/** Full arena texture size and the walkable rectangle inside its walls. */
export const ARENA = {
  width: 1184,
  height: 768,
  bounds: { x: 32, y: 56, w: 1120, h: 680 },
};

/** Render ordering. Entities are y-sorted on top of DEPTH.entities. */
export const DEPTH = {
  floor: 0,
  decal: 5,
  zones: 10,
  telegraph: 12,
  pickups: 20,
  shadows: 25,
  entities: 100,
  projectiles: 5000,
  effects: 6000,
  light: 6500,
  fog: 7000,
  numbers: 8000,
  overlay: 9000,
};

export const FONT = {
  title: '"Press Start 2P", monospace',
  body: '"Silkscreen", monospace',
};

export const COLORS = {
  text: '#e8e2ff',
  textDim: '#9a90c0',
  textDark: '#5d547f',
  void: '#b05cff',
  blood: '#ff3344',
  frost: '#6fe3ff',
  gold: '#ffd36b',
  hp: 0xff3355,
  hpBack: 0x2a0d18,
  xp: 0x6fe3ff,
  xpBack: 0x0f1d33,
  ult: 0xffd36b,
  p1: 0xb98cff,
  p2: 0x66ffcc,
  p1css: '#b98cff',
  p2css: '#66ffcc',
};

export const IS_DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
