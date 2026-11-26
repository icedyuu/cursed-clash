/** Character Gallery: browse heroes, monsters and the boss with every animation state. */
import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../game/GameConfig';
import { menuBackdrop, panel, txt } from '../ui/widgets';
import { SceneManager } from '../game/SceneManager';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { buildCharacterDetails } from '../ui/CharacterSelection';
import { menuIntent, tickInput } from '../game/InputManager';
import { audio } from '../game/AudioManager';
import { CHARACTER_ANIMS } from '../art/anims';
import { MONSTER_SPECS } from '../art/enemyArt';

interface Entry {
  name: string;
  texture: string;
  states: string[];
  scale: number;
  hero?: (typeof CHARACTER_ORDER)[number];
  lore: string;
}

const MONSTER_LORE: Record<string, string> = {
  slime: 'Curse-soaked ooze. Slow and fragile, but it never comes alone.',
  wraith: 'Fast shadows that circle and strike from the flanks.',
  bone_knight: 'Dead soldiers still loyal to the Hollow King. Watch the green arc: their cleave hits hard.',
  void_caster: 'Masked cultists that keep their distance and fire slow void bolts. Only attacks when visible.',
  elite: 'A mass of fused flesh. Charges, slams and bursts. Drops a Cursed Chest.',
  hollow_king: 'A crown with nothing beneath it. Three phases: summons, cursed floors and finally rage.',
};

export class GalleryScene extends Phaser.Scene {
  private entries: Entry[] = [];
  private index = 0;
  private stateIndex = 0;
  private view?: Phaser.GameObjects.Container;
  private sprite?: Phaser.GameObjects.Sprite;
  private stateLabel?: Phaser.GameObjects.Text;
  private openedFrame = 0;

  constructor() {
    super('GalleryScene');
  }

  create(): void {
    menuBackdrop(this);
    this.openedFrame = this.game.loop.frame;
    txt(this, GAME_WIDTH / 2, 16, 'CHARACTER GALLERY', { size: 16, font: 'title', origin: [0.5, 0.5] });
    this.entries = [
      ...CHARACTER_ORDER.map((id) => ({ name: CHARACTERS[id].name, texture: `hero-${id}`, states: CHARACTER_ANIMS.map((a) => a.state), scale: 3, hero: id, lore: CHARACTERS[id].lore })),
      ...Object.values(ENEMIES).map((e) => {
        const spec = MONSTER_SPECS.find((s) => s.key === e.texture)!;
        return { name: e.name, texture: e.texture, states: spec.anims.map((a) => a.state), scale: e.ai === 'boss' ? 2 : e.ai === 'elite' ? 2 : 3, lore: MONSTER_LORE[e.id] ?? '' };
      }),
    ];
    this.index = 0;
    this.show();
    txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 10, 'LEFT/RIGHT: BROWSE   UP/DOWN: ANIMATION   ESC: BACK   (CLICK TO CYCLE)', { origin: [0.5, 0.5], color: COLORS.textDark });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > GAME_HEIGHT - 30) return;
      this.cycle(p.x < GAME_WIDTH / 2 ? -1 : 1);
    });
    SceneManager.fadeIn(this);
  }

  private cycle(d: number): void {
    this.index = (this.index + d + this.entries.length) % this.entries.length;
    this.stateIndex = 0;
    audio.play('ui_move');
    this.show();
  }

  private show(): void {
    this.view?.destroy();
    const e = this.entries[this.index];
    const c = this.add.container(0, 0);
    c.add(panel(this, 14, 32, 200, 300, 'ui-panel-dark'));
    const glow = this.add.image(114, 170, 'glow-big').setTint(0x6b3fd1).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.5);
    c.add(glow);
    this.sprite = this.add.sprite(114, 210, e.texture).setScale(e.scale).setOrigin(0.5, 0.9);
    c.add(this.sprite);
    this.stateLabel = txt(this, 114, 300, '', { origin: [0.5, 0.5], color: COLORS.gold });
    c.add(this.stateLabel);
    c.add(txt(this, 114, 316, `${this.index + 1} / ${this.entries.length}`, { origin: [0.5, 0.5], color: COLORS.textDark }));
    if (e.hero) c.add(buildCharacterDetails(this, CHARACTERS[e.hero], 222, 32, GAME_WIDTH - 236, 250, false));
    else {
      const def = Object.values(ENEMIES).find((x) => x.texture === e.texture)!;
      c.add(panel(this, 222, 32, GAME_WIDTH - 236, 250, 'ui-panel-dark'));
      c.add(txt(this, 232, 42, def.name.toUpperCase(), { font: 'title', color: def.ai === 'boss' ? COLORS.gold : '#ff8a8a' }));
      const rows = [
        ['HEALTH', `${def.hp}`],
        ['SPEED', `${def.speed}`],
        ['CONTACT DAMAGE', `${def.contactDamage}`],
        ['ATTACK DAMAGE', `${def.attackDamage || '-'}`],
        ['XP REWARD', `${def.xp}`],
        ['BEHAVIOUR', def.ai.toUpperCase()],
      ];
      rows.forEach(([a, b], i) => {
        c.add(txt(this, 232, 60 + i * 11, a, { color: COLORS.textDim }));
        c.add(txt(this, 360, 60 + i * 11, b));
      });
      c.add(txt(this, 232, 136, e.lore, { color: COLORS.text, wrap: GAME_WIDTH - 260 }));
    }
    c.add(txt(this, 222, 290, e.lore && e.hero ? `"${e.lore}"` : '', { color: COLORS.textDim, wrap: GAME_WIDTH - 236 }));
    this.view = c;
    this.playState();
  }

  private playState(): void {
    const e = this.entries[this.index];
    const st = e.states[this.stateIndex % e.states.length];
    this.sprite?.play({ key: `${e.texture}:${st}`, repeat: -1, repeatDelay: st === 'death' ? 600 : 0 });
    this.stateLabel?.setText(`< ${st.toUpperCase()} >`);
  }

  update(): void {
    tickInput(this.game.loop.frame);
    if (this.game.loop.frame <= this.openedFrame + 1) return;
    const m = menuIntent('any', this.game.loop.time);
    if (m.left) this.cycle(-1);
    if (m.right) this.cycle(1);
    if (m.up || m.down || m.confirm) {
      this.stateIndex += m.up ? -1 + this.entries[this.index].states.length : 1;
      audio.play('ui_move');
      this.playState();
    }
    if (m.back) SceneManager.fadeTo(this, 'MainMenuScene');
  }
}
