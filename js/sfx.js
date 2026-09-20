// Pure sound synthesis: no DOM, no Web Audio. Every generator takes a sample rate and returns a
// Float32Array of mono samples, so the same code runs in the browser (sound.js) and in node for
// offline rendering and measurement.
//
// The voicing follows measurements of the original game (a phone screen recording):
//  - tap:   a short woody knock (~1.45 kHz, tone rises ~90 Hz in the first few ms) on an ~88 Hz body
//           thump, a tiny rebound, then three soft rattles at ~72/101/126 ms; ~0.15 s in all.
//  - fail:  a dry, clattering knock in the 1.5-2.3 kHz region (spring-back after a bad drag).
//  - clear: a crack, ~65 ms of sizzle, then a full-band crackling burst (firework-like) with a low
//           thump, fading over ~0.9 s. No pitch variation between plays in the original.
// Nothing here is derived from recorded audio data: every sound is built from chosen parameters.

/** Small deterministic PRNG so every build of a sound is identical. */
export function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** RBJ biquad filter applied in place. type: 'lp' | 'hp' | 'bp' (0 dB peak). */
function filter(buf, sr, type, freq, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b1 = 1 - cs; b0 = b2 = b1 / 2; }
  else if (type === 'hp') { b1 = -(1 + cs); b0 = b2 = (1 + cs) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    buf[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return buf;
}

function noise(n, rand) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rand() * 2 - 1;
  return out;
}

/** Pink-ish noise (Paul Kellet's economy filter), roughly unit RMS. */
function pink(n, rand) {
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.28;
  }
  return out;
}

/** Piecewise-linear-in-dB envelope over [time, dB] breakpoints, as a gain per sample.
 *  Within a segment the gain ramps multiplicatively, so there is no pow() in the inner loop. */
function dbEnvelope(n, sr, points) {
  const out = new Float32Array(n);
  for (let k = 0; k < points.length - 1; k++) {
    const [t0, d0] = points[k], [t1, d1] = points[k + 1];
    const i0 = Math.max(0, Math.round(t0 * sr)), i1 = Math.min(n, Math.round(t1 * sr));
    if (i1 <= i0) continue;
    let g = Math.pow(10, d0 / 20);
    const step = Math.pow(10, (d1 - d0) / 20 / (i1 - i0));
    for (let i = i0; i < i1; i++) { out[i] = g; g *= step; }
  }
  const last = Math.min(n, Math.round(points[points.length - 1][0] * sr));
  for (let i = last; i < n; i++) out[i] = 0;
  return out;
}

function mixInto(out, src, at, gain = 1) {
  for (let i = 0; i < src.length && at + i < out.length; i++) if (at + i >= 0) out[at + i] += src[i] * gain;
}

function peakOf(data) {
  let m = 0;
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]));
  return m;
}

/** Gentle soft-clip: lifts density (and grit) the way the original's burst sounds, without
 *  the hard edges of digital clipping. Amount 0 = none. */
function saturate(data, amount) {
  if (!amount) return data;
  const k = amount, g = Math.tanh(k);
  for (let i = 0; i < data.length; i++) data[i] = Math.tanh(k * data[i]) / g;
  return data;
}

function normalize(data, peak) {
  const m = peakOf(data);
  if (m > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / m;
  return data;
}

// Output levels (sample peak). Chosen so that, like the original, the clear is the loudest effect
// and a tap sits ~7 dB below it (K-weighted short-term loudness), while leaving headroom for
// several clears overlapping during fast combos.
const LEVEL = { tap: 0.9, fail: 0.92, clear: 0.82, slide: 0.09 };

// ---------------------------------------------------------------------------------------- tap

// The tap's tone is a cluster of wooden modes: a strong one at ~1.45 kHz (which settles upward by
// ~95 Hz in the first few ms) over a handful of shorter-lived ones just below it.
const KNOCK_MODES = [[1307, 0.8, 0.0035], [1250, 0.5, 0.003], [1213, 0.55, 0.003],
  [1150, 0.3, 0.0025], [1052, 0.25, 0.0025], [2100, 0.12, 0.002], [2450, 0.1, 0.002]];

/** One knock of a tile: the mode cluster, an ~88 Hz body thump, a broad wooden resonance and a
 *  small contact click. `hold`/`tau` shape how long the main tone rings. */
function knock(out, sr, at, g, rand, hold = 0.006, tau = 0.0058) {
  const i0 = Math.round(at * sr);
  const n = Math.floor(sr * 0.05);
  const end = Math.min(n, out.length - i0);
  // main tone: a short upward settle, so its phase is stepped directly
  let ph = 0, env = 0;
  const decay = Math.exp(-1 / (sr * tau)), holdN = hold * sr, attN = 0.003 * sr;
  // body thump: rotating oscillator at 88 Hz with a multiplicative decay
  const wt = (2 * Math.PI * 88) / sr, ct = Math.cos(wt), st = Math.sin(wt);
  let tx = Math.cos(1.1), ty = Math.sin(1.1), te = 1;
  const tdec = Math.exp(-1 / (sr * 0.0057));
  const w2 = (2 * Math.PI * 130) / sr, c2 = Math.cos(w2), s2 = Math.sin(w2);
  let tx2 = Math.cos(1.1), ty2 = Math.sin(1.1), te2 = 1;
  const tdec2 = Math.exp(-1 / (sr * 0.0045));
  for (let i = 0; i < end; i++) {
    const f = 1452 - 95 * Math.exp(-i / (sr * 0.003));
    ph += (2 * Math.PI * f) / sr;
    if (i < attN) { const u = Math.sin((Math.PI / 2) * (i / attN)); env = u * u; }
    else if (i < holdN) env = 1;
    else env *= decay;
    const ny = tx * st + ty * ct; tx = tx * ct - ty * st; ty = ny;
    const ny2 = tx2 * s2 + ty2 * c2; tx2 = tx2 * c2 - ty2 * s2; ty2 = ny2;
    out[i0 + i] += g * (env * Math.sin(ph) - (0.85 * ty * te + 0.22 * ty2 * te2) * Math.min(1, i / (sr * 0.0004)));
    te *= tdec; te2 *= tdec2;
  }
  for (const [mf, mg, mt] of KNOCK_MODES) {
    const w = (2 * Math.PI * mf) / sr, c = Math.cos(w), sn = Math.sin(w);
    const dec = Math.exp(-1 / (sr * mt)), att = 0.0008 * sr;
    let x = 1, y = 0, e = g * mg;
    for (let i = 0; i < end; i++) {
      const ny = x * sn + y * c; x = x * c - y * sn; y = ny;
      out[i0 + i] += e * y * (i < att ? i / att : 1);
      e *= dec;
    }
  }
  // noise-excited parts: the wooden body, the ring around the tone and the contact click
  const exc = noise(Math.floor(sr * 0.012), rand);
  let d = 1; const dd = Math.exp(-1 / (sr * 0.0016));
  for (let i = 0; i < exc.length; i++) { exc[i] *= d; d *= dd; }
  const body = filter(Float32Array.from(exc), sr, 'bp', 430, 1.1);
  mixInto(out, body, i0, g * 0.5);
  const ring = filter(Float32Array.from(exc), sr, 'bp', 1500, 6);
  mixInto(out, ring, i0, g * 0.6);
  const edge = filter(Float32Array.from(exc), sr, 'bp', 4000, 1.5);
  mixInto(out, edge, i0, g * 0.12);
  const click = Float32Array.from(exc);
  let d2 = 1; const dd2 = Math.exp(-1 / (sr * 0.0013));
  for (let i = 0; i < click.length; i++) { click[i] *= d2; d2 *= dd2; }
  filter(click, sr, 'hp', 3200);
  filter(click, sr, 'hp', 6000);
  filter(click, sr, 'lp', 15000);
  mixInto(out, click, i0, g * 0.6);
}

export function tap(sr) {
  const rand = rng(11);
  const out = new Float32Array(Math.floor(sr * 0.2));
  knock(out, sr, 0, 1, rand);
  knock(out, sr, 0.0121, 0.22, rand, 0.004, 0.0045);
  knock(out, sr, 0.0236, 0.04, rand, 0.003, 0.004);
  knock(out, sr, 0.0355, 0.05, rand, 0.003, 0.005);
  knock(out, sr, 0.0475, 0.05, rand, 0.003, 0.005);
  // the tile rattling as it shakes: three soft knocks, each with a small rebound
  for (const at of [0.0707, 0.1003, 0.1254]) {
    knock(out, sr, at, 0.17, rand, 0.0035, 0.0048);
    knock(out, sr, at + 0.0105, 0.045, rand, 0.003, 0.0045);
  }
  // the quiet ring that keeps sounding between the rattles
  const tail = noise(Math.floor(sr * 0.2), rand);
  filter(tail, sr, 'bp', 1452, 9);
  const te = dbEnvelope(tail.length, sr, [[0, -6], [0.02, 0], [0.05, -3], [0.15, -9], [0.19, -20], [0.2, -40]]);
  for (let i = 0; i < tail.length; i++) tail[i] *= te[i];
  mixInto(out, tail, 0, 0.45);
  normalize(out, 1);
  saturate(out, 1.4);
  return normalize(out, LEVEL.tap);
}

// --------------------------------------------------------------------------------------- fail

export function fail(sr) {
  const rand = rng(5);
  const n = Math.floor(sr * 0.24);
  const exc = new Float32Array(n);
  const hit = (at, g, len = 0.0012) => {
    const i0 = Math.round(at * sr);
    let a = g; const dec = Math.exp(-1 / (sr * len));
    for (let i = 0; i < len * sr * 4 && i0 + i < n; i++) { exc[i0 + i] += a * (rand() * 2 - 1); a *= dec; }
  };
  hit(0.002, 0.85);
  hit(0.0075, 1);
  for (let k = 0; k < 8; k++) hit(0.012 + k * 0.0034 + rand() * 0.001, 0.3 * Math.exp(-k / 3));
  hit(0.041, 0.3);
  hit(0.0445, 0.26);
  for (const at of [0.059, 0.066, 0.069, 0.087]) hit(at, 0.05);
  hit(0.177, 0.02);
  // a small cluster of inharmonic wooden modes
  const modes = [[1510, 0.55, 0.008], [1640, 0.6, 0.009], [1740, 1, 0.0095], [1810, 0.9, 0.009],
    [1960, 0.95, 0.009], [2170, 0.42, 0.0075], [2250, 0.42, 0.0075]];
  const out = new Float32Array(n);
  for (const [f, g, tau] of modes) {
    const y = filter(Float32Array.from(exc), sr, 'bp', f, Math.PI * f * tau);
    for (let i = 0; i < n; i++) out[i] += y[i] * g;
  }
  filter(out, sr, 'hp', 1250);
  filter(out, sr, 'hp', 1250);
  filter(out, sr, 'lp', 2900);
  normalize(out, 1);
  // a hint of the tile's low body, and the bright contact clicks on the two first hits
  const low = filter(Float32Array.from(exc), sr, 'bp', 230, 2);
  mixInto(out, low, 0, 0.25);
  const midLow = filter(Float32Array.from(exc), sr, 'bp', 520, 0.8);
  mixInto(out, midLow, 0, 0.3);
  const click = new Float32Array(Math.floor(sr * 0.03));
  for (const [at, g] of [[0.002, 1], [0.0075, 0.7], [0.041, 0.25], [0.0445, 0.2]]) {
    const i0 = Math.round(at * sr);
    let a = g; const dec = Math.exp(-1 / (sr * 0.0009));
    for (let i = 0; i + i0 < click.length && i < sr * 0.006; i++) { click[i0 + i] += a * (rand() * 2 - 1); a *= dec; }
  }
  filter(click, sr, 'hp', 2500);
  filter(click, sr, 'lp', 9000);
  filter(click, sr, 'lp', 14000);
  mixInto(out, click, 0, 1.1);
  // the original cuts to silence after ~0.12 s, with one faint tick at ~0.18 s
  const end = Math.round(0.122 * sr), fade = Math.round(0.006 * sr), gap = Math.round(0.168 * sr);
  for (let i = end; i < gap && i < n; i++) out[i] *= Math.max(0, 1 - (i - end) / fade);
  normalize(out, 1);
  saturate(out, 1.4);
  return normalize(out, LEVEL.fail);
}

// -------------------------------------------------------------------------------------- clear

export function clear(sr) {
  const rand = rng(7);
  const dur = 0.95;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);

  // 1. the crack, and a thin sizzle until the burst lands
  const crack = noise(Math.floor(sr * 0.012), rand);
  { let a = 1; const dec = Math.exp(-1 / (sr * 0.0007)); for (let i = 0; i < crack.length; i++) { crack[i] *= a; a *= dec; } }
  filter(crack, sr, 'hp', 300);
  filter(crack, sr, 'lp', 5000);
  filter(crack, sr, 'lp', 5000);
  mixInto(out, crack, 0, 4.2);
  const sizzle = noise(Math.floor(sr * 0.075), rand);
  filter(sizzle, sr, 'bp', 3600, 1.4);
  filter(sizzle, sr, 'lp', 7000);
  const sz = dbEnvelope(sizzle.length, sr, [[0, -40], [0.004, 0], [0.06, -2], [0.072, -30]]);
  for (let i = 0; i < sizzle.length; i++) sizzle[i] *= sz[i];
  mixInto(out, sizzle, 0, 0.45);

  // 2. the burst: four bands of pink noise, each with its own decay (highs die first).
  // Everything in the burst is band-limited to ~9.6 kHz; only the crack reaches higher.
  const body = new Float32Array(n);
  const T0 = 0.065;
  const bands = [
    // [lo, hi, gain, envelope]
    [90, 400, 0.55, [[T0, -40], [T0 + 0.008, 0], [0.09, -2], [0.12, -10], [0.16, -9], [0.3, -13], [0.45, -19], [0.52, -17], [0.6, -14], [0.64, -22], [0.93, -24]]],
    [400, 1500, 1.6, [[T0, -40], [T0 + 0.01, 0], [0.09, -5], [0.12, -13], [0.2, -15], [0.3, -17], [0.45, -24], [0.52, -22], [0.6, -19], [0.64, -28], [0.93, -30]]],
    [1500, 5000, 1.15, [[T0, -40], [T0 + 0.006, 0], [0.1, -3], [0.14, -9], [0.2, -9], [0.3, -11], [0.45, -20], [0.52, -19], [0.6, -17], [0.64, -26], [0.93, -30]]],
    [5000, 9500, 0.55, [[T0, -40], [T0 + 0.005, 0], [0.1, -4], [0.15, -15], [0.3, -19], [0.45, -32], [0.6, -30], [0.64, -36], [0.93, -44]]],
  ];
  for (const [lo, hi, gain, pts] of bands) {
    const b = pink(n, rand);
    filter(b, sr, 'hp', lo); filter(b, sr, 'hp', lo);
    filter(b, sr, 'lp', hi); filter(b, sr, 'lp', hi);
    const env = dbEnvelope(n, sr, pts);
    for (let i = 0; i < n; i++) body[i] += b[i] * env[i] * gain;
  }

  // 3. crackle: many short grains, dense at first and thinning out
  let g = T0 + 0.003;
  while (g < 0.9) {
    const len = Math.floor(sr * (0.0015 + rand() * 0.004));
    const grain = noise(len, rand);
    { let a = 1; const dec = Math.exp(-4 / len); for (let i = 0; i < len; i++) { grain[i] *= a; a *= dec; } }
    filter(grain, sr, 'bp', 600 * Math.pow(12, rand()), 0.8 + rand() * 2);
    const level = Math.pow(10, (-(g - T0) * 28 - rand() * 10) / 20);
    mixInto(body, grain, Math.round(g * sr), 2.6 * level);
    g += 0.010 + rand() * 0.030 + (g - T0) * 0.05;
  }
  // a few bigger pops through the tail
  for (const [at, lv, f] of [[0.19, 0.28, 3000], [0.2, 0.42, 2500], [0.28, 0.45, 6500], [0.47, 0.4, 1800], [0.59, 0.3, 3000], [0.745, 0.2, 1200], [0.85, 0.15, 2200]]) {
    const len = Math.floor(sr * 0.012);
    const p = noise(len, rand);
    { let a = 1; const dec = Math.exp(-1 / (sr * 0.0025)); for (let i = 0; i < len; i++) { p[i] *= a; a *= dec; } }
    filter(p, sr, 'bp', f, 1.2);
    mixInto(body, p, Math.round(at * sr), lv * 3);
  }
  for (let k = 0; k < 4; k++) filter(body, sr, 'lp', 9600, k % 2 ? 1.31 : 0.54);
  for (let i = 0; i < n; i++) out[i] += body[i];

  // 4. the low thump that gives it weight (50-80 Hz, fading over ~0.35 s)
  const t0i = Math.round(T0 * sr), tend = Math.min(n, t0i + Math.round(0.45 * sr));
  let x = 1, y = 0, c = 1, sn = 0, e = 1;
  const dec = Math.exp(-1 / (sr * 0.12)), rise = Math.exp(-1 / (sr * 0.012));
  let up = 1;
  for (let i = t0i; i < tend; i++) {
    const k = i - t0i;
    if ((k & 31) === 0) {
      const f = 50 + 30 * Math.exp(-k / (sr * 0.05)), w = (2 * Math.PI * f) / sr;
      c = Math.cos(w); sn = Math.sin(w);
    }
    const ny = x * sn + y * c; x = x * c - y * sn; y = ny;
    out[i] += 0.14 * y * (1 - up) * e;
    e *= dec; up *= rise;
  }

  // 5. shape the whole burst to the original's loudness curve: it starts almost silent, swells to
  //    its peak around 80 ms, then settles a few dB lower through the tail. (Derived by comparing
  //    5 ms RMS envelopes of this synth against the reference recording and taking the trend.)
  const shape = dbEnvelope(n, sr, [[0, -14], [0.02, -10], [0.035, -4], [0.06, -2.5], [0.08, -2],
    [0.12, -3.5], [0.18, -4.5], [0.25, -3], [0.35, -2], [0.45, -3.5], [0.55, -4], [0.65, -6], [0.8, -5], [0.95, -5]]);
  for (let i = 0; i < n; i++) out[i] *= shape[i];

  // hard stop like the original, with a 6 ms fade to avoid a click
  const end = Math.round(0.93 * sr), fade = Math.round(0.006 * sr);
  for (let i = end; i < n; i++) out[i] *= Math.max(0, 1 - (i - end) / fade);
  normalize(out, 1);
  saturate(out, 2.1);
  return normalize(out, LEVEL.clear);
}

// -------------------------------------------------------------------------------------- slide

/** Not in the original (dragging is silent there): a very soft, low tick per step. */
export function slide(sr) {
  const rand = rng(3);
  const out = new Float32Array(Math.floor(sr * 0.03));
  for (let i = 0; i < out.length; i++) out[i] = (rand() * 2 - 1) * Math.exp(-i / (sr * 0.002));
  filter(out, sr, 'bp', 700, 3);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * 160) / sr;
    out[i] += 0.1 * Math.sin(ph) * Math.exp(-t / 0.006);
  }
  return normalize(out, LEVEL.slide);
}

// ------------------------------------------------------------------------- combo bell & tunes

/** Soft, low bell for combos (the original has no combo sound, so this stays in the background). */
export function bell(sr, freq, dur = 0.4, vol = 0.13) {
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const partials = [[1, 1, 0.22], [2, 0.18, 0.1], [3.01, 0.05, 0.05]];
  const att = 0.004 * sr;
  for (const [m, g, tau] of partials) {
    const w = (2 * Math.PI * freq * m) / sr, c = Math.cos(w), sn = Math.sin(w);
    const dec = Math.exp(-1 / (sr * tau));
    let x = 1, y = 0, e = g;
    for (let i = 0; i < n; i++) {
      const ny = x * sn + y * c; x = x * c - y * sn; y = ny;
      out[i] += e * y * (i < att ? i / att : 1);
      e *= dec;
    }
  }
  return normalize(out, vol);
}

/** Pentatonic steps (semitones) the combo bell climbs through, from C5. */
export const COMBO_STEPS = [0, 2, 4, 7, 9, 12];
export const COMBO_BASE = 523.25;

export function tones(sr, notes, wave, volume) {
  const total = notes.reduce((n, [, d]) => n + Math.floor(d * sr), 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const [freq, dur] of notes) {
    const n = Math.floor(dur * sr);
    const w = (2 * Math.PI * freq) / sr, c = Math.cos(w), sn = Math.sin(w);
    let x = 1, y = 0;
    const att = 0.004 * sr;
    for (let i = 0; i < n; i++) {
      const ny = x * sn + y * c; x = x * c - y * sn; y = ny;
      // triangle from the same oscillator: fold the sine's phase quadrants
      // the resonator can drift a hair past ±1, and asin() of that is NaN
      const v = wave === 'sine' ? y : (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, y)));
      const u = 1 - i / n;
      out[o++] = v * Math.min(1, i / att) * u * u * Math.sqrt(Math.sqrt(u * u * u)) * volume;
    }
  }
  return out;
}

export const shuffle = sr => tones(sr, [[523, 0.05], [659, 0.05], [784, 0.05], [659, 0.05], [784, 0.08]], 'sine', 0.4);
export const lose = sr => tones(sr, [[392, 0.16], [330, 0.16], [262, 0.16], [196, 0.4]], 'triangle', 0.45);
export const win = sr => tones(sr, [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], 'triangle', 0.5);

/** Every named effect, for sound.play(name). */
export const SFX = { tap, fail, clear, slide, shuffle, win, lose };
