// The moment a puzzle piece is won. The board lifts out of the result card into the middle of a
// darkened screen, the piece flies in from the prize that paid it, turning and casting a shadow
// as if held above the table, settles into its slot with a click and a burst of sparkles, and the
// board sinks back into the card. The last piece of a photo goes further: the seams melt away,
// light fans out behind it and hearts rain down.
//
// Everything is drawn on one canvas from pre-cut sprites (see Jigsaw in puzzle.js); the words are
// HTML on top. A tap hurries it along, and a second tap after the photo is revealed closes it.

import { PIECES, bitCount, jigsawFor } from './puzzle.js';
import { sound } from './sound.js';
import { L } from './i18n.js';

const ALL = (1 << PIECES) - 1;
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outBack: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
};
const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

/** The tray around the pieces, as a share of the board's shorter side. */
export const FRAME = 0.05;

/**
 * The board as she sees it: a rounded tray with the pieces she has in place, W×H being the photo
 * area in device pixels. `whole` draws the finished photo without seams.
 */
export function framedBoard(jig, W, H, mask, whole = false) {
  const P = Math.round(Math.min(W, H) * FRAME);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W + 2 * P); cv.height = Math.round(H + 2 * P);
  const ctx = cv.getContext('2d');
  const r = P * 1.6;
  ctx.beginPath();
  ctx.roundRect(0, 0, cv.width, cv.height, r);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#FBE7EF');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, P * 0.12);
  ctx.strokeStyle = 'rgba(200,120,150,0.35)';
  ctx.stroke();
  if (whole) ctx.drawImage(jig.picture(W, H), P, P, W, H);
  else jig.draw(ctx, P, P, W, H, mask);
  // the lip of the tray, casting a little shade on the pieces below it
  ctx.save();
  ctx.beginPath();
  ctx.rect(P, P, W, H);
  ctx.clip();
  ctx.shadowColor = 'rgba(90,30,60,0.35)';
  ctx.shadowBlur = P * 0.5;
  ctx.shadowOffsetY = P * 0.12;
  ctx.lineWidth = P;
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(P - P / 2, P - P / 2, W + P, H + P);
  ctx.restore();
  return { canvas: cv, pad: P };
}

// ---------------------------------------------------------------- particles

function sprite(size, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  paint(cv.getContext('2d'), size);
  return cv;
}
let SPRITES = null;
function sprites() {
  if (SPRITES) return SPRITES;
  const sparkle = color => sprite(64, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.18, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    const m = s / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, rr = i % 2 ? s * 0.1 : s * 0.5;
      c.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr);
    }
    c.fill();
  });
  const heart = color => sprite(64, (c, s) => {
    c.fillStyle = color;
    c.font = `${s * 0.9}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('♥', s / 2, s * 0.55);
  });
  const glow = sprite(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,190,220,0.9)'); g.addColorStop(0.4, 'rgba(255,120,180,0.35)'); g.addColorStop(1, 'rgba(255,120,180,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
  SPRITES = {
    sparkles: ['#FFE38A', '#FFFFFF', '#FFB3D9', '#FFD1A6'].map(sparkle),
    hearts: ['#FF5C9D', '#FF8FB8', '#FFD166', '#FFFFFF', '#E0447E'].map(heart),
    glow,
  };
  return SPRITES;
}

// ---------------------------------------------------------------- the scene

let current = null;

export const pieceScene = {
  get active() { return !!current; },

  /**
   * Plays the pieces in `result.added` going into the photo `result.photo`.
   * `from`: the canvas in the card the board lifts out of and returns to (or null: it appears in
   * the middle and fades away). `origin`: a DOMRect the pieces fly out of (the prize chip).
   * Resolves when it has finished and gone.
   */
  async play({ photo, before, added, completed }, { from = null, origin = null } = {}) {
    if (current || !added || !added.length) return;
    const scene = new Scene();
    current = scene;
    try {
      const jig = await jigsawFor(photo);
      await scene.run(jig, { before, added, completed }, from, origin);
    } finally {
      scene.remove();
      current = null;
    }
  },
};

class Scene {
  constructor() {
    this.layer = h('div', 'piece-scene');
    this.canvas = h('canvas');
    this.title = h('div', 'ps-title');
    this.sub = h('div', 'ps-sub');
    this.count = h('div', 'ps-count');
    this.tap = h('div', 'ps-tap', L.tapToContinue());
    this.layer.append(this.canvas, this.title, this.sub, this.count, this.tap);
    document.body.append(this.layer);
    this.particles = [];
    this.ripples = [];
    this.flashes = [];
    this.taps = 0;
    this.layer.addEventListener('pointerdown', e => { e.preventDefault(); this.taps++; this.onTap?.(); });
  }

  remove() { this.layer.remove(); }

  run(jig, { before, added, completed }, from, origin) {
    return new Promise(resolve => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vw = window.innerWidth, vh = window.innerHeight;
      const cv = this.canvas;
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      const ctx = cv.getContext('2d');
      const S = sprites();

      // the board in the middle of the screen, in device pixels
      const fit = jig.fit(Math.min(vw * 0.84, 440) * dpr, Math.min(vh * 0.54, 560) * dpr);
      const W = Math.round(fit.w), H = Math.round(fit.h);
      let board = framedBoard(jig, W, H, before);
      const P = board.pad, BW = board.canvas.width, BH = board.canvas.height;
      const home = { x: (cv.width - BW) / 2, y: cv.height * 0.47 - BH / 2 };
      const cardRect = from ? from.getBoundingClientRect() : null;
      const start = cardRect && cardRect.width > 0
        ? { x: cardRect.left * dpr, y: cardRect.top * dpr, k: (cardRect.width * dpr) / BW }
        : null;
      const shadow = document.createElement('canvas');
      shadow.width = BW + 160 * dpr; shadow.height = BH + 160 * dpr;
      {
        const s = shadow.getContext('2d');
        s.shadowColor = 'rgba(20,0,20,0.6)';
        s.shadowBlur = 40 * dpr;
        s.shadowOffsetY = 18 * dpr;
        s.shadowOffsetX = shadow.width;
        s.beginPath();
        s.roundRect(80 * dpr - shadow.width, 80 * dpr, BW, BH, P * 1.6);
        s.fill();
      }

      // where each piece is going, and when
      const n = added.length;
      const T_RISE = start ? 0.62 : 0.5;
      const flights = [];
      let t0 = T_RISE + 0.12;
      let mask = before;
      added.forEach((piece, j) => {
        const dur = Math.max(0.5, 1.0 * Math.pow(0.84, j));
        mask |= 1 << piece;
        flights.push({
          piece, j, start: t0, dur, land: t0 + dur, mask, landed: false,
          spin: (j % 2 ? 1 : -1) * (0.55 + ((piece * 7919) % 100) / 190),
          side: j % 2 ? -1 : 1,
        });
        t0 += n > 3 ? Math.max(0.24, dur * 0.5) : dur + 0.45;
      });
      const lastLand = flights[n - 1].land;
      const T_DONE = lastLand + (completed ? 0.45 : 0.3);
      const HOLD = 1.35; // seconds the finished board rests before sinking back
      const cell = i => {
        const c = jig.cell(i, W, H);
        return { ...c, cx: P + c.x + c.w / 2, cy: P + c.y + c.h / 2 };
      };
      const src = origin
        ? { x: (origin.left + origin.width / 2) * dpr, y: (origin.top + origin.height / 2) * dpr }
        : { x: cv.width / 2, y: cv.height + 80 * dpr };

      let t = 0, last = performance.now(), leaving = null, frameId = 0;
      let shownMask = before, whole = false;

      // a tap hurries the pieces in; once it's all in, a tap closes it
      this.onTap = () => {
        if (leaving !== null) return;
        if (t < lastLand) {
          t = lastLand - 0.001;
          for (const f of flights) if (f.land < t) f.landed = true;
        } else if (!completed || t > T_DONE + 1.0) {
          leaving = t;
        }
      };

      const boardAt = time => {
        if (!start) {
          const e = ease.outBack(clamp01(time / T_RISE));
          return { x: home.x + (BW * (1 - lerp(0.85, 1, e))) / 2, y: home.y + (BH * (1 - lerp(0.85, 1, e))) / 2, k: lerp(0.85, 1, e), a: clamp01(time / (T_RISE * 0.6)) };
        }
        const e = ease.inOut(clamp01(time / T_RISE));
        return { x: lerp(start.x, home.x, e), y: lerp(start.y, home.y, e), k: lerp(start.k, 1, e), a: 1 };
      };

      const snap = f => {
        f.landed = true;
        const c = cell(f.piece);
        const x = home.x + c.cx, y = home.y + c.cy;
        sound.snapPiece(bitCount(f.mask) - 1);
        sound.buzz(14);
        this.flashes.push({ piece: f.piece, t: t });
        this.ripples.push({ x, y, t: t, r: c.s });
        this.punch = t;
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 340) * dpr;
          this.particles.push({
            x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * dpr, g: 520 * dpr, drag: 2.4,
            life: 0.7 + Math.random() * 0.6, age: 0, size: (10 + Math.random() * 16) * dpr,
            img: Math.random() < 0.3 ? S.hearts[i % S.hearts.length] : S.sparkles[i % S.sparkles.length],
            rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
          });
        }
        this.count.textContent = L.puzzleCount(bitCount(f.mask));
        this.count.classList.remove('bump');
        void this.count.offsetWidth;
        this.count.classList.add('bump');
      };

      const frame = nowMs => {
        const dt = Math.min(0.05, (nowMs - last) / 1000);
        last = nowMs;
        t += dt;

        for (const f of flights) if (!f.landed && t >= f.land) snap(f);
        const m = flights.reduce((acc, f) => (f.landed ? acc | (1 << f.piece) : acc), before);
        if (m !== shownMask) { shownMask = m; board = framedBoard(jig, W, H, m); }

        // the finished photo: seams melt, then the words
        if (completed && t >= T_DONE && !this.revealed) {
          this.revealed = true;
          sound.revealPhoto();
          this.title.textContent = L.photoUnlockedTitle();
          this.sub.textContent = L.addedToAlbum();
          this.layer.classList.add('revealed');
        }
        if (completed && !whole && t >= T_DONE + 0.9) { whole = true; board = framedBoard(jig, W, H, ALL, true); }
        if (t >= lastLand + 0.25 && !this.counted) {
          this.counted = true;
          this.layer.classList.add('counted');
        }
        if (!completed && leaving === null && t >= T_DONE + HOLD) leaving = t;
        if (t > T_DONE + 1.6) this.layer.classList.add('can-close');

        // leaving: back into the card (or away), backdrop fading
        const out = leaving === null ? 0 : clamp01((t - leaving) / 0.55);
        if (out >= 1) { cancelAnimationFrame(frameId); resolve(); return; }
        if (leaving !== null) this.layer.classList.add('leaving');

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        const rise = clamp01(t / T_RISE);
        const bg = ease.out(rise) * (1 - ease.inOut(out));
        ctx.fillStyle = `rgba(28,6,30,${0.82 * bg})`;
        ctx.fillRect(0, 0, cv.width, cv.height);

        // where the board is now
        let b = boardAt(t);
        if (out > 0) {
          const e = ease.inOut(out);
          if (start && !completed) b = { x: lerp(home.x, start.x, e), y: lerp(home.y, start.y, e), k: lerp(1, start.k, e), a: 1 };
          else b = { x: home.x + (BW * e * 0.06), y: home.y + (BH * e * 0.06) + e * 30 * dpr, k: 1 - e * 0.12, a: 1 - e };
        }
        // a small jolt when a piece clicks in
        if (this.punch !== undefined && out === 0) {
          const p = clamp01((t - this.punch) / 0.3);
          const k = 1 + 0.02 * Math.sin(Math.PI * p) * (1 - p);
          b = { ...b, x: b.x - (BW * (k - 1)) / 2, y: b.y - (BH * (k - 1)) / 2, k: b.k * k };
        }
        const cx = b.x + (BW * b.k) / 2, cy = b.y + (BH * b.k) / 2;

        // a pink glow behind the board, and for a finished photo, slow rays of light
        ctx.globalAlpha = 0.55 * bg;
        const gs = Math.max(BW, BH) * 2.1 * b.k;
        ctx.drawImage(S.glow, cx - gs / 2, cy - gs / 2, gs, gs);
        if (completed && t > T_DONE) {
          const r = t - T_DONE;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(r * 0.18);
          ctx.globalAlpha = clamp01(r / 1.2) * 0.3 * (1 - out);
          const len = Math.hypot(cv.width, cv.height);
          const rays = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.6);
          rays.addColorStop(0, 'rgba(255,236,170,0.95)'); rays.addColorStop(1, 'rgba(255,200,230,0)');
          ctx.fillStyle = rays;
          for (let i = 0; i < 14; i++) {
            ctx.rotate((Math.PI * 2) / 14);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(len, -len * 0.09);
            ctx.lineTo(len, len * 0.09);
            ctx.fill();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        // the board, and the shadow it floats on
        const lift = completed && t > T_DONE ? ease.out(clamp01((t - T_DONE) / 1.1)) : 0;
        ctx.save();
        ctx.globalAlpha = b.a;
        if (lift) {
          ctx.translate(cx, cy);
          ctx.rotate(-0.025 * lift);
          ctx.scale(1 + 0.04 * lift, 1 + 0.04 * lift);
          ctx.translate(-cx, -cy);
        }
        ctx.globalAlpha = b.a * (0.5 + 0.5 * rise);
        ctx.drawImage(shadow, b.x - 80 * dpr * b.k, b.y - 80 * dpr * b.k, shadow.width * b.k, shadow.height * b.k);
        ctx.globalAlpha = b.a;
        ctx.drawImage(board.canvas, b.x, b.y, BW * b.k, BH * b.k);

        // the seams melting into one photo
        if (completed && t > T_DONE && !whole) {
          ctx.globalAlpha = b.a * ease.inOut(clamp01((t - T_DONE) / 0.9));
          ctx.drawImage(jig.picture(W, H), b.x + P * b.k, b.y + P * b.k, W * b.k, H * b.k);
          ctx.globalAlpha = b.a;
        }
        // a band of golden light across the finished photo
        if (completed && t > T_DONE + 0.35) {
          const p = clamp01((t - T_DONE - 0.35) / 1.2);
          if (p < 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x + P * b.k, b.y + P * b.k, W * b.k, H * b.k);
            ctx.clip();
            const span = (W + H) * b.k;
            const x0 = b.x - span * 0.3 + p * span * 1.6;
            const band = ctx.createLinearGradient(x0, b.y, x0 + span * 0.35, b.y + span * 0.2);
            band.addColorStop(0, 'rgba(255,240,200,0)'); band.addColorStop(0.5, 'rgba(255,245,215,0.55)'); band.addColorStop(1, 'rgba(255,240,200,0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = band;
            ctx.fillRect(b.x, b.y, BW * b.k, BH * b.k);
            ctx.restore();
          }
        }
        ctx.restore();

        // just-landed pieces flash and a shine runs across them
        for (const fl of this.flashes) {
          const p = (t - fl.t) / 0.6;
          if (p < 0 || p > 1 || out > 0) continue;
          const sp = jig.sprite(fl.piece, W, H);
          ctx.save();
          ctx.translate(b.x + P * b.k, b.y + P * b.k);
          ctx.scale(b.k, b.k);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - p) * 0.55;
          ctx.drawImage(sp.canvas, sp.ox, sp.oy);
          ctx.globalAlpha = 1;
          ctx.clip(jig.path(fl.piece, W, H));
          const c = jig.cell(fl.piece, W, H);
          const x0 = c.x - c.w + p * c.w * 3;
          const band = ctx.createLinearGradient(x0, c.y, x0 + c.w * 0.6, c.y + c.h * 0.5);
          band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.7)'); band.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = band;
          ctx.fillRect(c.x - c.m, c.y - c.m, c.w + 2 * c.m, c.h + 2 * c.m);
          ctx.restore();
        }
        this.flashes = this.flashes.filter(fl => t - fl.t < 0.6);

        // rings spreading out from each click
        for (const rp of this.ripples) {
          const p = (t - rp.t) / 0.75;
          if (p < 0 || p > 1) continue;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.r * (0.4 + ease.out(p) * 1.5), 0, Math.PI * 2);
          ctx.lineWidth = (1 - p) * 6 * dpr;
          ctx.strokeStyle = `rgba(255,236,190,${(1 - p) * 0.85})`;
          ctx.stroke();
        }
        this.ripples = this.ripples.filter(rp => t - rp.t < 0.75);

        // the pieces in the air
        for (const f of flights) {
          if (f.landed || t < f.start) continue;
          const u = clamp01((t - f.start) / f.dur);
          const c = cell(f.piece);
          const tx = home.x + c.cx, ty = home.y + c.cy;
          const hover = { x: tx, y: ty - c.s * 0.28 };
          const FLY = 0.7;
          let x, y, sc, rot;
          if (u < FLY) {
            const p = ease.inOut(u / FLY);
            // a curve that swings out to one side and over the top
            const qx = lerp(src.x, hover.x, 0.5) + f.side * cv.width * 0.28, qy = Math.min(src.y, hover.y) - cv.height * 0.12;
            x = (1 - p) * (1 - p) * src.x + 2 * (1 - p) * p * qx + p * p * hover.x;
            y = (1 - p) * (1 - p) * src.y + 2 * (1 - p) * p * qy + p * p * hover.y;
            const q = ease.out(u / FLY);
            sc = lerp(0.3, 1.32, q);
            rot = lerp(f.spin * 2.2, f.spin * 0.12, q) + Math.sin(u * 14) * 0.03 * (1 - q);
            if (Math.random() < 0.8) {
              this.particles.push({
                x: x + (Math.random() - 0.5) * c.s * 0.5, y: y + (Math.random() - 0.5) * c.s * 0.5,
                vx: (Math.random() - 0.5) * 60 * dpr, vy: (Math.random() - 0.2) * 60 * dpr, g: 40 * dpr, drag: 1,
                life: 0.5 + Math.random() * 0.4, age: 0, size: (6 + Math.random() * 10) * dpr,
                img: S.sparkles[Math.floor(Math.random() * S.sparkles.length)], rot: 0, vr: 3,
              });
            }
          } else {
            const p = (u - FLY) / (1 - FLY);
            const e = ease.in(p);
            x = lerp(hover.x, tx, e);
            y = lerp(hover.y, ty, e);
            sc = lerp(1.32, 1, e);
            rot = lerp(f.spin * 0.12, 0, ease.out(p));
          }

          // its slot breathes a soft light while it's on its way
          ctx.save();
          ctx.translate(home.x + P, home.y + P);
          ctx.shadowColor = 'rgba(255,230,160,0.95)';
          ctx.shadowBlur = 16 * dpr;
          ctx.lineWidth = 3 * dpr;
          ctx.strokeStyle = `rgba(255,244,210,${0.45 + 0.4 * Math.sin(t * 9)})`;
          ctx.stroke(jig.path(f.piece, W, H));
          ctx.restore();

          // the shadow drops away as the piece is lifted
          const height = Math.max(0, sc - 1);
          const sh = jig.shadow(f.piece, W, H), sp = jig.sprite(f.piece, W, H);
          ctx.save();
          ctx.translate(x + height * c.s * 0.9, y + height * c.s * 1.3);
          ctx.rotate(rot);
          ctx.scale(sc * 1.04, sc * 1.04);
          ctx.globalAlpha = clamp01(0.35 + height * 1.2) * clamp01(u * 4);
          ctx.drawImage(sh.canvas, sh.ox - c.x - c.w / 2, sh.oy - c.y - c.h / 2);
          ctx.restore();
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.scale(sc, sc);
          ctx.globalAlpha = clamp01(u * 6);
          ctx.drawImage(sp.canvas, sp.ox - c.x - c.w / 2, sp.oy - c.y - c.h / 2);
          ctx.restore();
        }

        // hearts raining down on a finished photo
        if (completed && t > T_DONE + 0.2 && t < T_DONE + 3.2 && out === 0) {
          const rate = 30 * dt;
          for (let i = 0; i < rate || Math.random() < rate - i; i++) {
            this.particles.push({
              x: Math.random() * cv.width, y: -30 * dpr, vx: (Math.random() - 0.5) * 80 * dpr, vy: (80 + Math.random() * 160) * dpr,
              g: 60 * dpr, drag: 0.2, life: 3.2, age: 0, size: (14 + Math.random() * 22) * dpr,
              img: S.hearts[Math.floor(Math.random() * S.hearts.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, sway: Math.random() * 6,
            });
          }
        }

        for (const p of this.particles) {
          p.age += dt;
          p.vx *= Math.exp(-p.drag * dt);
          p.vy = p.vy * Math.exp(-p.drag * dt) + p.g * dt;
          p.x += p.vx * dt + (p.sway ? Math.sin(p.age * 3 + p.sway) * 40 * dpr * dt : 0);
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          const life = 1 - p.age / p.life;
          if (life <= 0) continue;
          ctx.save();
          ctx.globalAlpha = Math.min(1, life * 2) * (1 - out);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
        this.particles = this.particles.filter(p => p.age < p.life && p.y < cv.height + 60 * dpr);

        frameId = requestAnimationFrame(frame);
      };

      // words sit above and below the board
      const top = home.y / dpr, bottom = (home.y + BH) / dpr;
      this.title.style.top = `${Math.max(12, top - 78)}px`;
      this.sub.style.top = `${Math.max(52, top - 36)}px`;
      this.count.style.top = `${bottom + 16}px`;
      this.count.textContent = L.puzzleCount(bitCount(before));
      if (from) from.style.visibility = 'hidden';
      requestAnimationFrame(() => this.layer.classList.add('show'));
      frameId = requestAnimationFrame(frame);
    }).finally(() => {
      if (from) from.style.visibility = '';
    });
  }
}
