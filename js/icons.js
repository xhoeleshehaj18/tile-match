// Every little picture in the game's interface, drawn in code in one sticker style: a thick ink
// outline, flat pastel fills with a shade along the lower left (the light comes from the upper
// right, as on the riders) and a white gloss. Emoji look different on every phone and never
// matched the drawn riders, so the HUD, the menus and the panels all use these instead.
//
// An icon is a list of parts in a 32×32 box, drawn in order. The same parts are painted onto a
// canvas (the HUD, via Path2D) and built as inline SVG (the HTML panels), so both match exactly.
// In text, `{name}` stands for an icon: "Thinking of you {hearts}".

const INK = '#1E2208';
const OUT = 2; // outline width in the 32-unit box
const SH = [1.3, -1.5]; // how far the main fill sits up and to the right of its shade
const BLUSH = 'rgba(255,112,150,0.55)';

const K = {
  pink: '#FF7EB0', pinkSh: '#EC5F98', pinkLt: '#FFB3D1', pinkLtSh: '#F591BA', pinkDk: '#E0558F',
  red: '#FF6B7A', redSh: '#E64E60',
  gold: '#FFD23F', goldSh: '#F5A51F', goldLt: '#FFEA95', goldDk: '#EE9A12',
  orange: '#FF9A45', orangeSh: '#F07A22',
  blue: '#74C3FF', blueSh: '#4FA5EE', paleBlue: '#EAF6FF',
  green: '#6CCB6A', greenSh: '#4CB050',
  mint: '#86DDB5', mintSh: '#5FC495',
  lilac: '#C3A4FF', lilacSh: '#A283F2', paleLilac: '#F6F1FF',
  paper: '#FFFDF7', paperSh: '#EDE5D3',
  cream: '#FFF3DA', creamSh: '#EDD9B2',
  brown: '#C98B55', brownSh: '#A96E3E',
  metal: '#BCC6D3', metalSh: '#9AA6B6',
  dark: '#4A4453',
  ele: '#B9C8EA', eleSh: '#98A9D2',
};

// ---------------------------------------------------------------- geometry, as SVG path strings

const n = v => +v.toFixed(2);
const TAU = Math.PI * 2;

function ellipse(cx, cy, rx, ry) {
  return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;
}
const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

function rect(x, y, w, h, r = 0) {
  r = Math.min(r, w / 2, h / 2);
  if (!r) return `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;
  const a = `A${n(r)} ${n(r)} 0 0 1`;
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}${a} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}${a} ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}${a} ${n(x)} ${n(y + h - r)}V${n(y + r)}${a} ${n(x + r)} ${n(y)}Z`;
}

/** A closed polygon with its corners rounded off (one radius, or one per corner). */
function roundPoly(pts, r = 1) {
  let d = '';
  pts.forEach((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const k = Array.isArray(r) ? r[i] : r;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ta = Math.min(k, la / 2) / la, tb = Math.min(k, lb / 2) / lb;
    d += `${i ? 'L' : 'M'}${n(p[0] + (a[0] - p[0]) * ta)} ${n(p[1] + (a[1] - p[1]) * ta)}` +
      `Q${n(p[0])} ${n(p[1])} ${n(p[0] + (b[0] - p[0]) * tb)} ${n(p[1] + (b[1] - p[1]) * tb)}`;
  });
  return d + 'Z';
}

function starPoints(cx, cy, R, r, points = 5) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points, d = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  return pts;
}
const star5 = (cx, cy, R, r, round = [2.4, 1.1]) =>
  roundPoly(starPoints(cx, cy, R, r), starPoints(cx, cy, R, r).map((_, i) => round[i % 2]));

/** A four-pointed twinkle. */
function twinkle(cx, cy, r, w = 0.2) {
  const q = r * w;
  return `M${n(cx)} ${n(cy - r)}Q${n(cx + q)} ${n(cy - q)} ${n(cx + r)} ${n(cy)}Q${n(cx + q)} ${n(cy + q)} ${n(cx)} ${n(cy + r)}` +
    `Q${n(cx - q)} ${n(cy + q)} ${n(cx - r)} ${n(cy)}Q${n(cx - q)} ${n(cy - q)} ${n(cx)} ${n(cy - r)}Z`;
}

/** Moves every point of a path built from absolute M/L/H/V/C/Q/Z commands (H and V become L). */
function mapPath(d, fn) {
  let out = '', cmd = '', x = 0, y = 0;
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'Z' || 'MLCQ'.includes(cmd)) out += cmd;
      else if (cmd !== 'H' && cmd !== 'V') throw new Error(`mapPath: ${cmd}`);
      continue;
    }
    if (cmd === 'H' || cmd === 'V') {
      if (cmd === 'H') x = +t; else y = +t;
      const [a, b] = fn(x, y);
      out += `L${n(a)} ${n(b)}`;
      i++;
    } else {
      x = +t;
      y = +tokens[i + 1];
      const [a, b] = fn(x, y);
      out += `${n(a)} ${n(b)} `;
      i += 2;
    }
  }
  return out.trim();
}
function turn(d, deg, cx = 16, cy = 16) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return mapPath(d, (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
const shift = (d, dx, dy) => mapPath(d, (x, y) => [x + dx, y + dy]);

const HEART = 'M16 27.2C10.4 23.6 3.6 19 3.6 12.2C3.6 8.3 6.5 5.4 10.1 5.4C12.6 5.4 14.8 6.8 16 9C17.2 6.8 19.4 5.4 21.9 5.4C25.5 5.4 28.4 8.3 28.4 12.2C28.4 19 21.6 23.6 16 27.2Z';
/** A heart centred on (cx, cy), `hw` from its middle to either side. */
const heart = (cx, cy, hw) => mapPath(HEART, (x, y) => [cx + ((x - 16) * hw) / 12.4, cy + ((y - 16.3) * hw) / 12.4]);

// ---------------------------------------------------------------- parts

/** A filled shape with an ink outline, and a shade if `sh` is given. */
const solid = (d, f, sh = null, o = OUT) => ({ d, f, sh, o });
/** A filled shape with no outline: markings on top of another part. */
const flat = (d, f, a) => ({ d, f, a });
/** A thick coloured line with an ink outline around it. */
const line = (d, c, w, o = OUT) => ({ d, line: c, w, o });
/** A plain stroke: ink by default. */
const stroke = (d, w = 1.6, s = INK, a) => ({ d, s, w, a });
/** The white shine. */
const gloss = (d, w = 1.7, a = 0.9) => ({ d, s: '#FFFFFF', w, a });

const eyes = (x1, x2, y, rx = 1.35, ry = 1.75) => [
  flat(ellipse(x1, y, rx, ry), INK), flat(ellipse(x2, y, rx, ry), INK),
  flat(circle(x1 + rx * 0.3, y - ry * 0.35, rx * 0.42), '#FFFFFF'), flat(circle(x2 + rx * 0.3, y - ry * 0.35, rx * 0.42), '#FFFFFF'),
];
const cheeks = (x1, x2, y, rx = 1.9, ry = 1.15) => [flat(ellipse(x1, y, rx, ry), BLUSH), flat(ellipse(x2, y, rx, ry), BLUSH)];

// ---------------------------------------------------------------- the icons

const ARROW = [[16, 3.4], [27.8, 15.4], [20.6, 15.4], [20.6, 27.6], [11.4, 27.6], [11.4, 15.4], [4.2, 15.4]];
const ARROW_R = [1.8, 1.4, 0.6, 1.4, 1.4, 0.6, 1.4];
const arrow = deg => [
  solid(turn(roundPoly(ARROW, ARROW_R), deg), K.blue, K.blueSh),
  gloss(turn('M18.2 7.4L22 11.2', deg)),
];

const SPEAKER = 'M5.2 12.4H9.6L15.4 7.4C16.2 6.7 17.4 7.3 17.4 8.4V23.6C17.4 24.7 16.2 25.3 15.4 24.6L9.6 19.6H5.2C4.3 19.6 3.6 18.9 3.6 18V14C3.6 13.1 4.3 12.4 5.2 12.4Z';

const BULB = 'M16 3.4C10.4 3.4 6.6 7.6 6.6 12.6C6.6 16 8.3 18.2 10 20C11 21.1 11.6 22.1 11.6 23.4H20.4C20.4 22.1 21 21.1 22 20C23.7 18.2 25.4 16 25.4 12.6C25.4 7.6 21.6 3.4 16 3.4Z';

const FLAME = 'M16 29C10.2 29 6.2 25 6.2 19.8C6.2 15.4 8.8 12.6 11 9.6C11.6 11.6 12.8 12.8 14.4 13.2C14 9 16 5.4 19.6 3C19.8 7 21.6 9.6 23.6 12.4C25.2 14.7 25.8 17 25.8 19.8C25.8 25 21.8 29 16 29Z';
const FLAME_IN = 'M16 26.6C13.2 26.6 11.4 24.8 11.4 22.4C11.4 19.8 13.2 18.4 14.4 16.2C15.2 17.8 16.4 18.6 17.8 18.4C19.4 19.8 20.6 21 20.6 22.6C20.6 24.9 18.8 26.6 16 26.6Z';

const PIECE = shift('M5 11.6C5 10.4 6 9.5 7.2 9.5H11.2C10.7 8.9 10.5 8.3 10.5 7.6C10.5 5.6 12.1 4 14.1 4C16.1 4 17.7 5.6 17.7 7.6' +
  'C17.7 8.3 17.5 8.9 17 9.5H20.8C22 9.5 23 10.5 23 11.7V15.2C23.6 14.7 24.3 14.4 25.1 14.4C27.1 14.4 28.7 16 28.7 18' +
  'C28.7 20 27.1 21.6 25.1 21.6C24.3 21.6 23.6 21.3 23 20.8V25.3C23 26.5 22 27.5 20.8 27.5H7.2C6 27.5 5 26.5 5 25.3Z', -0.9, 0.3);

function gear(cx, cy, R, r, teeth = 8) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU - Math.PI / 2;
    for (const [da, d] of [[-0.3, r], [-0.19, R], [0.19, R], [0.3, r]]) pts.push([cx + Math.cos(a + da) * d, cy + Math.sin(a + da) * d]);
  }
  return roundPoly(pts, 0.9);
}

export const ICONS = {
  heart: [solid(HEART, K.pink, K.pinkSh), gloss('M21.2 8.7C23.5 8.5 25.3 10 25.6 12.2')],
  hearts: [
    solid(heart(21.6, 10.8, 7.2), K.pinkLt, K.pinkLtSh),
    solid(heart(13, 18.8, 9.6), K.pink, K.pinkSh),
    gloss('M17.2 12.6C19 12.5 20.3 13.7 20.5 15.4', 1.5),
  ],
  star: [solid(star5(16, 17.2, 13.6, 6.9), K.gold, K.goldSh), gloss('M17.5 8.3L18.6 10.8', 1.6)],
  starOff: [{ d: star5(16, 17.2, 13.6, 6.9), f: '#E9E2CC', sh: '#DDD3B6', o: OUT, oc: 'rgba(30,34,8,0.3)' }],
  coin: [
    solid(circle(16, 16, 12.2), K.gold, K.goldSh),
    stroke(circle(16, 16, 8.4), 1.6, K.goldLt),
    flat(heart(16, 16.4, 4.8), K.goldDk),
    gloss('M20.5 6.6C23.2 7.6 25.1 9.8 25.7 12.6'),
  ],
  pause: [
    solid(rect(7.6, 6.4, 6.6, 19.2, 3.3), K.blue, K.blueSh),
    solid(rect(17.8, 6.4, 6.6, 19.2, 3.3), K.blue, K.blueSh),
    gloss('M12 9.4V12.2', 1.5), gloss('M22.2 9.4V12.2', 1.5),
  ],
  calendarBlank: [
    solid(rect(4.4, 7.4, 23.2, 20.8, 4.4), K.paper, K.paperSh),
    solid('M4.4 11.8C4.4 9.37 6.37 7.4 8.8 7.4H23.2C25.63 7.4 27.6 9.37 27.6 11.8V13.8H4.4Z', K.pink),
    solid(rect(9.3, 4.2, 3.4, 6.4, 1.7), '#FFFFFF'),
    solid(rect(19.3, 4.2, 3.4, 6.4, 1.7), '#FFFFFF'),
  ],
  bag: [
    line('M11.4 12.6C11.4 5.6 20.6 5.6 20.6 12.6', K.pinkDk, 1.8, 1.8),
    solid('M7.8 11.6H24.2C25.1 11.6 25.9 12.3 26 13.2L27 25.4C27.1 26.9 26 28.2 24.4 28.2H7.6C6 28.2 4.9 26.9 5 25.4L6 13.2C6.1 12.3 6.9 11.6 7.8 11.6Z', K.pink, K.pinkSh),
    flat(heart(16, 20.2, 5), '#FFFFFF'),
    gloss('M22.9 14.6L23.3 18.6', 1.5),
  ],
  clock: [
    solid(rect(13.4, 2.4, 5.2, 4.6, 1.8), K.pink),
    solid(circle(16, 18.4, 11.2), K.blue, K.blueSh),
    solid(circle(16, 18.4, 7.6), K.paper, null, 1.6),
    stroke('M16 18.4V13.9M16 18.4L19.3 20.2', 2),
    gloss('M21.8 9.9C23.7 11 25 12.8 25.6 14.8'),
  ],
  bolt: [
    solid(roundPoly([[18.8, 3], [6.6, 18.4], [14.4, 18.4], [12.4, 29], [25.4, 12.6], [17.4, 12.6]], [1.2, 1.4, 0.6, 1.2, 1.4, 0.6]), K.gold, K.goldSh),
    gloss('M16.9 7.6L14.6 10.6', 1.5),
  ],
  check: [line('M7.4 16.6L13.2 22.4L24.8 10', K.green, 4.2)],
  cross: [line('M9.4 9.4L22.6 22.6M22.6 9.4L9.4 22.6', K.red, 4.2)],
  x: [stroke('M9.2 9.2L22.8 22.8M22.8 9.2L9.2 22.8', 3.6, 'currentColor')],
  plus: [line('M16 7.6V24.4M7.6 16H24.4', K.green, 4.2)],
  arrowUp: arrow(0),
  arrowRight: arrow(90),
  arrowDown: arrow(180),
  arrowLeft: arrow(270),
  bulb: [
    solid(BULB, K.gold, K.goldSh),
    stroke(heart(16, 15.6, 3.3), 1.5, '#F08A00'),
    solid(rect(11.2, 22.6, 9.6, 6.6, 2.4), K.metal, K.metalSh),
    stroke('M12.8 25.9H19.2', 1.4, K.metalSh),
    gloss('M20.4 6.6C22.6 7.8 23.6 9.8 23.8 12'),
  ],
  shuffle: [
    line('M4.6 21.8H8.6C14.2 21.8 16.2 10.2 21.8 10.2H23', K.lilac, 2.8),
    solid(roundPoly([[22.2, 5.4], [28.6, 10.2], [22.2, 15]], 1), K.lilac),
    line('M4.6 10.2H8.6C14.2 10.2 16.2 21.8 21.8 21.8H23', K.lilac, 2.8),
    solid(roundPoly([[22.2, 17], [28.6, 21.8], [22.2, 26.6]], 1), K.lilac),
  ],
  flame: [solid(FLAME, K.orange, K.orangeSh), flat(FLAME_IN, K.gold), gloss('M21.8 13.2C23.1 14.7 23.8 16.5 23.8 18.4', 1.5)],
  spark: [solid(twinkle(16, 16, 13.2, 0.22), K.goldLt, K.gold)],
  sparkle: [
    solid(twinkle(13.4, 13.8, 10.6), K.goldLt, K.gold),
    solid(twinkle(24.4, 24, 5.4, 0.24), K.goldLt, K.gold, 1.6),
    solid(circle(25.4, 7.4, 1.8), K.goldLt, null, 1.4),
  ],
  candy: [
    solid(roundPoly([[10.6, 16], [3.2, 10], [5.2, 16], [3.2, 22]], [0.6, 1.4, 1, 1.4]), K.pinkLt, K.pinkLtSh),
    solid(roundPoly([[21.4, 16], [28.8, 10], [26.8, 16], [28.8, 22]], [0.6, 1.4, 1, 1.4]), K.pinkLt, K.pinkLtSh),
    solid(circle(16, 16, 7.8), K.pink, K.pinkSh),
    stroke('M11.8 11.2C15.2 12.8 16.4 17.2 14.2 22.4M16.8 9.4C20.2 11.4 21 16.4 18.8 21.4', 1.7, '#FFFFFF', 0.85),
  ],
  gift: [
    solid(rect(6.2, 14.2, 19.6, 14.2, 2.6), K.pink, K.pinkSh),
    solid(rect(14, 15.4, 4, 13, 0), K.gold),
    solid(rect(4.6, 10.2, 22.8, 6.4, 2.4), K.pinkLt, K.pinkLtSh),
    solid(rect(13.6, 10.2, 4.8, 6.4, 0), K.gold),
    solid('M16 10.4C13.4 4.6 8.2 4.6 9 7.8C9.6 10 12.6 10.6 16 10.4Z', K.gold, K.goldSh),
    solid('M16 10.4C18.6 4.6 23.8 4.6 23 7.8C22.4 10 19.4 10.6 16 10.4Z', K.gold, K.goldSh),
    solid(ellipse(16, 10.4, 2.2, 1.9), K.gold),
  ],
  puzzle: [solid(PIECE, K.mint, K.mintSh), gloss('M19.6 11.6C20.8 12 21.4 12.8 21.6 14', 1.5)],
  gear: [solid(gear(16, 16, 13.4, 10.2), '#AFC0D6', '#8FA2BD'), solid(circle(16, 16, 4.4), K.paper)],
  gamepad: [
    solid('M10 9.4H22C26.8 9.4 29.6 13.2 29.8 18.2C30 22.6 28.4 25.6 25.8 25.6C23.8 25.6 22.4 24 21 22H11C9.6 24 8.2 25.6 6.2 25.6' +
      'C3.6 25.6 2 22.6 2.2 18.2C2.4 13.2 5.2 9.4 10 9.4Z', K.lilac, K.lilacSh),
    flat(rect(7, 15.3, 7.6, 2.6, 0.9), K.dark), flat(rect(9.5, 12.8, 2.6, 7.6, 0.9), K.dark),
    solid(circle(21.8, 14.6, 1.9), K.pink, null, 1.4),
    solid(circle(25.2, 18, 1.9), K.gold, null, 1.4),
    gloss('M24.8 11.4C26.3 12.1 27.3 13.3 27.7 14.8', 1.5),
  ],
  scooter: [
    line('M23 22.6L25.8 8', K.pink, 2.4),
    line('M22.4 8H28.6', K.dark, 2.2),
    line('M5.8 22.6H23', K.pink, 3),
    solid(circle(7.8, 25.2, 3.6), K.dark), flat(circle(7.8, 25.2, 1.3), '#FFFFFF'),
    solid(circle(23.6, 25.2, 3.6), K.dark), flat(circle(23.6, 25.2, 1.3), '#FFFFFF'),
  ],
  trophy: [
    line('M9 8.6H6.8C4.9 8.6 4.3 10.8 5 12.6C5.8 14.6 7.6 15.6 9.8 15.4', K.gold, 2.2),
    line('M23 8.6H25.2C27.1 8.6 27.7 10.8 27 12.6C26.2 14.6 24.4 15.6 22.2 15.4', K.gold, 2.2),
    solid(rect(14, 19.6, 4, 5, 0), K.goldSh),
    solid('M8.4 5.2H23.6V11.8C23.6 17.2 20.4 20.6 16 20.6C11.6 20.6 8.4 17.2 8.4 11.8Z', K.gold, K.goldSh),
    flat(roundPoly(starPoints(16, 12.2, 4.2, 2), 0.4), '#FFF4B8'),
    solid(rect(9.4, 24, 13.2, 5, 2), K.brown, K.brownSh),
    gloss('M21 7.8V11.6', 1.5),
  ],
  elephant: [
    solid(circle(7.4, 13.6, 5.8), K.ele, K.eleSh), flat(circle(7.8, 14, 3.3), K.pinkLt),
    solid(circle(24.6, 13.6, 5.8), K.ele, K.eleSh), flat(circle(24.2, 14, 3.3), K.pinkLt),
    solid(circle(16, 15, 9.4), K.ele, K.eleSh),
    line('M16 18.4C16 22.6 16.4 25.4 18.8 26.2C20.8 26.9 22.8 25.6 23 23.2', K.ele, 3.4),
    ...eyes(12.4, 19.6, 13.4, 1.25, 1.6),
    ...cheeks(10.6, 21.4, 17.2, 1.7, 1.05),
    gloss('M19.8 7.4C21.8 8 23.2 9.4 23.8 11.2', 1.5),
  ],
  sound: [
    solid(SPEAKER, K.blue, K.blueSh),
    stroke('M21 12.2C22.6 13.8 22.6 18.2 21 19.8M24.4 9C27.6 12.4 27.6 19.6 24.4 23', 2.2),
  ],
  mute: [solid(SPEAKER, K.blue, K.blueSh), line('M21.4 12.6L27.8 19M27.8 12.6L21.4 19', K.red, 2.2, 1.8)],
  vibrate: [
    solid(rect(10, 4.2, 12, 23.6, 3.2), K.lilac, K.lilacSh),
    flat(rect(12.2, 7.4, 7.6, 14.8, 1.3), K.paleLilac),
    flat(circle(16, 24.6, 1.1), K.paleLilac),
    stroke('M6.4 10.4L4.2 12.8L6.4 15.2L4.2 17.6L6.4 20M25.6 10.4L27.8 12.8L25.6 15.2L27.8 17.6L25.6 20', 1.7),
  ],
  globe: [
    solid(circle(16, 16, 12.4), K.blue, K.blueSh),
    flat('M8.8 8.8C11.2 7.8 13.8 8.8 13.6 11.2C13.4 13 11.4 13.4 11.2 15.4C11 17.2 12.8 18.4 12 20.4C11.2 22.2 8.6 21.4 7.4 19.2C5.8 16.2 5.8 11 8.8 8.8Z', K.green),
    flat('M18.8 14.4C20.6 13.2 23.6 13.8 24.2 16.2C24.8 18.6 22.8 21.2 20.8 22.2C19.2 23 18 21.8 18.4 20C18.8 18.4 17.2 15.8 18.8 14.4Z', K.green),
    flat(ellipse(19.2, 8.4, 2.2, 1.3), K.green),
    gloss('M21.4 5.9C23.6 6.9 25.3 8.6 26.3 10.8'),
  ],
  refresh: [
    line('M7.2 13.4C8.4 9 11.8 6.4 16 6.4C19.4 6.4 22.2 8.2 23.8 11', K.green, 2.6),
    solid(roundPoly([[25.9, 14.65], [20.37, 12.3], [26.63, 8.7]], 0.8), K.green),
    line('M24.8 18.6C23.6 23 20.2 25.6 16 25.6C12.6 25.6 9.8 23.8 8.2 21', K.green, 2.6),
    solid(roundPoly([[6.1, 17.35], [11.63, 19.7], [5.37, 23.3]], 0.8), K.green),
  ],
  phone: [
    solid(rect(8.4, 3, 15.2, 26, 3.8), K.blue, K.blueSh),
    flat(rect(10.9, 6.6, 10.2, 17.4, 1.6), K.paleBlue),
    flat(heart(16, 15, 3.4), K.pink),
    flat(rect(14, 25.6, 4, 1.3, 0.65), K.paleBlue),
  ],
  share: [
    stroke('M11.4 12.2H9.2C7.8 12.2 6.8 13.2 6.8 14.6V25.8C6.8 27.2 7.8 28.2 9.2 28.2H22.8C24.2 28.2 25.2 27.2 25.2 25.8V14.6' +
      'C25.2 13.2 24.2 12.2 22.8 12.2H20.6M16 19.4V4.2M11.2 8.8L16 4L20.8 8.8', 2.4, '#1F96FA'),
  ],
  bug: [
    stroke('M13.6 7.6C12.8 5.2 11.2 4 9.4 4.2M18.4 7.6C19.2 5.2 20.8 4 22.6 4.2', 1.6),
    flat(circle(9.4, 4.2, 1.3), INK), flat(circle(22.6, 4.2, 1.3), INK),
    solid(circle(16, 10.2, 5.4), K.dark),
    flat(circle(14.2, 7.9, 1), '#FFFFFF'), flat(circle(17.8, 7.9, 1), '#FFFFFF'),
    solid(circle(16, 19.6, 9.4), K.red, K.redSh),
    stroke('M16 10.6V28.6', 1.6),
    flat(circle(11.6, 17.4, 1.9), INK), flat(circle(20.4, 17.4, 1.9), INK),
    flat(circle(11.8, 23.2, 1.5), INK), flat(circle(20.2, 23.2, 1.5), INK),
    gloss('M21.8 12.6C23.3 13.5 24.3 14.9 24.7 16.4', 1.5),
  ],
  envelope: [
    solid(rect(3.6, 7.6, 24.8, 17.8, 3.4), '#FFF8E8', '#EFE0BE'),
    stroke('M5.4 9.6L16 18L26.6 9.6', 1.8),
    solid(heart(16, 17.6, 4), K.pink, null, 1.6),
  ],
  clipboard: [
    solid(rect(6.2, 5.4, 19.6, 23.6, 3.2), K.brown, K.brownSh),
    flat(rect(9, 9.2, 14, 17, 1.4), K.paper),
    stroke('M11.6 14H20.4M11.6 17.8H20.4M11.6 21.6H17.2', 1.5, '#CFC4AC'),
    solid(rect(11.4, 3, 9.2, 5.2, 2), K.metal, K.metalSh),
  ],
  home: [
    solid(rect(20.4, 6.4, 3.6, 6.4, 0.8), '#E0876A'),
    solid('M7.4 14.6V25.8C7.4 27.1 8.4 28.2 9.8 28.2H22.2C23.6 28.2 24.6 27.1 24.6 25.8V14.6L16 7.4Z', K.cream, K.creamSh),
    line('M4.6 15.6L16 6L27.4 15.6', '#FF8A7A', 3),
    solid('M13.4 28.2V22.2C13.4 20.8 14.6 19.6 16 19.6C17.4 19.6 18.6 20.8 18.6 22.2V28.2Z', K.brown, null, 1.8),
    flat(heart(16, 14.9, 2.8), K.pink),
  ],
  dizzy: [
    solid(circle(16, 17.8, 11), '#FFE08A', '#F7C352'),
    stroke('M13.2 15.8C13.2 14.3 11.9 13.4 10.8 13.7C9.6 14 9.1 15.3 9.6 16.2C10.1 17 11.4 17 11.8 16.1' +
      'M18.8 15.8C18.8 14.3 20.1 13.4 21.2 13.7C22.4 14 22.9 15.3 22.4 16.2C21.9 17 20.6 17 20.2 16.1', 1.4),
    stroke('M12.2 22.6C13.4 21.4 14.6 23.8 16 22.6C17.4 21.4 18.6 23.8 19.8 22.6', 1.4),
    ...cheeks(9, 23, 20.2),
    solid(twinkle(5.6, 5.8, 3.8, 0.26), K.goldLt, null, 1.3),
    solid(twinkle(26.6, 6.2, 3, 0.26), K.goldLt, null, 1.3),
  ],
  yuzu: [
    solid(circle(16, 18, 10.8), '#FFB21E', '#F09500'),
    solid('M16.4 7.6C17 4.2 21.2 2.6 24.6 3.8C23.4 7.2 19.8 8.8 16.4 7.6Z', K.green, K.greenSh),
    flat(circle(20.6, 20.8, 0.8), '#F09500'), flat(circle(12, 21.8, 0.7), '#F09500'), flat(circle(17.2, 24.6, 0.7), '#F09500'),
    gloss('M21.2 10.4C23.4 11.6 24.8 13.6 25.2 15.8'),
  ],
};
ICONS.calendar = [...ICONS.calendarBlank, flat(heart(16, 20.9, 4.6), K.pink)];

/** Where the date goes on `calendarBlank`, in the 32-unit box. */
export const CALENDAR_PAGE = { x: 16, y: 21.1, size: 11 };

// ---------------------------------------------------------------- canvas

const paths = new Map();
const path2d = d => {
  let p = paths.get(d);
  if (!p) paths.set(d, (p = new Path2D(d)));
  return p;
};

/**
 * Paints an icon centred on (cx, cy), `size` across. `color` is what the few "currentColor"
 * parts (e.g. the plain ✕) are drawn in.
 */
export function drawIcon(ctx, name, cx, cy, size, { alpha = 1, color = INK } = {}) {
  const parts = ICONS[name];
  if (!parts) return;
  const pick = c => (c === 'currentColor' ? color : c);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 32, size / 32);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of parts) {
    const path = path2d(p.d);
    ctx.globalAlpha = alpha * (p.a ?? 1);
    if (p.line) {
      if (p.o) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = p.w + p.o * 2;
        ctx.stroke(path);
      }
      ctx.strokeStyle = pick(p.line);
      ctx.lineWidth = p.w;
      ctx.stroke(path);
      continue;
    }
    if (p.f) {
      ctx.fillStyle = pick(p.sh ?? p.f);
      ctx.fill(path);
      if (p.sh) {
        ctx.save();
        ctx.clip(path);
        ctx.translate(SH[0], SH[1]);
        ctx.fillStyle = pick(p.f);
        ctx.fill(path);
        ctx.restore();
      }
    }
    if (p.s) {
      ctx.strokeStyle = pick(p.s);
      ctx.lineWidth = p.w;
      ctx.stroke(path);
    }
    if (p.o) {
      ctx.strokeStyle = p.oc ?? INK;
      ctx.lineWidth = p.o;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

/** A plain heart in the current fill style, `hw` from its middle to either side (for patterns and confetti). */
export function fillHeart(ctx, cx, cy, hw) {
  ctx.fill(path2d(heart(cx, cy, hw)));
}

// ---------------------------------------------------------------- HTML

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function node(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.append(el);
  return el;
}

/**
 * How big the panels are drawn right now: style.css sizes them in rem, which is 16px on a phone
 * like hers and follows the screen. Anything drawn for a panel in pixels is scaled by this too.
 */
export const uiScale = () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;

/** The icon as an inline <svg>, sized by CSS (class `ic` is 1.25em square, sitting on the text). */
export function iconEl(name, cls = 'ic') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const round = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' };
  for (const p of ICONS[name] ?? []) {
    const g = p.a != null && p.a !== 1 ? node('g', { opacity: p.a }, svg) : svg;
    if (p.line) {
      if (p.o) node('path', { d: p.d, stroke: INK, 'stroke-width': n(p.w + p.o * 2), ...round }, g);
      node('path', { d: p.d, stroke: p.line, 'stroke-width': p.w, ...round }, g);
      continue;
    }
    if (p.f) {
      node('path', { d: p.d, fill: p.sh ?? p.f }, g);
      if (p.sh) {
        const id = `ic-clip-${++uid}`;
        node('path', { d: p.d }, node('clipPath', { id }, g));
        node('path', { d: p.d, fill: p.f, transform: `translate(${SH[0]} ${SH[1]})` }, node('g', { 'clip-path': `url(#${id})` }, g));
      }
    }
    if (p.s) node('path', { d: p.d, stroke: p.s, 'stroke-width': p.w, ...round }, g);
    if (p.o) node('path', { d: p.d, stroke: p.oc ?? INK, 'stroke-width': p.o, ...round }, g);
  }
  return svg;
}

// ---------------------------------------------------------------- icons in text

const TOKEN = /\{([a-zA-Z]+)\}/g;

/** Text with `{name}` icons in it, split into runs: [{ text }, { icon }, ...]. */
export function iconRuns(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (!ICONS[m[1]]) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ icon: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** The same text as HTML: a fragment of text nodes and inline icons. */
export function rich(text, cls = 'ic') {
  const frag = document.createDocumentFragment();
  for (const r of iconRuns(text)) frag.append(r.icon ? iconEl(r.icon, cls) : r.text);
  return frag;
}

/** The text without its icons, e.g. for a label read aloud. */
export const plain = text => text.replace(TOKEN, '').replace(/\s{2,}/g, ' ').trim();

/** The first icon in a line and the line without it: "Falling Tuesday {arrowDown}" → ['arrowDown', 'Falling Tuesday']. */
export function splitIcon(text) {
  const m = [...text.matchAll(TOKEN)].find(x => ICONS[x[1]]);
  return m ? [m[1], plain(text.replace(m[0], ''))] : [null, text];
}
