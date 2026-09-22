// The game scene: layout, rendering, input, animation and rules flow (ported from GameScene.swift).
// Everything is drawn on one canvas from pre-rendered sprites; there is no per-frame text or path drawing.

import { Board, DIRS, RIGHT, DOWN, LEFT, UP, moved, samePos } from './board.js';
import * as Art from './art.js';
import { DPR } from './art.js';
import { sound } from './sound.js';
import { L } from './i18n.js';
import { store, Stats, savedMode } from './store.js';
import { VERSION } from './version.js';
import { photos } from './photos.js';
import * as report from './report.js';

// Board size per mode. Big was chosen by rendering 11×15 up to 14×20 on phone-sized screens: at
// 12×17 a tile is still ~30 pt on a standard iPhone (about the size of body-text emoji), and one
// more column or row is where icons start to blur together and taps land on the neighbour.
const GRIDS = { levels: [10, 14], challenge: [10, 14], big: [12, 17] };
// ?grid=13x18 on the local test server tries another size for the Big board
const GRID_TEST = location.hostname === 'localhost' && /^(\d+)x(\d+)$/.exec(new URLSearchParams(location.search).get('grid') ?? '');
if (GRID_TEST) GRIDS.big = [+GRID_TEST[1], +GRID_TEST[2]];
// Plain emoji only: no U+FE0F "emoji style" marker, which Safari mis-measures (the ⭐️ tile drew off-centre).
export const KINDS = ['🍩', '🍄', '🍱', '🍞', '🦪', '🐮', '🍦', '🔥', '🦉', '🦄', '🐰', '🥚',
  '🍉', '🍅', '🍚', '🐼', '🧁', '🍰', '🐱', '🐶', '🦊', '🐸', '🐧', '🐥',
  '🍓', '🍒', '🍑', '🍋', '🥑', '🌽', '🥕', '🍪', '🍭', '🌸', '🌻', '⭐',
  '🎀', '💎', '🧸', '🎈', '🍔', '🍟', '🍕', '🐙', '🦋', '🐝', '🐢', '🐳',
  // the Big board only: more tiles need more kinds, or every icon would show up six times
  '🍇', '🍍', '🥝', '🍌', '🐨', '🐷', '🐹', '🦔', '🍬', '🌈', '🌵', '🐞'];
// Levels and Challenge deal from the first 48, which is what their difficulty was tuned with.
const BASE_KINDS = 48;

// Challenge: tuned by simulation so a careless player wins about 1 in 4 games and a careful one
// who uses the second chance wins most of them.
const TOUCHING_SHARE = 0.1;
const START_HINTS = 3;
const START_SHUFFLES = 1;
// Levels: power-ups carry over and refill with a photo break.
const LEVELS_HINTS = 3;
const LEVELS_SHUFFLES = 3;

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;
const snap = v => Math.round(v * DPR) / DPR;
const dirName = d => (d.dc ? (d.dc > 0 ? 'right' : 'left') : d.dr > 0 ? 'down' : 'up');

// How long a shattered piece lives, and how long it stays solid before fading out.
const FRAG_LIFE = 0.62;
const FRAG_SOLID = 0.35;

const EASE = {
  linear: t => t,
  out: t => 1 - (1 - t) * (1 - t) * (1 - t),
  in: t => t * t * t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/** Piecewise-linear keyframes: [[duration, value], ...] from `start`. Returns null once finished. */
function segments(list, t, start = 0) {
  let v0 = start;
  for (const [d, v] of list) {
    if (t < d) return v0 + (v - v0) * (t / d);
    t -= d;
    v0 = v;
  }
  return null;
}

// Selected tiles shake like the original: a sharp kick that settles within ~0.3 s (measured at 30 fps
// from the reference video), repeated every SHAKE_EVERY seconds while they stay selected.
const SHAKE_EVERY = 0.9;
function shakeAngle(t) {
  t %= SHAKE_EVERY;
  if (t > 0.36) return 0;
  return 0.3 * Math.exp(-t / 0.1) * Math.sin(2 * Math.PI * 7 * t);
}
const TAP_POP = [[0.05, 1.14], [0.12, 1]];
const WOBBLE = [[0.05, 0.16], [0.08, -0.11], [0.06, 0.05], [0.05, 0]];
const PRESS = [[0.05, 0.9], [0.1, 1]];
const POP = [[0.07, 1.15], [0.12, 1]];
const GRANT_POP = [[0.12, 1.2], [0.15, 1]];

// ---------------------------------------------------------------- tweens

class Animator {
  constructor() { this.list = []; }

  to(target, props, dur, { ease = 'linear', delay = 0, key = null, done = null } = {}) {
    if (key) this.cancel(target, key);
    const tw = { target, props, dur: Math.max(dur, 1e-4), ease: EASE[ease], delay, key, done, from: null, t: 0, dead: false };
    // When this tween is finished with the target. The renderer uses it to tell a tile that is
    // being moved from one that is sitting still, so the resting-tile layer is not rebuilt for a
    // tile whose position is about to change again next frame.
    target.animT = Math.max(target.animT ?? 0, now() + delay + tw.dur);
    this.list.push(tw);
    return tw;
  }

  cancel(target, key = null) {
    for (const tw of this.list) if (tw.target === target && (key === null || tw.key === key)) tw.dead = true;
  }

  update(dt) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i];
      if (tw.dead) continue;
      tw.t += dt;
      if (tw.t < tw.delay) continue;
      if (!tw.from) {
        tw.from = {};
        for (const k in tw.props) tw.from[k] = tw.target[k];
      }
      const p = Math.min(1, (tw.t - tw.delay) / tw.dur);
      const e = tw.ease(p);
      for (const k in tw.props) tw.target[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (p >= 1) {
        tw.dead = true;
        if (tw.done) tw.done();
      }
    }
    if (list.length > 64) this.list = list.filter(tw => !tw.dead);
  }
}

// ---------------------------------------------------------------- game

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.anim = new Animator();
    this.timers = [];
    this.particles = [];
    this.particleOut = { x: 0, y: 0, rot: 0, scale: 1, alpha: 1 };
    this.frags = [];
    this.jx = 0;
    this.jy = 0;
    this.joltT0 = -1;
    this.raised = [];
    this.live = [];
    this.still = [];
    this.tiles = [];          // everything drawn, including tiles still animating away
    this.nodes = new Map();   // live tiles by id

    this.mode = savedMode();
    this.board = new Board(this.cols, this.rows);
    this.levelTileTotal = 0;
    this.selected = null;
    this.peerIds = [];
    this.hinted = [];
    this.hintArrow = null;
    this.drag = null;
    this.touchOrigin = null;
    this.pendingPair = null;
    this.touchStart = { x: 0, y: 0 };
    this.pointerId = null;
    this.busyUntil = 0;
    this.finishing = false;
    this.lostPending = false;
    this.combo = 0;
    this.lastMatch = -10;
    this.lastSparkle = { x: 0, y: 0 };
    this.tileAlpha = 1;
    this.toastSprite = null;
    this.comboFx = null;
    this.bands = null;
    this.girl = { x: 0, alpha: 1 };
    this.built = false;
    this.loadState();

    this.bindInput();
    this.last = now();
    const frame = () => {
      requestAnimationFrame(frame);
      try {
        this.frame();
      } catch (e) {
        report.crash(e);
        console.error(e);
      }
    };
    requestAnimationFrame(frame);
  }

  get busy() { return this.finishing || now() < this.busyUntil; }

  get cols() { return GRIDS[this.mode][0]; }
  get rows() { return GRIDS[this.mode][1]; }
  /** Levels and Big can't be lost: power-ups refill with a photo break and a stuck board reshuffles. */
  get relaxed() { return this.mode !== 'challenge'; }

  // ------------------------------------------------------------ state

  key(k) { return this.mode === 'challenge' ? k : this.mode + '.' + k; }

  loadState() {
    const levels = this.relaxed;
    this.hints = store.int(this.key('hints'), levels ? LEVELS_HINTS : START_HINTS);
    this.shuffles = store.int(this.key('shuffles'), levels ? LEVELS_SHUFFLES : START_SHUFFLES);
    this.secondChanceUsed = store.bool(this.key('secondChanceUsed'));
    this.score = store.int(this.key('score'));
    this.level = Math.max(1, store.int(this.key('level'), 1));
    this.lostPending = false;
    this.bestAtStart = Stats.best;
  }

  save() {
    store.set(this.key('hints'), this.hints);
    store.set(this.key('shuffles'), this.shuffles);
    store.set(this.key('secondChanceUsed'), this.secondChanceUsed);
    store.set(this.key('score'), this.score);
    store.set(this.key('level'), this.level);
  }

  saveBoard() {
    if (this.board.isEmpty) {
      store.remove(this.key('board'));
    } else {
      store.set(this.key('board'), this.board.snapshot());
      store.set(this.key('boardTotal'), this.levelTileTotal);
    }
  }

  /** Picks up a game that was in progress when the page was closed. */
  restoreBoard() {
    const saved = Board.fromSnapshot(this.cols, this.rows, store.json(this.key('board')));
    if (!saved) return false;
    this.board = saved;
    this.levelTileTotal = Math.max(store.int(this.key('boardTotal')), saved.tileCount);
    this.after(1.2, () => this.checkBoard(), 'check');
    return true;
  }

  // ------------------------------------------------------------ timers

  after(sec, fn, key = null) {
    if (key) this.cancelTimer(key);
    this.timers.push({ at: now() + sec, fn, key });
  }

  cancelTimer(key) { this.timers = this.timers.filter(t => t.key !== key); }

  // ------------------------------------------------------------ layout

  layout(width, height, safe) {
    const W = width, H = height;
    this.W = W;
    this.H = H;
    this.safe = safe;
    const COLS = this.cols, ROWS = this.rows;
    this.canvas.width = Math.round(W * DPR);
    this.canvas.height = Math.round(H * DPR);
    const s = (this.s = W / 592);
    const margin = 8 * s, padX = 10 * s, padY = 13 * s;
    const bottomH = H * 0.12 + safe.bottom * 0.5;
    // the scenery strip (girl, road, house, HUD) never gets squeezed; on short screens the tiles shrink instead
    const topMin = safe.top + 205 * s;
    let cell = (W - 2 * margin - 2 * padX) / COLS;
    if (bottomH + ROWS * cell + 2 * padY + topMin > H) cell = (H - bottomH - topMin - 2 * padY) / ROWS;
    this.cell = cell;
    const bw = COLS * cell + 2 * padX, bh = ROWS * cell + 2 * padY;
    this.boardRect = { x: (W - bw) / 2, y: H - bottomH - bh, w: bw, h: bh };
    this.gridLeft = this.boardRect.x + padX;
    this.gridTop = this.boardRect.y + padY;

    // scenery: the road's bottom edge sits just above the board
    const roadBottom = this.boardRect.y - 5 * s;
    const roadHeight = 50 * s;
    const [bg, bctx] = Art.surface(W, H);
    bctx.fillStyle = Art.C.grass;
    bctx.fillRect(0, 0, W, H);
    Art.drawBackdrop(bctx, W, roadBottom, roadBottom - roadHeight, s);
    const house = Art.house(70 * s);
    this.houseX = W - 139 * s;
    bctx.drawImage(house, this.houseX - house.w / 2, roadBottom - roadHeight - 12 * s - house.h, house.w, house.h);
    this.houseW = house.w;
    const boardSprite = Art.board(bw, bh, s);
    bctx.drawImage(boardSprite, this.boardRect.x, this.boardRect.y, bw, bh);
    this.bg = bg;

    this.dashPeriod = 52 * s;
    this.dashes = Art.roadDashes(W + this.dashPeriod * 2, this.dashPeriod, s);
    this.dashY = roadBottom - 22 * s;
    this.roadRect = { y: roadBottom - roadHeight, h: roadHeight };

    this.girlSprite = Art.girl(132 * s);
    this.girlHomeX = 138 * s;
    this.girlBottom = roadBottom - 12 * s;
    this.girlGoalX = this.houseX - this.houseW * 0.45;

    // tiles and effects
    this.tileW = cell * 0.97;
    this.tileH = cell * 0.99;
    this.tileSprite = Art.tile(this.tileW, this.tileH, 'normal');
    this.tileLitSprite = Art.tile(this.tileW, this.tileH, 'lit');
    this.tileFlashSprite = Art.tileFlash(this.tileW, this.tileH);
    this.emojiSize = cell * 0.7;
    this.emojiSprites = KINDS.map(k => Art.emoji(k, this.emojiSize));
    this.leafSprite = Art.leaf(cell * 0.42);
    this.sparkleSprite = Art.sparkle(cell * 0.4);
    this.glowSprite = Art.glow(cell * 1.2);
    this.ringSprite = Art.ring(cell * 1.1);
    this.fragSprites = new Map();
    this.frags = [];

    // The layer the resting tiles are kept in. It covers the board and a little beyond, because a
    // tile's sprite is slightly taller than its cell.
    const b = this.boardRect;
    const pad = cell * 0.4;
    // Snapped to whole device pixels at both corners: a layer on a half pixel would be resampled
    // on every blit, which would cost more than it saves and soften every tile on the board.
    const lx = Math.floor((b.x - pad) * DPR) / DPR, ly = Math.floor((b.y - pad) * DPR) / DPR;
    this.layerRect = {
      x: lx, y: ly,
      w: Math.ceil((b.x + b.w + pad) * DPR) / DPR - lx,
      h: Math.ceil((b.y + b.h + pad) * DPR) / DPR - ly,
    };
    [this.tileLayer, this.tileLayerCtx] = Art.surface(this.layerRect.w, this.layerRect.h);
    this.tileSig = -1;
    this.arrowSprite = Art.arrow(cell * 0.8);
    this.rowBand = Art.band(COLS * cell, cell);
    this.colBand = Art.band(cell, ROWS * cell);
    this.pointSprites = new Map();

    // HUD
    const topY = Math.max(safe.top, 14 * s) + 34 * s;
    this.topY = topY;
    this.gear = { x: 40 * s, y: topY, sprite: Art.gearButton(54 * s), scale: 1, pressT0: -1 };
    const bW = 114 * s, bH = 86 * s;
    const buttonY = H - (safe.bottom * 0.5 + (bottomH - safe.bottom * 0.5) / 2);
    this.hintBtn = { x: W * 0.338, y: buttonY, w: bW, h: bH, sprite: Art.powerButton(bW, bH, 'hint', s), alpha: 1, pressT0: -1, popT0: -1, attention: false, attT0: 0 };
    this.shuffleBtn = { x: W * 0.66, y: buttonY, w: bW, h: bH, sprite: Art.powerButton(bW, bH, 'shuffle', s), alpha: 1, pressT0: -1, popT0: -1, attention: false, attT0: 0 };
    this.versionSprite = Art.pill(`v${VERSION}`, 20 * s, { color: 'rgba(255,255,255,0.8)', bg: 'rgba(0,0,0,0.18)', fontScale: 0.62, radius: 0.5, pad: 0.8 });
    this.versionPos = { x: 10 * s + this.versionSprite.w / 2, y: H - Math.max(safe.bottom * 0.6, 8 * s) - this.versionSprite.h / 2 };
    this.badgeSprites = new Map();
    this.toastSprites = new Map();
    this.scorePopT0 = -1;
    this.scoreSprite = null;
    this.bestCanvas = null;
    this.bestText = null;
    this.comboCanvas = null;

    this.promoteSprites();
    const first = !this.built;
    this.built = true;
    this.cancelDrag();
    this.updateBadges();
    this.updateScore(false);
    this.particles = [];
    this.comboFx = null;
    this.toastSprite = null;
    this.hintArrow = null;

    if (first) {
      if (this.restoreBoard()) {
        this.rebuildTiles(true);
        this.placeGirl();
      } else {
        this.startLevel();
      }
    } else {
      this.rebuildTiles(false);
      this.placeGirl();
      this.peerIds = [];
      this.hinted = [];
      this.applySelectionVisuals();
    }
  }

  /** Safari draws ImageBitmaps faster than canvases; swap the per-frame sprites once they're ready. */
  promoteSprites() {
    if (typeof createImageBitmap !== 'function') return;
    const gen = (this.spriteGen = (this.spriteGen ?? 0) + 1);
    const lift = c => createImageBitmap(c).then(b => { b.w = c.w; b.h = c.h; return b; });
    const fields = ['bg', 'tileSprite', 'tileLitSprite', 'tileFlashSprite', 'dashes', 'girlSprite', 'leafSprite', 'sparkleSprite', 'glowSprite', 'ringSprite'];
    Promise.all([...fields.map(f => lift(this[f])), ...this.emojiSprites.map(lift)])
      .then(list => {
        if (gen !== this.spriteGen) return; // a newer layout replaced these
        fields.forEach((f, i) => { this[f] = list[i]; });
        this.emojiSprites = list.slice(fields.length);
      })
      .catch(() => {});
  }

  point(p) { return { x: this.gridLeft + (p.c + 0.5) * this.cell, y: this.gridTop + (p.r + 0.5) * this.cell }; }

  cellAt(pt) {
    const p = { c: Math.floor((pt.x - this.gridLeft) / this.cell), r: Math.floor((pt.y - this.gridTop) / this.cell) };
    return this.board.inBounds(p) ? p : null;
  }

  node(p) {
    const t = this.board.get(p);
    return t ? this.nodes.get(t.id) : undefined;
  }

  // ------------------------------------------------------------ HUD sprites

  badge(text) {
    let b = this.badgeSprites.get(text);
    if (!b) this.badgeSprites.set(text, (b = Art.badge(text, 32 * this.s)));
    return b;
  }

  updateBadges() {
    this.hintBtn.badge = this.badge(this.hints > 0 ? String(this.hints) : '+');
    const outForGood = this.mode === 'challenge' && this.secondChanceUsed;
    this.shuffleBtn.badge = this.badge(this.shuffles > 0 ? String(this.shuffles) : outForGood ? '0' : '+');
    this.shuffleBtn.alpha = this.shuffles === 0 && outForGood ? 0.55 : 1;
  }

  updateScore(animated = true) {
    const s = this.s;
    const levels = this.relaxed;
    this.scoreSprite = levels
      ? Art.pill(L.level(this.level), 38 * s, { reuse: this.scoreSprite })
      : Art.scorePill(String(this.score), 38 * s, this.scoreSprite);
    if (levels) {
      this.bestSprite = null;
    } else {
      let text = L.best(Math.max(Stats.best, this.score));
      if (Stats.streak > 0) text += `   🔥 ${Stats.streak}`;
      if (text !== this.bestText) {
        this.bestText = text;
        this.bestCanvas = Art.pill(text, 23 * s, { color: '#FFE14A', bg: 'rgba(13,13,13,0.75)', fontScale: 0.66, radius: 0.39, pad: 0.7, reuse: this.bestCanvas });
      }
      this.bestSprite = this.bestCanvas;
    }
    if (animated) this.scorePopT0 = now();
  }

  refreshLanguage() {
    this.updateScore(false);
  }

  // ------------------------------------------------------------ levels

  /** Deals a fresh board. In Challenge, walking away from a game in progress (or a lost one) counts as a loss. */
  startLevel() {
    if (this.mode === 'challenge') {
      if (this.lostPending || this.inProgress) Stats.recordLoss();
      this.hints = START_HINTS;
      this.shuffles = START_SHUFFLES;
      this.secondChanceUsed = false;
      this.score = 0;
      this.bestAtStart = Stats.best;
    }
    this.lostPending = false;
    this.save();
    this.updateBadges();
    this.updateScore(false);
    this.shuffleBtn.attention = false;
    this.cancelTimer('win');
    this.cancelTimer('check');
    this.finishing = false;
    this.selected = null;
    this.peerIds = [];
    this.hinted = [];
    this.hintArrow = null;
    this.combo = 0;
    const size = { cols: this.cols, rows: this.rows };
    this.board = this.mode === 'challenge'
      ? Board.generate({ ...size, level: 1, kindCount: BASE_KINDS, share: TOUCHING_SHARE, kinds: BASE_KINDS })
      : this.mode === 'big'
        // 102 pairs over 44 kinds and up: most icons come in two pairs, a few in three
        ? Board.generate({ ...size, level: this.level, kindCount: KINDS.length, kinds: 44 + (this.level - 1) * 2 })
        : Board.generate({ ...size, level: this.level, kindCount: BASE_KINDS });
    this.levelTileTotal = this.board.tileCount;
    this.saveBoard();
    this.anim.cancel(this.girl);
    this.girl.x = this.girlHomeX;
    this.girl.alpha = 1;
    this.anim.cancel(this, 'tileAlpha');
    this.tileAlpha = 1;
    this.rebuildTiles(true);
  }

  /** Part of the board cleared and the game not over: starting again would throw this away. */
  get inProgress() {
    return !this.finishing && this.levelTileTotal > 0 && !this.board.isEmpty && this.board.tileCount < this.levelTileTotal;
  }

  restartLevel() { this.startLevel(); }
  nextLevel() { this.startLevel(); }

  /** Switches between Levels, Challenge and Big. The game being left stays saved and resumes when you come back. */
  switchMode(mode) {
    if (mode === this.mode) return;
    this.save();
    this.saveBoard();
    this.cancelTimer('win');
    this.cancelTimer('check');
    this.cancelDrag();
    const resized = String(GRIDS[mode]) !== String(GRIDS[this.mode]);
    this.mode = mode;
    localStorage.setItem('mode', mode);
    this.loadState();
    this.finishing = false;
    this.selected = null;
    this.peerIds = [];
    this.hinted = [];
    this.hintArrow = null;
    this.combo = 0;
    this.board = new Board(this.cols, this.rows);
    // a different grid means a different cell size: every sprite and the tile layer are rebuilt
    if (resized) this.layout(this.W, this.H, this.safe);
    this.shuffleBtn.attention = false;
    this.anim.cancel(this, 'tileAlpha');
    this.tileAlpha = 1;
    this.anim.cancel(this.girl);
    this.girl.alpha = 1;
    this.girl.x = this.girlHomeX;
    this.updateBadges();
    this.updateScore(false);
    if (this.restoreBoard()) {
      this.rebuildTiles(true);
      this.placeGirl();
    } else {
      this.startLevel();
    }
  }

  makeTile(t, p) {
    const pt = this.point(p);
    return { id: t.id, kind: t.kind, x: pt.x, y: pt.y, rot: 0, scale: 1, alpha: 1, z: 0, lit: false,
      shake: false, shakeT0: 0, tapT0: -1, flashT0: -1, pulse: false, pulseT0: 0, wobbleT0: -1, gone: false };
  }

  rebuildTiles(animated) {
    for (const t of this.tiles) this.anim.cancel(t);
    this.tiles = [];
    this.nodes.clear();
    this.particles = [];
    this.frags = [];
    for (const p of this.board.occupied()) {
      const n = this.makeTile(this.board.get(p), p);
      this.tiles.push(n);
      this.nodes.set(n.id, n);
      if (animated) {
        const tx = n.x, ty = n.y;
        n.x = tx + rand(-2, 2) * this.cell;
        n.y = ty + rand(1, 4) * this.cell;
        n.rot = rand(-1, 1);
        n.scale = 0.3;
        n.alpha = 0;
        const delay = rand(0, 0.45);
        this.anim.to(n, { x: tx, y: ty, rot: 0, scale: 1 }, 0.38, { ease: 'out', delay, key: 'move' });
        this.anim.to(n, { alpha: 1 }, 0.15, { delay, key: 'alpha' });
      }
    }
    if (animated) this.busyUntil = now() + 0.5;
    this.warmFragPieces();
  }

  placeGirl() {
    if (this.levelTileTotal <= 0) return;
    this.girl.x = this.girlHomeX + (this.girlGoalX - this.girlHomeX) * (1 - this.board.tileCount / this.levelTileTotal);
  }

  /** The girl rides a little closer to the house with every cleared pair. */
  advanceGirl() {
    if (this.levelTileTotal <= 0) return;
    const progress = 1 - this.board.tileCount / this.levelTileTotal;
    this.anim.to(this.girl, { x: this.girlHomeX + (this.girlGoalX - this.girlHomeX) * progress }, 0.6, { ease: 'inOut', key: 'ride' });
  }

  // ------------------------------------------------------------ input

  bindInput() {
    const c = this.canvas;
    const pos = e => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', e => {
      // Only the first finger counts. A new primary pointer means every earlier touch has ended,
      // so a lost pointerup (iOS can drop one during system gestures) can never freeze input.
      if (this.pointerId !== null && !e.isPrimary) return;
      if (this.pointerId !== null) this.touchUp();
      this.pointerId = e.pointerId;
      try { c.setPointerCapture(e.pointerId); } catch {}
      sound.unlock();
      this.touchDown(pos(e));
    });
    c.addEventListener('pointermove', e => {
      if (e.pointerId !== this.pointerId) return;
      this.touchMoved(pos(e));
    });
    const end = e => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      if (e.type === 'pointercancel' && this.drag) {
        // The system took the gesture (a swipe from the edge, a call coming in): put the row back.
        this.showDragTarget(this.drag, null);
        this.springBack(this.drag);
        this.touchOrigin = null;
        this.drag = null;
        this.pendingPair = null;
      } else {
        // A cancel with no slide is still a tap she made; losing it would feel like a dropped touch.
        this.touchUp();
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('lostpointercapture', e => { if (e.pointerId === this.pointerId) end(e); });
  }

  hit(btn, pt, w = btn.w, h = btn.h) {
    return Math.abs(pt.x - btn.x) <= w / 2 && Math.abs(pt.y - btn.y) <= h / 2;
  }

  touchDown(pt) {
    this.touchOrigin = null;
    this.drag = null;
    const gearSize = this.gear.sprite.w;
    if (this.hit(this.gear, pt, gearSize + 16 * this.s, gearSize + 16 * this.s)) {
      this.gear.pressT0 = now();
      sound.play('tap');
      report.note('settings');
      this.ui.openSettings();
      return;
    }
    if (this.busy) return;
    if (this.hit(this.hintBtn, pt)) { this.hintBtn.pressT0 = now(); this.useHint(); return; }
    if (this.hit(this.shuffleBtn, pt)) { this.shuffleBtn.pressT0 = now(); this.useShuffle(); return; }

    const p = this.cellAt(pt);
    if (p && this.board.get(p)) {
      this.touchOrigin = p;
      this.touchStart = pt;
      this.pressTile(p);
    } else if (this.inBoard(pt)) {
      this.clearSelection();
      this.pendingPair = null;
    }
  }

  /**
   * A press lights up straight away and remembers the pair a release would clear — but it does not
   * clear it yet. Clearing on touch-down used to snatch the tile out from under her finger: a tile
   * that already saw a partner vanished the instant she touched it, so she could never drag it into
   * line with a different one. Lighting is still instant, so rapid tapping feels exactly the same.
   */
  pressTile(p) {
    this.clearHint();
    const prev = this.selected;
    let pair = null;
    if (prev && !samePos(prev, p) && this.board.sees(prev, p)) pair = [prev, p];
    else {
      const q = this.board.tapPartner(p);
      if (q) pair = [p, q];
    }
    this.pendingPair = pair;
    if (pair) {
      // Light only the two that would go, so the pair she is about to take is never a surprise —
      // if it picked the wrong twin she can still drag away to a different one.
      this.clearSelection();
      this.selected = p;
      this.lightPair(pair);
    } else {
      this.select(p);
      sound.play('tap');
      sound.buzz(10);
    }
    report.note('tap', `${p.c},${p.r} k${this.board.get(p).kind} lit${this.peerIds.length}${pair ? ' pair' : ''}`);
    const n = this.node(p);
    if (n) n.tapT0 = now();
  }

  lightPair(pair) {
    const t0 = now();
    for (const q of pair) {
      const n = this.node(q);
      if (!n) continue;
      n.lit = true;
      n.shake = true;
      n.shakeT0 = t0;
      this.peerIds.push(n.id);
    }
  }

  /** Resolves a press that ended without a slide. */
  releaseTap(p, pair) {
    if (!pair || this.busy) return false;
    const [a, b] = pair;
    if (!this.board.get(a) || !this.board.get(b) || !this.board.sees(a, b)) return false;
    this.clearSelection();
    this.match(a, b);
    return true;
  }

  inBoard(pt) {
    const b = this.boardRect;
    return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
  }

  touchMoved(pt) {
    const origin = this.touchOrigin;
    if (!origin) return;
    const dx = pt.x - this.touchStart.x, dy = pt.y - this.touchStart.y;
    const cell = this.cell;

    if (!this.drag) {
      if (Math.hypot(dx, dy) <= cell * 0.22 || this.busy || !this.board.get(origin)) return;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const plusDir = horizontal ? RIGHT : DOWN;
      const minusDir = horizontal ? LEFT : UP;
      const plus = this.board.slideBlock(origin, plusDir);
      const minus = this.board.slideBlock(origin, minusDir);
      this.drag = {
        origin, horizontal, offset: 0, lastFinger: pt, k: 0, preview: null, target: null,
        plus: { dir: plusDir, ...plus }, minus: { dir: minusDir, ...minus },
      };
      // `pendingPair` is deliberately kept: a slide of a whole cell or more ignores it (she chose to
      // move the tile instead), but a finger that wobbles and comes back to nothing still counts as
      // the press it started as, so releasing there takes the pair rather than doing nothing.
      this.clearSelection();
      this.clearHint();
      const n = this.node(origin);
      if (n) { n.z = 5; this.anim.cancel(n); n.rot = 0; n.scale = 1; n.wobbleT0 = -1; }
      this.lastSparkle = this.point(origin);
      this.bands = { x: 0, y: 0 };
    }
    const d = this.drag;
    const raw = d.horizontal ? dx : dy;
    const prevSteps = this.steps(d);
    d.offset = Math.min(d.plus.free * cell, Math.max(-d.minus.free * cell, raw));
    d.lastFinger = pt;

    const active = this.active(d), inactive = d.offset >= 0 ? d.minus : d.plus;
    const off = Math.abs(d.offset);
    for (const bp of inactive.block) {
      if (samePos(bp, d.origin)) continue;
      const n = this.node(bp);
      if (n) { const q = this.point(bp); n.x = q.x; n.y = q.y; }
    }
    for (const bp of active.block) {
      const n = this.node(bp);
      if (!n) continue;
      const q = this.point(bp);
      this.anim.cancel(n, 'move');
      n.x = q.x + active.dir.dc * off;
      n.y = q.y + active.dir.dr * off;
    }
    const steps = this.steps(d);
    const snapped = this.point(moved(d.origin, active.dir, steps));
    this.bands.x = snapped.x;
    this.bands.y = snapped.y;
    if (steps !== prevSteps) sound.play('slide');
    if (steps !== d.k || !d.preview || d.preview.dir !== active.dir) {
      d.k = steps;
      d.preview = steps > 0 ? this.previewSlide(d, active.dir, steps) : null;
    }
    this.showDragTarget(d, this.chooseTarget(d, pt));

    const n = this.node(d.origin);
    if (n && Math.hypot(n.x - this.lastSparkle.x, n.y - this.lastSparkle.y) > cell * 0.3) {
      this.lastSparkle = { x: n.x, y: n.y };
      this.spawnSparkle(n.x, n.y);
    }
  }

  active(d) { return d.offset >= 0 ? d.plus : d.minus; }
  steps(d) { return Math.min(this.active(d).free, Math.round(Math.abs(d.offset) / this.cell)); }

  touchUp() {
    const d = this.drag;
    const origin = this.touchOrigin;
    const pair = this.pendingPair;
    this.touchOrigin = null;
    this.drag = null;
    this.pendingPair = null;
    if (d) this.finishDrag(d, pair);
    else if (origin) this.releaseTap(origin, pair);
  }

  cancelDrag() {
    if (this.drag) {
      this.showDragTarget(this.drag, null);
      for (const bp of this.drag.plus.block.concat(this.drag.minus.block)) {
        const n = this.node(bp);
        if (n) { const q = this.point(bp); n.x = q.x; n.y = q.y; n.z = 0; }
      }
    }
    this.drag = null;
    this.touchOrigin = null;
    this.pendingPair = null;
    this.bands = null;
  }

  // ------------------------------------------------------------ tapping

  /** Selects `p`; it and every tile with the same icon turn yellow and keep shaking. */
  select(p) {
    this.clearSelection();
    if (!this.board.get(p)) return;
    this.selected = p;
    this.applySelectionVisuals();
  }

  applySelectionVisuals() {
    this.clearPeers();
    const s = this.selected;
    const t = s && this.board.get(s);
    if (!t) return;
    const t0 = now();
    for (const q of this.board.occupied()) {
      if (this.board.get(q).kind !== t.kind) continue;
      const n = this.node(q);
      if (!n) continue;
      n.lit = true;
      n.shake = true;
      n.shakeT0 = t0;
      this.peerIds.push(n.id);
    }
  }

  clearPeers() {
    for (const id of this.peerIds) {
      const n = this.nodes.get(id);
      if (!n) continue;
      n.shake = false;
      n.lit = false;
    }
    this.peerIds = [];
  }

  clearSelection() {
    this.clearPeers();
    this.selected = null;
  }

  wobble(n) { if (n) n.wobbleT0 = now(); }

  // ------------------------------------------------------------ dragging

  /** The board as it would be if the drag were let go now, and every pair that would be on offer. */
  previewSlide(d, dir, k) {
    const next = this.board.clone();
    const pos = next.applySlide(d.origin, dir, k);
    const cands = [];
    for (const way of DIRS) {
      const q = next.seenIn(pos, way);
      if (!q) continue;
      cands.push({
        q, id: next.get(q).id,
        steps: Math.abs(q.c - pos.c) + Math.abs(q.r - pos.r),
        // sideways = in the row or column the tile has just slid into
        across: d.horizontal ? way.dc === 0 : way.dr === 0,
        side: d.horizontal ? way.dr : way.dc,
      });
    }
    return { dir, k, next, pos, cands };
  }

  /**
   * Which twin the drag takes: the one she is heading toward. A slide can never bring a new twin
   * into line along the way the tile travels — the tiles it pushes travel with it, and the trail
   * behind stays clear back to whatever was already in view — so anything in line along the slide
   * was already there before she touched it, and a press would have taken it. She dragged instead,
   * so those come last. Among the twins the slide actually opened, one on each side, the off-axis
   * part of her gesture picks; a dead-straight drag has nothing to go on, so it takes the nearer.
   */
  chooseTarget(d, pt) {
    const pv = d.preview;
    if (!pv || !pv.cands.length) return null;
    const nearest = list => list.reduce((a, b) => (b.steps < a.steps ? b : a));
    const opened = pv.cands.filter(c => c.across);
    const pool = opened.length ? opened : pv.cands;
    if (pool.length > 1) {
      const lean = d.horizontal ? pt.y - this.touchStart.y : pt.x - this.touchStart.x;
      const aimed = pool.filter(c => c.side === Math.sign(lean));
      if (Math.abs(lean) > this.cell * 0.25 && aimed.length) return nearest(aimed);
    }
    return nearest(pool);
  }

  /** Lights the twin the drag would pair with, so the choice shows without drawing a path. */
  showDragTarget(d, c) {
    if (d.target && d.target.id !== c?.id) {
      const old = this.nodes.get(d.target.id);
      if (old) { old.lit = false; old.pulse = false; }
    }
    if (c && d.target?.id !== c.id) {
      const n = this.nodes.get(c.id);
      if (n) { n.lit = true; n.pulse = true; n.pulseT0 = now(); }
    }
    d.target = c;
    const dragged = this.node(d.origin);
    if (dragged) dragged.lit = !!c;
  }

  finishDrag(d, pair) {
    this.bands = null;
    const side = this.active(d);
    const k = this.steps(d);
    if (k === 0) {
      this.showDragTarget(d, null);
      this.springBack(d);
      // A finger that wobbled a little but moved nothing was meant as a press.
      if (Math.abs(d.offset) < this.cell * 0.5 &&
          Math.hypot(d.lastFinger.x - this.touchStart.x, d.lastFinger.y - this.touchStart.y) < this.cell * 0.6) {
        this.releaseTap(d.origin, pair);
      }
      return;
    }
    const chosen = d.target;
    const pv = d.preview;
    if (!chosen || !pv || pv.dir !== side.dir || pv.k !== k) {
      this.showDragTarget(d, null);
      this.springBack(d);
      report.note('fail', `${d.origin.c},${d.origin.r} ${dirName(side.dir)} x${k}`);
      sound.play('fail');
      return;
    }
    const next = pv.next, newPos = pv.pos, partner = chosen.q;
    const lit = this.nodes.get(chosen.id);
    if (lit) { lit.lit = false; lit.pulse = false; }
    d.target = null;
    this.board = next;
    report.note('slide', `${d.origin.c},${d.origin.r} ${dirName(side.dir)} x${k}`);
    for (const bp of side.block) {
      const np = moved(bp, side.dir, k);
      const n = this.node(np);
      if (n) this.anim.to(n, this.point(np), 0.06, { key: 'move' });
    }
    this.match(newPos, partner);
  }

  springBack(d) {
    this.bands = null;
    for (const bp of d.plus.block.concat(d.minus.block)) {
      const n = this.node(bp);
      if (!n) continue;
      this.anim.to(n, this.point(bp), 0.15, { ease: 'out', key: 'move' });
      n.z = 0;
    }
    this.wobble(this.node(d.origin));
  }

  // ------------------------------------------------------------ matching

  match(a, b) {
    const ta = this.board.get(a), tb = this.board.get(b);
    const na = ta && this.nodes.get(ta.id), nb = tb && this.nodes.get(tb.id);
    if (!na || !nb) return;
    this.board.set(a, null);
    this.board.set(b, null);
    this.nodes.delete(ta.id);
    this.nodes.delete(tb.id);
    this.saveBoard();
    this.clearHint();

    const t = now();
    this.combo = t - this.lastMatch < 3.5 ? this.combo + 1 : 1;
    this.lastMatch = t;
    report.note('clear', `${a.c},${a.r}+${b.c},${b.r} k${ta.kind} combo${this.combo} left${this.board.tileCount}`);
    sound.clear(this.combo);
    sound.buzz(18);
    if (this.combo >= 2) this.showCombo(this.combo);

    const pa = this.point(a), pb = this.point(b);
    if (this.mode === 'challenge') {
      const points = 10 * Math.min(this.combo, 10);
      if (this.bestAtStart > 0 && this.score <= this.bestAtStart && this.score + points > this.bestAtStart) {
        this.toast(L.newBest() + ' 🎉');
      }
      this.score += points;
      this.save();
      this.updateScore();
      this.showPoints(points, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
    }

    this.flash(pa.x, pa.y);
    this.flash(pb.x, pb.y);
    this.advanceGirl();

    // Like the original, a matched pair goes at once: a white flash, then each tile shatters.
    for (const n of [na, nb]) {
      this.anim.cancel(n);
      n.z = 20;
      n.rot = 0;
      n.shake = false;
      n.pulse = false;
      n.tapT0 = -1;
      n.wobbleT0 = -1;
      n.lit = true;
      n.flashT0 = t;
      this.anim.to(n, { scale: 1.16 }, 0.07, {
        ease: 'out', key: 'pop',
        done: () => { n.gone = true; this.shatter(n); },
      });
    }
    this.jolt(Math.min(this.combo, 6));
    if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > this.cell * 1.5) {
      this.burst(pa.x, pa.y, 10);
      this.burst(pb.x, pb.y, 10);
    } else {
      this.burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
    }
    this.after(0.2, () => this.checkBoard(), 'check');
  }

  checkBoard() {
    if (this.finishing) return;
    if (this.board.isEmpty) {
      this.win();
    } else if (!this.board.hasMove) {
      this.clearHint();
      this.clearSelection();
      if (this.relaxed) {
        // Levels and Big can't be lost: a stuck board reshuffles for free
        this.toast(L.noMovesShuffling());
        this.after(0.8, () => this.performShuffle());
        this.busyUntil = now() + 0.9;
      } else if (this.shuffles > 0) {
        this.toast(L.noMovesUseShuffle());
        this.shuffleBtn.attention = true;
        this.shuffleBtn.attT0 = now();
      } else {
        this.lose();
      }
    }
  }

  // ------------------------------------------------------------ effects

  addParticle(sprite, fn, dur) { this.particles.push({ sprite, fn, t0: now(), dur }); }

  /**
   * The tile (face + icon) cut into the 3×3 grid of pieces a shatter flings out.
   *
   * The nine pieces are cut once per kind and cached as nine separate sprites rather than kept as
   * one image the draw reads sub-rectangles out of. Same pixels either way, but a plain blit of a
   * whole small canvas takes the browser's fast path, where a source-rectangle blit does not.
   */
  cutFragPieces(kind) {
    const base = this.tileLitSprite, icon = this.emojiSprites[kind % this.emojiSprites.length];
    const [whole, wctx] = Art.surface(base.w, base.h);
    wctx.drawImage(base, 0, 0, base.w, base.h);
    wctx.drawImage(icon, (base.w - icon.w) / 2, (base.h - icon.w) / 2 - base.h * 0.05, icon.w, icon.w);
    const pw = base.w / 3, ph = base.h / 3;
    const pieces = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const [p, pctx] = Art.surface(pw, ph);
        pctx.drawImage(whole, -i * pw, -j * ph, base.w, base.h);
        p.dx = (i - 1) * pw;
        p.dy = (j - 1) * ph;
        pieces.push(p);
      }
    }
    this.fragSprites.set(kind, pieces);
    return pieces;
  }

  /**
   * Cut the shatter pieces for the kinds on the board while nothing is happening.
   *
   * Cutting a kind's nine pieces costs about half a millisecond here and several times that on
   * her phone, and left to itself it happens on the frame of the first match of each kind — one
   * of the few frames that already has the most to do. The board sits still for seconds at a
   * time between moves, so the work is done then instead, a kind at a time, and the first match
   * finds them ready.
   */
  warmFragPieces() {
    const idle = window.requestIdleCallback;
    if (!idle) return; // Safari < 17: the first clear of each kind cuts its own, as before
    const map = this.fragSprites;
    const todo = [];
    for (const n of this.tiles) if (!map.has(n.kind) && !todo.includes(n.kind)) todo.push(n.kind);
    if (!todo.length) return;
    const step = deadline => {
      // a new layout throws the whole cache away, and with it any reason to keep cutting
      while (todo.length && this.fragSprites === map && (deadline.didTimeout || deadline.timeRemaining() > 3)) {
        this.cutFragPieces(todo.pop());
      }
      if (todo.length && this.fragSprites === map) idle(step, { timeout: 1500 });
    };
    idle(step, { timeout: 1500 });
  }

  /** A cleared tile bursting into its nine pieces, spinning out and falling. */
  shatter(n) {
    const pieces = this.fragSprites.get(n.kind) || this.cutFragPieces(n.kind);
    const cell = this.cell, t0 = now();
    for (const p of pieces) {
      const ang = Math.atan2(p.dy + rand(-2, 2), p.dx + rand(-2, 2));
      const speed = cell * rand(2.2, 4.5);
      this.frags.push({
        img: p, x0: n.x + p.dx, y0: n.y + p.dy,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - cell * rand(2, 3.5),
        vr: rand(-9, 9), t0,
      });
    }
  }

  /**
   * A tiny knock of the board on every clear; a little stronger during combos. It is applied as one
   * translate on the canvas for the whole board layer, not added into each tile's own position —
   * that per-tile version was why the knock had to be dropped for performance once before.
   */
  jolt(strength) {
    this.joltT0 = now();
    this.joltAmp = this.s * (1.2 + 0.35 * strength);
    this.joltAng = rand(0, TAU);
  }

  flash(x, y) {
    this.addParticle(this.glowSprite, (a, o) => {
      o.x = x; o.y = y; o.rot = 0; o.scale = 0.4 + 0.5 * Math.min(1, a / 0.25);
      o.alpha = a < 0.1 ? 1 : Math.max(0, 1 - (a - 0.1) / 0.2);
      return true;
    }, 0.3);
    const spin = 0.6;
    this.addParticle(this.ringSprite, (a, o) => {
      if (a < 0.12) return false;
      const k = Math.min(1, (a - 0.12) / 0.4);
      o.x = x; o.y = y; o.rot = spin * k; o.scale = 0.4 + 0.75 * k; o.alpha = 0.95 * (1 - k);
      return true;
    }, 0.52);
  }

  burst(x, y, leaves = 18) {
    const cell = this.cell;
    for (let i = 0; i < leaves; i++) {
      const x0 = x + rand(-0.6, 0.6) * cell, y0 = y + rand(-0.35, 0.35) * cell;
      const ox = rand(-1.5, 1.5) * cell, oy = -rand(-0.2, 1.1) * cell;
      const fx = rand(-0.3, 0.3) * cell, fy = rand(0.8, 1.6) * cell;
      const r0 = rand(0, TAU), spin = rand(-6, 6), sc = rand(0.7, 1.25);
      this.addParticle(this.leafSprite, (a, o) => {
        if (a < 0.3) {
          const e = EASE.out(a / 0.3);
          o.x = x0 + ox * e; o.y = y0 + oy * e;
        } else {
          const e = EASE.in(Math.min(1, (a - 0.3) / 0.5));
          o.x = x0 + ox + fx * e; o.y = y0 + oy + fy * e;
        }
        o.rot = r0 + spin * (a / 0.8); o.scale = sc; o.alpha = a < 0.4 ? 1 : Math.max(0, 1 - (a - 0.4) / 0.4);
        return true;
      }, 0.8);
    }
    for (let i = 0; i < 6; i++) this.spawnSparkle(x + rand(-0.8, 0.8) * cell, y + rand(-0.6, 0.6) * cell);
  }

  spawnSparkle(x, y) {
    const cell = this.cell;
    const x0 = x + rand(-0.3, 0.3) * cell, y0 = y + rand(-0.3, 0.3) * cell;
    const s0 = rand(0.4, 1), r0 = rand(0, 1);
    this.addParticle(this.sparkleSprite, (a, o) => {
      const k = Math.min(1, a / 0.5);
      o.x = x0; o.y = y0 - cell * 0.3 * k; o.rot = r0; o.scale = s0 + (0.1 - s0) * k;
      o.alpha = a < 0.2 ? 1 : Math.max(0, 1 - (a - 0.2) / 0.3);
      return true;
    }, 0.5);
  }

  showPoints(n, x, y) {
    let sprite = this.pointSprites.get(n);
    if (!sprite) {
      sprite = Art.outlinedText([{ text: `+${n}`, size: 26 * this.s, weight: 900, color: '#FFE14A' }]);
      this.pointSprites.set(n, sprite);
    }
    const cell = this.cell;
    this.addParticle(sprite, (a, o) => {
      o.x = x; o.y = y - cell * 1.1 * EASE.out(Math.min(1, a / 0.7)); o.rot = 0;
      o.scale = 0.6 + 0.4 * Math.min(1, a / 0.15); o.alpha = a < 0.4 ? 1 : Math.max(0, 1 - (a - 0.4) / 0.3);
      return true;
    }, 0.7);
  }

  showCombo(n) {
    const size = 38 * this.s;
    this.comboCanvas = Art.outlinedText([
      { text: String(n), size, weight: 900, color: '#FF4FB8', italic: true },
      { text: L.combo(), size: size * 0.42, weight: 800, color: '#FFFFFF', italic: true },
    ], 0.2, this.comboCanvas);
    this.comboFx = { sprite: this.comboCanvas, t0: now() };
  }

  toast(text) {
    let sprite = this.toastSprites.get(text);
    if (!sprite) this.toastSprites.set(text, (sprite = Art.pill(text, 44 * this.s)));
    this.toastSprite = { sprite, t0: now() };
  }

  // ------------------------------------------------------------ power-ups

  useHint() {
    if (this.hints === 0) {
      this.ui.requestPhotoBreak('hint');
      return;
    }
    this.clearHint();
    this.clearSelection();
    const move = this.board.findMove();
    if (!move) { this.checkBoard(); return; }
    this.hints--;
    report.note('hint', `${this.hints} left`);
    this.save();
    this.updateBadges();
    sound.play('tap');

    const highlight = p => {
      const n = this.node(p);
      if (!n) return;
      n.lit = true;
      n.pulse = true;
      n.pulseT0 = now();
      this.hinted.push(n.id);
    };
    if (move.type === 'pair') {
      highlight(move.a);
      highlight(move.b);
    } else {
      highlight(move.from);
      highlight(move.partner);
      const o = this.point(move.from);
      this.hintArrow = { x: o.x + move.dir.dc * this.cell * 0.75, y: o.y + move.dir.dr * this.cell * 0.75,
        dir: move.dir, rot: Math.atan2(move.dir.dr, move.dir.dc), t0: now() };
    }
  }

  clearHint() {
    for (const id of this.hinted) {
      const n = this.nodes.get(id);
      if (!n) continue;
      n.pulse = false;
      n.lit = false;
    }
    this.hinted = [];
    this.hintArrow = null;
    this.applySelectionVisuals();
  }

  useShuffle() {
    if (this.shuffles === 0) {
      if (this.relaxed) {
        this.ui.requestPhotoBreak('shuffle');
      } else if (this.secondChanceUsed) {
        this.toast(L.noShufflesLeft());
        sound.play('fail');
      } else {
        this.ui.requestPhotoBreak('shuffle');
      }
      return;
    }
    this.shuffles--;
    this.save();
    this.updateBadges();
    this.performShuffle();
  }

  /** Reward after a photo break: +3 hints, +3 shuffles (Levels) or the one-per-game second-chance shuffle. */
  grant(kind) {
    if (kind === 'hint') {
      this.hints += 3;
    } else if (this.relaxed) {
      this.shuffles += 3;
    } else {
      this.secondChanceUsed = true;
      if (this.finishing || !this.board.hasMove) {
        // rescued from "out of moves": shuffle straight away
        this.finishing = false;
        this.lostPending = false;
        this.anim.to(this, { tileAlpha: 1 }, 0.2, { key: 'tileAlpha' });
        this.performShuffle();
      } else {
        this.shuffles += 1;
      }
    }
    this.save();
    this.updateBadges();
    sound.play('win', { gain: 0.6 });
    (kind === 'hint' ? this.hintBtn : this.shuffleBtn).popT0 = now();
  }

  performShuffle() {
    report.note('shuffle', `${this.shuffles} left, ${this.board.tileCount} tiles`);
    this.shuffleBtn.attention = false;
    this.clearHint();
    this.clearSelection();
    this.board.shuffle();
    this.saveBoard();
    this.after(0.7, () => this.checkBoard(), 'check');
    sound.play('shuffle');
    const b = this.boardRect;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (const p of this.board.occupied()) {
      const n = this.node(p);
      if (!n) continue;
      this.anim.cancel(n);
      n.scale = 1;
      n.rot = 0;
      n.wobbleT0 = -1;
      const dest = this.point(p);
      this.anim.to(n, { x: cx + rand(-1, 1) * this.cell, y: cy + rand(-1, 1) * this.cell }, 0.25, {
        ease: 'in', key: 'move',
        done: () => this.anim.to(n, dest, 0.32, { ease: 'out', key: 'move' }),
      });
      this.anim.to(n, { rot: TAU }, 0.57, { key: 'spin', done: () => { n.rot = 0; } });
    }
    this.busyUntil = now() + 0.6;
  }

  // ------------------------------------------------------------ win / lose

  win() {
    this.finishing = true;
    sound.play('win');
    sound.buzz(40);
    this.anim.to(this.girl, { x: this.girlGoalX }, 0.8, {
      ease: 'inOut', key: 'ride', done: () => this.anim.to(this.girl, { alpha: 0 }, 0.25, { key: 'fade' }),
    });
    for (let i = 0; i < 5; i++) {
      this.after(i * 0.15, () => {
        const b = this.boardRect;
        this.burst(b.x + rand(0.15, 0.85) * b.w, b.y + rand(0.2, 0.7) * b.h);
      });
    }
    if (this.relaxed) {
      const cleared = this.level;
      this.level++;
      this.save();
      const result = { won: true, level: cleared };
      this.after(1.7, () => this.ui.showResult(result), 'win');
      return;
    }
    report.note('WON', `${this.mode} level ${this.level}`);
    // clearing the board pays a bonus, more if the shuffle was never needed
    this.score += 500 + 300 * this.shuffles + (this.secondChanceUsed ? 0 : 200);
    const newBest = Stats.submit(this.score);
    Stats.recordWin();
    this.save();
    this.updateScore();
    const result = this.makeResult(true, newBest);
    this.after(1.7, () => this.ui.showResult(result), 'win');
  }

  lose() {
    report.note('LOST', `${this.board.tileCount} tiles left, score ${this.score}`);
    this.finishing = true;
    this.lostPending = true;
    sound.play('lose');
    sound.buzz(60);
    this.anim.to(this, { tileAlpha: 0.55 }, 0.4, { key: 'tileAlpha' });
    const newBest = Stats.submit(this.score);
    this.updateScore(false);
    const result = this.makeResult(false, newBest);
    this.after(1.0, () => this.ui.showResult(result), 'win');
  }

  makeResult(won, newBest) {
    return { won, score: this.score, best: Stats.best, newBest, streak: Stats.streak,
      tilesLeft: this.board.tileCount, canRevive: !won && !this.secondChanceUsed, wins: Stats.wins, games: Stats.games };
  }

  // ------------------------------------------------------------ frame

  /** Everything a bug report needs: where she is in the game, and the exact board. */
  diagnostics() {
    const b = this.board;
    return {
      mode: this.mode, level: this.level, score: this.score, best: Stats.best,
      tiles: b.tileCount, total: this.levelTileTotal, hasMove: b.hasMove,
      hints: this.hints, shuffles: this.shuffles, secondChanceUsed: this.secondChanceUsed,
      busy: this.busy, finishing: this.finishing, pointer: this.pointerId,
      drag: this.drag ? (this.drag.horizontal ? 'horizontal' : 'vertical') : 'none',
      selected: this.selected ? `${this.selected.c},${this.selected.r}` : 'none',
      lit: this.peerIds.length, tweens: this.anim.list.filter(tw => !tw.dead).length,
      timers: this.timers.length, drawn: this.tiles.length,
      overlay: this.ui.breakKind ? 'photo break' : this.ui.result ? 'result' : this.ui.anyOpen ? 'panel' : 'none',
      sound: sound.enabled, haptics: sound.haptics, audio: sound.ctx ? sound.ctx.state : 'not started',
      photos: photos.entries.length ? `${photos.entries.length}${photos.key ? '' : ', NO KEY'}` : 'none',
      cols: b.cols, rows: b.rows, board: b.snapshot(),
    };
  }

  frame() {
    const t = now();
    const raw = t - this.last;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.last = t;
    report.tick(t, raw);
    if (!this.built) return;

    if (this.timers.length) {
      let anyDue = false;
      for (const tm of this.timers) if (tm.at <= t) { anyDue = true; break; }
      if (anyDue) {
        const due = this.timers.filter(tm => tm.at <= t);
        this.timers = this.timers.filter(tm => tm.at > t);
        for (const tm of due) tm.fn();
      }
    }
    this.anim.update(dt);
    let gone = false;
    for (const n of this.tiles) if (n.gone) { gone = true; break; }
    if (gone) this.tiles = this.tiles.filter(n => !n.gone);
    this.render(t);
    if (this.perf) this.trackPerf(dt, now() - t);
  }

  /** ?fps: on-screen meter of frame rate, slow frames and the time each frame takes to draw. */
  trackPerf(dt, work) {
    const p = this.perf;
    p.frames++;
    p.maxWork = Math.max(p.maxWork, work * 1000);
    p.sumWork += work * 1000;
    if (p.frames > 5 && dt > p.budget * 1.6) {
      p.slow++;
      if (p.lastWork > 8) p.ours++;
    }
    p.lastWork = work * 1000;
    if (dt > 0) p.budget = p.budget * 0.98 + Math.min(dt, 0.05) * 0.02;
    const ctx = this.ctx;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#000';
    ctx.fillRect(4, this.H - 58, 190, 54);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`fps ${(1 / p.budget).toFixed(0)}  frames ${p.frames}`, 10, this.H - 42);
    ctx.fillText(`slow frames ${p.slow} (ours ${p.ours})`, 10, this.H - 27);
    ctx.fillText(`draw avg ${(p.sumWork / p.frames).toFixed(2)}ms max ${p.maxWork.toFixed(1)}ms`, 10, this.H - 12);
  }

  drawAt(img, x, y, rot, scale, alpha) {
    if (alpha <= 0.001 || scale <= 0.001) return;
    const ctx = this.ctx;
    ctx.globalAlpha = Math.min(1, alpha);
    if (rot === 0 && scale === 1) {
      ctx.drawImage(img, snap(x - img.w / 2), snap(y - img.h / 2), img.w, img.h);
    } else {
      const c = Math.cos(rot) * scale * DPR, s = Math.sin(rot) * scale * DPR;
      ctx.setTransform(c, s, -s, c, x * DPR, y * DPR);
      ctx.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  /**
   * Tiles, in three groups: the ones sitting still, the ones animating, and the ones lifted above
   * the board by a drag or a clear.
   *
   * Almost every frame of a real game has nothing moving on the board at all, and redrawing all
   * 140 tiles on each of those frames was 81% of the frame's work — two draws a tile, 280 of them,
   * for a picture identical to the one before. The still ones are now kept as a single prepared
   * image and put down in one draw.
   *
   * The layer is keyed off a signature of exactly what it holds: every resting tile's position,
   * icon and lit state. Deriving the key from the contents rather than setting a flag wherever the
   * board changes means it cannot be left stale by a call site that forgot to invalidate it — the
   * worst a mistake here can do is rebuild the layer on a frame that did not need it.
   */
  drawTiles(t) {
    const ctx = this.ctx;
    const raised = this.raised, live = this.live, still = this.still;
    raised.length = 0;
    live.length = 0;
    still.length = 0;

    // A whole-board fade is on, so nothing is resting; take the simple path.
    if (this.tileAlpha !== 1) {
      for (const n of this.tiles) {
        if (n.z) raised.push(n); else this.drawTile(n, t);
      }
      if (raised.length) {
        raised.sort((a, b) => a.z - b.z);
        for (const n of raised) this.drawTile(n, t);
      }
      this.tileSig = -1;
      return;
    }

    // The tiles a drag is carrying are the only ones on the board that move during it, and they
    // still satisfy every test for "resting" below — nothing about them is animating, they are
    // simply somewhere new each frame. Left in the layer they invalidate it continuously, and all
    // 140 tiles are redrawn into it on 86% of the frames of a drag to move about ten of them.
    // Drawn on top instead, the layer holds still and is not touched for the whole drag.
    // Like the signature itself this is read off the drag as it is now, so it cannot go stale.
    let moving = null;
    if (this.drag) {
      moving = this.movingIds ??= new Set();
      moving.clear();
      for (const bp of this.active(this.drag).block) {
        const n = this.node(bp);
        if (n) moving.add(n.id);
      }
    }

    let sig = 0x811c9dc5 ^ this.tiles.length;
    for (const n of this.tiles) {
      if (n.z) { raised.push(n); continue; }
      if (moving !== null && moving.has(n.id)) { live.push(n); continue; }
      const resting = n.alpha === 1 && n.rot === 0 && n.scale === 1 && !n.shake && !n.pulse &&
        n.tapT0 < 0 && n.wobbleT0 < 0 && n.flashT0 < 0 && t >= (n.animT ?? 0);
      if (!resting) { live.push(n); continue; }
      still.push(n);
      // quantised to quarter-pixels: below that the layer would redraw for a difference it
      // could not show anyway
      sig = Math.imul(sig ^ n.id, 16777619);
      sig = Math.imul(sig ^ ((n.x * 4) | 0), 16777619);
      sig = Math.imul(sig ^ ((n.y * 4) | 0), 16777619);
      sig = Math.imul(sig ^ ((n.kind << 1) | (n.lit ? 1 : 0)), 16777619);
    }
    sig = Math.imul(sig ^ live.length, 16777619) >>> 0;

    const r = this.layerRect;
    if (sig !== this.tileSig) {
      this.tileSig = sig;
      const lctx = this.tileLayerCtx;
      lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      lctx.clearRect(0, 0, r.w, r.h);
      // the layer draws in its own coordinates, so shift the board into it
      lctx.setTransform(DPR, 0, 0, DPR, -r.x * DPR, -r.y * DPR);
      const real = this.ctx;
      this.ctx = lctx;
      for (const n of still) this.drawTile(n, t);
      this.ctx = real;
      lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(this.tileLayer, r.x, r.y, r.w, r.h);

    for (const n of live) this.drawTile(n, t);
    if (raised.length) {
      raised.sort((a, b) => a.z - b.z);
      for (const n of raised) this.drawTile(n, t);
    }
  }

  drawTile(n, t) {
    let rot = n.rot, scale = n.scale;
    if (n.shake) rot += shakeAngle(t - n.shakeT0);
    if (n.tapT0 >= 0) {
      const v = segments(TAP_POP, t - n.tapT0, 1);
      if (v === null) n.tapT0 = -1; else scale *= v;
    }
    if (n.pulse) scale *= 1 + 0.05 * (1 - Math.cos((TAU * (t - n.pulseT0)) / 0.6));
    if (n.wobbleT0 >= 0) {
      const w = segments(WOBBLE, t - n.wobbleT0);
      if (w === null) n.wobbleT0 = -1;
      else rot += w;
    }
    const alpha = n.alpha * this.tileAlpha;
    if (alpha <= 0.001) return;
    const ctx = this.ctx;
    const base = n.lit ? this.tileLitSprite : this.tileSprite;
    const icon = this.emojiSprites[n.kind % this.emojiSprites.length];
    const tw = base.w, th = base.h, iw = icon.w;
    const nx = n.x, ny = n.y;
    ctx.globalAlpha = Math.min(1, alpha);
    if (rot === 0 && scale === 1) {
      const x = snap(nx - tw / 2), y = snap(ny - th / 2);
      ctx.drawImage(base, x, y, tw, th);
      ctx.drawImage(icon, snap(nx - iw / 2), snap(ny - iw / 2 - th * 0.05), iw, iw);
      if (n.flashT0 >= 0) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(this.tileFlashSprite, x, y, tw, th);
      }
    } else {
      const c = Math.cos(rot) * scale * DPR, s = Math.sin(rot) * scale * DPR;
      ctx.setTransform(c, s, -s, c, nx * DPR, ny * DPR);
      ctx.drawImage(base, -tw / 2, -th / 2, tw, th);
      ctx.drawImage(icon, -iw / 2, -iw / 2 - th * 0.05, iw, iw);
      if (n.flashT0 >= 0) {
        ctx.globalAlpha = 0.85;
        const f = this.tileFlashSprite;
        ctx.drawImage(f, -f.w / 2, -f.h / 2, f.w, f.h);
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  drawButton(b, t) {
    let scale = 1;
    if (b.pressT0 >= 0) {
      const v = segments(PRESS, t - b.pressT0, 1);
      if (v === null) b.pressT0 = -1; else scale *= v;
    }
    if (b.popT0 >= 0) {
      const v = segments(GRANT_POP, t - b.popT0, 1);
      if (v === null) b.popT0 = -1; else scale *= v;
    }
    if (b.attention) scale *= 1 + 0.06 * (1 - Math.cos((TAU * (t - b.attT0)) / 0.5));
    this.drawAt(b.sprite, b.x, b.y, 0, scale, b.alpha);
    if (b.badge) {
      const s = this.s;
      this.drawAt(b.badge, b.x + (b.w / 2 - 4 * s) * scale, b.y - (b.h / 2 - 6 * s) * scale, 0, 1, b.alpha);
    }
  }

  render(t) {
    const ctx = this.ctx, s = this.s;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0, this.W, this.H);

    // scrolling road markings
    const off = ((t * this.dashPeriod) / 0.45) % this.dashPeriod;
    ctx.drawImage(this.dashes, -off, this.dashY - this.dashes.h / 2, this.dashes.w, this.dashes.h);

    // girl, bobbing on her scooter
    const bob = -1.6 * s * 0.5 * (1 - Math.cos((TAU * t) / 0.44));
    const g = this.girlSprite;
    if (this.girl.alpha > 0.001) {
      ctx.globalAlpha = this.girl.alpha;
      ctx.drawImage(g, this.girl.x - g.w / 2, this.girlBottom - g.h + bob, g.w, g.h);
    }

    // Everything from here to the HUD is the board layer, and the knock of a clear moves all of it
    // with one translate. The previous version of this added the offset to every tile and every
    // particle as it was drawn, which is the same picture for about a hundred extra additions a
    // frame — and it is why the knock had to be taken out for performance once before.
    ctx.save();
    this.jx = this.jy = 0;
    if (this.joltT0 >= 0) {
      const a = t - this.joltT0;
      if (a > 0.16) {
        this.joltT0 = -1;
      } else {
        const k = this.joltAmp * Math.exp(-a / 0.045) * Math.sin(a * TAU * 22);
        // Whole device pixels only. A knock of a third of a pixel still moves the board, but it
        // makes the browser resample every tile on screen for the 160 ms it lasts — the picture
        // goes soft exactly when it is moving, and pays for the blur. Snapped, it is a clean shift.
        this.jx = snap(Math.cos(this.joltAng) * k);
        this.jy = snap(Math.sin(this.joltAng) * k);
        ctx.translate(this.jx, this.jy);
      }
    }

    // drag guides
    if (this.bands) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.rowBand, this.gridLeft, this.bands.y - this.cell / 2, this.rowBand.w, this.rowBand.h);
      ctx.drawImage(this.colBand, this.bands.x - this.cell / 2, this.gridTop, this.colBand.w, this.colBand.h);
    }

    this.drawTiles(t);

    if (this.hintArrow) {
      const h = this.hintArrow;
      const k = 0.3 * this.cell * (1 - Math.abs((((t - h.t0) / 0.6) % 1) * 2 - 1));
      this.drawAt(this.arrowSprite, h.x + h.dir.dc * k, h.y + h.dir.dr * k, h.rot, 1, 1);
    }

    // effects
    if (this.particles.length) {
      let alive = 0;
      for (const p of this.particles) {
        const a = t - p.t0;
        if (a > p.dur) continue;
        this.particles[alive++] = p;
        const o = this.particleOut;
        if (p.fn(a, o)) this.drawAt(p.sprite, o.x, o.y, o.rot, o.scale, o.alpha);
      }
      this.particles.length = alive;
    }

    // shattered tiles: nine pieces each, flung out and falling
    if (this.frags.length) {
      const g = this.cell * 16;
      let alive = 0;
      for (const f of this.frags) {
        const a = t - f.t0;
        if (a > FRAG_LIFE) continue;
        this.frags[alive++] = f;
        const sc = (1 - 0.35 * (a / FRAG_LIFE)) * DPR;
        const rot = f.vr * a;
        const c = Math.cos(rot) * sc, sn = Math.sin(rot) * sc;
        const img = f.img;
        ctx.globalAlpha = a < FRAG_SOLID ? 1 : 1 - (a - FRAG_SOLID) / (FRAG_LIFE - FRAG_SOLID);
        ctx.setTransform(c, sn, -sn, c,
          (f.x0 + f.vx * a + this.jx) * DPR, (f.y0 + f.vy * a + 0.5 * g * a * a + this.jy) * DPR);
        ctx.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h);
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      this.frags.length = alive;
    }

    // HUD
    ctx.restore();
    ctx.globalAlpha = 1;
    const gearPress = this.gear.pressT0 >= 0 ? segments(PRESS, t - this.gear.pressT0, 1) : null;
    if (gearPress === null) this.gear.pressT0 = -1;
    this.drawAt(this.gear.sprite, this.gear.x, this.gear.y, 0, gearPress ?? 1, 1);

    let popScale = 1;
    if (this.scorePopT0 >= 0) {
      const v = segments(POP, t - this.scorePopT0, 1);
      if (v === null) this.scorePopT0 = -1; else popScale = v;
    }
    const sp = this.scoreSprite;
    this.drawAt(sp, this.W - 22 * s - sp.w / 2, this.topY, 0, popScale, 1);
    if (this.bestSprite) {
      const b = this.bestSprite;
      this.drawAt(b, this.W - 24 * s - b.w / 2, this.topY + 24 * s + b.h / 2, 0, 1, 1);
    }

    this.drawAt(this.versionSprite, this.versionPos.x, this.versionPos.y, 0, 1, 1);
    this.drawButton(this.hintBtn, t);
    this.drawButton(this.shuffleBtn, t);

    if (this.comboFx) {
      const a = t - this.comboFx.t0;
      const sp2 = this.comboFx.sprite;
      if (a > 1.78) this.comboFx = null;
      else {
        const scale = a < 0.18 ? 1.6 - 0.6 * EASE.out(a / 0.18) : 1;
        const alpha = a < 1.48 ? 1 : 1 - (a - 1.48) / 0.3;
        const b = this.boardRect;
        this.drawAt(sp2, this.W - 6 * s - sp2.w / 2, b.y + b.h + 2 * s + sp2.h / 2, 0, scale, alpha);
      }
    }

    if (this.toastSprite) {
      const a = t - this.toastSprite.t0;
      if (a > 2.95) this.toastSprite = null;
      else {
        const alpha = a < 0.15 ? a / 0.15 : a < 2.65 ? 1 : 1 - (a - 2.65) / 0.3;
        const b = this.boardRect;
        this.drawAt(this.toastSprite.sprite, b.x + b.w / 2, b.y + b.h / 2, 0, 1, alpha);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ debug helpers (?autoplay, ?stuck, ?endgame)

  autoplayStep(slidesFirst = false) {
    if (this.busy || this.board.isEmpty || this.drag) return;
    const move = this.board.findMove(slidesFirst);
    if (!move) {
      if (this.shuffles > 0 || this.relaxed || !this.secondChanceUsed) this.useShuffle();
      return;
    }
    if (move.type === 'pair') {
      const p = this.point(move.a);
      this.touchDown(p);
      this.touchUp();
    } else {
      const start = this.point(move.from);
      this.touchDown(start);
      const frames = 10;
      for (let i = 1; i <= frames; i++) {
        const f = (i / frames) * move.dist * this.cell;
        this.after(i * 0.03, () => this.touchMoved({ x: start.x + move.dir.dc * f, y: start.y + move.dir.dr * f }));
      }
      this.after(frames * 0.03 + 0.03, () => this.touchUp());
    }
  }

  debugStuck() {
    const b = new Board(this.cols, this.rows);
    for (const p of b.allCells()) b.set(p, { id: p.r * this.cols + p.c, kind: (p.c + p.r * 3) % KINDS.length });
    this.board = b;
    this.levelTileTotal = this.cols * this.rows;
    this.rebuildTiles(false);
    this.checkBoard();
  }

  /** Every tile icon on the board at once, to check they all render centred. */
  debugAllKinds() {
    const b = new Board(this.cols, this.rows);
    KINDS.forEach((_, k) => b.set({ c: k % this.cols, r: Math.floor(k / this.cols) }, { id: k, kind: k }));
    this.board = b;
    this.levelTileTotal = this.cols * this.rows;
    this.rebuildTiles(false);
  }

  debugEndgame() {
    const b = new Board(this.cols, this.rows);
    b.set({ c: 1, r: 2 }, { id: 9001, kind: 0 });
    b.set({ c: 6, r: 5 }, { id: 9002, kind: 0 });
    b.set({ c: 3, r: 9 }, { id: 9003, kind: 1 });
    b.set({ c: 8, r: 11 }, { id: 9004, kind: 1 });
    this.board = b;
    this.levelTileTotal = this.cols * this.rows;
    this.rebuildTiles(false);
    this.placeGirl();
  }
}
