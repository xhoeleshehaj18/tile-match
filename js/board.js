// Game rules, ported from the iOS version (Board.swift).
// Positions are {c, r}; r grows downward.

export const UP = { dc: 0, dr: -1 };
export const DOWN = { dc: 0, dr: 1 };
export const LEFT = { dc: -1, dr: 0 };
export const RIGHT = { dc: 1, dr: 0 };
export const DIRS = [UP, DOWN, LEFT, RIGHT];

export const moved = (p, d, n = 1) => ({ c: p.c + d.dc * n, r: p.r + d.dr * n });
export const samePos = (a, b) => a.c === b.c && a.r === b.r;

// Randomness goes through `rng`, so a daily board can be dealt from a seed: the same date deals
// the same board on every phone.
let rng = Math.random;

/** A small seeded generator (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Runs `fn` with every random choice drawn from `seed`. */
export function withSeed(seed, fn) {
  const prev = rng;
  rng = seeded(seed);
  try { return fn(); } finally { rng = prev; }
}

export const random = () => rng();

export function shuffled(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Board {
  constructor(cols, rows, cells) {
    this.cols = cols;
    this.rows = rows;
    this.cells = cells ?? new Array(cols * rows).fill(null);
  }

  clone() { return new Board(this.cols, this.rows, this.cells.slice()); }

  inBounds(p) { return p.c >= 0 && p.c < this.cols && p.r >= 0 && p.r < this.rows; }
  get(p) { return this.inBounds(p) ? this.cells[p.r * this.cols + p.c] : null; }
  set(p, t) { if (this.inBounds(p)) this.cells[p.r * this.cols + p.c] = t; }

  /** No tiles left to clear. */
  get isEmpty() {
    for (const t of this.cells) if (t) return false;
    return true;
  }

  get tileCount() {
    let n = 0;
    for (const t of this.cells) if (t) n++;
    return n;
  }

  occupied() {
    const out = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.cells[r * this.cols + c]) out.push({ c, r });
    return out;
  }

  allCells() {
    const out = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) out.push({ c, r });
    return out;
  }

  // --- Tap matching: identical tiles that see each other along a clear straight line
  //     (same row or column, nothing in between; touching tiles are the shortest case)

  /** The nearest identical tile `p` can see in a straight line, or null. */
  tapPartner(p) { return this.straightMatch(p); }

  /** The nearest identical tile `p` can see looking along `d`, with nothing in between. */
  seenIn(p, d) {
    const t = this.get(p);
    if (!t) return null;
    let q = moved(p, d);
    while (this.inBounds(q)) {
      const o = this.get(q);
      if (o) return o.kind === t.kind ? q : null;
      q = moved(q, d);
    }
    return null;
  }

  /** True when `a` and `b` are identical and see each other along a clear row or column. */
  sees(a, b) {
    const ta = this.get(a), tb = this.get(b);
    if (!ta || !tb || ta.kind !== tb.kind || (a.c === b.c && a.r === b.r)) return false;
    if (a.c !== b.c && a.r !== b.r) return false;
    const d = { dc: Math.sign(b.c - a.c), dr: Math.sign(b.r - a.r) };
    for (let q = moved(a, d); !samePos(q, b); q = moved(q, d)) if (this.get(q)) return false;
    return true;
  }


  touching(a, b) {
    const ta = this.get(a), tb = this.get(b);
    return Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1 && !!ta && !!tb && ta.kind === tb.kind;
  }

  touchingPartner(p) {
    for (const d of DIRS) {
      const q = moved(p, d);
      if (this.touching(p, q)) return q;
    }
    return null;
  }

  // --- Sliding

  /** Tiles pushed when dragging `p` toward `d`, and how many empty cells lie beyond them. */
  slideBlock(p, d) {
    if (!this.get(p)) return { block: [], free: 0 };
    const block = [p];
    let q = moved(p, d);
    while (this.inBounds(q) && this.get(q)) {
      block.push(q);
      q = moved(q, d);
    }
    let room = 0;
    while (this.inBounds(q) && !this.get(q)) { room++; q = moved(q, d); }
    return { block, free: room };
  }

  /** Moves the dragged tile and everything it pushes. Returns the dragged tile's new position. */
  applySlide(p, d, dist) {
    const { block, free } = this.slideBlock(p, d);
    const n = Math.min(dist, free);
    if (n <= 0) return p;
    for (let i = block.length - 1; i >= 0; i--) {
      const bp = block[i];
      const t = this.get(bp);
      this.set(bp, null);
      this.set(moved(bp, d, n), t);
    }
    return moved(p, d, n);
  }

  /** The nearest identical tile with nothing in between, along the row and column of `p`. */
  straightMatch(p) {
    const t = this.get(p);
    if (!t) return null;
    let best = null, bestSteps = Infinity;
    for (const d of DIRS) {
      let q = moved(p, d), steps = 1;
      while (this.inBounds(q)) {
        const o = this.get(q);
        if (o) {
          if (o.kind === t.kind && steps < bestSteps) { best = q; bestSteps = steps; }
          break;
        }
        q = moved(q, d);
        steps++;
      }
    }
    return best;
  }

  // --- Move search

  findMove(slidesFirst = false) {
    if (slidesFirst) {
      const m = this.findSlide();
      if (m) return m;
    }
    for (const p of this.occupied()) {
      const q = this.tapPartner(p);
      if (q) return { type: 'pair', a: p, b: q };
    }
    return this.findSlide();
  }

  findSlide() {
    const scratch = new Board(this.cols, this.rows);
    for (const p of shuffled(this.occupied())) {
      for (const d of DIRS) {
        const free = this.slideBlock(p, d).free;
        for (let dist = 1; dist <= free; dist++) {
          scratch.cells = this.cells.slice();
          const np = scratch.applySlide(p, d, dist);
          const partner = scratch.straightMatch(np);
          if (partner) return { type: 'slide', from: p, dir: d, dist, partner };
        }
      }
    }
    return null;
  }

  get hasMove() { return this.findMove() !== null; }

  get touchingPairs() {
    let n = 0;
    for (const p of this.occupied())
      for (const d of [RIGHT, DOWN])
        if (this.touching(p, moved(p, d))) n++;
    return n;
  }

  // --- Gravity

  /** Every loose tile falls toward `d` until it lands on something. Returns [{t, to, dist}]. */
  applyGravity(d) {
    const moves = [];
    // the cells nearest the floor settle first, so each tile lands on one that already has
    const depth = p => p.c * d.dc + p.r * d.dr;
    const cells = this.allCells().sort((a, b) => depth(b) - depth(a));
    for (const p of cells) {
      const t = this.get(p);
      if (!t) continue;
      let q = p, dist = 0;
      for (let n = moved(q, d); this.inBounds(n) && !this.get(n); n = moved(n, d)) { q = n; dist++; }
      if (dist) {
        this.set(p, null);
        this.set(q, t);
        moves.push({ t, to: q, dist });
      }
    }
    return moves;
  }

  // --- Shuffle / generation

  /** Rearranges the tiles among their cells so that at least one move exists. */
  shuffle() {
    const spots = this.occupied();
    const tiles = spots.map(p => this.get(p));
    for (let i = 0; i < 40; i++) {
      const copy = this.clone();
      const order = shuffled(tiles.slice());
      spots.forEach((p, k) => copy.set(p, order[k]));
      if (copy.hasMove || copy.tileCount === 0) { this.cells = copy.cells; return; }
    }
    // The last few tiles can sit in cells that never line up, whatever order they are in. Then
    // they move house: dealt into any open cells, not only the ones they were in.
    const open = spots.concat(this.allCells().filter(p => !this.get(p)));
    for (let i = 0; i < 60; i++) {
      const copy = this.clone();
      for (const p of spots) copy.set(p, null);
      const cells = shuffled(open.slice());
      tiles.forEach((t, k) => copy.set(cells[k], t));
      if (copy.hasMove) { this.cells = copy.cells; return; }
    }
    const order = shuffled(tiles.slice());
    spots.forEach((p, k) => this.set(p, order[k]));
  }

  /**
   * Share of pairs dealt already touching in Levels mode. Measured by simulation: at 0.5 a player
   * who only taps the obvious pairs clears 55% of the board without thinking, which is why the
   * early levels felt like nothing. This ramps from 0.30 (about a third clearable on autopilot)
   * down to 0.04 by level 14, where the board is barely easier than a random deal.
   */
  static touchingShare(level) { return Math.max(0.04, 0.3 - (level - 1) * 0.02); }

  static generate({ level, cols, rows, kindCount, share, kinds: kindsOverride }) {
    const pairCount = Math.floor(cols * rows / 2);
    const kinds = Math.min(kindCount, kindsOverride ?? 35 + (level - 1) * 2);
    share = share ?? Board.touchingShare(level);

    let board = new Board(cols, rows);
    let nextId = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      board = new Board(cols, rows);
      nextId = 0;

      // Every kind appears as one pair; leftover pairs go to distinct kinds so none shows up more than four times.
      const pairKinds = shuffled([...Array(kindCount).keys()]).slice(0, kinds);
      let extras = shuffled(pairKinds.slice());
      while (pairKinds.length < pairCount) {
        if (!extras.length) extras = shuffled(pairKinds.slice(0, kinds));
        pairKinds.push(extras.pop());
      }
      shuffled(pairKinds);

      const place = (p, kind) => board.set(p, { id: nextId++, kind });

      // Deal some pairs as touching dominoes...
      const wanted = Math.floor(pairCount * share);
      let dominoes = 0;
      for (const p of shuffled(board.allCells())) {
        if (dominoes >= wanted) break;
        if (board.get(p)) continue;
        const q = shuffled(DIRS.slice()).map(d => moved(p, d)).find(q => board.inBounds(q) && !board.get(q));
        if (!q) continue;
        const kind = pairKinds.pop();
        place(p, kind);
        place(q, kind);
        dominoes++;
      }
      // ...and scatter the rest.
      const rest = shuffled(pairKinds.concat(pairKinds));
      for (const p of board.allCells()) if (!board.get(p)) place(p, rest.pop());

      if (board.touchingPairs >= 4) break;
    }

    if (!board.hasMove) board.shuffle();
    return board;
  }

  /** Tile kinds cell by cell (-1 = empty), for saving a game in progress. */
  snapshot() { return this.cells.map(t => (t ? t.kind : -1)); }

  /** A saved board (see snapshot). */
  static fromSnapshot(cols, rows, kinds) {
    if (!Array.isArray(kinds) || kinds.length !== cols * rows) return null;
    const b = new Board(cols, rows);
    const counts = new Map();
    kinds.forEach((k, i) => {
      if (k >= 0) {
        b.cells[i] = { id: i, kind: k };
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    });
    if (!counts.size) return null;
    for (const n of counts.values()) if (n % 2) return null;
    return b;
  }
}
