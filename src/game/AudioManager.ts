/**
 * Fully procedural audio: synthesised SFX and a small step-sequencer for music.
 * No external audio files, so there are no licensing concerns.
 */
import type { Settings } from '../systems/SaveSystem';

type Wave = OscillatorType | 'noise';

interface Layer {
  wave: Wave;
  f0: number;
  f1?: number;
  dur: number;
  vol: number;
  attack?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; f0: number; f1?: number; q?: number };
}

const SFX: Record<string, Layer[]> = {
  ui_move: [{ wave: 'square', f0: 660, f1: 700, dur: 0.04, vol: 0.12 }],
  ui_select: [
    { wave: 'square', f0: 520, f1: 780, dur: 0.07, vol: 0.14 },
    { wave: 'triangle', f0: 1040, dur: 0.12, vol: 0.1, delay: 0.05 },
  ],
  ui_back: [{ wave: 'square', f0: 500, f1: 300, dur: 0.08, vol: 0.12 }],
  shoot_void: [
    { wave: 'square', f0: 880, f1: 330, dur: 0.07, vol: 0.06, filter: { type: 'lowpass', f0: 3000 } },
    { wave: 'sine', f0: 220, f1: 140, dur: 0.06, vol: 0.08 },
  ],
  orb: [
    { wave: 'sawtooth', f0: 180, f1: 90, dur: 0.25, vol: 0.12, filter: { type: 'lowpass', f0: 1800, f1: 300 } },
    { wave: 'sine', f0: 660, f1: 220, dur: 0.18, vol: 0.1 },
  ],
  black_hole: [
    { wave: 'sawtooth', f0: 60, f1: 30, dur: 0.9, vol: 0.18, attack: 0.1, filter: { type: 'lowpass', f0: 600, f1: 120, q: 6 } },
    { wave: 'sine', f0: 900, f1: 120, dur: 0.6, vol: 0.06 },
  ],
  ultimate_void: [
    { wave: 'sawtooth', f0: 50, f1: 25, dur: 1.8, vol: 0.25, attack: 0.15, filter: { type: 'lowpass', f0: 900, f1: 100, q: 8 } },
    { wave: 'noise', f0: 0, dur: 1.2, vol: 0.12, filter: { type: 'bandpass', f0: 2000, f1: 200, q: 2 } },
    { wave: 'sine', f0: 1200, f1: 80, dur: 1.2, vol: 0.08 },
  ],
  slash: [
    { wave: 'noise', f0: 0, dur: 0.09, vol: 0.16, filter: { type: 'bandpass', f0: 5000, f1: 1500, q: 1.5 } },
    { wave: 'triangle', f0: 400, f1: 200, dur: 0.05, vol: 0.05 },
  ],
  heavy_slash: [
    { wave: 'noise', f0: 0, dur: 0.18, vol: 0.24, filter: { type: 'bandpass', f0: 4000, f1: 600, q: 1.2 } },
    { wave: 'sawtooth', f0: 160, f1: 60, dur: 0.18, vol: 0.12, filter: { type: 'lowpass', f0: 900 } },
  ],
  rush: [
    { wave: 'noise', f0: 0, dur: 0.22, vol: 0.18, filter: { type: 'highpass', f0: 800, f1: 4000 } },
    { wave: 'sawtooth', f0: 120, f1: 320, dur: 0.18, vol: 0.08, filter: { type: 'lowpass', f0: 1200 } },
  ],
  ultimate_blood: [
    { wave: 'sawtooth', f0: 110, f1: 55, dur: 1.2, vol: 0.2, filter: { type: 'lowpass', f0: 1200, f1: 200, q: 4 } },
    { wave: 'square', f0: 220, f1: 440, dur: 0.6, vol: 0.06, delay: 0.1 },
    { wave: 'noise', f0: 0, dur: 0.6, vol: 0.1, filter: { type: 'lowpass', f0: 600 } },
  ],
  shoot_frost: [
    { wave: 'triangle', f0: 1600, f1: 900, dur: 0.06, vol: 0.07 },
    { wave: 'noise', f0: 0, dur: 0.04, vol: 0.04, filter: { type: 'highpass', f0: 6000 } },
  ],
  lance: [
    { wave: 'triangle', f0: 1400, f1: 500, dur: 0.18, vol: 0.12 },
    { wave: 'noise', f0: 0, dur: 0.15, vol: 0.08, filter: { type: 'highpass', f0: 4000 } },
  ],
  frozen_ground: [
    { wave: 'noise', f0: 0, dur: 0.6, vol: 0.14, filter: { type: 'highpass', f0: 3000, f1: 8000 } },
    { wave: 'sine', f0: 2400, f1: 1800, dur: 0.4, vol: 0.05 },
  ],
  ultimate_frost: [
    { wave: 'noise', f0: 0, dur: 1.2, vol: 0.2, filter: { type: 'bandpass', f0: 8000, f1: 1500, q: 1 } },
    { wave: 'triangle', f0: 2000, f1: 200, dur: 1.0, vol: 0.12 },
    { wave: 'sine', f0: 80, f1: 40, dur: 0.8, vol: 0.2 },
  ],
  dash: [{ wave: 'noise', f0: 0, dur: 0.12, vol: 0.1, filter: { type: 'bandpass', f0: 1200, f1: 3500, q: 1 } }],
  blink: [
    { wave: 'sine', f0: 300, f1: 1400, dur: 0.1, vol: 0.08 },
    { wave: 'noise', f0: 0, dur: 0.08, vol: 0.05, filter: { type: 'highpass', f0: 3000 } },
  ],
  hit: [{ wave: 'square', f0: 220, f1: 90, dur: 0.05, vol: 0.07, filter: { type: 'lowpass', f0: 1600 } }],
  crit: [
    { wave: 'square', f0: 900, f1: 300, dur: 0.07, vol: 0.08 },
    { wave: 'noise', f0: 0, dur: 0.06, vol: 0.1, filter: { type: 'highpass', f0: 2000 } },
  ],
  enemy_death: [
    { wave: 'noise', f0: 0, dur: 0.12, vol: 0.08, filter: { type: 'lowpass', f0: 1500, f1: 200 } },
    { wave: 'square', f0: 300, f1: 60, dur: 0.1, vol: 0.05 },
  ],
  player_hurt: [
    { wave: 'sawtooth', f0: 300, f1: 80, dur: 0.18, vol: 0.18, filter: { type: 'lowpass', f0: 1200 } },
    { wave: 'noise', f0: 0, dur: 0.1, vol: 0.1 },
  ],
  xp: [{ wave: 'sine', f0: 1200, f1: 1600, dur: 0.05, vol: 0.05 }],
  heal: [
    { wave: 'triangle', f0: 523, dur: 0.1, vol: 0.1 },
    { wave: 'triangle', f0: 784, dur: 0.15, vol: 0.1, delay: 0.08 },
  ],
  level_up: [
    { wave: 'square', f0: 523, dur: 0.09, vol: 0.09 },
    { wave: 'square', f0: 659, dur: 0.09, vol: 0.09, delay: 0.08 },
    { wave: 'square', f0: 784, dur: 0.09, vol: 0.09, delay: 0.16 },
    { wave: 'triangle', f0: 1046, dur: 0.35, vol: 0.12, delay: 0.24 },
  ],
  upgrade_pick: [
    { wave: 'triangle', f0: 784, f1: 1568, dur: 0.2, vol: 0.12 },
    { wave: 'sine', f0: 392, dur: 0.3, vol: 0.08 },
  ],
  synergy: [
    { wave: 'square', f0: 392, dur: 0.12, vol: 0.08 },
    { wave: 'square', f0: 587, dur: 0.12, vol: 0.08, delay: 0.1 },
    { wave: 'square', f0: 784, dur: 0.12, vol: 0.08, delay: 0.2 },
    { wave: 'triangle', f0: 1175, dur: 0.5, vol: 0.12, delay: 0.3 },
  ],
  chest: [
    { wave: 'triangle', f0: 392, f1: 784, dur: 0.3, vol: 0.12 },
    { wave: 'sine', f0: 1568, dur: 0.4, vol: 0.06, delay: 0.2 },
  ],
  explosion: [
    { wave: 'noise', f0: 0, dur: 0.3, vol: 0.18, filter: { type: 'lowpass', f0: 2000, f1: 150 } },
    { wave: 'sine', f0: 120, f1: 40, dur: 0.25, vol: 0.18 },
  ],
  freeze: [{ wave: 'triangle', f0: 2200, f1: 2600, dur: 0.08, vol: 0.05 }],
  telegraph: [{ wave: 'square', f0: 140, f1: 180, dur: 0.15, vol: 0.06, filter: { type: 'lowpass', f0: 800 } }],
  enemy_shoot: [{ wave: 'sawtooth', f0: 500, f1: 200, dur: 0.12, vol: 0.06, filter: { type: 'lowpass', f0: 1400 } }],
  knight_slam: [
    { wave: 'noise', f0: 0, dur: 0.15, vol: 0.14, filter: { type: 'lowpass', f0: 900 } },
    { wave: 'sine', f0: 90, f1: 45, dur: 0.15, vol: 0.16 },
  ],
  elite_roar: [
    { wave: 'sawtooth', f0: 90, f1: 60, dur: 0.7, vol: 0.18, filter: { type: 'lowpass', f0: 700, q: 5 } },
    { wave: 'noise', f0: 0, dur: 0.5, vol: 0.1, filter: { type: 'bandpass', f0: 500, q: 2 } },
  ],
  boss_intro: [
    { wave: 'sawtooth', f0: 55, f1: 41, dur: 2.4, vol: 0.28, attack: 0.3, filter: { type: 'lowpass', f0: 500, f1: 150, q: 6 } },
    { wave: 'square', f0: 110, f1: 104, dur: 2.0, vol: 0.06, attack: 0.5 },
    { wave: 'noise', f0: 0, dur: 1.5, vol: 0.08, filter: { type: 'bandpass', f0: 300, q: 1 }, delay: 0.4 },
  ],
  boss_slam: [
    { wave: 'noise', f0: 0, dur: 0.4, vol: 0.22, filter: { type: 'lowpass', f0: 1000, f1: 100 } },
    { wave: 'sine', f0: 80, f1: 30, dur: 0.4, vol: 0.25 },
  ],
  boss_summon: [
    { wave: 'sawtooth', f0: 200, f1: 400, dur: 0.6, vol: 0.1, filter: { type: 'bandpass', f0: 800, q: 4 } },
    { wave: 'sine', f0: 300, f1: 900, dur: 0.6, vol: 0.06 },
  ],
  boss_phase: [
    { wave: 'sawtooth', f0: 80, f1: 160, dur: 1.2, vol: 0.22, filter: { type: 'lowpass', f0: 1200, q: 8 } },
    { wave: 'noise', f0: 0, dur: 1.0, vol: 0.14, filter: { type: 'bandpass', f0: 600, f1: 3000 } },
  ],
  boss_death: [
    { wave: 'sawtooth', f0: 120, f1: 30, dur: 2.5, vol: 0.25, filter: { type: 'lowpass', f0: 1500, f1: 80, q: 4 } },
    { wave: 'noise', f0: 0, dur: 2.0, vol: 0.18, filter: { type: 'lowpass', f0: 3000, f1: 100 } },
    { wave: 'triangle', f0: 523, dur: 0.6, vol: 0.1, delay: 1.6 },
    { wave: 'triangle', f0: 784, dur: 0.9, vol: 0.1, delay: 1.9 },
  ],
  victory: [
    { wave: 'square', f0: 523, dur: 0.15, vol: 0.1 },
    { wave: 'square', f0: 659, dur: 0.15, vol: 0.1, delay: 0.15 },
    { wave: 'square', f0: 784, dur: 0.15, vol: 0.1, delay: 0.3 },
    { wave: 'triangle', f0: 1046, dur: 0.8, vol: 0.14, delay: 0.45 },
  ],
  defeat: [
    { wave: 'square', f0: 392, dur: 0.25, vol: 0.1 },
    { wave: 'square', f0: 330, dur: 0.25, vol: 0.1, delay: 0.25 },
    { wave: 'square', f0: 262, dur: 0.25, vol: 0.1, delay: 0.5 },
    { wave: 'triangle', f0: 196, dur: 1.0, vol: 0.14, delay: 0.75 },
  ],
  wave: [
    { wave: 'triangle', f0: 220, f1: 330, dur: 0.4, vol: 0.1 },
    { wave: 'sine', f0: 110, dur: 0.6, vol: 0.12 },
  ],
};

// ───────── Music ─────────
const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
type TrackId = 'menu' | 'battle' | 'boss';

interface Track {
  bpm: number;
  /** Chord roots (MIDI) per bar, with minor/major triads. */
  chords: { root: number; minor: boolean }[];
  drums: boolean;
  arp: boolean;
  intensity: number;
}

const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 72,
    chords: [
      { root: 50, minor: true },
      { root: 46, minor: false },
      { root: 43, minor: true },
      { root: 45, minor: false },
    ],
    drums: false,
    arp: true,
    intensity: 0.5,
  },
  battle: {
    bpm: 124,
    chords: [
      { root: 50, minor: true },
      { root: 50, minor: true },
      { root: 46, minor: false },
      { root: 48, minor: false },
      { root: 43, minor: true },
      { root: 43, minor: true },
      { root: 45, minor: false },
      { root: 45, minor: false },
    ],
    drums: true,
    arp: true,
    intensity: 0.8,
  },
  boss: {
    bpm: 142,
    chords: [
      { root: 50, minor: true },
      { root: 51, minor: false },
      { root: 50, minor: true },
      { root: 49, minor: false },
    ],
    drums: true,
    arp: true,
    intensity: 1,
  },
};

export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private noise?: AudioBuffer;
  private lastPlayed = new Map<string, number>();
  private active = 0;
  private settings: Pick<Settings, 'masterVolume' | 'musicVolume' | 'sfxVolume'> = { masterVolume: 0.8, musicVolume: 0.55, sfxVolume: 0.75 };
  private track: TrackId | null = null;
  private wantedTrack: TrackId | null = null;
  private step = 0;
  private nextStepTime = 0;
  private timer?: number;
  private musicBus?: GainNode;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      return; // no audio available – game stays silent
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings(this.settings);
    if (this.wantedTrack) this.playMusic(this.wantedTrack);
  }

  get unlocked(): boolean {
    return !!this.ctx;
  }

  applySettings(s: Pick<Settings, 'masterVolume' | 'musicVolume' | 'sfxVolume'>): void {
    this.settings = { masterVolume: s.masterVolume, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume };
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.musicVolume * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
  }

  play(id: string, opts: { pitch?: number; volume?: number } = {}): void {
    const ctx = this.ctx;
    const layers = SFX[id];
    if (!ctx || !layers || !this.sfxGain) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (now - last < 0.035) return; // rate-limit identical sounds
    if (this.active > 28) return; // voice cap
    this.lastPlayed.set(id, now);
    const pitch = opts.pitch ?? 1;
    const vol = opts.volume ?? 1;
    for (const l of layers) this.layer(l, now + (l.delay ?? 0), pitch, vol, this.sfxGain);
  }

  private layer(l: Layer, t: number, pitch: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    let src: AudioScheduledSourceNode;
    if (l.wave === 'noise') {
      const b = ctx.createBufferSource();
      b.buffer = this.noise!;
      b.playbackRate.value = pitch;
      src = b;
    } else {
      const o = ctx.createOscillator();
      o.type = l.wave;
      o.frequency.setValueAtTime(l.f0 * pitch, t);
      if (l.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, l.f1 * pitch), t + l.dur);
      src = o;
    }
    const g = ctx.createGain();
    const attack = l.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, l.vol * vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + l.dur);
    let node: AudioNode = src;
    if (l.filter) {
      const f = ctx.createBiquadFilter();
      f.type = l.filter.type;
      f.frequency.setValueAtTime(l.filter.f0, t);
      if (l.filter.f1) f.frequency.exponentialRampToValueAtTime(l.filter.f1, t + l.dur);
      f.Q.value = l.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(out);
    this.active++;
    src.onended = () => {
      this.active--;
      g.disconnect();
    };
    src.start(t);
    src.stop(t + l.dur + 0.05);
  }

  // ───────── music sequencer ─────────
  playMusic(id: TrackId | null): void {
    this.wantedTrack = id;
    if (!this.ctx || !this.musicGain) return;
    if (this.track === id) return;
    const ctx = this.ctx;
    // crossfade: fade old bus out, start a new bus
    if (this.musicBus) {
      const old = this.musicBus;
      old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      window.setTimeout(() => old.disconnect(), 1500);
    }
    this.track = id;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
    if (!id) return;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    this.musicBus.connect(this.musicGain);
    this.step = 0;
    this.nextStepTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track || !this.musicBus) return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.15) {
      this.playStep(tr, this.step, this.nextStepTime, stepDur);
      this.step++;
      this.nextStepTime += stepDur;
    }
  }

  private note(wave: OscillatorType, midi: number, t: number, dur: number, vol: number, cutoff?: number): void {
    this.layer({ wave, f0: NOTE(midi), dur, vol, attack: Math.min(0.02, dur / 4), filter: cutoff ? { type: 'lowpass', f0: cutoff } : undefined }, t, 1, 1, this.musicBus!);
  }

  private playStep(tr: Track, step: number, t: number, sd: number): void {
    const bar = Math.floor(step / 16) % tr.chords.length;
    const s = step % 16;
    const ch = tr.chords[bar];
    const triad = [0, ch.minor ? 3 : 4, 7];
    const I = tr.intensity;
    // pad on bar start
    if (s === 0) {
      for (const iv of triad) this.note('triangle', ch.root + 12 + iv, t, sd * 16, 0.035 * (1.2 - I * 0.4), 1400);
    }
    // bass
    if (tr.drums) {
      if (s % 2 === 0) this.note('sawtooth', ch.root - 12 + (s === 14 ? 7 : 0), t, sd * 1.6, 0.09, 420 + I * 300);
    } else if (s === 0 || s === 8) {
      this.note('sawtooth', ch.root - 12, t, sd * 7, 0.08, 300);
    }
    // arpeggio
    if (tr.arp) {
      const every = tr.drums ? 1 : 2;
      if (s % every === 0) {
        const seq = [0, 1, 2, 1, 2, 0, 1, 2];
        const iv = triad[seq[(s / every) % seq.length]] + (s >= 8 && tr.drums ? 12 : 0);
        this.note('square', ch.root + 24 + iv, t, sd * 0.9, tr.drums ? 0.022 : 0.03, 2400 + I * 1200);
      }
    }
    // boss lead stabs
    if (this.track === 'boss' && (s === 0 || s === 3 || s === 6)) this.note('sawtooth', ch.root + 12, t, sd * 1.5, 0.04, 1800);
    // drums
    if (tr.drums) {
      if (s % 4 === 0 || (this.track === 'boss' && s === 10)) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 1 || this.track === 'boss') this.hat(t, s % 4 === 2 ? 0.04 : 0.025);
    }
  }

  private kick(t: number): void {
    this.layer({ wave: 'sine', f0: 140, f1: 40, dur: 0.18, vol: 0.32 }, t, 1, 1, this.musicBus!);
  }
  private snare(t: number): void {
    this.layer({ wave: 'noise', f0: 0, dur: 0.14, vol: 0.12, filter: { type: 'bandpass', f0: 1800, q: 0.8 } }, t, 1, 1, this.musicBus!);
    this.layer({ wave: 'triangle', f0: 220, f1: 140, dur: 0.08, vol: 0.06 }, t, 1, 1, this.musicBus!);
  }
  private hat(t: number, vol: number): void {
    this.layer({ wave: 'noise', f0: 0, dur: 0.04, vol, filter: { type: 'highpass', f0: 7000 } }, t, 1, 1, this.musicBus!);
  }
}

export const audio = new AudioManager();
