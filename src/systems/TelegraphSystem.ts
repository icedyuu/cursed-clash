/**
 * Enemy/boss attack warnings. Every hostile area attack is announced here first so the
 * player can always read and avoid it: an outline + a fill that grows until impact.
 */
import Phaser from 'phaser';
import { DEPTH } from '../game/GameConfig';

export interface Telegraph {
  shape: 'circle' | 'arc' | 'line' | 'ring';
  x: number;
  y: number;
  radius: number;
  /** Inner radius for 'ring'. */
  inner?: number;
  angle?: number;
  arc?: number;
  length?: number;
  width?: number;
  dur: number;
  t: number;
  color: number;
  onDone?: (t: Telegraph) => void;
  /** Called every frame (e.g. to follow a moving source). */
  onUpdate?: (t: Telegraph) => void;
  cancelled?: boolean;
}

export class TelegraphSystem {
  private list: Telegraph[] = [];
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.telegraph);
  }

  add(t: Omit<Telegraph, 't'>): Telegraph {
    const tg: Telegraph = { ...t, t: 0 };
    this.list.push(tg);
    return tg;
  }

  clear(): void {
    this.list.length = 0;
    this.gfx.clear();
  }

  update(dt: number): void {
    const g = this.gfx;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      if (t.cancelled) {
        this.list.splice(i, 1);
        continue;
      }
      t.t += dt;
      t.onUpdate?.(t);
      const p = Math.min(1, t.t / t.dur);
      const blink = p > 0.75 ? (Math.floor(t.t * 20) % 2 === 0 ? 1 : 0.55) : 1;
      g.lineStyle(1, t.color, 0.9 * blink);
      g.fillStyle(t.color, 0.12);
      switch (t.shape) {
        case 'circle':
          g.fillCircle(t.x, t.y, t.radius);
          g.strokeCircle(t.x, t.y, t.radius);
          g.fillStyle(t.color, 0.28 * blink);
          g.fillCircle(t.x, t.y, t.radius * p);
          break;
        case 'ring':
          g.strokeCircle(t.x, t.y, t.radius);
          g.strokeCircle(t.x, t.y, t.inner ?? t.radius * 0.6);
          g.lineStyle(Math.max(1, (t.radius - (t.inner ?? 0)) * p), t.color, 0.25 * blink);
          g.strokeCircle(t.x, t.y, ((t.inner ?? 0) + t.radius) / 2);
          break;
        case 'arc': {
          const a0 = t.angle! - t.arc! / 2;
          const a1 = t.angle! + t.arc! / 2;
          g.slice(t.x, t.y, t.radius, a0, a1, false);
          g.fillPath();
          g.beginPath();
          g.slice(t.x, t.y, t.radius, a0, a1, false);
          g.strokePath();
          g.fillStyle(t.color, 0.3 * blink);
          g.slice(t.x, t.y, t.radius * p, a0, a1, false);
          g.fillPath();
          break;
        }
        case 'line': {
          const len = t.length!;
          const w = t.width!;
          const cos = Math.cos(t.angle!);
          const sin = Math.sin(t.angle!);
          const nx = -sin * (w / 2);
          const ny = cos * (w / 2);
          const pts = (l: number) => [
            new Phaser.Math.Vector2(t.x + nx, t.y + ny),
            new Phaser.Math.Vector2(t.x + cos * l + nx, t.y + sin * l + ny),
            new Phaser.Math.Vector2(t.x + cos * l - nx, t.y + sin * l - ny),
            new Phaser.Math.Vector2(t.x - nx, t.y - ny),
          ];
          g.fillPoints(pts(len), true);
          g.strokePoints(pts(len), true);
          g.fillStyle(t.color, 0.3 * blink);
          g.fillPoints(pts(len * p), true);
          break;
        }
      }
      if (p >= 1) {
        this.list.splice(i, 1);
        t.onDone?.(t);
      }
    }
  }
}
