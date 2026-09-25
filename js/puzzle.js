// The photo puzzle: every cleared level (and every daily star) earns a piece of one of our photos,
// and twelve pieces unlock it into the album for good.
//
// Photos are remembered by the start of their file name, not by their place in the list, so adding
// new photos later never shuffles which ones she has already unlocked.
//
// The pieces are real jigsaw pieces cut from the whole photo at its own shape: a portrait photo is
// cut 3 across and 4 down, a landscape one 4 by 3, so nothing is cropped or stretched and on a
// phone photo every piece comes out square. The knobs are dealt from the photo's id, so a photo
// is always cut the same way.

import { store } from './store.js';
import { photos } from './photos.js';
import { random, hashSeed } from './board.js';
import { fillHeart } from './icons.js';

export const PIECES = 12;
const ALL = (1 << PIECES) - 1;
const idOf = entry => entry.f.slice(0, 8);
export const bitCount = m => { let n = 0; for (; m; m >>= 1) n += m & 1; return n; };

export const puzzle = {
  /** Ids of the photos she has unlocked, oldest first. */
  get album() {
    const list = store.json('puzzle.album');
    return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
  },

  /** Bitmask of the pieces she holds of the current photo. */
  get pieces() { return store.int('puzzle.pieces') & ALL; },

  get count() { return bitCount(this.pieces); },

  /** The photo being collected: the one saved, else the first she hasn't unlocked yet. */
  get current() {
    const saved = localStorage.getItem('puzzle.photo');
    if (saved) return saved;
    const album = this.album;
    const next = photos.entries.find(e => !album.includes(idOf(e)));
    // every photo unlocked: start round again from the first
    return next ? idOf(next) : photos.entries.length ? idOf(photos.entries[album.length % photos.entries.length]) : 'none';
  },

  /**
   * Adds `n` random pieces. Returns what happened for the result screen:
   * { photo, before, after, added: [piece...], completed: bool } for the photo the pieces went to
   * first, and `more` for pieces that spilled over into the next photo.
   */
  award(n) {
    if (n <= 0) return null;
    const photo = this.current;
    const before = this.pieces;
    let mask = before;
    const added = [];
    while (added.length < n && mask !== ALL) {
      const missing = [];
      for (let i = 0; i < PIECES; i++) if (!(mask & (1 << i))) missing.push(i);
      const pick = missing[Math.floor(random() * missing.length)];
      mask |= 1 << pick;
      added.push(pick);
    }
    const out = { photo, before, after: mask, added, completed: mask === ALL, more: 0 };
    if (out.completed) {
      const album = this.album;
      if (!album.includes(photo)) album.push(photo);
      store.set('puzzle.album', album);
      store.set('puzzle.pieces', 0);
      store.remove('puzzle.photo');
      const spill = n - added.length;
      if (spill > 0) {
        this.award(spill);
        out.more = spill;
      }
    } else {
      store.set('puzzle.pieces', mask);
      store.set('puzzle.photo', photo);
    }
    return out;
  },
};

/** The photo with this id, decoded (an Image on a blob: URL the caller revokes), or null. */
export async function loadPhoto(id) {
  await photos.loaded;
  if (!photos.available) return null;
  const entry = photos.entries.find(e => idOf(e) === id);
  if (!entry) return null;
  try { return await photos.load(entry, false); } catch { return null; }
}

// ---------------------------------------------------------------- cutting the pieces

/** Ways to cut twelve pieces; the one whose pieces come out squarest for the photo wins. */
const LAYOUTS = [[2, 6], [3, 4], [4, 3], [6, 2]];
const TAB = 0.1; // knob size, as a share of the piece
const JITTER = 0.04;

function layoutFor(aspect) {
  let best = LAYOUTS[1], score = Infinity;
  for (const [c, r] of LAYOUTS) {
    const s = Math.abs(Math.log((aspect / c) * r));
    if (s < score) { score = s; best = [c, r]; }
  }
  return best;
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The ten points of one knobbed edge from (x0,y0) to (x1,y1): a start, three cubic curves.
 * The shape is the classic one (a neck, a round head) with a little jitter so no two match.
 */
function edgePoints(x0, y0, x1, y1, s, e) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const nx = -uy * e.sign, ny = ux * e.sign;
  const P = (u, v) => [x0 + ux * u + nx * v * s, y0 + uy * u + ny * v * s];
  const k = x => L / 2 + s * (x - 0.5);
  const t = TAB, { a, b, c, d } = e;
  return [
    P(0, 0), P(0.2 * L, a), P(k(0.5 + b + d), -t + c), P(k(0.5 - t + b), t + c),
    P(k(0.5 - 2 * t + b - d), 3 * t + c), P(k(0.5 + 2 * t + b - d), 3 * t + c), P(k(0.5 + t + b), t + c),
    P(k(0.5 + b + d), -t + c), P(0.8 * L, e.e), P(L, 0),
  ];
}

function follow(path, pts, backwards) {
  const p = backwards ? pts.slice().reverse() : pts;
  for (let i = 1; i < 10; i += 3) path.bezierCurveTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], p[i + 2][0], p[i + 2][1]);
}

/**
 * One photo cut into pieces, drawn at any size. `img` may be null (no photo key on this phone, or
 * still loading): the pieces are then a soft pink with hearts, so it still looks like a puzzle.
 */
export class Jigsaw {
  constructor(id, img) {
    this.id = id;
    this.img = img;
    this.aspect = img ? img.naturalWidth / img.naturalHeight : 3 / 4;
    [this.cols, this.rows] = layoutFor(this.aspect);
    const rnd = prng(hashSeed('jigsaw' + id));
    const edge = () => ({
      sign: rnd() < 0.5 ? -1 : 1,
      a: (rnd() * 2 - 1) * JITTER, b: (rnd() * 2 - 1) * JITTER, c: (rnd() * 2 - 1) * JITTER,
      d: (rnd() * 2 - 1) * JITTER, e: (rnd() * 2 - 1) * JITTER,
    });
    // across[r][c]: the edge along the top of row r; down[r][c]: the edge down the left of column c
    this.across = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, edge));
    this.down = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, edge));
    this.cache = new Map();
  }

  /** The largest size that fits in w×h at the photo's own shape. */
  fit(w, h) {
    return this.aspect > w / h ? { w, h: w / this.aspect } : { w: h * this.aspect, h };
  }

  cell(i, W, H) {
    const pw = W / this.cols, ph = H / this.rows;
    const c = i % this.cols, r = Math.floor(i / this.cols);
    return { x: c * pw, y: r * ph, w: pw, h: ph, c, r, s: Math.min(pw, ph), m: Math.min(pw, ph) * 0.38 };
  }

  /** The outline of piece `i` on a W×H board, as a Path2D in board pixels. */
  path(i, W, H) {
    const { x, y, w, h, c, r, s } = this.cell(i, W, H);
    const p = new Path2D();
    p.moveTo(x, y);
    if (r === 0) p.lineTo(x + w, y); else follow(p, edgePoints(x, y, x + w, y, s, this.across[r][c]), false);
    if (c === this.cols - 1) p.lineTo(x + w, y + h); else follow(p, edgePoints(x + w, y, x + w, y + h, s, this.down[r][c + 1]), false);
    if (r === this.rows - 1) p.lineTo(x, y + h); else follow(p, edgePoints(x, y + h, x + w, y + h, s, this.across[r + 1][c]), true);
    if (c === 0) p.closePath(); else { follow(p, edgePoints(x, y, x, y + h, s, this.down[r][c]), true); p.closePath(); }
    return p;
  }

  /** The photo (or the pink stand-in) scaled to the board, drawn once per size. */
  picture(W, H) {
    const key = `pic${W}x${H}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W); cv.height = Math.round(H);
    const ctx = cv.getContext('2d');
    if (this.img) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.img, 0, 0, cv.width, cv.height);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#FFD6E7'); g.addColorStop(0.5, '#FFB3D1'); g.addColorStop(1, '#FFC9A8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const rnd = prng(hashSeed('hearts' + this.id));
      const size = Math.min(W, H) / 7;
      for (let i = 0; i < 14; i++) fillHeart(ctx, rnd() * W, rnd() * H, size * 0.3);
    }
    this.cache.set(key, cv);
    return cv;
  }

  /**
   * Piece `i` cut out on its own canvas, with a bevel so it reads as a thick piece of card.
   * Returns { canvas, ox, oy } where (ox, oy) is where its corner sits on the board.
   */
  sprite(i, W, H) {
    const key = `p${i}:${W}x${H}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const { x, y, w, h, m, s } = this.cell(i, W, H);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w + 2 * m); cv.height = Math.ceil(h + 2 * m);
    const ctx = cv.getContext('2d');
    ctx.translate(m - x, m - y);
    const path = this.path(i, W, H);
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(this.picture(W, H), 0, 0);
    const k = Math.max(1, s * 0.022);
    ctx.lineWidth = k * 2.4;
    ctx.translate(k, k);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke(path);
    ctx.translate(-2 * k, -2 * k);
    ctx.strokeStyle = 'rgba(60,20,40,0.38)';
    ctx.stroke(path);
    ctx.restore();
    ctx.lineWidth = Math.max(0.6, k * 0.5);
    ctx.strokeStyle = 'rgba(70,30,50,0.35)';
    ctx.stroke(path);
    const out = { canvas: cv, ox: x - m, oy: y - m };
    this.cache.set(key, out);
    return out;
  }

  /** A soft dark silhouette of piece `i`, for the shadow it casts while it's in the air. */
  shadow(i, W, H) {
    const key = `s${i}:${W}x${H}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const { x, y, w, h, m, s } = this.cell(i, W, H);
    const blur = s * 0.12, pad = m + blur * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w + 2 * pad); cv.height = Math.ceil(h + 2 * pad);
    const ctx = cv.getContext('2d');
    // the shape is drawn far off the canvas and only its blurred shadow lands on it
    const off = cv.width + 50;
    ctx.translate(pad - x - off, pad - y);
    ctx.shadowColor = 'rgba(40,0,30,0.55)';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = off;
    ctx.fillStyle = '#000';
    ctx.fill(this.path(i, W, H));
    const out = { canvas: cv, ox: x - pad, oy: y - pad };
    this.cache.set(key, out);
    return out;
  }

  /** The empty board: a tray with the cuts pressed into it, for pieces not yet found. */
  tray(W, H) {
    const key = `tray${W}x${H}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W); cv.height = Math.ceil(H);
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F6E3EA'); g.addColorStop(1, '#EBCFDA');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / this.cols, H / this.rows);
    const k = Math.max(0.8, s * 0.014);
    ctx.lineWidth = k * 1.6;
    for (let i = 0; i < PIECES; i++) {
      const p = this.path(i, W, H);
      ctx.save(); ctx.translate(0, k); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(p); ctx.restore();
      ctx.strokeStyle = 'rgba(150,80,110,0.35)';
      ctx.stroke(p);
      // a faint heart where each piece will go
      const c = this.cell(i, W, H);
      ctx.fillStyle = 'rgba(214,120,160,0.22)';
      fillHeart(ctx, c.x + c.w / 2, c.y + c.h / 2, c.s * 0.11);
    }
    this.cache.set(key, cv);
    return cv;
  }

  /** The board with the pieces in `mask` in place, at (x, y) in `ctx`, W×H. */
  draw(ctx, x, y, W, H, mask, skip = -1) {
    ctx.drawImage(this.tray(W, H), x, y, W, H);
    for (let i = 0; i < PIECES; i++) {
      if (!(mask & (1 << i)) || i === skip) continue;
      const sp = this.sprite(i, W, H);
      ctx.drawImage(sp.canvas, x + sp.ox, y + sp.oy);
    }
  }
}

/** Jigsaws already cut, by photo id, so the album and the result screen share one. */
const cut = new Map();

/** The jigsaw for a photo, with the photo loaded (or null when it can't be). */
export async function jigsawFor(id) {
  if (cut.has(id)) return cut.get(id);
  const job = loadPhoto(id).then(img => new Jigsaw(id, img));
  cut.set(id, job);
  return job;
}
