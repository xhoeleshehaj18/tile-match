// The HUD's pieces: the buttons along the top and bottom, the pills with the level and score,
// the badges, toasts and the big bouncy words (combo, FEVER!, +30). Everything is built
// like the board's tiles and in the icons' sticker style: a cream face with an ink outline on a
// lip, brown lettering and coloured icons. Drawn once into offscreen canvases, like art.js.

import { surface, rr, FONT } from './art.js';
import { drawIcon, iconRuns, CALENDAR_PAGE } from './icons.js';

const INK = '#1E2208';
export const TEXT = '#5C300A';

/**
 * The looks a HUD piece comes in: the everyday cream one, pink for good news, and blush for
 * anything to do with the photo puzzle (like the piece prize on the result card).
 */
export const LOOK = {
  cream: { face: ['#FBFFE6', '#EDFBC4'], lip: '#62B236', text: TEXT },
  pink: { face: ['#FF9CC8', '#FF73AE'], lip: '#D63F7E', text: '#FFFFFF' },
  blush: { face: ['#FFEAF3', '#FFCCE2'], lip: '#F07AAE', text: TEXT },
};

let measurer = null;
function textWidth(font, text) {
  measurer ??= document.createElement('canvas').getContext('2d');
  measurer.font = font;
  return measurer.measureText(text).width;
}

/**
 * The body every piece shares: a face with an ink outline sitting on a lip. (x, y, w, h) is the
 * whole thing, lip included; returns the face's height.
 */
export function plate(ctx, x, y, w, h, r, lw, lip, look = LOOK.cream) {
  const fh = h - lip;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = look.lip;
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + fh);
  g.addColorStop(0, look.face[0]);
  g.addColorStop(1, look.face[1]);
  rr(ctx, x, y, w, fh, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  rr(ctx, x, y, w, fh, r);
  ctx.stroke();
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  return fh;
}

/** A square button with an icon; `day` writes a date on the calendar. */
export function button(size, icon, { day = null } = {}) {
  const [c, ctx] = surface(size, size);
  const lw = Math.max(1.4, size * 0.055), lip = size * 0.12;
  const b = lw / 2, bs = size - lw;
  const fh = plate(ctx, b, b, bs, bs, size * 0.27, lw, lip);
  const cy = b + fh / 2, is = fh * 0.8;
  if (day === null) {
    drawIcon(ctx, icon, size / 2, cy, is);
  } else {
    drawIcon(ctx, 'calendarBlank', size / 2, cy, is);
    const k = is / 32;
    ctx.font = `900 ${CALENDAR_PAGE.size * k}px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(day), size / 2 + (CALENDAR_PAGE.x - 16) * k, cy + (CALENDAR_PAGE.y - 16) * k + is * 0.02);
  }
  return c;
}

/** The big hint / shuffle buttons along the bottom. */
export function bigButton(w, h, icon) {
  const [c, ctx] = surface(w, h);
  const lw = Math.max(1.8, h * 0.045), lip = h * 0.13;
  const fh = plate(ctx, lw / 2, lw / 2, w - lw, h - lw, h * 0.24, lw, lip);
  drawIcon(ctx, icon, w / 2, lw / 2 + fh / 2, fh * 0.84);
  return c;
}

/**
 * A rounded pill of text, with `{name}` icons drawn in line. `look` picks the colours.
 */
export function pill(text, height, { look = LOOK.cream, fontScale = 0.5, iconScale = 0.74, pad = 0.44, reuse = null } = {}) {
  const lw = Math.max(1.2, height * 0.06), lip = height * 0.12;
  const fh = height - lw - lip;
  const fs = height * fontScale, font = `900 ${fs}px ${FONT}`;
  const is = fh * iconScale, gap = fh * 0.1;
  const runs = iconRuns(text).map((r, i, all) => {
    if (!r.icon) return { ...r, w: textWidth(font, r.text) };
    const lead = i > 0 ? gap : 0;
    return { ...r, lead, w: is + lead + (i < all.length - 1 ? gap : 0) };
  });
  // an icon at either end sits closer to the edge than letters do, so the pill looks even
  const edge = r => fh * (r?.icon ? 0.2 : pad);
  const left = edge(runs[0]), right = edge(runs[runs.length - 1]);
  const inner = runs.reduce((a, r) => a + r.w, 0);
  const w = Math.ceil(inner + left + right + lw);
  const [c, ctx] = surface(w, height, reuse);
  plate(ctx, lw / 2, lw / 2, w - lw, height - lw, fh / 2, lw, lip, look);
  const mid = lw / 2 + fh / 2;
  ctx.font = font;
  ctx.fillStyle = look.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = lw / 2 + left;
  for (const r of runs) {
    if (r.icon) drawIcon(ctx, r.icon, x + r.lead + is / 2, mid, is);
    else ctx.fillText(r.text, x, mid + fs * 0.05);
    x += r.w;
  }
  return c;
}

/** The count on a power button: pink with the number, or green with a plus when it's out. */
export function badge(text, size) {
  const [c, ctx] = surface(size, size);
  const lw = size * 0.085, r = size / 2 - lw / 2, m = size / 2;
  const plus = text === '+';
  const [fill, shade] = plus ? ['#4CC47E', '#2E9A5C'] : ['#FF6FA8', '#E0468A'];
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(m + size * 0.05, m - size * 0.06, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  if (plus) {
    const t = size * 0.15, l = size * 0.5;
    rr(ctx, m - l / 2, m - t / 2, l, t, t / 2);
    ctx.fill();
    rr(ctx, m - t / 2, m - l / 2, t, l, t / 2);
    ctx.fill();
  } else {
    ctx.font = `900 ${size * (text.length > 1 ? 0.5 : 0.58)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, m, m + size * 0.04);
  }
  return c;
}

/** The little "something new" dot. */
export function dot(size) {
  const [c, ctx] = surface(size, size);
  const lw = size * 0.14, m = size / 2;
  ctx.beginPath();
  ctx.arc(m, m, m - lw / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#FF5C9E';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(m, m, m * 0.42, -1.3, -0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = 'round';
  ctx.stroke();
  return c;
}

/** An icon on its own, as a sprite (e.g. the coins that fly into the counter). */
export function icon(name, size) {
  const [c, ctx] = surface(size, size);
  drawIcon(ctx, name, size / 2, size / 2, size);
  return c;
}

/**
 * Big chunky words with depth, like a sticker: each part is { text, size, fill: [top, bottom],
 * lip, italic } or { icon, size }, all set on one baseline.
 */
export function bigText(parts, { reuse = null } = {}) {
  const max = Math.max(...parts.map(p => p.size));
  const laid = parts.map(p => {
    if (p.icon) return { ...p, w: p.size * 1.05 };
    const font = `${p.italic ? 'italic ' : ''}900 ${p.size}px ${FONT}`;
    return { ...p, font, w: textWidth(font, p.text) };
  });
  const pad = max * 0.2, depth = max * 0.07;
  const w = laid.reduce((a, p) => a + p.w, 0) + pad * 2;
  const h = max * 1.18 + pad * 2 + depth;
  const [c, ctx] = surface(w, h, reuse);
  const base = pad + max * 0.92;
  ctx.lineJoin = 'round';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let x = pad;
  for (const p of laid) {
    if (p.icon) {
      drawIcon(ctx, p.icon, x + p.w / 2, base - max * 0.36, p.size);
      x += p.w;
      continue;
    }
    const lw = p.size * 0.16, d = p.size * 0.07;
    ctx.font = p.font;
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.strokeText(p.text, x, base + d);
    ctx.fillStyle = p.lip;
    ctx.fillText(p.text, x, base + d);
    ctx.strokeText(p.text, x, base);
    const g = ctx.createLinearGradient(0, base - p.size * 0.78, 0, base);
    g.addColorStop(0, p.fill[0]);
    g.addColorStop(1, p.fill[1]);
    ctx.fillStyle = g;
    ctx.fillText(p.text, x, base);
    x += p.w;
  }
  return c;
}

/** The colours bigText uses, so the words across the game match. */
export const INKS = {
  pink: { fill: ['#FFB3D6', '#FF4F9A'], lip: '#C22E72' },
  gold: { fill: ['#FFF3A6', '#FFC21A'], lip: '#D08A00' },
  white: { fill: ['#FFFFFF', '#F1ECFF'], lip: '#B9AEE0' },
};

/**
 * A bar that runs down, e.g. the time left to keep a combo going: an outlined cream track with
 * `frac` of it filled in `color`. Drawn straight onto the frame (it changes every frame).
 */
export function drawMeter(ctx, x, y, w, h, frac, color) {
  const lw = Math.max(1.2, h * 0.2);
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#FBFFE6';
  ctx.fill();
  if (frac > 0) {
    const inset = lw * 0.5;
    const fw = Math.max(h - inset * 2, (w - inset * 2) * frac);
    rr(ctx, x + inset, y + inset, fw, h - inset * 2, (h - inset * 2) / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = h * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + inset + h * 0.4, y + h * 0.36);
    ctx.lineTo(x + inset + Math.max(h * 0.4, fw - h * 0.4), y + h * 0.36);
    ctx.stroke();
  }
  rr(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
}
