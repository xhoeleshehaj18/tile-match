// Plays the synthesized effects (see sfx.js) through Web Audio.

import { SFX, bell, clear, CLEAR_VARIANTS, COMBO_STEPS, COMBO_BASE } from './sfx.js';

// iPhone Safari has no navigator.vibrate. Flipping a native switch control does play the system's
// light haptic tick there (iOS 18 and later), so that's what a tick is on an iPhone: one strength
// only, which means a pattern becomes a rhythm of ticks rather than stronger and weaker buzzes.
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function iosTick() {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.append(input);
  document.head.append(label);
  label.click();
  label.remove();
}

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
  /** Any kind of haptics: a real vibration motor, or the iPhone's switch tick. */
  get canFeel() { return this.canVibrate || IOS; }

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

  /** A long, soft bell `step` pentatonic notes above G4, made the first time it's needed. */
  pieceBell(step) {
    this.pieceBells ??= {};
    if (!this.pieceBells[step]) {
      const scale = [0, 2, 4, 7, 9];
      const semis = 12 * Math.floor(step / 5) + scale[step % 5];
      const data = bell(this.ctx.sampleRate, 392 * Math.pow(2, semis / 12), 1.1, 0.16);
      const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      b.getChannelData(0).set(data);
      this.pieceBells[step] = b;
    }
    return this.pieceBells[step];
  }

  /** A puzzle piece clicking into place: a wooden knock and a chime that climbs as the photo fills. */
  snapPiece(step) {
    if (!this.enabled || this.volume <= 0 || !this.ctx) return;
    this.start(this.buffers.tap, 0.62, 1.3);
    this.start(this.pieceBell(Math.max(0, Math.min(14, step))), 1, 1, 0.02);
  }

  /** The last piece in: a harp run up the scale. */
  revealPhoto() {
    if (!this.enabled || this.volume <= 0 || !this.ctx) return;
    for (let i = 0; i < 11; i++) this.start(this.pieceBell(i + 2), 1, 0.9, i * 0.075);
    this.start(this.buffers.win, 1, 0.7, 0.8);
  }

  start(buffer, rate, gain, delay = 0) {
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
    src.start(delay ? this.ctx.currentTime + delay : 0);
  }

  buzz(ms = 12) {
    if (this.haptics && this.canVibrate) navigator.vibrate(ms);
  }

  /** One faint haptic tick, 0..1 strong (a few milliseconds of motor; on iPhone, the switch tick). */
  tick(strength = 0.5) {
    if (!this.haptics) return;
    if (this.canVibrate) navigator.vibrate(Math.round(4 + 22 * strength));
    else if (IOS) try { iosTick(); } catch {}
  }

  /** A rhythm of ticks: [[ms from now, strength], ...]. */
  ticks(list) {
    for (const [ms, strength] of list) setTimeout(() => this.tick(strength), ms);
  }
}

export const sound = new Sound();
