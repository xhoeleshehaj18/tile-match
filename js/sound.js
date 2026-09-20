// Plays the synthesized effects (see sfx.js) through Web Audio.

import { SFX, bell, COMBO_STEPS, COMBO_BASE } from './sfx.js';

class Sound {
  constructor() {
    this.enabled = localStorage.getItem('sound') !== 'false';
    this.haptics = localStorage.getItem('haptics') !== 'false';
    this.ctx = null;
    this.buffers = {};
    this.bells = [];
    // Respect the iPhone's silent switch, like a normal game.
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
  }

  get canVibrate() { return typeof navigator.vibrate === 'function'; }

  setEnabled(on) { this.enabled = on; localStorage.setItem('sound', on); }
  setHaptics(on) { this.haptics = on; localStorage.setItem('haptics', on); }

  /** Audio can only start from a user gesture on iOS; call on the first touch. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const sr = this.ctx.sampleRate;
      const make = data => {
        const b = this.ctx.createBuffer(1, data.length, sr);
        b.getChannelData(0).set(data);
        return b;
      };
      for (const [name, fn] of Object.entries(SFX)) this.buffers[name] = make(fn(sr));
      this.bells = COMBO_STEPS.map(st => make(bell(sr, COMBO_BASE * Math.pow(2, st / 12))));
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name, { rate = 1, gain = 1 } = {}) {
    if (!this.enabled || !this.ctx || !this.buffers[name]) return;
    this.start(this.buffers[name], rate, gain);
  }

  /** A clear: the crunch, slightly varied each time, plus a bell that climbs with the combo. */
  clear(combo) {
    if (!this.enabled || !this.ctx) return;
    // the original plays the same clear every time; only a touch of variation so it doesn't tire
    this.start(this.buffers.clear, 0.98 + Math.random() * 0.04, 1);
    if (combo >= 2) this.start(this.bells[Math.min(combo - 2, this.bells.length - 1)], 1, 0.9);
  }

  start(buffer, rate, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    if (gain === 1) {
      src.connect(this.ctx.destination);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.ctx.destination);
    }
    src.start();
  }

  buzz(ms = 12) {
    if (this.haptics && this.canVibrate) navigator.vibrate(ms);
  }
}

export const sound = new Sound();
