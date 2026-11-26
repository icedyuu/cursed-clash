/** Pause overlay: resume, controls, settings, restart, quit. Also shows the current build. */
import Phaser from 'phaser';
import type { ArenaScene } from '../scenes/ArenaScene';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { Button, MenuList, panel, txt } from './widgets';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { RARITIES } from '../data/rarities';
import { SYNERGIES } from '../data/synergies';
import { CONTROLS_P2, CONTROLS_PAD, CONTROLS_SOLO } from './controlsText';
import { audio } from '../game/AudioManager';

export class PauseScene extends Phaser.Scene {
  private arena!: ArenaScene;
  private menu!: MenuList;
  private controls?: Phaser.GameObjects.Container;

  constructor() {
    super('PauseScene');
  }

  init(data: { arena: ArenaScene }): void {
    this.arena = data.arena;
    this.controls = undefined;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x07040d, 0.75).setOrigin(0);
    txt(this, GAME_WIDTH / 2, 30, 'PAUSED', { size: 16, font: 'title', origin: [0.5, 0.5] });
    const resume = () => this.resume();
    const buttons = [
      new Button(this, 110, 90, 150, 20, 'RESUME', resume),
      new Button(this, 110, 116, 150, 20, 'CONTROLS', () => this.toggleControls()),
      new Button(this, 110, 142, 150, 20, 'SETTINGS', () => {
        this.scene.pause();
        this.scene.launch('SettingsScene', { returnTo: 'PauseScene', overlay: true });
      }),
      new Button(this, 110, 168, 150, 20, 'RESTART RUN', () => {
        this.scene.stop();
        this.arena.restart();
      }),
      new Button(this, 110, 194, 150, 20, 'QUIT TO MENU', () => {
        this.scene.stop();
        this.arena.quitToMenu();
      }),
    ];
    this.menu = new MenuList(this, buttons);
    this.menu.onBack = resume;
    this.buildSummary();
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.menu.select(this.menu.index));
  }

  private buildSummary(): void {
    const x = 210;
    const w = GAME_WIDTH - x - 14;
    panel(this, x, 56, w, GAME_HEIGHT - 80, 'ui-panel-dark');
    let y = 64;
    for (const p of this.arena.players) {
      txt(this, x + 8, y, `${this.arena.mode === 'versus' ? `P${p.index + 1} - ` : ''}${p.def.name.toUpperCase()}  LV ${p.level}`, { color: p.index === 0 ? COLORS.p1css : COLORS.p2css });
      y += 12;
      const s = p.stats;
      txt(this, x + 8, y, `HP ${Math.ceil(p.hp)}/${Math.round(s.maxHp)}  DMG ${Math.round(s.damage * 100)}%  CD ${Math.round(s.cooldown * 100)}%  CRIT ${Math.round(s.critChance * 100)}%  SPD ${Math.round(s.moveSpeed)}`, { color: COLORS.textDim });
      y += 14;
      const counts = Object.entries(p.build.stacks);
      let ix = 0;
      for (const [id, n] of counts) {
        const up = UPGRADE_BY_ID[id];
        const best = [...p.build.history].reverse().find((h) => h.id === id);
        const col = best ? RARITIES[best.rarity].color : 0xffffff;
        const cx = x + 16 + (ix % 16) * 24;
        const cy = y + 8 + Math.floor(ix / 16) * 24;
        this.add.rectangle(cx, cy, 20, 20, col, 0.25).setStrokeStyle(1, col);
        this.add.image(cx, cy, 'icons', up.icon);
        if (n > 1) txt(this, cx + 7, cy + 3, `${n}`, { origin: [0.5, 0.5] });
        ix++;
      }
      if (counts.length === 0) txt(this, x + 8, y, 'NO UPGRADES YET', { color: COLORS.textDark });
      y += Math.max(1, Math.ceil(counts.length / 16)) * 24 + 4;
      for (const sid of p.build.synergies) {
        const syn = SYNERGIES.find((s) => s.id === sid);
        if (!syn) continue;
        txt(this, x + 8, y, `* ${syn.name.toUpperCase()}`, { color: '#6fe3ff' });
        y += 11;
      }
      y += 8;
    }
  }

  private toggleControls(): void {
    if (this.controls) {
      this.controls.destroy();
      this.controls = undefined;
      return;
    }
    const c = this.add.container(0, 0);
    c.add(panel(this, 200, 40, 430, 290, 'ui-panel'));
    let y = 50;
    const section = (title: string, rows: string[][]) => {
      c.add(txt(this, 212, y, title, { color: COLORS.gold }));
      y += 12;
      for (const [a, b] of rows) {
        c.add(txt(this, 216, y, a, { color: COLORS.textDim }));
        c.add(txt(this, 330, y, b));
        y += 10;
      }
      y += 6;
    };
    section(this.arena.mode === 'versus' ? 'PLAYER 1 (KEYBOARD + MOUSE)' : 'KEYBOARD + MOUSE', CONTROLS_SOLO);
    if (this.arena.mode === 'versus') section('PLAYER 2 (KEYBOARD)', CONTROLS_P2);
    section('GAMEPAD', CONTROLS_PAD);
    this.controls = c;
  }

  private resume(): void {
    audio.play('ui_back');
    this.scene.stop();
    this.scene.resume('ArenaScene');
  }

  update(): void {
    if (!this.scene.isActive()) return;
    this.menu.update();
  }
}
