/**
 * Input layer: independent per-player controllers built from keyboard schemes, mouse and gamepads.
 * Keys are tracked by physical `event.code`, so WASD works on QWERTZ/AZERTY and Right Shift is
 * distinguishable from Left Shift.
 */
import Phaser from 'phaser';
import { normalize, normalizeMovement } from '../core/math';

export interface PlayerIntent {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  /** Where the aim came from: mouse aims at a world point, others are directions. */
  aimSource: 'mouse' | 'stick' | 'keys' | 'none';
  attack: boolean;
  q: boolean;
  e: boolean;
  ult: boolean;
  dash: boolean;
  pause: boolean;
}

export const emptyIntent = (): PlayerIntent => ({
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  aimSource: 'none',
  attack: false,
  q: false,
  e: false,
  ult: false,
  dash: false,
  pause: false,
});

// ───────── raw keyboard ─────────
class KeyTracker {
  readonly down = new Set<string>();
  private pressedAcc = new Set<string>();
  pressed = new Set<string>();
  private frame = -1;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedAcc.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  /** Called once per game frame; moves accumulated presses into `pressed`. */
  tick(frame: number): void {
    if (frame === this.frame) return;
    this.frame = frame;
    this.pressed = this.pressedAcc;
    this.pressedAcc = new Set();
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }
  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }
}

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

// ───────── gamepads ─────────
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

class PadTracker {
  private prev: boolean[][] = [];
  private cur: boolean[][] = [];
  axes: number[][] = [];
  private frame = -1;
  connected: number[] = [];

  tick(frame: number): void {
    if (frame === this.frame) return;
    this.frame = frame;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    this.prev = this.cur;
    this.cur = [];
    this.axes = [];
    this.connected = [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      this.connected.push(i);
      this.cur[i] = p.buttons.map((b) => b.pressed || b.value > 0.5);
      this.axes[i] = [...p.axes];
    }
  }

  /** Index of the n-th connected pad, or -1. */
  nth(n: number): number {
    return this.connected[n] ?? -1;
  }
  isDown(pad: number, button: number): boolean {
    return !!this.cur[pad]?.[button];
  }
  wasPressed(pad: number, button: number): boolean {
    return !!this.cur[pad]?.[button] && !this.prev[pad]?.[button];
  }
  stick(pad: number, which: 0 | 1, deadzone = 0.25): { x: number; y: number } {
    const a = this.axes[pad];
    if (!a) return { x: 0, y: 0 };
    const x = a[which * 2] ?? 0;
    const y = a[which * 2 + 1] ?? 0;
    const m = Math.hypot(x, y);
    if (m < deadzone) return { x: 0, y: 0 };
    const scale = Math.min(1, (m - deadzone) / (1 - deadzone)) / m;
    return { x: x * scale, y: y * scale };
  }
}

export const keys = new KeyTracker();
export const pads = new PadTracker();

export const tickInput = (frame: number): void => {
  keys.tick(frame);
  pads.tick(frame);
};

// ───────── schemes ─────────
export interface KeyScheme {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  aimUp?: string[];
  aimDown?: string[];
  aimLeft?: string[];
  aimRight?: string[];
  attack: string[];
  q: string[];
  e: string[];
  ult: string[];
  dash: string[];
  pause: string[];
  confirm: string[];
  usesMouse: boolean;
}

export const SCHEME_P1: KeyScheme = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  attack: ['KeyF'],
  q: ['KeyQ'],
  e: ['KeyE'],
  ult: ['KeyR'],
  dash: ['Space'],
  pause: ['Escape'],
  confirm: ['Space', 'KeyF'],
  usesMouse: true,
};

/** Solo player may also use arrows to move. */
export const SCHEME_SOLO: KeyScheme = {
  ...SCHEME_P1,
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  confirm: ['Space', 'Enter', 'KeyF'],
};

export const SCHEME_P2: KeyScheme = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  aimUp: ['KeyI', 'Numpad8'],
  aimDown: ['KeyK', 'Numpad5', 'Numpad2'],
  aimLeft: ['KeyJ', 'Numpad4'],
  aimRight: ['KeyL', 'Numpad6'],
  attack: ['Enter', 'NumpadEnter'],
  q: ['KeyU', 'Numpad7'],
  e: ['KeyO', 'Numpad9'],
  ult: ['KeyP', 'NumpadAdd'],
  dash: ['ShiftRight', 'Numpad0'],
  pause: ['Escape'],
  confirm: ['Enter', 'NumpadEnter', 'KeyU'],
  usesMouse: false,
};

export interface ControllerOptions {
  scheme: KeyScheme;
  /** Returns the browser gamepad index this player uses right now, or -1. Re-evaluated every frame. */
  pad: () => number;
  autoAttack?: boolean;
}

/**
 * Produces a PlayerIntent per frame. `origin` is the player's world position (for mouse aim).
 */
export class PlayerController {
  private lastAim = { x: 1, y: 0 };
  private usingPad = false;

  constructor(public opts: ControllerOptions) {}

  get padIndex(): number {
    return this.opts.pad();
  }

  poll(scene: Phaser.Scene, origin: { x: number; y: number }): PlayerIntent {
    const s = this.opts.scheme;
    const it = emptyIntent();
    let mx = (keys.isDown(...s.right) ? 1 : 0) - (keys.isDown(...s.left) ? 1 : 0);
    let my = (keys.isDown(...s.down) ? 1 : 0) - (keys.isDown(...s.up) ? 1 : 0);
    const pad = this.padIndex;
    if (pad >= 0) {
      const st = pads.stick(pad, 0);
      const dx = (pads.isDown(pad, PAD.RIGHT) ? 1 : 0) - (pads.isDown(pad, PAD.LEFT) ? 1 : 0);
      const dy = (pads.isDown(pad, PAD.DOWN) ? 1 : 0) - (pads.isDown(pad, PAD.UP) ? 1 : 0);
      if (st.x || st.y || dx || dy) this.usingPad = true;
      mx += st.x + dx;
      my += st.y + dy;
    }
    const mv = normalizeMovement(mx, my);
    it.moveX = mv.x;
    it.moveY = mv.y;

    // ── aim ──
    let aimed = false;
    if (pad >= 0) {
      const rs = pads.stick(pad, 1, 0.3);
      if (rs.x || rs.y) {
        const n = normalize(rs.x, rs.y);
        it.aimX = n.x;
        it.aimY = n.y;
        it.aimSource = 'stick';
        it.attack = true; // twin-stick: aiming fires
        aimed = true;
        this.usingPad = true;
      }
    }
    if (!aimed && s.aimUp) {
      const ax = (keys.isDown(...(s.aimRight ?? [])) ? 1 : 0) - (keys.isDown(...(s.aimLeft ?? [])) ? 1 : 0);
      const ay = (keys.isDown(...(s.aimDown ?? [])) ? 1 : 0) - (keys.isDown(...(s.aimUp ?? [])) ? 1 : 0);
      if (ax || ay) {
        const n = normalize(ax, ay);
        it.aimX = n.x;
        it.aimY = n.y;
        it.aimSource = 'keys';
        it.attack = true; // directional keys fire while held
        aimed = true;
      }
    }
    if (!aimed && s.usesMouse && !this.usingPad) {
      const p = scene.input.activePointer;
      const { x: wx, y: wy } = pointerWorld(scene);
      const n = normalize(wx - origin.x, wy - origin.y);
      if (n.x || n.y) {
        it.aimX = n.x;
        it.aimY = n.y;
        it.aimSource = 'mouse';
        aimed = true;
      }
      if (p.leftButtonDown()) it.attack = true;
    }
    if (s.usesMouse && scene.input.activePointer.leftButtonDown()) {
      this.usingPad = false;
      it.attack = true;
    }
    if (!aimed) {
      // fall back to movement direction, then last aim
      if (mv.x || mv.y) {
        const n = normalize(mv.x, mv.y);
        it.aimX = n.x;
        it.aimY = n.y;
      } else {
        it.aimX = this.lastAim.x;
        it.aimY = this.lastAim.y;
      }
    }
    this.lastAim = { x: it.aimX, y: it.aimY };

    // ── buttons ──
    if (keys.isDown(...s.attack)) it.attack = true;
    it.q = keys.wasPressed(...s.q);
    it.e = keys.wasPressed(...s.e);
    it.ult = keys.wasPressed(...s.ult);
    it.dash = keys.wasPressed(...s.dash);
    it.pause = keys.wasPressed(...s.pause);
    if (pad >= 0) {
      if (pads.isDown(pad, PAD.RT)) it.attack = true;
      it.q ||= pads.wasPressed(pad, PAD.X) || pads.wasPressed(pad, PAD.LB);
      it.e ||= pads.wasPressed(pad, PAD.Y) || pads.wasPressed(pad, PAD.RB);
      it.ult ||= pads.wasPressed(pad, PAD.B) || pads.wasPressed(pad, PAD.LT);
      it.dash ||= pads.wasPressed(pad, PAD.A);
      it.pause ||= pads.wasPressed(pad, PAD.START);
    }
    if (this.opts.autoAttack) it.attack = true;
    return it;
  }
}

// ───────── menu navigation ─────────
export interface MenuIntent {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

const stickRepeat = new Map<string, number>();

/** Menu input. `who`: 'any' merges every device; 0/1 restricts to that player's scheme and pad. */
export const menuIntent = (who: 'any' | 0 | 1, time: number, versus = false): MenuIntent => {
  const m: MenuIntent = { up: false, down: false, left: false, right: false, confirm: false, back: false };
  const useKeys = (s: KeyScheme) => {
    m.up ||= keys.wasPressed(...s.up);
    m.down ||= keys.wasPressed(...s.down);
    m.left ||= keys.wasPressed(...s.left);
    m.right ||= keys.wasPressed(...s.right);
    m.confirm ||= keys.wasPressed(...s.confirm);
  };
  if (who === 'any') {
    useKeys(SCHEME_SOLO);
    useKeys(SCHEME_P2);
    m.back = keys.wasPressed('Escape', 'Backspace');
  } else {
    useKeys(who === 0 ? (versus ? SCHEME_P1 : SCHEME_SOLO) : SCHEME_P2);
  }
  const padList = who === 'any' ? pads.connected : [versus ? padForPlayer(who) : pads.nth(0)].filter((p) => p >= 0);
  for (const p of padList) {
    m.up ||= pads.wasPressed(p, PAD.UP);
    m.down ||= pads.wasPressed(p, PAD.DOWN);
    m.left ||= pads.wasPressed(p, PAD.LEFT);
    m.right ||= pads.wasPressed(p, PAD.RIGHT);
    m.confirm ||= pads.wasPressed(p, PAD.A) || pads.wasPressed(p, PAD.START);
    m.back ||= pads.wasPressed(p, PAD.B);
    const st = pads.stick(p, 0, 0.5);
    const key = `${who}:${p}`;
    const next = stickRepeat.get(key) ?? 0;
    if ((st.x || st.y) && time >= next) {
      if (Math.abs(st.x) > Math.abs(st.y)) {
        if (st.x > 0) m.right = true;
        else m.left = true;
      } else if (st.y > 0) m.down = true;
      else m.up = true;
      stickRepeat.set(key, time + 220);
    } else if (!st.x && !st.y) stickRepeat.set(key, 0);
  }
  return m;
};

/**
 * Versus pad assignment: with one pad it goes to P2 (P1 has the mouse); with two, pad0→P1, pad1→P2.
 */
export const padSlotFor = (player: 0 | 1, versus: boolean): number | null => {
  if (!versus) return 0;
  const n = pads.connected.length;
  if (n >= 2) return player;
  return player === 1 ? 0 : null;
};

export const padForPlayer = (player: 0 | 1): number => {
  const slot = padSlotFor(player, true);
  return slot === null ? -1 : pads.nth(slot);
};

export const soloPad = (): number => pads.nth(0);

/**
 * Mouse position in arena world space. `pointer.worldX` is only refreshed on pointer events and
 * uses whichever camera received them (the HUD overlay), so it goes stale as the arena camera scrolls.
 */
const _pw = new Phaser.Math.Vector2();
export const pointerWorld = (scene: Phaser.Scene): Phaser.Math.Vector2 => {
  const p = scene.input.activePointer;
  return scene.cameras.main.getWorldPoint(p.x, p.y, _pw);
};

export const createController = (player: 0 | 1, versus: boolean, autoAttack: boolean): PlayerController =>
  new PlayerController({
    scheme: versus ? (player === 0 ? SCHEME_P1 : SCHEME_P2) : SCHEME_SOLO,
    pad: versus ? () => padForPlayer(player) : soloPad,
    autoAttack,
  });
