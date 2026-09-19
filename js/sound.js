// Tiny synthesized sound effects (same notes as the iOS version), played through Web Audio.

const EFFECTS = {
  tap: { notes: [[1100, 0.045]], wave: 'sine', volume: 0.35 },
  match: { notes: [[660, 0.06], [990, 0.1]], wave: 'triangle', volume: 0.5 },
  combo: { notes: [[880, 0.05], [1175, 0.05], [1568, 0.12]], wave: 'triangle', volume: 0.45 },
  fail: { notes: [[320, 0.07], [220, 0.11]], wave: 'triangle', volume: 0.45 },
  slide: { notes: [[500, 0.03]], wave: 'sine', volume: 0.2 },
  shuffle: { notes: [[523, 0.05], [659, 0.05], [784, 0.05], [659, 0.05], [784, 0.08]], wave: 'sine', volume: 0.4 },
  lose: { notes: [[392, 0.16], [330, 0.16], [262, 0.16], [196, 0.4]], wave: 'triangle', volume: 0.45 },
  win: { notes: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], wave: 'triangle', volume: 0.5 },
};

class Sound {
  constructor() {
    this.enabled = localStorage.getItem('sound') !== 'false';
    this.haptics = localStorage.getItem('haptics') !== 'false';
    this.ctx = null;
    this.buffers = {};
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
      this.ctx = new AC();
      for (const [name, e] of Object.entries(EFFECTS)) this.buffers[name] = this.render(e);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  render({ notes, wave, volume }) {
    const rate = this.ctx.sampleRate;
    const total = notes.reduce((n, [, d]) => n + Math.floor(d * rate), 0);
    const buf = this.ctx.createBuffer(1, total, rate);
    const data = buf.getChannelData(0);
    let o = 0;
    for (const [freq, dur] of notes) {
      const n = Math.floor(dur * rate);
      for (let i = 0; i < n; i++) {
        const phase = ((i / rate) * freq) % 1;
        const v = wave === 'sine' ? Math.sin(phase * 2 * Math.PI) : phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
        const attack = Math.min(1, i / (rate * 0.004));
        const release = Math.pow(1 - i / n, 1.6);
        data[o++] = v * attack * release * volume;
      }
    }
    return buf;
  }

  play(name) {
    if (!this.enabled || !this.ctx || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.ctx.destination);
    src.start();
  }

  buzz(ms = 12) {
    if (this.haptics && this.canVibrate) navigator.vibrate(ms);
  }
}

export const sound = new Sound();
