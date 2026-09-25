// All artwork is drawn in code (ported from Art.swift) and rendered once into offscreen
// canvases at device resolution, so the game loop only ever copies finished images.

export const DPR = Math.min(window.devicePixelRatio || 1, 3);

export const C = {
  outline: '#1E2208',
  faceTop: '#F5FFD6', faceBottom: '#E9FBB9',
  lit: '#FAFC21', litSide: '#E2E400', litSeam: '#B8BA00',
  side: '#62B236', sideDark: '#3F7F1E',
  board: '#8C4D17', boardRim: '#B96E21', boardEdge: '#4A2508',
  grass: '#3CB275',
  button: '#1E96FB', buttonSide: '#1F6FA8',
  gold: '#FFC21A',
};

export const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "PingFang SC", sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** An offscreen canvas at device resolution whose context draws in logical (CSS pixel) units.
 *  Pass `reuse` to redraw into an existing canvas instead of allocating a new one. */
export function surface(w, h, reuse = null) {
  const c = reuse ?? document.createElement('canvas');
  const pw = Math.max(1, Math.ceil(w * DPR)), ph = Math.max(1, Math.ceil(h * DPR));
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
  }
  c.w = w;
  c.h = h;
  const ctx = c.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function radialGlow(ctx, cx, cy, r, inner, outer) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- tiles

export function tile(w, h, style) {
  const [c, ctx] = surface(w, h);
  const lw = Math.max(1, w * 0.035);
  const side = h * 0.1;
  const radius = w * 0.13;
  const bx = lw / 2, by = lw / 2, bw = w - lw, bh = h - lw;
  const normal = style !== 'lit';

  rr(ctx, bx, by, bw, bh, radius);
  ctx.fillStyle = normal ? C.side : C.litSide;
  ctx.fill();

  const fh = bh - side;
  ctx.save();
  rr(ctx, bx, by, bw, fh, radius);
  ctx.clip();
  ctx.fillStyle = normal ? linear(ctx, 0, by, 0, by + fh, [[0, C.faceTop], [1, C.faceBottom]]) : C.lit;
  ctx.fillRect(bx, by, bw, fh);
  if (normal) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(bx, by + fh - side * 0.5, bw, side * 0.5);
  }
  ctx.restore();

  ctx.strokeStyle = normal ? C.sideDark : C.litSeam;
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(bx + radius * 0.5, by + fh + lw * 0.2);
  ctx.lineTo(bx + bw - radius * 0.5, by + fh + lw * 0.2);
  ctx.stroke();

  ctx.strokeStyle = C.outline;
  ctx.lineWidth = lw;
  rr(ctx, bx, by, bw, fh, radius);
  ctx.stroke();
  rr(ctx, bx, by, bw, bh, radius);
  ctx.stroke();
  return c;
}

/** White tile silhouette, flashed over a tile the instant it's matched. */
export function tileFlash(w, h) {
  const [c, ctx] = surface(w, h);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, w * 0.13);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return c;
}

/** One emoji centred in a square sprite. Centred by the ink it actually draws (bounding box),
 *  not by its advance width, which Safari gets wrong for some emoji. */
export function emoji(ch, size) {
  const box = size * 1.2;
  const [c, ctx] = surface(box, box);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch);
  const left = m.actualBoundingBoxLeft, right = m.actualBoundingBoxRight;
  const inkW = left + right;
  const x = Number.isFinite(inkW) && inkW > size * 0.4 && inkW < size * 1.6
    ? box / 2 - (right - left) / 2
    : (box - m.width) / 2;
  const asc = m.actualBoundingBoxAscent || size * 0.8;
  const desc = m.actualBoundingBoxDescent || size * 0.2;
  ctx.fillText(ch, x, box / 2 + (asc - desc) / 2);
  return c;
}

// ---------------------------------------------------------------- board

export function board(w, h, s) {
  const [c, ctx] = surface(w, h);
  const ox = 1.5 * s, ow = w - 3 * s, oh = h - 3 * s;
  rr(ctx, ox, ox, ow, oh, 12 * s);
  ctx.fillStyle = C.boardRim;
  ctx.fill();

  const ix = ox + 7 * s, iw = ow - 14 * s, ih = oh - 14 * s;
  rr(ctx, ix, ix, iw, ih, 7 * s);
  ctx.fillStyle = C.board;
  ctx.fill();
  ctx.save();
  rr(ctx, ix, ix, iw, ih, 7 * s);
  ctx.clip();
  ctx.fillStyle = linear(ctx, 0, ix, 0, ix + 10 * s, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(ix, ix, iw, 10 * s);
  ctx.restore();
  ctx.strokeStyle = '#6A360C';
  ctx.lineWidth = 2 * s;
  rr(ctx, ix, ix, iw, ih, 7 * s);
  ctx.stroke();

  ctx.strokeStyle = '#D98F3A';
  ctx.lineWidth = 1.5 * s;
  rr(ctx, ox + 2.5 * s, ox + 2.5 * s, ow - 5 * s, oh - 5 * s, 10 * s);
  ctx.stroke();

  ctx.strokeStyle = C.boardEdge;
  ctx.lineWidth = 2.5 * s;
  rr(ctx, ox, ox, ow, oh, 12 * s);
  ctx.stroke();
  return c;
}

// ---------------------------------------------------------------- scenery

/** Sky, sun, sea, sand and road surface drawn into `ctx` over the top `h` pixels. */
export function drawBackdrop(ctx, w, h, roadTop, s) {
  const seaTop = roadTop - 50 * s;
  const sandTop = seaTop + 20 * s;
  ctx.fillStyle = linear(ctx, 0, 0, 0, seaTop,
    [[0, '#86BBF9'], [0.45, '#A6CBF3'], [0.78, '#E9DDAA'], [0.92, '#F7C98A'], [1, '#F6A88C']]);
  ctx.fillRect(0, 0, w, seaTop);

  const sx = w / 2, sy = Math.max(seaTop - 112 * s, 60 * s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, seaTop);
  ctx.clip();
  radialGlow(ctx, sx, sy, 85 * s, 'rgba(255,246,208,0.75)', 'rgba(255,246,208,0)');
  ctx.fillStyle = '#FFF3C0';
  ctx.beginPath();
  ctx.arc(sx, sy, 48 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = linear(ctx, 0, seaTop, 0, sandTop, [[0, '#9BD6F5'], [1, '#C6EDF8']]);
  ctx.fillRect(0, seaTop, w, sandTop - seaTop);
  ctx.fillStyle = '#FFB08F';
  ctx.fillRect(0, seaTop - 1 * s, w, 2 * s);
  ctx.fillStyle = '#FFFBE2';
  const ell = (x, y, ew, eh) => { ctx.beginPath(); ctx.ellipse(x, y, ew / 2, eh / 2, 0, 0, Math.PI * 2); ctx.fill(); };
  ell(sx, seaTop + 5 * s, 68 * s, 6 * s);
  ell(sx, seaTop + 11 * s, 48 * s, 4 * s);
  ell(sx, seaTop + 15.5 * s, 28 * s, 3 * s);

  ctx.fillStyle = linear(ctx, 0, sandTop, 0, roadTop, [[0, '#C6A262'], [1, '#A58448']]);
  ctx.fillRect(0, sandTop, w, roadTop - sandTop);

  ctx.fillStyle = '#2B2A29';
  ctx.fillRect(0, roadTop, w, h - roadTop);
  ctx.fillStyle = '#A3A3A3';
  ctx.fillRect(0, roadTop + 1.5 * s, w, 3 * s);
  ctx.fillStyle = '#4B4948';
  ctx.fillRect(0, roadTop + 6 * s, w, h - roadTop - 12 * s);
}

export function roadDashes(width, period, s) {
  const h = 4 * s;
  const [c, ctx] = surface(width, h);
  ctx.fillStyle = '#D2D2D2';
  for (let x = 0; x < width; x += period) {
    rr(ctx, x, 0, period * 0.6, h, h / 2);
    ctx.fill();
  }
  return c;
}

/** Girl riding a kick scooter, drawn in a 100×140 design space. */
export function girl(height) {
  const k = height / 140;
  const [c, ctx] = surface(100 * k, 140 * k);
  ctx.scale(k, k);
  const ink = C.outline;
  const shape = (build, fill, lw = 2.6) => {
    ctx.beginPath();
    build();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const round = (x, y, w, h, r) => () => { rr(ctx, x, y, w, h, r); };
  const oval = (x, y, w, h) => () => { ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); };
  const line = (pts, width, color = ink) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  // scooter stem + handlebar (behind the rider)
  line([[80, 128], [72, 70]], 5);
  line([[64, 70], [80, 68]], 5);

  // hair behind the body
  shape(() => {
    ctx.moveTo(26, 40);
    ctx.bezierCurveTo(18, 60, 18, 84, 24, 96);
    ctx.lineTo(46, 98);
    ctx.lineTo(52, 44);
    ctx.closePath();
  }, '#151515');

  for (const x of [38, 50]) {
    shape(round(x, 96, 9, 26, 3), '#FFF1E4');
    shape(round(x, 112, 9, 10, 2), '#FFFFFF');
    shape(round(x - 1, 120, 13, 6, 3), '#222222');
  }
  shape(round(34, 88, 30, 14, 4), '#FFFFFF');

  // plaid shirt
  ctx.save();
  ctx.beginPath();
  rr(ctx, 30, 62, 34, 32, 8);
  ctx.fillStyle = '#2F7D4C';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#1E5A34';
  for (let i = 34; i < 64; i += 9) ctx.fillRect(i, 62, 3, 32);
  ctx.fillStyle = 'rgba(124,195,143,0.7)';
  for (let j = 67; j < 94; j += 9) ctx.fillRect(30, j, 34, 2.5);
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.6;
  rr(ctx, 30, 62, 34, 32, 8);
  ctx.stroke();

  // arm reaching the handlebar
  line([[52, 68], [66, 72]], 10);
  line([[52, 68], [66, 72]], 6, '#2F7D4C');
  shape(oval(63, 66, 9, 9), '#FFF1E4', 2);

  // head
  shape(oval(30, 28, 38, 38), '#FFF6EE');
  ctx.beginPath();
  ctx.moveTo(30, 44);
  ctx.quadraticCurveTo(34, 32, 50, 34);
  ctx.quadraticCurveTo(44, 44, 40, 50);
  ctx.lineTo(32, 56);
  ctx.closePath();
  ctx.fillStyle = '#151515';
  ctx.fill();
  const fillOval = (x, y, w, h, color) => {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  fillOval(51, 43, 4.5, 6, '#151515');
  fillOval(60, 43, 4.5, 6, '#151515');
  fillOval(47, 51, 6, 3.5, 'rgba(255,157,168,0.8)');
  fillOval(61, 51, 6, 3.5, 'rgba(255,157,168,0.8)');
  ctx.beginPath();
  ctx.moveTo(55, 55);
  ctx.quadraticCurveTo(58, 59, 61, 55);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // cap
  shape(() => {
    ctx.moveTo(28, 42);
    ctx.bezierCurveTo(26, 18, 62, 12, 66, 36);
    ctx.lineTo(76, 40);
    ctx.quadraticCurveTo(72, 44, 62, 42);
    ctx.lineTo(28, 42);
    ctx.closePath();
  }, '#2C9A4E');
  ctx.beginPath();
  ctx.moveTo(44, 26); ctx.lineTo(50, 30); ctx.lineTo(44, 34); ctx.lineTo(47, 30);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // deck + wheels
  shape(round(12, 125, 72, 6, 3), '#2A2A2A');
  shape(oval(6, 124, 14, 14), '#E2394E');
  fillOval(10.5, 128.5, 5, 5, '#333333');
  shape(oval(76, 124, 14, 14), '#3A3A3A');
  fillOval(80.5, 128.5, 5, 5, '#8A8A8A');
  return c;
}

/** Small two-storey house with a teal roof, drawn in a 90×80 design space. */
export function house(height) {
  const k = height / 80;
  const [c, ctx] = surface(90 * k, 80 * k);
  ctx.scale(k, k);
  const shape = (build, fill, lw = 2.4) => {
    ctx.beginPath();
    build();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const rect = (x, y, w, h) => () => ctx.rect(x, y, w, h);
  shape(rect(4, 70, 82, 8), '#8E7A5A');
  shape(rect(10, 30, 70, 42), '#FFFFFF');
  shape(() => { ctx.moveTo(4, 34); ctx.lineTo(22, 6); ctx.lineTo(68, 6); ctx.lineTo(86, 34); ctx.closePath(); }, '#2E8C7C');
  ctx.fillStyle = '#4FB3A2';
  ctx.fillRect(24, 9, 42, 3);
  for (const [x, y] of [[16, 38], [32, 38], [58, 38], [16, 54], [32, 54]]) {
    shape(rect(x, y, 12, 10), '#3F82DB', 1.8);
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 1);
    ctx.lineTo(x + 6, y + 9);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  shape(rect(54, 48, 20, 4), '#B9C4CC', 1.6);
  shape(rect(58, 56, 12, 16), '#9A5A2E', 1.8);
  return c;
}

// ---------------------------------------------------------------- effects

export function leaf(size) {
  const w = size, h = size * 0.72, m = h / 2;
  const [c, ctx] = surface(w, h);
  ctx.beginPath();
  ctx.moveTo(1.5, m);
  ctx.bezierCurveTo(w * 0.25, -m * 0.2, w * 0.7, 0, w - 1.5, m);
  ctx.bezierCurveTo(w * 0.7, h, w * 0.25, h * 1.2, 1.5, m);
  ctx.closePath();
  ctx.fillStyle = '#D9F2AE';
  ctx.fill();
  ctx.strokeStyle = '#4F8A2B';
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.15, m);
  ctx.lineTo(w * 0.8, m);
  ctx.lineWidth = Math.max(0.8, size * 0.05);
  ctx.stroke();
  return c;
}

export function sparkle(size) {
  const [c, ctx] = surface(size, size);
  const cx = size / 2, r = size / 2, w = size * 0.1;
  radialGlow(ctx, cx, cx, r, 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(cx, cx - r);
  ctx.quadraticCurveTo(cx + w, cx - w, cx + r, cx);
  ctx.quadraticCurveTo(cx + w, cx + w, cx, cx + r);
  ctx.quadraticCurveTo(cx - w, cx + w, cx - r, cx);
  ctx.quadraticCurveTo(cx - w, cx - w, cx, cx - r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return c;
}

export function glow(size) {
  // The puff's core. In the original this is a solid white ball with a crisp edge, not a soft
  // glow — the hard edge is most of why the clear reads as a distinct "pop".
  const [c, ctx] = surface(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.82, '#FFFDF4');
  g.addColorStop(0.93, 'rgba(255,248,226,0.85)');
  g.addColorStop(1, 'rgba(255,243,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function ring(size) {
  // The dust ring a cleared tile leaves behind: measured off the original, where the white puff
  // hollows out into a speckled cream ring that thins as it fades.
  const [c, ctx] = surface(size, size);
  const mid = size / 2;
  const lw = size * 0.085;
  const r = mid - lw;
  ctx.strokeStyle = '#F7E4BE';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(mid, mid, r, 0, Math.PI * 2);
  ctx.stroke();
  // grains around the rim, uneven like the original's
  ctx.fillStyle = '#FFF6E2';
  const grains = 13;
  for (let i = 0; i < grains; i++) {
    const a = (i / grains) * Math.PI * 2 + (i % 3) * 0.11;
    const rr = r + (i % 4 - 1.5) * lw * 0.42;
    const dot = lw * (0.3 + (i % 5) * 0.11);
    ctx.beginPath();
    ctx.arc(mid + Math.cos(a) * rr, mid + Math.sin(a) * rr, dot, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------------------------------------------------------------- twist entrances

/** A pale streak of rushing air, pointing right; rotated for the other directions. */
export function streak(length, thickness) {
  const [c, ctx] = surface(length, thickness);
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, 0, 0, length, thickness, thickness / 2);
  ctx.fillStyle = g;
  ctx.fill();
  return c;
}

export function band(w, h) {
  const [c, ctx] = surface(w, h);
  ctx.fillStyle = 'rgba(255,224,184,0.32)';
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function arrow(size) {
  const [c, ctx] = surface(size, size);
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s * 0.39);
  ctx.lineTo(s * 0.52, s * 0.39);
  ctx.lineTo(s * 0.52, s * 0.2);
  ctx.lineTo(s * 0.88, s * 0.5);
  ctx.lineTo(s * 0.52, s * 0.8);
  ctx.lineTo(s * 0.52, s * 0.61);
  ctx.lineTo(s * 0.12, s * 0.61);
  ctx.closePath();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = s * 0.1;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return c;
}
