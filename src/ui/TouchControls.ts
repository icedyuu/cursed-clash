/**
 * Touch controls for phones/tablets (solo only).
 *
 * A DOM layer sits over the canvas while a run is active:
 *  - left half: floating joystick (appears under the thumb)
 *  - right side: Q, E, ULT and DASH buttons with cooldown sweeps, plus pause
 * Basic attacks fire automatically and aim at the nearest enemy (auto-aim); area abilities
 * are placed on that enemy. Menus keep using Phaser's normal pointer/tap handling.
 *
 * DOM instead of Phaser objects: multi-touch, safe-area insets and crisp hit areas are much
 * easier, and it never interferes with the pixel-art canvas scaling.
 */
import type Phaser from 'phaser';

export type TouchButton = 'q' | 'e' | 'ult' | 'dash' | 'pause';

/** True on phones/tablets. `?touch=1` / `?touch=0` force it for testing. */
export const IS_TOUCH: boolean = (() => {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)').matches ?? false;
  return (coarse && noHover) || (navigator.maxTouchPoints > 0 && noHover);
})();

const JOY_RADIUS = 52;

class TouchState {
  moveX = 0;
  moveY = 0;
  private pressed = new Set<TouchButton>();
  /** Supplies the auto-aim target (nearest enemy) for a world position. */
  aimProvider: ((x: number, y: number) => { x: number; y: number } | null) | null = null;

  press(b: TouchButton): void {
    this.pressed.add(b);
  }

  /** Edge-triggered: returns true once per tap. */
  consume(b: TouchButton): boolean {
    const had = this.pressed.has(b);
    this.pressed.delete(b);
    return had;
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.pressed.clear();
  }
}

export const touch = new TouchState();

export interface TouchSlotInfo {
  icon: string;
  /** 0 = ready, 1 = just used. */
  ratio: number;
  label: string;
  ready?: boolean;
}

class TouchOverlay {
  private root: HTMLDivElement | null = null;
  private joyBase!: HTMLDivElement;
  private joyKnob!: HTMLDivElement;
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private buttons = new Map<TouchButton, { el: HTMLDivElement; icon: HTMLDivElement; sweep: HTMLDivElement; label: HTMLSpanElement }>();
  private iconCache = new Map<string, string>();
  private game: Phaser.Game | null = null;

  init(game: Phaser.Game): void {
    if (!IS_TOUCH || this.root) return;
    this.game = game;
    document.body.classList.add('touch');
    const root = document.createElement('div');
    root.id = 'touch-layer';
    root.innerHTML = `
      <div class="tc-joyzone"></div>
      <div class="tc-joy"><div class="tc-knob"></div></div>
      <div class="tc-buttons"></div>
      <div class="tc-pause" data-b="pause"><span>II</span></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.joyBase = root.querySelector('.tc-joy') as HTMLDivElement;
    this.joyKnob = root.querySelector('.tc-knob') as HTMLDivElement;
    const zone = root.querySelector('.tc-joyzone') as HTMLDivElement;
    zone.addEventListener('pointerdown', (e) => this.joyStart(e));
    window.addEventListener('pointermove', (e) => this.joyMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.joyEnd(e));
    window.addEventListener('pointercancel', (e) => this.joyEnd(e));

    const wrap = root.querySelector('.tc-buttons') as HTMLDivElement;
    const defs: [TouchButton, string][] = [
      ['ult', 'ULT'],
      ['e', 'E'],
      ['q', 'Q'],
      ['dash', 'DASH'],
    ];
    for (const [b, name] of defs) {
      const el = document.createElement('div');
      el.className = `tc-btn tc-${b}`;
      el.innerHTML = `<div class="tc-icon"></div><div class="tc-sweep"></div><span class="tc-label"></span><span class="tc-name">${name}</span>`;
      wrap.appendChild(el);
      this.bindButton(el, b);
      this.buttons.set(b, {
        el,
        icon: el.querySelector('.tc-icon') as HTMLDivElement,
        sweep: el.querySelector('.tc-sweep') as HTMLDivElement,
        label: el.querySelector('.tc-label') as HTMLSpanElement,
      });
    }
    this.bindButton(root.querySelector('.tc-pause') as HTMLDivElement, 'pause');
    // Android: go fullscreen + landscape on the first touch (iOS ignores this gracefully).
    const goFull = () => {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      try {
        const p = el.requestFullscreen?.({ navigationUI: 'hide' });
        p?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => undefined)).catch(() => undefined);
      } catch {
        /* not supported */
      }
    };
    window.addEventListener('pointerup', goFull, { once: true });
    this.hide();
  }

  private bindButton(el: HTMLDivElement, b: TouchButton): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      touch.press(b);
      el.classList.add('down');
      if (navigator.vibrate) navigator.vibrate(8);
    });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  private joyStart(e: PointerEvent): void {
    e.preventDefault();
    if (this.joyId !== null) return;
    this.joyId = e.pointerId;
    this.joyOrigin = { x: e.clientX, y: e.clientY };
    this.joyBase.style.left = `${e.clientX}px`;
    this.joyBase.style.top = `${e.clientY}px`;
    this.joyBase.classList.add('active');
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
  }

  private joyMove(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    e.preventDefault();
    let dx = e.clientX - this.joyOrigin.x;
    let dy = e.clientY - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > JOY_RADIUS) {
      // drag the base along so the stick never "runs out"
      const k = (d - JOY_RADIUS) / d;
      this.joyOrigin.x += dx * k;
      this.joyOrigin.y += dy * k;
      this.joyBase.style.left = `${this.joyOrigin.x}px`;
      this.joyBase.style.top = `${this.joyOrigin.y}px`;
      dx = e.clientX - this.joyOrigin.x;
      dy = e.clientY - this.joyOrigin.y;
    }
    const m = Math.min(1, Math.hypot(dx, dy) / JOY_RADIUS);
    const dead = 0.12;
    const mag = m < dead ? 0 : (m - dead) / (1 - dead);
    const len = Math.hypot(dx, dy) || 1;
    touch.moveX = (dx / len) * mag;
    touch.moveY = (dy / len) * mag;
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  private joyEnd(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    this.joyId = null;
    touch.moveX = 0;
    touch.moveY = 0;
    this.joyBase.classList.remove('active');
  }

  show(): void {
    if (!this.root) return;
    touch.reset();
    this.root.classList.add('visible');
  }

  hide(): void {
    if (!this.root) return;
    this.joyId = null;
    touch.reset();
    this.joyBase?.classList.remove('active');
    this.root.classList.remove('visible');
  }

  /** Called every frame by the HUD with the solo player's ability state. */
  update(slots: Partial<Record<TouchButton, TouchSlotInfo>>): void {
    if (!this.root) return;
    for (const [b, info] of Object.entries(slots) as [TouchButton, TouchSlotInfo][]) {
      const v = this.buttons.get(b);
      if (!v) continue;
      const url = this.iconUrl(info.icon);
      if (url && v.icon.dataset.icon !== info.icon) {
        v.icon.dataset.icon = info.icon;
        v.icon.style.backgroundImage = `url(${url})`;
      }
      v.sweep.style.setProperty('--cd', `${Math.round(Math.max(0, Math.min(1, info.ratio)) * 360)}deg`);
      v.label.textContent = info.label;
      v.el.classList.toggle('cooling', info.ratio > 0.001);
      v.el.classList.toggle('ready', !!info.ready);
    }
  }

  private iconUrl(frame: string): string | null {
    const hit = this.iconCache.get(frame);
    if (hit) return hit;
    if (!this.game?.textures.exists('icons')) return null;
    try {
      const url = this.game.textures.getBase64('icons', frame);
      if (url) this.iconCache.set(frame, url);
      return url || null;
    } catch {
      return null;
    }
  }
}

export const touchOverlay = new TouchOverlay();
