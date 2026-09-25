// The six shop animals, drawn once as vector data so every renderer paints the exact
// same drawing (the shop draws them as SVG, the game uses frames painted from them by
// art-lab/bake.mjs). Coordinates are the game's rider design space (100 × 140, facing right), so these
// are the same characters as web/js/riders.js, rebuilt as a scene graph:
//
//   { t: 'g', name, o: [x, y], base: [x, y, rot], c: [...] }   a group; `name` is what poses move,
//                                                              pivoting on `o` (in local coordinates)
//   { t: 'solid', d, f, sh, dir, lw, inside }                  filled, shaded on its back edge, outlined
//   { t: 'shape', d, f, lw }                                   filled and outlined
//   { t: 'fill',  d, f }                                       filled only
//   { t: 'line',  d, w, c }                                    stroked only
//   { t: 'limb',  d, c, w }                                    an outlined stroke (tails, arms)
//   { t: 'cloud', puffs }                                      overlapping round puffs outlined as one
//   { t: 'blush', cx, cy, rx, ry }                             a soft rosy cheek
//
// Any node can carry `dyn: 'key'`; a pose may then replace its path with `pose.d[key]` (a swishing
// tail, a fluttering scarf). Every pose is a pure function of time, so any renderer can draw any
// frame in any order.

export const INK = '#2A1C1A';
export const TAU = Math.PI * 2;
const EYE = '#2A1A14';
const SHADE = [-3.4, 3.8];
const HEAD = { x: 47, y: 66, rx: 26, ry: 22 };
const FACE = { x: 52.5, y: 70.5, gap: 17 };

// ---------------------------------------------------------------- path builders (SVG path data)

const n2 = v => Math.round(v * 100) / 100;
const pt = (x, y) => `${n2(x)} ${n2(y)}`;
const K = 0.5523;

export const P = {
  /** An ellipse (optionally rotated), as four cubic arcs. */
  ell(cx, cy, rx, ry, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (x, y) => pt(cx + x * c - y * s, cy + x * s + y * c);
    return `M${at(rx, 0)}C${at(rx, ry * K)} ${at(rx * K, ry)} ${at(0, ry)}C${at(-rx * K, ry)} ${at(-rx, ry * K)} ${at(-rx, 0)}`
      + `C${at(-rx, -ry * K)} ${at(-rx * K, -ry)} ${at(0, -ry)}C${at(rx * K, -ry)} ${at(rx, -ry * K)} ${at(rx, 0)}Z`;
  },
  /** A squishy oval, flatter on top and fullest just below the middle, like a mochi. */
  mochi(cx, cy, rx, ry) {
    const t = cy - ry, b = cy + ry, m = cy + ry * 0.12;
    return `M${pt(cx, t)}C${pt(cx + rx * 0.6, t)} ${pt(cx + rx, cy - ry * 0.55)} ${pt(cx + rx, m)}`
      + `C${pt(cx + rx, b - ry * 0.2)} ${pt(cx + rx * 0.64, b)} ${pt(cx, b)}`
      + `C${pt(cx - rx * 0.64, b)} ${pt(cx - rx, b - ry * 0.2)} ${pt(cx - rx, m)}`
      + `C${pt(cx - rx, cy - ry * 0.55)} ${pt(cx - rx * 0.6, t)} ${pt(cx, t)}Z`;
  },
  /** A soft closed shape through the midpoints of `pts`. */
  blob(pts) {
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = `M${pt(...mid(pts[n - 1], pts[0]))}`;
    for (let i = 0; i < n; i++) d += `Q${pt(...pts[i])} ${pt(...mid(pts[i], pts[(i + 1) % n]))}`;
    return d + 'Z';
  },
  /** A lock of hair: root `a` out to tip `t` and back to root `b`. */
  lock: (a, ca, t, cb, b) => `M${pt(...a)}Q${pt(...ca)} ${pt(...t)}Q${pt(...cb)} ${pt(...b)}Z`,
  poly: pts => `M${pts.map(p => pt(...p)).join('L')}Z`,
  open: pts => `M${pts.map(p => pt(...p)).join('L')}`,
  /** A rounded box with its own radius per corner: top-left, top-right, bottom-right, bottom-left. */
  box(x, y, w, h, [tl, tr, br, bl]) {
    return `M${pt(x + tl, y)}L${pt(x + w - tr, y)}C${pt(x + w - tr + tr * K, y)} ${pt(x + w, y + tr - tr * K)} ${pt(x + w, y + tr)}`
      + `L${pt(x + w, y + h - br)}C${pt(x + w, y + h - br + br * K)} ${pt(x + w - br + br * K, y + h)} ${pt(x + w - br, y + h)}`
      + `L${pt(x + bl, y + h)}C${pt(x + bl - bl * K, y + h)} ${pt(x, y + h - bl + bl * K)} ${pt(x, y + h - bl)}`
      + `L${pt(x, y + tl)}C${pt(x, y + tl - tl * K)} ${pt(x + tl - tl * K, y)} ${pt(x + tl, y)}Z`;
  },
  rr: (x, y, w, h, r) => P.box(x, y, w, h, [r, r, r, r]),
  /** Part of an ellipse's edge, from angle a0 to a1 (clockwise on screen), as an open path. */
  arc(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.35));
    let d = '';
    for (let i = 0; i < n; i++) {
      const u0 = a0 + (a1 - a0) * i / n, u1 = a0 + (a1 - a0) * (i + 1) / n, k = (4 / 3) * Math.tan((u1 - u0) / 4);
      const p = u => [cx + rx * Math.cos(u), cy + ry * Math.sin(u)];
      const dp = u => [-rx * Math.sin(u), ry * Math.cos(u)];
      const [x0, y0] = p(u0), [x1, y1] = p(u1), [dx0, dy0] = dp(u0), [dx1, dy1] = dp(u1);
      if (!i) d += `M${pt(x0, y0)}`;
      d += `C${pt(x0 + k * dx0, y0 + k * dy0)} ${pt(x1 - k * dx1, y1 - k * dy1)} ${pt(x1, y1)}`;
    }
    return d;
  },
  /** A little four-point twinkle. */
  star4(x, y, r, w = 0.2) {
    return `M${pt(x, y - r)}Q${pt(x + r * w, y - r * w)} ${pt(x + r, y)}Q${pt(x + r * w, y + r * w)} ${pt(x, y + r)}`
      + `Q${pt(x - r * w, y + r * w)} ${pt(x - r, y)}Q${pt(x - r * w, y - r * w)} ${pt(x, y - r)}Z`;
  },
  heart(x, y, r) {
    return `M${pt(x, y + r * 0.9)}C${pt(x - r * 1.35, y + r * 0.05)} ${pt(x - r * 0.9, y - r * 1.05)} ${pt(x, y - r * 0.35)}`
      + `C${pt(x + r * 0.9, y - r * 1.05)} ${pt(x + r * 1.35, y + r * 0.05)} ${pt(x, y + r * 0.9)}Z`;
  },
};

// ---------------------------------------------------------------- node builders

const g = (name, o, c, base) => ({ t: 'g', name, o, base, c: c.flat(9) });
const solid = (d, f, sh, { lw = 2.6, dir = SHADE, inside = [], dyn } = {}) => ({ t: 'solid', d, f, sh, dir, lw, inside: inside.flat(9), dyn });
const shape = (d, f, lw = 2.6, dyn) => ({ t: 'shape', d, f, lw, dyn });
const fill = (d, f, dyn) => ({ t: 'fill', d, f, dyn });
const line = (d, w, c = INK, dyn) => ({ t: 'line', d, w, c, dyn });
const limb = (d, c, w = 5.5, dyn) => ({ t: 'limb', d, c, w, dyn });
const gloss = (cx, cy, rx, ry, a0 = -1.35, a1 = -0.75, w = 2.4, a = 0.75) => line(P.arc(cx, cy, rx, ry, a0, a1), w, `rgba(255,255,255,${a})`);
const blush = (cx, cy, rx = 4.2, ry = 2.5) => ({ t: 'blush', cx, cy, rx, ry });

/** A big shiny eye: its open drawing and its closed "‿", swapped by the pose. */
function eye(x, y, { rx = 3.7, ry = 4.6, color = EYE, glow = '#7B5040' } = {}) {
  return g('eye', [x, y], [
    g('eyeOpen', [x, y + ry * 0.6], [
      fill(P.ell(x, y, rx, ry), color),
      glow && fill(P.ell(x, y + ry * 0.45, rx * 0.68, ry * 0.42), glow),
      fill(P.ell(x + rx * 0.26, y - ry * 0.3, rx * 0.5, rx * 0.5), '#FFFFFF'),
      fill(P.ell(x - rx * 0.34, y + ry * 0.42, rx * 0.22, rx * 0.22), '#FFFFFF'),
    ].filter(Boolean)),
    g('eyeShut', [x, y], [line(`M${pt(x - rx - 0.3, y + 0.4)}Q${pt(x, y + ry * 0.95)} ${pt(x + rx + 0.3, y + 0.4)}`, 2.2, color)]),
  ]);
}

function face({ x = FACE.x, y = FACE.y, gap = FACE.gap, eye: e = {}, blush: b = true } = {}) {
  return [
    eye(x - gap / 2, y, e),
    eye(x + gap / 2, y, e),
    b ? [blush(x - gap / 2 - 5.2, y + 6.4), blush(x + gap / 2 + 5.4, y + 6.4, 3.6, 2.3)] : [],
  ];
}

const catMouth = (x, y, w = 1.8, lw = 1.7) => line(`M${pt(x - 2 * w, y)}Q${pt(x - w, y + w * 1.4)} ${pt(x, y)}Q${pt(x + w, y + w * 1.4)} ${pt(x + 2 * w, y)}`, lw);
const smile = (x, y, w = 2.6, lw = 1.7) => line(`M${pt(x - w, y)}Q${pt(x, y + w * 1.25)} ${pt(x + w, y)}`, lw);
const head = (color, shade, { x = HEAD.x, y = HEAD.y, rx = HEAD.rx, ry = HEAD.ry, inside = [] } = {}) =>
  solid(P.mochi(x, y, rx, ry), color, shade, { inside });
const body = (color, belly, shade) => solid(P.mochi(46, 104.5, 14.8, 17), color, shade, {
  inside: [belly && fill(P.ell(50.5, 109, 8.4, 10.8), belly), shade && fill(P.ell(47, 88.5, 19, 5.5), shade)].filter(Boolean),
});
const BAR = 96;
const arm = (color, paw = color, from = [50.5, 97]) => g('arm', from, [
  limb(`M${pt(...from)}Q${pt(from[0] + 6, BAR + 3.5)} ${pt(63.5, BAR + 0.8)}`, color, 6.6),
  shape(P.ell(66.3, BAR, 4.5, 4.3), paw, 2.2),
]);
const feet = (color, pads, y = 121) => g('feet', [46, y], [39.5, 53.5].map(x => [
  shape(P.ell(x, y, 6.9, 4.1), color, 2.2),
  pads ? fill(P.ell(x + 0.6, y + 1.2, 2.8, 1.5), pads) : [],
]));

// ---------------------------------------------------------------- the scooter

function scooterBack(color) {
  const top = [81 - (126 - BAR) * 0.13, BAR - 1.5];
  return g('stem', [81, 126], [
    limb(`M81 126L${pt(...top)}`, color, 3.4),
    limb(`M62 ${n2(BAR + 0.5)}L${pt(top[0] + 2.5, BAR - 1.5)}`, color, 3.4),
  ]);
}

function scooterFront(color, hub) {
  const wheel = (x, h) => [
    g('wheel', [x, 131], [
      shape(P.ell(x, 131, 6.8, 6.8), '#3A3A44', 2.4),
      [0, 1, 2].map(i => line(P.open([[x, 131], [x + Math.cos(i * TAU / 3) * 5, 131 + Math.sin(i * TAU / 3) * 5]]), 1.1, 'rgba(255,255,255,0.28)')),
      fill(P.ell(x, 131, 2.8, 2.8), h),
    ]),
    line(P.arc(x, 131, 4.6, 4.6, -2.3, -1.2), 1.3, 'rgba(255,255,255,0.4)'),
  ];
  return [
    shape(P.rr(12, 122.5, 74, 7, 3.5), color, 2.4),
    line('M17 124.6L44 124.6', 1.6, 'rgba(255,255,255,0.55)'),
    wheel(16, hub),
    wheel(81, '#FFFFFF'),
  ];
}

// ---------------------------------------------------------------- the animals

function bunny() {
  const fur = '#FFFFFF', shade = '#F2E0EC', pink = '#FFB3CB';
  const ear = (name, bx, by, rot) => g(name, [0, 0], [
    solid(P.mochi(0, -16, 7.2, 17), fur, shade, { dir: [-2.2, 1.5], inside: [fill(P.mochi(0.8, -14, 3.4, 12), pink)] }),
  ], [bx, by, rot]);
  return [
    g('tail', [31.5, 109.5], [shape(P.ell(31.5, 109.5, 6.6, 6.3), fur, 2.2)]),
    feet(fur, pink),
    body(fur, '#FFF3F8', shade),
    arm(fur),
    g('head', [47, 88], [
      ear('earBack', 38, 50, -0.2),
      ear('earFront', 56.5, 48.5, 0.15),
      head(fur, shade),
      g('bow', [46.5, 45.5], [
        shape(P.blob([[46.5, 45.5], [38.5, 38], [37.5, 50]]), '#FF6FA8', 2),
        shape(P.blob([[46.5, 45.5], [55.5, 37.5], [55.5, 50.5]]), '#FF6FA8', 2),
        shape(P.ell(46.5, 45.5, 3, 3), '#FF9CC2', 2),
        fill(P.ell(41.5, 42.5, 1.6, 1, -0.6), 'rgba(255,255,255,0.7)'),
      ]),
      face(),
      shape(P.ell(FACE.x, FACE.y + 4.2, 2.1, 1.5), '#FF86AE', 1.2),
      catMouth(FACE.x, FACE.y + 6.3, 1.6),
    ]),
  ];
}

function capybara() {
  const fur = '#CF9460', shade = '#B97A46', light = '#EBC596', dark = '#8C5832';
  return [
    feet(dark),
    body(fur, light, shade),
    arm(fur, dark),
    g('head', [48, 88], [
      g('earBack', [29, 49], [shape(P.ell(29, 46, 5.2, 4.7, -0.3), dark, 2.2)]),
      g('earFront', [45.5, 47], [shape(P.ell(45.5, 43.5, 5, 4.5, 0.1), dark, 2.2)]),
      solid(P.box(16, 44, 67, 44.5, [19, 19, 16, 18]), fur, shade, { inside: [fill(P.mochi(64, 78.5, 19.5, 11.2), light)] }),
      gloss(50, 66, 30, 19.5, -1.3, -0.8, 2.6, 0.5),
      face({ x: 59.5, y: 61.5, gap: 23, eye: { rx: 3.3, ry: 4 }, blush: false }),
      blush(41.5, 70, 4.2, 2.5),
      blush(78, 69.5, 3.2, 2.3),
      fill(P.ell(60, 72.4, 1.85, 1.2, 0.45), '#5A331C'),
      fill(P.ell(68, 72.4, 1.85, 1.2, -0.45), '#5A331C'),
      catMouth(64, 79.2, 1.85, 1.8),
      g('yuzu', [0, 7.8], [
        solid(P.ell(0, 0, 8.6, 7.8), '#FFB21E', '#F09500', { lw: 2.2, dir: [-1.8, 2] }),
        fill(P.ell(-3, -2.8, 2.6, 1.6, -0.5), 'rgba(255,255,255,0.75)'),
        fill(P.ell(2, 2, 0.8, 0.8), 'rgba(200,110,0,0.45)'),
        fill(P.ell(4.3, -0.8, 0.7, 0.7), 'rgba(200,110,0,0.45)'),
        line('M0.5 -7.2L1.3 -9.8', 2),
        g('leaf', [1.3, -9.8], [shape(P.ell(6.3, -10.2, 5.2, 2.5, -0.35), '#5DBB4A', 1.8)]),
      ], [57.5, 36.5, 0]),
    ]),
  ];
}

// the kitty's tail, from its root out to a tip that sweeps between two poses
export const kittyTail = k => {
  const L = (a, b) => a + (b - a) * k;
  const c1 = [L(16, 16), L(110, 116)], c2 = [L(13, 6), L(92, 104)], tip = [L(22, 11), L(84, 91)];
  return { d: `M34 112C${pt(...c1)} ${pt(...c2)} ${pt(...tip)}`, tip: P.ell(tip[0], tip[1], 3.1, 3.1) };
};

function kitty() {
  const fur = '#FFB45C', shade = '#F29A47', stripe = '#E07F2A', cream = '#FFF4E4', pink = '#FFB5C4';
  const t0 = kittyTail(0);
  return [
    limb(t0.d, fur, 6.2, 'tail'),
    fill(t0.tip, cream, 'tailTip'),
    feet(cream, pink),
    body(fur, cream, shade),
    line('M33.5 96L37.5 97', 2.2, stripe),
    line('M33.5 103L37.5 104', 2.2, stripe),
    arm(fur, cream),
    g('head', [48, 88], [
      g('earBack', [34, 52], [
        shape(P.blob([[23, 62], [21.5, 29], [31, 32], [46, 47]]), fur),
        fill(P.blob([[27, 56], [25.5, 36.5], [31, 39], [40, 48]]), pink),
      ]),
      g('earFront', [60, 50], [
        shape(P.blob([[49, 47], [64.5, 29.5], [72.5, 31], [72, 62]]), fur),
        fill(P.blob([[54, 47], [65, 36], [69.5, 37], [69, 56]]), pink),
      ]),
      shape(P.poly([[23, 70.5], [15.5, 74], [21.5, 76], [16.5, 80.5], [24, 81]]), fur, 2.2),
      shape(P.poly([[71, 70], [79, 73.5], [73.5, 75.5], [78.5, 80], [71, 80.5]]), fur, 2.2),
      head(fur, shade, {
        rx: 26.5, ry: 21.5,
        inside: [
          ...[[42.5, 5.5], [47.5, 7], [52.5, 5.5]].map(([x, l]) => line(`M${x} 43L${x} ${43 + l}`, 2.4, stripe)),
          fill(P.mochi(FACE.x, FACE.y + 7.2, 9, 6), cream),
        ],
      }),
      gloss(47, 66, 22.5, 18, -1.2, -0.7, 2.4, 0.55),
      face(),
      shape(P.poly([[FACE.x - 2.1, FACE.y + 3.6], [FACE.x + 2.1, FACE.y + 3.6], [FACE.x, FACE.y + 5.6]]), '#FF7FA3', 1.2),
      catMouth(FACE.x, FACE.y + 6.1, 1.6),
      [[[33, 73.5], [26, 72]], [[33, 77], [26.5, 78]], [[72, 73.5], [79, 72]], [[72, 77], [79, 78]]].map(([a, b]) => line(P.open([a, b]), 1.2)),
    ]),
    g('collar', [50, 88], [
      shape(P.rr(37.5, 86, 23, 5, 2.5), '#FF5C7A', 2),
      g('bell', [50, 90], [
        solid(P.ell(50, 92.5, 3.9, 3.9), '#FFD23F', '#F2B200', { lw: 1.8, dir: [-1, 1.2] }),
        line('M48.2 93.5L51.8 93.5', 1.1),
        fill(P.ell(48.9, 91.2, 1, 0.8), 'rgba(255,255,255,0.8)'),
      ]),
    ]),
  ];
}

export const scarfTail = k => {
  const A = [[36, 86], [22, 91], [15, 103], [23, 104], [34, 94]];
  const B = [[36, 86], [20, 80], [9, 85], [16, 91], [34, 94]];
  return P.blob(A.map((p, i) => [p[0] + (B[i][0] - p[0]) * k, p[1] + (B[i][1] - p[1]) * k]));
};

function penguin() {
  const navy = '#3E5288', navyShade = '#2F4071', red = '#FF5C6F', beak = '#FFA630';
  return [
    shape(scarfTail(0), red, 2.2, 'scarf'),
    g('feet', [47, 122], [shape(P.ell(40.5, 122, 7.2, 3.6), beak, 2.2), shape(P.ell(54, 122, 7.2, 3.6), beak, 2.2)]),
    g('head', [47, 118], [
      solid(P.ell(47, 86, 28, 36.5), navy, navyShade, {
        dir: [-4, 3],
        inside: [
          fill(P.ell(44.5, 72, 12, 12.5), '#FFFFFF'),
          fill(P.ell(59, 72, 12, 12.5), '#FFFFFF'),
          fill(P.poly([[35, 77], [68.5, 77], [66, 100], [36, 100]]), '#FFFFFF'),
          fill(P.ell(51, 103, 17, 18), '#FFFFFF'),
          fill(P.ell(47, 124, 22, 9), 'rgba(47,64,113,0.14)'),
        ],
      }),
      gloss(47, 86, 23, 31, -1.3, -0.95, 2.8, 0.45),
      g('tuft', [47, 50], [line('M45.5 50L43.5 43', 2.2), line('M48.5 49.5L49.5 42.5', 2.2)]),
      g('arm', [50, 95], [shape(P.blob([[49, 92], [60, 91], [70, 96], [62, 100], [51, 101]]), navy, 2.2)]),
      face({ x: 52, y: 70.5, gap: 15.5 }),
      shape(P.blob([[48, 75], [56, 75], [52, 80.5]]), beak, 1.6),
      shape('M20.5 85Q47 95 74 85L74.5 91.5Q47 102 20.5 91.5Z', red, 2.2),
      [30, 40, 50, 60].map(x => {
        const o = x === 30 ? -1 : x === 60 ? -0.5 : 1;
        return line(P.open([[x, 90.5 + o], [x + 2, 93.5 + o]]), 1.3, 'rgba(160,20,50,0.45)');
      }),
    ]),
  ];
}

function panda() {
  const black = '#2E2E36', white = '#FFFFFF', shade = '#E6E6EF';
  const eyes = [[43.5, 0.55], [61.5, -0.55]].map(([x, rot]) => [
    fill(P.ell(x, FACE.y + 0.5, 6, 7.4, rot), black),
    g('eye', [x, FACE.y], [
      g('eyeOpen', [x, FACE.y + 1], [
        fill(P.ell(x + 0.4, FACE.y, 3, 3.4), white),
        fill(P.ell(x + 0.6, FACE.y + 0.4, 2, 2.4), black),
        fill(P.ell(x + 1.3, FACE.y - 0.6, 0.85, 0.85), white),
      ]),
      g('eyeShut', [x, FACE.y], [line(`M${pt(x - 2.9, FACE.y)}Q${pt(x, FACE.y + 2.9)} ${pt(x + 2.9, FACE.y)}`, 1.8, white)]),
    ]),
  ]);
  return [
    feet(black),
    body(white, null, shade),
    arm(black),
    g('head', [47, 88], [
      g('earBack', [27, 50], [shape(P.ell(27, 50, 8.2, 7.8), black)]),
      g('earFront', [65, 47], [shape(P.ell(65, 47, 8.2, 7.8), black)]),
      g('sprout', [0, 0], [
        limb('M0 0Q0.5 -5 1.5 -9', '#86CF5A', 2.4),
        solid(P.lock([1.5, -9], [-3, -14], [-9.5, -12], [-4, -7.5], [1.5, -9]), '#5DBB4A', null, { lw: 1.7 }),
        solid(P.lock([1.5, -9], [5, -16], [11.5, -15], [7.5, -9], [1.5, -9]), '#6FCB58', null, { lw: 1.7 }),
      ], [47, 45, 0]),
      head(white, shade),
      eyes,
      blush(34.5, 78.5, 3.6, 2.2),
      blush(68.5, 78, 3.2, 2.1),
      shape(P.blob([[FACE.x - 3, FACE.y + 6], [FACE.x + 3, FACE.y + 6], [FACE.x, FACE.y + 9]]), black, 1.2),
      catMouth(FACE.x, FACE.y + 9.2, 1.6),
    ]),
  ];
}

function unicorn() {
  const coat = '#FFFFFF', shade = '#EFE2F6', lilac = '#C9A6FF';
  const PINK = '#FFA3CF', YELLOW = '#FFDB7E', MINT = '#98E8CB', BLUE = '#9CCBFF', LILAC = '#CDAEFF';
  const l = FACE.x - FACE.gap / 2, r = FACE.x + FACE.gap / 2, y = FACE.y;
  return [
    g('tail', [31, 110], [{ t: 'cloud', puffs: [[26, 113, 6, BLUE], [30, 104, 6, MINT], [23.5, 105.5, 6.6, PINK]] }]),
    feet(lilac),
    body(coat, '#FFF3FB', shade),
    arm(coat, lilac),
    g('head', [47, 88], [
      g('mane', [30, 50], [{ t: 'cloud', puffs: [[23, 82, 6.8, BLUE], [20, 70.5, 7.8, MINT], [22.5, 58.5, 8.4, YELLOW], [29, 48.5, 8.6, PINK], [39.5, 43, 8.4, PINK]] }]),
      g('earBack', [37, 50], [
        shape(P.blob([[31, 55], [29.5, 34], [35, 35.5], [44, 48]]), coat),
        fill(P.blob([[33, 50], [32.5, 39.5], [35.5, 40.5], [39.5, 48]]), '#FFD0E6'),
      ]),
      g('earFront', [62, 48], [
        shape(P.blob([[57, 46], [66.5, 32.5], [70.5, 35], [68, 55]]), coat),
        fill(P.blob([[60, 46], [66.5, 38], [68.5, 40], [66, 51]]), '#FFD0E6'),
      ]),
      head(coat, shade),
      g('horn', [51, 45], [
        solid(P.blob([[46, 46], [53, 16.5], [54.5, 17], [56, 45]]), '#FFD76A', '#F2BA3A', { lw: 2.2, dir: [-1.5, 0.5] }),
        [[[48.3, 37.5], [55, 35]], [[50, 29.5], [54.7, 27.5]], [[51.3, 22.5], [54.3, 21]]].map(([a, b]) => line(P.open([a, b]), 1.4, '#D99A1E')),
      ]),
      solid(P.blob([[53, 45], [61, 40], [67, 47], [60, 51]]), LILAC, null, { lw: 2.2 }),
      solid(P.blob([[31, 57], [33, 44], [45, 39.5], [58, 44], [52, 50], [42, 50], [37, 60]]), PINK, null, { lw: 2.2 }),
      line('M36 49Q39 44.5 45 43.5', 1.7, 'rgba(255,255,255,0.7)'),
      face(),
      g('lashes', [FACE.x, y], [line(P.open([[l - 3.4, y - 1.3], [l - 5.8, y - 2.3]]), 1.5), line(P.open([[r + 3.4, y - 1.3], [r + 5.8, y - 2.3]]), 1.5)]),
      smile(FACE.x, FACE.y + 5.8, 2.1, 1.6),
      g('twinkle', [66, 20], [shape(P.star4(66, 20, 6.5, 0.22), '#FFF08A', 1.2)]),
    ]),
  ];
}

// ---------------------------------------------------------------- poses: pure functions of time

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
/** Keyframes [[u, v], ...] over u in 0..1, eased between keys. */
const kf = (u, keys) => {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      return va + (vb - va) * smooth((u - a) / (b - a));
    }
  }
  return keys[keys.length - 1][1];
};
/** Progress 0..1 through a move that plays for `dur` every `every` seconds, or -1 between. */
const every = (t, period, dur, off = 0) => { const u = (((t + off) % period) + period) % period; return u < dur ? u / dur : -1; };
/** A damped wobble kicked at t0: follow-through for ears, bells and yuzus. */
const spring = (dt, k = 6, w = 18) => dt < 0 ? 0 : Math.exp(-k * dt) * Math.sin(w * dt);

/** How closed the eyes are (0 open, 1 shut): a blink every few seconds and now and then a double. */
function blinkAt(t, seed) {
  const bt = (t + seed) % 3.7, n = Math.floor((t + seed) / 3.7);
  const bump = (a, d) => bt >= a && bt < a + d ? Math.sin(((bt - a) / d) * Math.PI) : 0;
  return Math.max(bump(0, 0.17), n % 3 === 0 ? bump(0.3, 0.15) : 0);
}

/** What every rider does: rides over the bumps, breathes, lags a little in the head, blinks. */
function base(t, seed) {
  const w = TAU * 1.35, b = Math.sin(t * w + seed);
  const shut = blinkAt(t, seed);
  return {
    rider: { y: -Math.abs(Math.sin(t * w * 0.5 + seed)) * 0.9, sx: 1 + 0.012 * b, sy: 1 - 0.012 * b },
    head: { r: 0.03 * Math.sin(t * w - 0.9 + seed), y: 0.5 * Math.sin(t * w - 0.5 + seed) },
    arm: { r: 0.03 * Math.sin(t * w - 1.4 + seed) },
    wheel: { r: t * 9 },
    eyeOpen: { sy: 1 - 0.9 * shut, a: shut > 0.72 ? 0 : 1 },
    eyeShut: { a: shut > 0.72 ? 1 : 0 },
  };
}

const POSES = {
  bunny(t, s = 0) {
    const p = base(t, s);
    const u = every(t, 3.4, 1.15, s);
    const flop = u < 0 ? 0 : kf(u, [[0, 0], [0.2, 1.08], [0.3, 0.95], [0.66, 1], [0.84, -0.08], [1, 0]]);
    p.earFront = { r: 1.62 * flop };
    p.earBack = { r: -0.08 * flop + 0.03 * Math.sin(t * 2.3 + s) };
    p.tail = { sx: 1 + 0.08 * Math.max(0, Math.sin(t * 9)), sy: 1 + 0.08 * Math.max(0, Math.sin(t * 9)) };
    p.bow = { r: 0.08 * Math.sin(t * 2.7 + s) };
    return p;
  },
  capy(t, s = 0) {
    const p = base(t, s);
    const period = 2.2, u = every(t, period, 0.42, s);
    const hop = u < 0 ? 0 : Math.sin(u * Math.PI);
    const since = (((t + s) % period) + period) % period - 0.42;
    p.yuzu = { y: -7 * hop, r: 0.28 * hop + 0.12 * spring(since), sx: 1 - 0.08 * hop + 0.1 * spring(since, 9, 26), sy: 1 + 0.08 * hop - 0.1 * spring(since, 9, 26) };
    p.leaf = { r: -0.4 * hop + 0.3 * spring(since, 5, 20) };
    p.earFront = { r: 0.12 * Math.sin(t * 5 + s) * (Math.sin(t * 0.9) > 0.6 ? 1 : 0) };
    // a capybara at peace: now and then the eyes close in bliss for a moment
    const bliss = every(t, 7.3, 1.4, s + 3);
    if (bliss >= 0) p.eyeOpen = { sy: 0.1, a: 0 }, p.eyeShut = { a: 1 };
    return p;
  },
  kitty(t, s = 0) {
    const p = base(t, s);
    const k = 0.5 + 0.5 * Math.sin(t * 2.6 + s) + 0.12 * Math.sin(t * 7.1);
    const tail = kittyTail(clamp(k, -0.1, 1.1));
    p.d = { tail: tail.d, tailTip: tail.tip };
    const u = every(t, 2.9, 0.35, s);
    p.earFront = { r: u < 0 ? 0 : 0.35 * Math.sin(u * Math.PI * 2) };
    p.bell = { r: 0.25 * Math.sin(t * TAU * 1.35 + s - 1.6) };
    return p;
  },
  penguin(t, s = 0) {
    const p = base(t, s);
    p.d = { scarf: scarfTail(0.5 + 0.5 * Math.sin(t * 13 + s) * (0.7 + 0.3 * Math.sin(t * 1.7))) };
    p.head = { r: 0.025 * Math.sin(t * TAU * 0.7 + s), sx: 1 + 0.01 * Math.sin(t * 8.5), sy: 1 - 0.01 * Math.sin(t * 8.5) };
    p.arm = { r: -0.05 + 0.08 * Math.sin(t * TAU * 1.35 + s) };
    p.tuft = { r: 0.15 * Math.sin(t * 6 + s) };
    return p;
  },
  panda(t, s = 0) {
    const p = base(t, s);
    const u = every(t, 2.6, 0.5, s);
    const w = u < 0 ? 0 : Math.sin(u * Math.PI);
    p.earBack = { y: -3 * w, r: -0.25 * w };
    p.earFront = { y: -3 * w, r: 0.25 * w };
    p.sprout = { r: 0.22 * w + 0.08 * Math.sin(t * 3.1 + s) };
    return p;
  },
  unicorn(t, s = 0) {
    const p = base(t, s);
    p.tail = { r: 0.16 * Math.sin(t * 5.2 + s) };
    p.mane = { x: -0.8 + 0.8 * Math.sin(t * 2.4 + s), r: 0.02 * Math.sin(t * 2.4 + s) };
    const u = every(t, 2.4, 0.7, s);
    const tw = u < 0 ? 0 : Math.sin(u * Math.PI);
    p.twinkle = { sx: tw, sy: tw, r: u < 0 ? 0 : u * 1.2, a: tw > 0.02 ? 1 : 0 };
    p.lashes = { a: p.eyeShut.a ? 0 : 1 };
    return p;
  },
};

export const ANIMALS = {
  bunny: { name: 'Bunny', draw: bunny, scooter: '#FF9CC2', hub: '#FF9CC2', bg: ['#FFE3EE', '#FFC9DC'] },
  capy: { name: 'Capybara', draw: capybara, scooter: '#FFA94D', hub: '#FFA94D', bg: ['#FFEBD2', '#FFD3A4'] },
  kitty: { name: 'Kitty', draw: kitty, scooter: '#7CC8FF', hub: '#7CC8FF', bg: ['#E2F2FF', '#BFE1FF'] },
  penguin: { name: 'Penguin', draw: penguin, scooter: '#FF6F7F', hub: '#FF6F7F', bg: ['#E6ECFF', '#C8D4FF'] },
  panda: { name: 'Panda', draw: panda, scooter: '#6FD08C', hub: '#6FD08C', bg: ['#E3F7E6', '#C2EBCB'] },
  unicorn: { name: 'Unicorn', draw: unicorn, scooter: '#C3A2FF', hub: '#C3A2FF', bg: ['#F1E6FF', '#DCC8FF'] },
};
export const IDS = Object.keys(ANIMALS);

/** The whole scene graph for one animal on its scooter. */
export function scene(id) {
  const a = ANIMALS[id];
  return g('root', [0, 0], [
    scooterBack(a.scooter),
    g('rider', [46, 124], a.draw()),
    scooterFront(a.scooter, a.hub),
  ]);
}

/** The pose at time `t`: { groupName: { x, y, r, sx, sy, a }, d: { dynKey: path } }. */
export const poseAt = (id, t, seed = 0) => POSES[id](t, seed);

// ---------------------------------------------------------------- shared renderer helpers

/** 2D affine matrices as [a, b, c, d, e, f] (like DOMMatrix). */
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  tr: (x, y) => [1, 0, 0, 1, x, y],
  rot: r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0],
  sc: (x, y) => [x, 0, 0, y, 0, 0],
  apply: (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
};

/** A group's full local matrix: its static base, then the pose's move around its pivot. */
export function groupMatrix(node, p) {
  let m = M.id();
  if (node.base) m = M.mul(M.tr(node.base[0], node.base[1]), M.rot(node.base[2]));
  if (p) {
    const [ox, oy] = node.o;
    m = M.mul(m, M.tr(ox + (p.x ?? 0), oy + (p.y ?? 0)));
    m = M.mul(m, M.rot(p.r ?? 0));
    m = M.mul(m, M.sc(p.sx ?? 1, p.sy ?? 1));
    m = M.mul(m, M.tr(-ox, -oy));
  }
  return m;
}

/** A group's pose as an SVG transform string: its base, then the move around its pivot. */
export function groupTransform(node, p) {
  const [a, b, c, d, e, f] = groupMatrix(node, p);
  return `matrix(${[a, b, c, d, e, f].map(v => Math.round(v * 10000) / 10000).join(' ')})`;
}

/** Points along a path, for renderers that need polygons (the watercolour brush). Cached per path. */
const sampleCache = new Map();
let probe;
export function samplePath(d, step = 1.1) {
  const key = d + '|' + step;
  let pts = sampleCache.get(key);
  if (pts) return pts;
  probe ??= document.createElementNS('http://www.w3.org/2000/svg', 'path');
  probe.setAttribute('d', d);
  const len = probe.getTotalLength(), n = Math.max(10, Math.ceil(len / step));
  pts = [];
  for (let i = 0; i < n; i++) { const q = probe.getPointAtLength((i / n) * len); pts.push([q.x, q.y]); }
  if (!/Z\s*$/i.test(d)) { const q = probe.getPointAtLength(len); pts.push([q.x, q.y]); }
  sampleCache.set(key, pts);
  if (sampleCache.size > 4000) sampleCache.clear();
  return pts;
}

/** Colour helpers for the renderers' gradients. */
export function mix(hex, to, k) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
