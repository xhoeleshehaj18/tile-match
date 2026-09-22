// Plays the synthesized effects (see sfx.js) through Web Audio.

import { SFX, bell, clear, CLEAR_VARIANTS, COMBO_STEPS, COMBO_BASE } from './sfx.js';

/** A missing or damaged saved volume falls back to full, which is what it was before the slider. */
const clamp01 = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

class Sound {
  constructor() {
    this.enabled = localStorage.getItem('sound') !== 'false';
    this.haptics = localStorage.getItem('haptics') !== 'false';
    this.volume = clamp01(parseFloat(localStorage.getItem('volume')));
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.bells = [];
    this.clears = [];
    this.lastClear = -1;
    // Respect the iPhone's silent switch, like a normal game.
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
  }

  get canVibrate() { return typeof navigator.vibrate === 'function'; }

  setEnabled(on) { this.enabled = on; localStorage.setItem('sound', on); }
  setHaptics(on) { this.haptics = on; localStorage.setItem('haptics', on); }

  /** 0..1, applied to everything through one master gain so the mix between effects is kept. */
  setVolume(v) {
    this.volume = clamp01(v);
    localStorage.setItem('volume', this.volume);
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Audio can only start from a user gesture on iOS; call on the first touch. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const sr = this.ctx.sampleRate;
      const make = data => {
        const b = this.ctx.createBuffer(1, data.length, sr);
        b.getChannelData(0).set(data);
        return b;
      };
      for (const [name, fn] of Object.entries(SFX)) this.buffers[name] = make(fn(sr));
      this.clears = Array.from({ length: CLEAR_VARIANTS }, (_, v) => make(clear(sr, v)));
      this.bells = COMBO_STEPS.map(st => make(bell(sr, COMBO_BASE * Math.pow(2, st / 12))));
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name, { rate = 1, gain = 1 } = {}) {
    if (!this.enabled || this.volume <= 0 || !this.ctx || !this.buffers[name]) return;
    this.start(this.buffers[name], rate, gain);
  }

  /** A clear: the pop and chime (one of a few versions, never the same twice running), plus a
   *  bell that climbs with the combo. Played at its own pitch so it stays in tune with the bell. */
  clear(combo) {
    if (!this.enabled || this.volume <= 0 || !this.ctx) return;
    let v = Math.floor(Math.random() * (this.clears.length - 1));
    if (v >= this.lastClear) v++;
    this.lastClear = v;
    this.start(this.clears[v], 1, 1);
    if (combo >= 2) this.start(this.bells[Math.min(combo - 2, this.bells.length - 1)], 1, 0.9);
  }

  start(buffer, rate, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    if (gain === 1) {
      src.connect(this.master);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.master);
    }
    src.start();
  }

  buzz(ms = 12) {
    if (this.haptics && this.canVibrate) navigator.vibrate(ms);
  }
}

export const sound = new Sound();
