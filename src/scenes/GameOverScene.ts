/** Death screen + run summary (solo) or winner screen (versus). */
import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { GameManager, type PlayerSummary } from '../game/GameManager';
import { Button, MenuList, menuBackdrop, panel, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';
import { CHARACTERS } from '../data/characters';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { RARITIES } from '../data/rarities';
import { SYNERGIES } from '../data/synergies';
import { formatTime } from '../core/math';
import { audio } from '../game/AudioManager';

export class GameOverScene extends Phaser.Scene {
  private menu!: MenuList;

  constructor() {
    super('GameOverScene');
  }

  create(): void {
    menuBackdrop(this);
    const r = GameManager.lastResult;
    if (!r) {
      this.scene.start('MainMenuScene');
      return;
    }
    audio.playMusic('menu');
    if (r.mode === 'solo') {
      txt(this, GAME_WIDTH / 2, 22, 'YOU HAVE FALLEN', { size: 16, font: 'title', origin: [0.5, 0.5], color: '#ff5577' });
      txt(this, GAME_WIDTH / 2, 40, r.highscoreRank !== undefined && r.highscoreRank >= 0 ? (r.highscoreRank === 0 ? 'NEW BEST RUN!' : `HIGHSCORE RANK #${r.highscoreRank + 1}`) : 'THE CURSE CLAIMS ANOTHER SOUL', { origin: [0.5, 0.5], color: r.highscoreRank === 0 ? COLORS.gold : COLORS.textDim });
      this.summary(r.players[0], 30, 54, 360, 250, r.bossesDefeated);
      this.highscores(404, 54, 206, 250);
    } else {
      const w = r.winner;
      const title = w === null || w === undefined ? 'DRAW' : `PLAYER ${w + 1} WINS`;
      txt(this, GAME_WIDTH / 2, 22, title, { size: 16, font: 'title', origin: [0.5, 0.5], color: w === 0 ? COLORS.p1css : w === 1 ? COLORS.p2css : COLORS.text });
      txt(this, GAME_WIDTH / 2, 40, `${(r.winReason ?? '').toUpperCase()}  -  MATCH TIME ${formatTime(r.time)}  -  BOSSES ${r.bossesDefeated}`, { origin: [0.5, 0.5], color: COLORS.textDim });
      r.players.forEach((p, i) => this.summary(p, 14 + i * 312, 54, 300, 250, r.bossesDefeated, w === p.index));
      const s = GameManager.save.stats;
      txt(this, GAME_WIDTH / 2, 308, `ALL-TIME  P1 ${s.versusWins[0]}  -  P2 ${s.versusWins[1]}  (DRAWS ${s.versusDraws})`, { origin: [0.5, 0.5], color: COLORS.textDim });
    }
    const buttons = [
      new Button(this, GAME_WIDTH / 2 - 80, GAME_HEIGHT - 22, 140, 20, 'PLAY AGAIN', () => {
        GameManager.startRun(GameManager.run.mode, GameManager.run.characters);
        SceneManager.fadeTo(this, 'ArenaScene', {}, 400);
      }),
      new Button(this, GAME_WIDTH / 2 + 80, GAME_HEIGHT - 22, 140, 20, 'MAIN MENU', () => SceneManager.fadeTo(this, 'MainMenuScene')),
    ];
    this.menu = new MenuList(this, buttons, true);
    this.menu.onBack = () => SceneManager.fadeTo(this, 'MainMenuScene');
    SceneManager.fadeIn(this, 500);
  }

  private summary(p: PlayerSummary, x: number, y: number, w: number, h: number, bosses: number, winner?: boolean): void {
    const def = CHARACTERS[p.character];
    panel(this, x, y, w, h, winner ? 'ui-panel-gold' : 'ui-panel-dark');
    const s = this.add.sprite(x + 30, y + 46, `hero-${p.character}`).setScale(2).setOrigin(0.5, 0.9);
    s.play(`hero-${p.character}:${p.alive ? 'idle' : 'death'}`);
    if (!p.alive) s.once('animationcomplete', () => s.setFrame(s.frame.name));
    const mode = GameManager.lastResult?.mode;
    txt(this, x + 60, y + 10, `${mode === 'versus' ? `P${p.index + 1} - ` : ''}${def.name.toUpperCase()}`, { font: 'title', color: `#${def.color.toString(16)}` });
    if (winner) txt(this, x + w - 10, y + 10, 'WINNER', { font: 'title', origin: [1, 0], color: COLORS.gold });
    const rows: [string, string][] = [
      ['SURVIVAL TIME', formatTime(p.survivalTime)],
      ['TOTAL KILLS', `${p.kills}`],
      ['LEVEL REACHED', `${p.level}`],
      ['BOSSES DEFEATED', `${bosses}`],
      ['DAMAGE DEALT', `${p.damageDealt.toLocaleString('en-US')}`],
      ['UPGRADES', `${p.upgrades.length}`],
    ];
    rows.forEach(([a, b], i) => {
      txt(this, x + 60, y + 24 + i * 10, a, { color: COLORS.textDim });
      txt(this, x + w - 10, y + 24 + i * 10, b, { origin: [1, 0] });
    });
    // acquired upgrades as icons (deduped, with best rarity colour)
    const seen = new Map<string, { n: number; tier: number }>();
    for (const u of p.upgrades) {
      const cur = seen.get(u.id) ?? { n: 0, tier: -1 };
      seen.set(u.id, { n: cur.n + 1, tier: Math.max(cur.tier, RARITIES[u.rarity].tier) });
    }
    const perRow = Math.floor((w - 16) / 22);
    let i = 0;
    for (const [id, info] of seen) {
      const up = UPGRADE_BY_ID[id];
      const rar = Object.values(RARITIES).find((r) => r.tier === info.tier)!;
      const cx = x + 18 + (i % perRow) * 22;
      const cy = y + 100 + Math.floor(i / perRow) * 22;
      this.add.rectangle(cx, cy, 19, 19, rar.color, 0.25).setStrokeStyle(1, rar.color);
      this.add.image(cx, cy, 'icons', up.icon);
      if (info.n > 1) txt(this, cx + 6, cy + 3, `${info.n}`, { origin: [0.5, 0.5] });
      i++;
      if (i >= perRow * 4) break;
    }
    if (seen.size === 0) txt(this, x + 10, y + 96, 'NO UPGRADES ACQUIRED', { color: COLORS.textDark });
    let sy = y + h - 12 - p.synergies.length * 10;
    for (const sid of p.synergies) {
      const syn = SYNERGIES.find((q) => q.id === sid);
      if (syn) txt(this, x + 10, sy, `* SYNERGY: ${syn.name.toUpperCase()}`, { color: '#6fe3ff' });
      sy += 10;
    }
  }

  private highscores(x: number, y: number, w: number, h: number): void {
    panel(this, x, y, w, h, 'ui-panel-dark');
    txt(this, x + w / 2, y + 10, 'HIGHSCORES', { font: 'title', origin: [0.5, 0], color: COLORS.gold });
    const list = GameManager.save.highscores;
    list.slice(0, 10).forEach((e, i) => {
      const def = CHARACTERS[e.character];
      const yy = y + 28 + i * 20;
      txt(this, x + 8, yy, `${i + 1}.`, { color: COLORS.textDim });
      this.add.image(x + 30, yy + 4, `hero-${e.character}`, 0).setScale(0.5);
      txt(this, x + 40, yy, `${formatTime(e.time)}  LV${e.level}`, { color: `#${def.color.toString(16)}` });
      txt(this, x + 40, yy + 9, `${e.kills} KILLS  ${e.bosses} BOSS  ${e.date}`, { color: COLORS.textDark });
    });
    if (list.length === 0) txt(this, x + 10, y + 30, 'NO RUNS YET', { color: COLORS.textDark });
  }

  update(): void {
    this.menu?.update();
  }
}
