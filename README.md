# CURSED CLASH

An anime-inspired pixel-art survival roguelite for the browser. Pick a cursed hero, survive endless waves in a haunted arena, build a run out of upgrade cards and synergies, defeat **the Hollow King**, and keep going. You can play solo, or local 2-player versus where the last one standing wins.

Built with **Phaser 3.90**, **TypeScript** and **Vite**. Every sprite, icon, tile and sound is generated procedurally at startup. The game ships with no external art or audio files.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript only
```

The build is a static site (`base: './'`), so `dist/` can be hosted anywhere, including GitHub Pages, itch.io or a plain folder.

**Play online:** https://icedyuu.github.io/cursed-clash/

Every push to `main` runs the tests, builds the game and deploys it with `.github/workflows/deploy.yml`. Pages has to be turned on once: open *Settings → Pages* and set *Source* to **GitHub Actions**.

---

## Modes

| Mode | Rules |
|---|---|
| **Solo Survival** | Survive as long as you can. The Hollow King arrives at **9:00**. After **10:00** the run turns endless: difficulty ramps faster, elites and swarms come more often, and the boss returns stronger. Your top 10 runs are saved. |
| **Local Versus** | Two players share one screen and fight the same horde. **The first player to die loses.** If both die within 0.6 s, the longer survival time wins, then more kills; an exact tie is a draw. |

### Versus balancing

Versus does not just double the enemies. Instead it changes several values at once:

- **Spawn rate:** ×1.55.
- **Enemy HP:** ×0.85.
- **Boss HP:** ×1.7.
- **Catch-up XP:** the player who is behind gets +12 % XP per level they trail, up to +60 %.
- **"Hunted":** a player who is 25 kills ahead draws more spawns toward them.
- **Mirrored pickups:** a pair of reserved heart pickups appears every 45 s, one per player.
- **Camera leash:** the camera keeps both players on screen.

---

## Controls

| Action | Player 1 / Solo | Player 2 (versus) | Gamepad |
|---|---|---|---|
| Move | WASD (arrows also work in solo) | Arrow keys | Left stick / D-pad |
| Aim | Mouse | I J K L (aiming also fires) | Right stick (aiming also fires) |
| Basic attack | Hold LMB, or F | Hold IJKL, or Enter | RT |
| Ability 1 / 2 | Q / E | U / O | X / Y (or LB / RB) |
| Ultimate | R (when charged) | P | B (or LT) |
| Dash | Space | Right Shift | A |
| Pause | Esc | Esc | Start |

- Keys are read by physical position (`KeyboardEvent.code`), so QWERTZ and AZERTY layouts use the same physical keys.
- **Gamepads:**
  - Solo: the first pad controls the player.
  - Versus with one pad: it goes to **P2**, and P1 keeps keyboard and mouse.
  - Versus with two pads: one pad each.
- Menus work with the keyboard (arrows/WASD + Enter/Space, Esc to go back), the mouse, and any gamepad.
- Settings include an optional **auto-attack** for P1.

### Phones and tablets (solo)

On a touch device the game switches to touch controls automatically. You can force them on or off with `?touch=1` / `?touch=0`.

- **Move:** put your left thumb anywhere on the left half of the screen. A joystick appears there and follows your thumb.
- **Attack:** fully automatic, with **auto-aim** at the nearest enemy (bosses take priority). A reticle marks the current target. Area abilities such as Black Hole or Frozen Ground are placed on that target.
- **Buttons (bottom right):** **Q**, **E**, **ULT** and **DASH**, each with a cooldown sweep. ULT glows when it is charged. **II** pauses.
- **Menus:**
  - Everything works by tapping.
  - On character select, the first tap shows a hero's details and a second tap starts the run.
  - Upgrade cards are taken with one tap.
- **Screen:**
  - Landscape is required. In portrait the game shows a "rotate your device" hint.
  - The game fills the screen.
  - On Android the first tap switches to fullscreen.
  - On iPhone, use "Add to Home Screen" for fullscreen.
- Versus is hidden on touch devices, because it needs keyboards or gamepads.

---

## Characters

| | Voidwalker | Blood Reaper | Frost Witch |
|---|---|---|---|
| Role | Balanced / crowd control | Aggressive melee / lifesteal | Ranged / crowd control |
| Passive | **Void Resonance**: kills release homing void particles | **Bloodlust**: part of all damage dealt heals you | **Frostbite**: hits stack frost (slow); at 5 stacks the enemy freezes |
| Basic attack | Void Bolt | Reaper Strike (arc slash) | Frost Shard |
| Q | **Void Orb**: piercing orb | **Crimson Slash**: wide heavy slash | **Ice Lance**: piercing lance, shatters frozen enemies |
| E | **Black Hole**: pulls enemies in and crushes them | **Blood Rush**: dash that damages everything in your path | **Frozen Ground**: freezing field |
| Ultimate | **Event Horizon**: huge singularity | **Blood Moon**: attack speed, damage and lifesteal frenzy | **Absolute Zero**: freezes the whole screen |
| Dash | Blink | Burst | Glide |

The ultimate charges from XP, damage dealt and slowly over time.

## Enemies and boss

| Enemy | Behaviour |
|---|---|
| **Cursed Slime** | Hopping fodder. |
| **Shadow Wraith** | Fast, flanks from the side. |
| **Bone Knight** | Slow and tanky. Winds up a telegraphed heavy strike. |
| **Void Caster** | Keeps its distance and fires telegraphed bolts. Obstacles block the bolts. |
| **Elite Abomination** | Mini-boss with charges and slams. Drops a chest with a Rare+ reward. |
| **The Hollow King** | Three phases, switching at 66 % and 33 % HP. Phase 1: summons and a sweeping slash. Phase 2: crownfall and shockwave rings across a cursed floor. Phase 3: enraged palette, orb barrages and charges. Every attack is telegraphed. Defeating him drops a crown with an **Epic** reward plus a full heal. |

## Progression

- **XP:** enemies drop XP crystals in three sizes. Each level-up offers **3 cards**. Rarities are Common, Uncommon, Rare, Epic and Legendary, and higher rarity scales the effect: ×1, ×1.35, ×1.75, ×2.3 and ×3.
- **Upgrades:** there are 50 in total. 18 are general, and the rest belong to a specific character, so each hero has about 28 available. They cover:
  - stat upgrades
  - ability parameters: damage, cooldown, area, pierce, count, chains and so on
  - behaviour flags, such as explosions on pierce, bleed, or shatter.
- **Synergies:** 11 data-driven combos, for example Singularity Rounds, Crimson Cyclone or Blizzard. They unlock automatically once all their parts are owned. A card shows when picking it would complete one.
- **Stat rule:** `final = (base + Σadd) × (1 + Σmul)`, clamped to sane limits. Ability params follow the same rule.

---

## Architecture

```
src/
  main.ts                  boot + integer pixel-perfect scaling (640×360 → ×N)
  core/                    pure helpers: math, seeded RNG, stats, damage, progression, spatial grid
  data/                    ALL tuning lives here: characters, abilities, upgrades, synergies,
                           enemies, waves & difficulty, rarities, balance, asset manifest
  art/                     procedural pixel art (PixelCanvas with auto-outline, palettes, poses)
  game/                    config, GameManager (run + save), Audio, Input, scene transitions
  systems/                 Ability, Combat, Projectile, Zone, Telegraph, Effects, XP, Wave,
                           Upgrade (pure), versusRules (pure), LocalMultiplayer, Save
    abilities/             ability behaviours (projectile / melee / movement / areas)
    ai/                    enemy behaviours (hop, flank, brute, kite, elite) + boss in entities/Boss
  entities/                Player, Enemy (pooled), Boss, Projectile, Pickup
  scenes/                  Boot, Preload, MainMenu, GameMode, CharacterSelect, Arena, GameOver,
                           Settings, Gallery, Credits
  ui/                      widgets, HUD scene, UpgradeScene, PauseScene, character details
tests/                     Vitest unit tests (pure logic + data integrity)
tools/art-preview.html     dev page that renders every generated sprite sheet (?m=chars|monsters|fx|floor)
```

### Design notes

- **Data-driven:** new upgrades, synergies, enemies or wave segments are mostly data changes. Abilities are a definition plus one behaviour function.
- **World context:** systems receive a small `World` interface instead of the scene. This keeps them decoupled from Phaser and avoids a clash with `scene.time`.
- **Performance:**
  - Enemies, projectiles, pickups and particles are pooled.
  - A spatial hash grid handles hits, AoE and crowd separation.
  - Enemies are capped at 170 in solo and 200 in versus, plus caps per enemy type for ranged and heavy enemies.
  - Past 260 XP crystals, new drops merge into existing ones.
  - Off-screen casters and elites hold their attacks, so nothing fires at you from outside the view.
- **Audio:** WebAudio synthesis provides about 40 SFX recipes and three step-sequenced music tracks (menu, battle, boss). Nothing is sampled or copied. Audio starts after the first click or keypress, as browsers require.
- **Saves:** LocalStorage key `cursed-clash-save-v1` holds settings, the top 10 highscores and lifetime stats. If storage is blocked, the game falls back to memory and never throws.

### Replacing the generated art

Every texture is listed in `src/data/assetManifest.ts` with its frame size. To swap one:

1. Put a PNG with the same frame layout in `public/assets/`.
2. Set `url` on that entry.

`PreloadScene` loads the file and skips generating it. You can open `tools/art-preview.html` while running `npm run dev` to see the expected frame order.

### Debug helpers (dev only)

- **URL options:**
  - `?scene=ArenaScene&mode=versus&chars=blood_reaper,frost_witch` jumps straight into a run.
  - `&debug` enables the debug keys.
- **Debug keys:**
  - F1: +60 s
  - F2: level up
  - F3: spawn the boss
  - F4: god mode
  - F6: spawn an elite
  - F7: fill the ultimate

---

## Testing

### Automated (`npm test`)

There are 46 tests covering:

- stat stacking and limits, armour, crit and lifesteal math, seeded RNG, geometry helpers, the spatial grid
- the XP curve and crystal tiers
- upgrade rolling (3 distinct cards, character filtering, rarity floors, max stacks, prerequisites)
- upgrade application, ability params, and every synergy firing exactly once
- data integrity (references, 25-30 upgrades per hero, no unresolved description placeholders)
- versus resolution and tie-breaks, catch-up bonus
- SaveSystem (persistence, top 10, versus stats, corrupt or blocked storage, reset)
- the wave timeline (contiguous segments, boss between 8 and 10 min, monotonic difficulty, endless acceleration)
- versus scaling.

### Playtested in a headless browser during development

An autopilot bot aims at the nearest enemy, kites, uses abilities and picks cards.

- **All three heroes:** played for 2-3 minutes each. Levelling, the upgrade screen and ultimates all worked.
- **Hollow King:** spawned, driven through all three phases (including the rage sprite and the telegraphs), then defeated. It dropped the crown and loot.
- **Enemies:** all five types appeared in the 5-minute mix.
- **Versus:**
  - The first death loses.
  - The tie-break by survival time worked.
  - The game-over summary and "play again" worked.
- **Menus and gamepads:**
  - Pause and resume, settings, gallery, credits and mode select all worked.
  - The full menu flow ran in the production build.
  - Two **simulated** gamepads (movement for both players, Start pauses) worked.

### Manual test checklist

- [ ] `npm install && npm run dev` opens the main menu; music starts after the first input.
- [ ] Menus: mouse hover/click, keyboard arrows + Enter, Esc goes back, gamepad D-pad + A.
- [ ] Character select shows stats, the passive, Q/E/ultimate and a preview animation for all three heroes.
- [ ] Solo: WASD moves, the mouse aims (the reticle follows the cursor while the camera scrolls), holding LMB attacks, Q/E/R/Space work, cooldowns show on the HUD.
- [ ] Each hero: the passive visibly triggers (void particles / heal numbers / blue frost + freeze).
- [ ] XP crystals fly to you inside your pickup range; a level-up pauses the game and shows 3 cards; A/D + Enter or a click picks one.
- [ ] Owning both parts of a synergy shows the synergy banner.
- [ ] Enemies: slimes hop, wraiths flank, knights telegraph a strike, casters telegraph bolts, and the elite telegraphs charges.
- [ ] Boss at 9:00 (or F3 with `?debug`): phase banners at 66 % / 33 %, rage colours in phase 3, crown drop on death.
- [ ] Pause (Esc / Start): resume, settings, quit to menu.
- [ ] Death leads to the run summary; a new highscore is marked; "play again" restarts with the same hero.
- [ ] Versus: P1 uses keyboard + mouse, P2 uses arrows + IJKL/U/O/P/Right Shift; both HUDs update; the first death ends the match with the correct winner.
- [ ] Versus with 1 pad (goes to P2) and with 2 pads.
- [ ] Settings persist after a reload (volume, shake, damage numbers, auto-attack, FPS counter).
- [ ] The window resizes to integer scales with no blurry pixels.
- [ ] `npm run build && npm run preview` works.

---

## Known limitations

- **Gamepads** were only tested with simulated pads (standard mapping). Pads with non-standard mappings may need remapping.
- **Balance** was tuned with an autopilot bot and short manual sessions. Expect a human-tuning pass, especially for the late endless phase and Frost Witch survivability.
- **One arena.** There is a single, deliberately mirrored map, so versus is fair for both players.
- **Versus shares one screen.** The camera leash stops players from drifting more than a screen apart; there is no split-screen.
- **Audio** is synthesized, and the exact sound varies slightly between browsers. Safari needs a click before any sound plays.
- **Phaser chunk size.** The `phaser` chunk is about 1.5 MB (340 kB gzip). It is split out but not tree-shaken.
- **Touch controls** were tested in an emulated phone (Chromium, Pixel 7, real touch events): multi-touch joystick plus buttons, upgrades, pause and resume, and the portrait hint. They have not been tested on a physical iPhone or Android device yet.
- **No online multiplayer, controller rebinding or meta-progression unlocks.**

## Credits

- Design, code, pixel art, music and SFX: generated for this project. All art and audio are original and procedural.
- Fonts: *Press Start 2P* (CodeMan38) and *Silkscreen* (Jason Kottke), both under the SIL Open Font License, via Fontsource.
- Engine: Phaser 3 (MIT).
