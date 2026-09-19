// Synthesized sound effects, played through Web Audio. Modelled on the reference game:
// clearing is a loud, crisp crunch (a sharp crack followed by ~0.4 s of crackles), tapping is a
// short wooden "tok". Consecutive clears add a bell whose pitch climbs with the combo.

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Band-pass filters `input` in place-free fashion (RBJ biquad) and returns a new array. */
function bandpass(input, sr, freq, q) {
  const w = (2 * Math.PI * freq) / sr, alpha = Math.sin(w) / (2 * q), cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}

function normalize(data, peak) {
  let m = 0;
  for (const v of data) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / m;
  return data;
}

const SYNTH = {
  /** The clear: crack + thump + a spray of crackle grains. */
  clear(sr) {
    const rand = rng(7);
    const out = new Float32Array(Math.floor(sr * 0.45));
    // sharp crack
    for (let i = 0; i < sr * 0.006; i++) out[i] += 0.6 * (rand() * 2 - 1) * Math.exp(-i / (sr * 0.0015));
    // short body thump so it has weight, not just hiss
    let ph = 0;
    for (let i = 0; i < sr * 0.09; i++) {
      const t = i / sr, f = 90 + 160 * Math.exp(-t / 0.02);
      ph += (2 * Math.PI * f) / sr;
      out[i] += 0.55 * Math.sin(ph) * Math.exp(-t / 0.035);
    }
    // crackle texture: many short grains whose loudness fades slowly over ~0.4 s,
    // giving the sustained crunch of the reference game rather than a single click
    let g = 0.004;
    while (g < 0.4) {
      const len = Math.floor(sr * (0.01 + rand() * 0.022));
      const noise = new Float32Array(len);
      for (let i = 0; i < len; i++) noise[i] = (rand() * 2 - 1) * Math.exp(-i / (len * 0.3));
      const f = bandpass(noise, sr, 1500 + rand() * 4500, 2.2);
      const amp = 2.6 * Math.exp(-g / 0.33) * (0.55 + rand() * 0.6);
      const at = Math.floor(g * sr);
      for (let i = 0; i < len && at + i < out.length; i++) out[at + i] += f[i] * amp;
      g += 0.006 + rand() * 0.012;
    }
    // bright air on top
    const air = new Float32Array(out.length);
    for (let i = 0; i < air.length; i++) air[i] = (rand() * 2 - 1) * Math.exp(-i / (sr * 0.12));
    const airF = bandpass(air, sr, 4200, 0.9);
    for (let i = 0; i < out.length; i++) out[i] += airF[i] * 0.5;
    return normalize(out, 0.95);
  },

  /** Wooden "tok" when selecting a tile. */
  tap(sr) {
    const out = new Float32Array(Math.floor(sr * 0.12));
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, f = 1450 + 350 * Math.exp(-t / 0.006);
      ph += (2 * Math.PI * f) / sr;
      const env = Math.min(1, t / 0.0015) * Math.exp(-t / 0.03);
      out[i] = env * (Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.1 * Math.sin(3.1 * ph));
    }
    return normalize(out, 0.55);
  },

  fail(sr) {
    const out = new Float32Array(Math.floor(sr * 0.2));
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, f = 260 - 90 * (t / 0.2);
      ph += (2 * Math.PI * f) / sr;
      out[i] = Math.min(1, t / 0.004) * Math.exp(-t / 0.07) * (Math.sin(ph) + 0.3 * Math.sin(2 * ph));
    }
    return normalize(out, 0.45);
  },

  slide(sr) {
    const rand = rng(3);
    const n = new Float32Array(Math.floor(sr * 0.03));
    for (let i = 0; i < n.length; i++) n[i] = (rand() * 2 - 1) * Math.exp(-i / (sr * 0.006));
    return normalize(bandpass(n, sr, 1800, 1.5), 0.22);
  },
};

function bell(sr, freq, dur = 0.45, vol = 0.32) {
  const out = new Float32Array(Math.floor(sr * dur));
  const partials = [[1, 1, 0.4], [2.76, 0.35, 0.18], [5.4, 0.12, 0.08]];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr, a = Math.min(1, t / 0.002);
    let v = 0;
    for (const [m, g, tau] of partials) v += g * Math.sin(2 * Math.PI * freq * m * t) * Math.exp(-t / tau);
    out[i] = a * v;
  }
  return normalize(out, vol);
}

function tones(sr, notes, wave, volume) {
  const total = notes.reduce((n, [, d]) => n + Math.floor(d * sr), 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const [freq, dur] of notes) {
    const n = Math.floor(dur * sr);
    for (let i = 0; i < n; i++) {
      const phase = ((i / sr) * freq) % 1;
      const v = wave === 'sine' ? Math.sin(phase * 2 * Math.PI) : phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
      out[o++] = v * Math.min(1, i / (sr * 0.004)) * Math.pow(1 - i / n, 1.6) * volume;
    }
  }
  return out;
}

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
      for (const [name, fn] of Object.entries(SYNTH)) this.buffers[name] = make(fn(sr));
      this.buffers.shuffle = make(tones(sr, [[523, 0.05], [659, 0.05], [784, 0.05], [659, 0.05], [784, 0.08]], 'sine', 0.4));
      this.buffers.lose = make(tones(sr, [[392, 0.16], [330, 0.16], [262, 0.16], [196, 0.4]], 'triangle', 0.45));
      this.buffers.win = make(tones(sr, [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], 'triangle', 0.5));
      this.bells = PENTATONIC.map(st => make(bell(sr, 1046.5 * Math.pow(2, st / 12))));
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
    this.start(this.buffers.clear, 0.94 + Math.random() * 0.12, 1);
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
