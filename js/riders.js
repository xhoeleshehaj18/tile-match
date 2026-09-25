// The riders on the scooter at the top of the screen and the trails they leave behind. Drawn in
// code like everything in art.js: each rider is rendered once per size into a few frames (eyes
// open / blinking, and an "idle" pose such as an ear flop or a hopping yuzu), so the game loop only
// ever picks a frame and copies it.

import { surface, rr, C } from './art.js';

const TAU = Math.PI * 2;
const ink = C.outline;

const EYE = '#2A1A14';
const BLUSH = 'rgba(255,112,150,0.48)';

// Every animal shares one build (100×140 design space): a big soft "mochi" head, fullest at the
// cheeks, over a small bean of a body; big shiny eyes set low and wide; stubby paws holding on to
// the handlebar. The face sits a little right of the head's centre, towards where she's riding.
// The light comes from ahead and above, so each shape's shading sits low on its back edge.
const HEAD = { x: 47, y: 66, rx: 26, ry: 22 };
const FACE = { x: 52.5, y: 70.5, gap: 17 };
const SHADE = [-3.4, 3.8];

/** Drawing helpers bound to one context, in the rider's 100×140 design space. */
function kit(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const k = {
    shape(build, fill, lw = 2.6) {
      ctx.beginPath();
      build();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.stroke();
    },
    fill(build, color) {
      ctx.beginPath();
      build();
      ctx.fillStyle = color;
      ctx.fill();
    },
    /**
     * A shaded shape: filled, darkened along its back-bottom edge with `shade` (a crescent, left
     * where the shape shifted towards the light doesn't cover it), `inside` drawn clipped to it,
     * then outlined.
     */
    solid(build, fill, shade, { lw = 2.6, inside, dir = SHADE } = {}) {
      ctx.save();
      ctx.beginPath();
      build();
      ctx.fillStyle = shade ?? fill;
      ctx.fill();
      ctx.clip();
      if (shade) {
        ctx.save();
        ctx.translate(-dir[0], -dir[1]);
        k.fill(build, fill);
        ctx.restore();
      }
      inside?.();
      ctx.restore();
      k.stroke(build, lw);
    },
    oval: (cx, cy, rx, ry, rot = 0) => () => ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU),
    round: (x, y, w, h, r) => () => rr(ctx, x, y, w, h, r),
    /** A rounded box with its own radius at each corner: top-left, top-right, bottom-right, bottom-left. */
    box: (x, y, w, h, [tl, tr, br, bl]) => () => {
      ctx.moveTo(x + tl, y);
      ctx.arcTo(x + w, y, x + w, y + h, tr);
      ctx.arcTo(x + w, y + h, x, y + h, br);
      ctx.arcTo(x, y + h, x, y, bl);
      ctx.arcTo(x, y, x + w, y, tl);
      ctx.closePath();
    },
    /** A lock of hair or mane: from root `a` out to the tip `t` and back to root `b`, bulging towards `ca` and `cb`. */
    lock: (a, ca, t, cb, b) => () => {
      ctx.moveTo(...a);
      ctx.quadraticCurveTo(...ca, ...t);
      ctx.quadraticCurveTo(...cb, ...b);
      ctx.closePath();
    },
    poly: pts => () => { ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); },
    /** A soft closed shape through the midpoints of `pts` (each point pulls the curve towards it). */
    blob: pts => () => {
      const n = pts.length;
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ctx.moveTo(...mid(pts[n - 1], pts[0]));
      for (let i = 0; i < n; i++) ctx.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
      ctx.closePath();
    },
    /** A squishy oval, flatter on top and fullest just below the middle, like a mochi. */
    mochi: (cx, cy, rx, ry) => () => {
      const t = cy - ry, b = cy + ry, m = cy + ry * 0.12;
      ctx.moveTo(cx, t);
      ctx.bezierCurveTo(cx + rx * 0.6, t, cx + rx, cy - ry * 0.55, cx + rx, m);
      ctx.bezierCurveTo(cx + rx, b - ry * 0.2, cx + rx * 0.64, b, cx, b);
      ctx.bezierCurveTo(cx - rx * 0.64, b, cx - rx, b - ry * 0.2, cx - rx, m);
      ctx.bezierCurveTo(cx - rx, cy - ry * 0.55, cx - rx * 0.6, t, cx, t);
      ctx.closePath();
    },
    line(pts, width, color = ink) {
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      for (const p of pts.slice(1)) ctx.lineTo(...p);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    },
    stroke(build, width, color = ink) {
      ctx.beginPath();
      build();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    },
    /** A limb or tail: an ink stroke with a narrower coloured one on top, so it reads as outlined. */
    limb(path, color, w = 5.5) {
      for (const [lw, c] of [[w + 3.6, ink], [w, color]]) k.stroke(path, lw, c);
    },
    /** Overlapping round puffs outlined as one fluffy shape, each puff its own colour: [x, y, r, color]. */
    cloud(puffs, lw = 2.4) {
      for (const [x, y, r] of puffs) k.fill(k.oval(x, y, r + lw / 2, r + lw / 2), ink);
      for (const [x, y, r, c] of puffs) k.fill(k.oval(x, y, r - lw / 2, r - lw / 2), c);
      for (const [x, y, r] of puffs) k.gloss(x, y, r - 3.2, r - 3.2, -2.5, -1.7, 1.7, 0.75);
    },
    /** A glint of light on a round surface: a short white arc just inside its edge. */
    gloss(cx, cy, rx, ry, from = -1.35, to = -0.75, width = 2.4, alpha = 0.75) {
      k.stroke(() => ctx.ellipse(cx, cy, rx, ry, 0, from, to), width, `rgba(255,255,255,${alpha})`);
    },
    /** A big shiny eye with a warm glow at the bottom, or a closed "‿" when blinking. */
    eye(x, y, blink, { rx = 3.7, ry = 4.6, color = EYE, glow = '#7B5040' } = {}) {
      if (blink) {
        k.stroke(() => { ctx.moveTo(x - rx - 0.3, y + 0.4); ctx.quadraticCurveTo(x, y + ry * 0.95, x + rx + 0.3, y + 0.4); }, 2.2, color);
        return;
      }
      k.fill(k.oval(x, y, rx, ry), color);
      if (glow) k.fill(k.oval(x, y + ry * 0.45, rx * 0.68, ry * 0.42), glow);
      k.fill(k.oval(x + rx * 0.26, y - ry * 0.3, rx * 0.5, rx * 0.5), '#FFFFFF');
      k.fill(k.oval(x - rx * 0.34, y + ry * 0.42, rx * 0.22, rx * 0.22), '#FFFFFF');
    },
    blush(x, y, rx = 4.2, ry = 2.5) { k.fill(k.oval(x, y, rx, ry), BLUSH); },
    /** "ω", the little cat mouth. */
    catMouth(x, y, w = 1.8, lw = 1.7) {
      k.stroke(() => {
        ctx.moveTo(x - 2 * w, y);
        ctx.quadraticCurveTo(x - w, y + w * 1.4, x, y);
        ctx.quadraticCurveTo(x + w, y + w * 1.4, x + 2 * w, y);
      }, lw);
    },
    smile(x, y, w = 2.6, lw = 1.7) {
      k.stroke(() => { ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y + w * 1.25, x + w, y); }, lw);
    },
    /** Both eyes and the blush, centred on FACE unless told otherwise. */
    face(blink, { x = FACE.x, y = FACE.y, gap = FACE.gap, eye = {}, blush = true } = {}) {
      k.eye(x - gap / 2, y, blink, eye);
      k.eye(x + gap / 2, y, blink, eye);
      if (blush) {
        k.blush(x - gap / 2 - 5.2, y + 6.4);
        k.blush(x + gap / 2 + 5.4, y + 6.4, 3.6, 2.3);
      }
    },
    head(color, shade, { x = HEAD.x, y = HEAD.y, rx = HEAD.rx, ry = HEAD.ry, inside } = {}) {
      k.solid(k.mochi(x, y, rx, ry), color, shade, { inside });
    },
    /** A little bean of a body, with a lighter belly and the head's shadow across its top. */
    body(color, belly, shade) {
      k.solid(k.mochi(46, 104.5, 14.8, 17), color, shade, {
        inside() {
          if (belly) k.fill(k.oval(50.5, 109, 8.4, 10.8), belly);
          if (shade) k.fill(k.oval(47, 88.5, 19, 5.5), shade);
        },
      });
    },
    /** A stubby arm out to the handlebar grip, ending in a round paw. */
    arm(color, paw = color, from = [50.5, 97]) {
      const y = k.bar;
      k.limb(() => { ctx.moveTo(...from); ctx.quadraticCurveTo(from[0] + 6, y + 3.5, 63.5, y + 0.8); }, color, 6.6);
      k.shape(k.oval(66.3, y, 4.5, 4.3), paw, 2.2);
    },
    feet(color, pads, y = 121) {
      for (const x of [39.5, 53.5]) {
        k.shape(k.oval(x, y, 6.9, 4.1), color, 2.2);
        if (pads) k.fill(k.oval(x + 0.6, y + 1.2, 2.8, 1.5), pads);
      }
    },
    ctx,
    bar: 96,
  };
  return k;
}

// ---------------------------------------------------------------- the scooter

/** The stem and handlebar, up to where the rider's paw reaches (`k.bar`). */
function scooterBack(k, color) {
  const { ctx } = k, y = k.bar;
  const top = [81 - (126 - y) * 0.13, y - 1.5];
  k.limb(() => { ctx.moveTo(81, 126); ctx.lineTo(...top); }, color, 3.4);
  k.limb(() => { ctx.moveTo(62, y + 0.5); ctx.lineTo(top[0] + 2.5, y - 1.5); }, color, 3.4);
}

function scooterFront(k, color, wheel) {
  const { ctx } = k;
  k.shape(k.round(12, 122.5, 74, 7, 3.5), color, 2.4);
  k.line([[17, 124.6], [44, 124.6]], 1.6, 'rgba(255,255,255,0.55)');
  for (const [x, hub] of [[16, wheel], [81, '#FFFFFF']]) {
    k.shape(k.oval(x, 131, 6.8, 6.8), '#3A3A44', 2.4);
    k.fill(k.oval(x, 131, 2.8, 2.8), hub);
    k.stroke(() => ctx.arc(x, 131, 4.6, -2.3, -1.2), 1.3, 'rgba(255,255,255,0.35)');
  }
}

// ---------------------------------------------------------------- riders
// Each draws the rider between the scooter's stem (behind) and its deck (in front).
// pose: { blink, alt } — alt is the rider's own idle move.

function girl(k, { blink }) {
  const { ctx } = k;
  const skin = '#FFF0E4', skinShade = '#F6DCCB', hair = '#1B1B21', shoe = '#26262C', green = '#2F8A52';
  // long hair down her back
  k.shape(k.blob([[34, 46], [20, 60], [17, 92], [22, 110], [34, 112], [44, 102], [44, 74]]), hair);
  k.stroke(() => { ctx.moveTo(24, 74); ctx.quadraticCurveTo(21, 90, 25, 102); }, 1.6, 'rgba(255,255,255,0.18)');
  // legs, white socks and shoes
  for (const x of [36.5, 48.5]) {
    k.shape(k.round(x, 103, 8.5, 17, 3.5), skin, 2.2);
    k.shape(k.round(x, 111, 8.5, 9, 2.5), '#FFFFFF', 2.2);
  }
  k.shape(k.oval(40, 121.2, 6.6, 3.6), shoe, 2.2);
  k.shape(k.oval(53.5, 121.2, 6.6, 3.6), shoe, 2.2);
  // white shorts
  k.shape(k.round(33, 97, 28, 10, 4.5), '#FFFFFF');
  // green plaid shirt
  k.solid(k.round(32, 82, 30, 20, 8), green, null, {
    inside() {
      ctx.fillStyle = '#1F603A';
      for (let x = 35; x < 62; x += 8) ctx.fillRect(x, 82, 3, 20);
      ctx.fillStyle = 'rgba(150,220,170,0.7)';
      for (let y = 86; y < 102; y += 7) ctx.fillRect(32, y, 30, 2.4);
      k.fill(k.oval(47, 82, 17, 4.5), 'rgba(0,40,20,0.3)');
    },
  });
  // arm out to the handlebar
  k.limb(() => { ctx.moveTo(52, 89); ctx.quadraticCurveTo(58, k.bar + 1, 63.5, k.bar + 0.5); }, green, 6.6);
  k.shape(k.oval(66.5, k.bar, 4.2, 4), skin, 2.2);
  // head, a lock of hair down each side and a fringe
  k.solid(k.oval(47, 65, 23, 21), skin, skinShade, {
    inside() {
      k.fill(k.blob([[22, 52], [21, 80], [27, 90], [32, 80], [31, 60]]), hair);
      k.fill(k.blob([[66, 52], [73, 66], [70, 82], [67, 74], [66, 60]]), hair);
      k.fill(() => {
        ctx.moveTo(22, 64);
        ctx.quadraticCurveTo(24, 42, 48, 42);
        ctx.quadraticCurveTo(68, 42, 72, 58);
        ctx.quadraticCurveTo(67, 59.5, 64, 56);
        ctx.quadraticCurveTo(60, 61, 54.5, 57);
        ctx.quadraticCurveTo(49, 62, 43.5, 57.5);
        ctx.quadraticCurveTo(38, 62, 33, 58.5);
        ctx.quadraticCurveTo(30, 62, 29, 68);
        ctx.closePath();
      }, hair);
    },
  });
  k.face(blink, { x: 53, y: 70, gap: 14.5, eye: { rx: 3.3, ry: 4.2 }, blush: false });
  k.blush(40.5, 76, 3.6, 2.2);
  k.blush(64.5, 76, 3, 2.1);
  k.smile(53, 76, 2.2);
  // green cap, brim towards the road ahead
  k.solid(() => {
    ctx.moveTo(23.5, 55);
    ctx.bezierCurveTo(20, 30, 62, 25, 70, 49);
    ctx.quadraticCurveTo(46, 43, 23.5, 55);
    ctx.closePath();
  }, '#2C9A4E', '#23823F', { dir: [-3, 2.5] });
  k.shape(() => {
    ctx.moveTo(56, 47);
    ctx.quadraticCurveTo(73, 43, 82, 50);
    ctx.quadraticCurveTo(71, 54, 59, 51);
    ctx.closePath();
  }, '#23823F', 2.2);
  k.fill(k.poly([[41, 35], [47, 39], [41, 43], [43.8, 39]]), '#FFFFFF');
  k.gloss(45, 44, 17, 11, -1.2, -0.55, 2, 0.45);
}

function bunny(k, { blink, alt }) {
  const { ctx } = k;
  const fur = '#FFFFFF', shade = '#F2E0EC', pink = '#FFB3CB';
  k.shape(k.oval(31.5, 109.5, 6.6, 6.3), fur, 2.2); // cotton tail
  k.feet(fur, pink);
  k.body(fur, '#FFF3F8', shade);
  k.arm(fur);
  // long ears; the front one flops over when she's feeling it
  const ear = (bx, by, rot) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    k.solid(k.mochi(0, -16, 7.2, 17), fur, shade, {
      dir: [-2.2, 1.5],
      inside: () => k.fill(k.mochi(0.8, -14, 3.4, 12), pink),
    });
    ctx.restore();
  };
  ear(38, 50, -0.2);
  ear(56.5, 48.5, alt ? 1.8 : 0.15);
  k.head(fur, shade);
  // a pink bow between the ears
  k.shape(k.blob([[46.5, 45.5], [38.5, 38], [37.5, 50]]), '#FF6FA8', 2);
  k.shape(k.blob([[46.5, 45.5], [55.5, 37.5], [55.5, 50.5]]), '#FF6FA8', 2);
  k.shape(k.oval(46.5, 45.5, 3, 3), '#FF9CC2', 2);
  k.fill(k.oval(41.5, 42.5, 1.6, 1, -0.6), 'rgba(255,255,255,0.7)');
  k.face(blink);
  k.shape(k.oval(FACE.x, FACE.y + 4.2, 2.1, 1.5), '#FF86AE', 1.2);
  k.catMouth(FACE.x, FACE.y + 6.3, 1.6);
}

function capybara(k, { blink, alt }) {
  const { ctx } = k;
  const fur = '#CF9460', shade = '#B97A46', light = '#EBC596', dark = '#8C5832';
  k.feet(dark);
  k.body(fur, light, shade);
  k.arm(fur, dark);
  // small round ears, set far back on the head
  k.shape(k.oval(29, 46, 5.2, 4.7, -0.3), dark, 2.2);
  k.shape(k.oval(45.5, 43.5, 5, 4.5, 0.1), dark, 2.2);
  // the famous head: a big soft box with a blunt, lighter snout
  k.solid(k.box(16, 44, 67, 44.5, [19, 19, 16, 18]), fur, shade, {
    inside: () => k.fill(k.mochi(64, 78.5, 19.5, 11.2), light),
  });
  k.gloss(50, 66, 30, 19.5, -1.3, -0.8, 2.6, 0.5);
  k.face(blink, { x: 59.5, y: 61.5, gap: 23, eye: { rx: 3.3, ry: 4 }, blush: false });
  k.blush(41.5, 70, 4.2, 2.5);
  k.blush(78, 69.5, 3.2, 2.3);
  // two little nostrils and a content "ω"
  k.fill(k.oval(60, 72.4, 1.85, 1.2, 0.45), '#5A331C');
  k.fill(k.oval(68, 72.4, 1.85, 1.2, -0.45), '#5A331C');
  k.catMouth(64, 79.2, 1.85, 1.8);
  // a yuzu balanced on top, which hops when she's pleased
  ctx.save();
  ctx.translate(57.5, 36.5 + (alt ? -6 : 0));
  ctx.rotate(alt ? 0.25 : 0);
  k.solid(k.oval(0, 0, 8.6, 7.8), '#FFB21E', '#F09500', { lw: 2.2, dir: [-1.8, 2] });
  k.fill(k.oval(-3, -2.8, 2.6, 1.6, -0.5), 'rgba(255,255,255,0.75)');
  k.fill(k.oval(2, 2, 0.8, 0.8), 'rgba(200,110,0,0.45)');
  k.fill(k.oval(4.3, -0.8, 0.7, 0.7), 'rgba(200,110,0,0.45)');
  k.line([[0.5, -7.2], [1.3, -9.8]], 2);
  k.shape(k.oval(6.3, -10.2, 5.2, 2.5, -0.35), '#5DBB4A', 1.8);
  ctx.restore();
}

function kitty(k, { blink, alt }) {
  const { ctx } = k;
  const fur = '#FFB45C', shade = '#F29A47', stripe = '#E07F2A', cream = '#FFF4E4', pink = '#FFB5C4';
  // a tail that never sits still, stripy with a cream tip
  const tail = alt
    ? () => { ctx.moveTo(34, 112); ctx.bezierCurveTo(16, 116, 6, 104, 11, 91); }
    : () => { ctx.moveTo(34, 112); ctx.bezierCurveTo(16, 110, 13, 92, 22, 84); };
  k.limb(tail, fur, 6.2);
  const tip = alt ? [11, 91] : [22, 84];
  k.fill(k.oval(tip[0], tip[1], 3.1, 3.1), cream);
  k.feet(cream, pink);
  k.body(fur, cream, shade);
  for (const y of [96, 103]) k.line([[33.5, y], [37.5, y + 1]], 2.2, stripe);
  k.arm(fur, cream);
  // pointy ears with pink insides, and fluffy cheeks
  k.shape(k.blob([[23, 62], [21.5, 29], [31, 32], [46, 47]]), fur);
  k.fill(k.blob([[27, 56], [25.5, 36.5], [31, 39], [40, 48]]), pink);
  k.shape(k.blob([[49, 47], [64.5, 29.5], [72.5, 31], [72, 62]]), fur);
  k.fill(k.blob([[54, 47], [65, 36], [69.5, 37], [69, 56]]), pink);
  k.shape(k.poly([[23, 70.5], [15.5, 74], [21.5, 76], [16.5, 80.5], [24, 81]]), fur, 2.2);
  k.shape(k.poly([[71, 70], [79, 73.5], [73.5, 75.5], [78.5, 80], [71, 80.5]]), fur, 2.2);
  k.head(fur, shade, {
    rx: 26.5,
    ry: 21.5,
    inside() {
      for (const [x, l] of [[42.5, 5.5], [47.5, 7], [52.5, 5.5]]) k.line([[x, 43], [x, 43 + l]], 2.4, stripe);
      k.fill(k.mochi(FACE.x, FACE.y + 7.2, 9, 6), cream);
    },
  });
  k.gloss(47, 66, 22.5, 18, -1.2, -0.7, 2.4, 0.55);
  k.face(blink);
  k.shape(k.poly([[FACE.x - 2.1, FACE.y + 3.6], [FACE.x + 2.1, FACE.y + 3.6], [FACE.x, FACE.y + 5.6]]), '#FF7FA3', 1.2);
  k.catMouth(FACE.x, FACE.y + 6.1, 1.6);
  for (const [a, b] of [[[33, 73.5], [26, 72]], [[33, 77], [26.5, 78]], [[72, 73.5], [79, 72]], [[72, 77], [79, 78]]]) k.line([a, b], 1.2);
  // jingle-bell collar
  k.shape(k.round(37.5, 86, 23, 5, 2.5), '#FF5C7A', 2);
  k.solid(k.oval(50, 92.5, 3.9, 3.9), '#FFD23F', '#F2B200', { lw: 1.8, dir: [-1, 1.2] });
  k.line([[48.2, 93.5], [51.8, 93.5]], 1.1);
  k.fill(k.oval(48.9, 91.2, 1, 0.8), 'rgba(255,255,255,0.8)');
}

function penguin(k, { blink, alt }) {
  const { ctx } = k;
  const navy = '#3E5288', navyShade = '#2F4071', red = '#FF5C6F', beak = '#FFA630';
  // scarf end streaming out behind (it flutters)
  const tail = alt
    ? [[36, 86], [20, 80], [9, 85], [16, 91], [34, 94]]
    : [[36, 86], [22, 91], [15, 103], [23, 104], [34, 94]];
  k.shape(k.blob(tail), red, 2.2);
  k.shape(k.oval(40.5, 122, 7.2, 3.6), beak, 2.2);
  k.shape(k.oval(54, 122, 7.2, 3.6), beak, 2.2);
  // one round egg of a penguin, white down the front with a heart-shaped face
  k.solid(k.oval(47, 86, 28, 36.5), navy, navyShade, {
    dir: [-4, 3],
    inside() {
      for (const x of [44.5, 59]) k.fill(k.oval(x, 72, 12, 12.5), '#FFFFFF');
      k.fill(k.poly([[35, 77], [68.5, 77], [66, 100], [36, 100]]), '#FFFFFF');
      k.fill(k.oval(51, 103, 17, 18), '#FFFFFF');
      k.fill(k.oval(47, 124, 22, 9), 'rgba(47,64,113,0.14)');
    },
  });
  k.gloss(47, 86, 23, 31, -1.3, -0.95, 2.8, 0.45);
  for (const [a, b] of [[[45.5, 50], [43.5, 43]], [[48.5, 49.5], [49.5, 42.5]]]) k.line([a, b], 2.2);
  // a little flipper on the handlebar
  k.shape(k.blob([[49, 92], [60, 91], [70, 96], [62, 100], [51, 101]]), navy, 2.2);
  k.face(blink, { x: 52, y: 70.5, gap: 15.5 });
  k.shape(k.blob([[48, 75], [56, 75], [52, 80.5]]), beak, 1.6);
  // the knitted scarf, wrapped round where a neck would be
  k.shape(() => {
    ctx.moveTo(20.5, 85);
    ctx.quadraticCurveTo(47, 95, 74, 85);
    ctx.lineTo(74.5, 91.5);
    ctx.quadraticCurveTo(47, 102, 20.5, 91.5);
    ctx.closePath();
  }, red, 2.2);
  for (const x of [30, 40, 50, 60]) k.line([[x, 90.5 + (x === 30 ? -1 : x === 60 ? -0.5 : 1)], [x + 2, 93.5 + (x === 30 ? -1 : x === 60 ? -0.5 : 1)]], 1.3, 'rgba(160,20,50,0.45)');
}

function panda(k, { blink, alt }) {
  const { ctx } = k;
  const black = '#2E2E36', white = '#FFFFFF', shade = '#E6E6EF';
  k.feet(black);
  k.body(white, null, shade);
  k.arm(black);
  const lift = alt ? -3 : 0;
  k.shape(k.oval(27, 50 + lift, 8.2, 7.8, alt ? -0.25 : 0), black);
  k.shape(k.oval(65, 47 + lift, 8.2, 7.8, alt ? 0.25 : 0), black);
  // a little bamboo sprout on top, which wiggles with her ears
  ctx.save();
  ctx.translate(47, 45);
  ctx.rotate(alt ? 0.22 : 0);
  k.limb(() => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.5, -5, 1.5, -9); }, '#86CF5A', 2.4);
  k.solid(k.lock([1.5, -9], [-3, -14], [-9.5, -12], [-4, -7.5], [1.5, -9]), '#5DBB4A', null, { lw: 1.7 });
  k.solid(k.lock([1.5, -9], [5, -16], [11.5, -15], [7.5, -9], [1.5, -9]), '#6FCB58', null, { lw: 1.7 });
  ctx.restore();
  k.head(white, shade);
  // droopy eye patches, with shiny eyes looking out of them
  for (const [x, rot] of [[43.5, 0.55], [61.5, -0.55]]) {
    k.fill(k.oval(x, FACE.y + 0.5, 6, 7.4, rot), black);
    if (blink) {
      k.stroke(() => { ctx.moveTo(x - 2.9, FACE.y); ctx.quadraticCurveTo(x, FACE.y + 2.9, x + 2.9, FACE.y); }, 1.8, white);
    } else {
      k.fill(k.oval(x + 0.4, FACE.y, 3, 3.4), white);
      k.fill(k.oval(x + 0.6, FACE.y + 0.4, 2, 2.4), black);
      k.fill(k.oval(x + 1.3, FACE.y - 0.6, 0.85, 0.85), white);
    }
  }
  k.blush(34.5, 78.5, 3.6, 2.2);
  k.blush(68.5, 78, 3.2, 2.1);
  k.shape(k.blob([[FACE.x - 3, FACE.y + 6], [FACE.x + 3, FACE.y + 6], [FACE.x, FACE.y + 9]]), black, 1.2);
  k.catMouth(FACE.x, FACE.y + 9.2, 1.6);
}

function unicorn(k, { blink, alt }) {
  const { ctx } = k;
  const coat = '#FFFFFF', shade = '#EFE2F6', lilac = '#C9A6FF';
  const PINK = '#FFA3CF', YELLOW = '#FFDB7E', MINT = '#98E8CB', BLUE = '#9CCBFF', LILAC = '#CDAEFF';
  const lock = (color, ...pts) => k.solid(k.lock(...pts), color, null, { lw: 2.2 });
  // a fluffy rainbow pompom of a tail, which gives a little wag
  const sw = alt ? 2 : 0;
  k.cloud([[26 - sw, 113, 6, BLUE], [30, 104 - sw, 6, MINT], [23.5 - sw, 105.5 - sw, 6.6, PINK]]);
  k.feet(lilac);
  k.body(coat, '#FFF3FB', shade);
  k.arm(coat, lilac);
  // the mane, a fluffy rainbow tumbling down her back
  const mx = alt ? -1.2 : 0;
  k.cloud([[23 + mx, 82, 6.8, BLUE], [20 + mx, 70.5, 7.8, MINT], [22.5 + mx, 58.5, 8.4, YELLOW], [29, 48.5, 8.6, PINK], [39.5, 43, 8.4, PINK]]);
  // ears
  k.shape(k.blob([[31, 55], [29.5, 34], [35, 35.5], [44, 48]]), coat);
  k.fill(k.blob([[33, 50], [32.5, 39.5], [35.5, 40.5], [39.5, 48]]), '#FFD0E6');
  k.shape(k.blob([[57, 46], [66.5, 32.5], [70.5, 35], [68, 55]]), coat);
  k.fill(k.blob([[60, 46], [66.5, 38], [68.5, 40], [66, 51]]), '#FFD0E6');
  k.head(coat, shade);
  // golden spiral horn
  k.solid(k.blob([[46, 46], [53, 16.5], [54.5, 17], [56, 45]]), '#FFD76A', '#F2BA3A', { lw: 2.2, dir: [-1.5, 0.5] });
  for (const [a, b] of [[[48.3, 37.5], [55, 35]], [[50, 29.5], [54.7, 27.5]], [[51.3, 22.5], [54.3, 21]]]) k.line([a, b], 1.4, '#D99A1E');
  // a soft fringe swept to the side, pink over lilac
  k.solid(k.blob([[53, 45], [61, 40], [67, 47], [60, 51]]), LILAC, null, { lw: 2.2 });
  k.solid(k.blob([[31, 57], [33, 44], [45, 39.5], [58, 44], [52, 50], [42, 50], [37, 60]]), PINK, null, { lw: 2.2 });
  k.stroke(() => { ctx.moveTo(36, 49); ctx.quadraticCurveTo(39, 44.5, 45, 43.5); }, 1.7, 'rgba(255,255,255,0.7)');
  k.face(blink);
  if (!blink) {
    // lashes, flicking out at the outer corners
    const y = FACE.y, l = FACE.x - FACE.gap / 2, r = FACE.x + FACE.gap / 2;
    k.line([[l - 3.4, y - 1.3], [l - 5.8, y - 2.3]], 1.5);
    k.line([[r + 3.4, y - 1.3], [r + 5.8, y - 2.3]], 1.5);
  }
  k.smile(FACE.x, FACE.y + 5.8, 2.1, 1.6);
  if (alt) {
    // a twinkle off the horn
    ctx.save();
    ctx.translate(66, 20);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 1.6 : 6, a = (i * Math.PI) / 4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFF08A';
    ctx.fill();
    ctx.strokeStyle = '#E8B400';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Every rider: how to draw it, its scooter's colour and back-wheel hub, and its idle move — the alt
 * pose shows for `altFor` seconds every `altEvery` (or flips back and forth when `altEvery` is 0).
 */
export const RIDERS = {
  girl: { draw: girl, bar: 90, scooter: '#34343C', wheel: '#E2394E', altEvery: 0, altFor: 0, still: true },
  bunny: { draw: bunny, scooter: '#FF9CC2', wheel: '#FF9CC2', altEvery: 3.4, altFor: 0.7 },
  capy: { draw: capybara, scooter: '#FFA94D', wheel: '#FFA94D', altEvery: 2.2, altFor: 0.28 },
  kitty: { draw: kitty, scooter: '#7CC8FF', wheel: '#7CC8FF', altEvery: 1.6, altFor: 0.55 },
  penguin: { draw: penguin, scooter: '#FF6F7F', wheel: '#FF6F7F', altEvery: 0, altFor: 0.16 },
  panda: { draw: panda, scooter: '#6FD08C', wheel: '#6FD08C', altEvery: 2.6, altFor: 0.22 },
  unicorn: { draw: unicorn, scooter: '#C3A2FF', wheel: '#C3A2FF', altEvery: 0, altFor: 0.32 },
};

/** One frame of a rider on its scooter, `height` tall. Frames: 0 plain, 1 blink, 2 idle move, 3 both. */
export function riderFrame(id, height, frame = 0) {
  const def = RIDERS[id] ?? RIDERS.girl;
  const s = height / 140;
  const [c, ctx] = surface(100 * s, 140 * s);
  ctx.scale(s, s);
  const k = kit(ctx);
  k.bar = def.bar ?? 96;
  scooterBack(k, def.scooter);
  def.draw(k, { blink: !!(frame & 1), alt: !!(frame & 2) });
  scooterFront(k, def.scooter, def.wheel);
  return c;
}

export const riderFrames = (id, height) => [0, 1, 2, 3].map(f => riderFrame(id, height, f));

/** Which frame a rider shows at time `t` (seconds): a blink every few seconds, plus its idle move. */
export function frameAt(id, t, seed = 0) {
  const def = RIDERS[id] ?? RIDERS.girl;
  const bt = (t + seed) % 3.7;
  const blink = bt < 0.13 || (bt > 0.32 && bt < 0.42 && Math.floor((t + seed) / 3.7) % 3 === 0);
  let alt = false;
  if (!def.still) alt = def.altEvery ? (t + seed * 0.7) % def.altEvery < def.altFor : Math.floor(t / def.altFor) % 2 === 1;
  return (blink ? 1 : 0) + (alt ? 2 : 0);
}

// ---------------------------------------------------------------- trails

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.35, y + r * 0.05, x - r * 0.9, y - r * 1.05, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 1.05, x + r * 1.35, y + r * 0.05, x, y + r * 0.9);
  ctx.closePath();
}

function star4(ctx, x, y, r, w = 0.18) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * w, y - r * w, x + r, y);
  ctx.quadraticCurveTo(x + r * w, y + r * w, x, y + r);
  ctx.quadraticCurveTo(x - r * w, y + r * w, x - r, y);
  ctx.quadraticCurveTo(x - r * w, y - r * w, x, y - r);
  ctx.closePath();
}

const TRAIL_ART = {
  hearts: size => ['#FF5C9E', '#FF9CC6', '#FF7FB0'].map(col => {
    const [c, ctx] = surface(size, size);
    heart(ctx, size / 2, size / 2 + size * 0.04, size * 0.36);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#B32E66';
    ctx.lineWidth = size * 0.07;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size * 0.37, size * 0.4, size * 0.07, size * 0.045, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    return c;
  }),
  sparkles: size => ['#FFE14A', '#FFFFFF', '#FFF3A6'].map(col => {
    const [c, ctx] = surface(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,210,0.75)');
    g.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    star4(ctx, size / 2, size / 2, size * 0.42);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(214,160,0,0.6)';
    ctx.lineWidth = size * 0.03;
    ctx.stroke();
    return c;
  }),
  bubbles: size => [0.85, 1].map(k => {
    const [c, ctx] = surface(size, size);
    const r = size * 0.4 * k, m = size / 2;
    const g = ctx.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.7, 'rgba(170,225,255,0.25)');
    g.addColorStop(1, 'rgba(120,190,255,0.55)');
    ctx.beginPath();
    ctx.arc(m, m, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,150,230,0.85)';
    ctx.lineWidth = size * 0.045;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m, m, r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.06;
    ctx.stroke();
    return c;
  }),
  petals: size => ['#FFB7D2', '#FFD1E3', '#FF9CC0'].map(col => {
    const [c, ctx] = surface(size, size);
    const m = size / 2, r = size * 0.4;
    // a cherry blossom petal: a teardrop with a notch at its tip
    ctx.beginPath();
    ctx.moveTo(m, m + r);
    ctx.bezierCurveTo(m - r * 1.05, m + r * 0.2, m - r * 0.7, m - r, m - r * 0.16, m - r);
    ctx.lineTo(m, m - r * 0.72);
    ctx.lineTo(m + r * 0.16, m - r);
    ctx.bezierCurveTo(m + r * 0.7, m - r, m + r * 1.05, m + r * 0.2, m, m + r);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = '#E0679A';
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m, m + r * 0.7);
    ctx.lineTo(m, m - r * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    return c;
  }),
  notes: size => [['#8B6CFF', 1], ['#FF6FB5', 2], ['#3FA7F5', 1]].map(([col, heads]) => {
    const [c, ctx] = surface(size, size);
    const r = size * 0.13, stem = size * 0.5;
    const xs = heads === 2 ? [size * 0.3, size * 0.68] : [size * 0.44];
    const by = size * 0.74;
    const paint = (lw, color) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lw;
      for (const x of xs) {
        ctx.beginPath();
        ctx.ellipse(x, by, r * 1.2, r * 0.9, -0.4, 0, TAU);
        ctx.fill();
        if (lw > size * 0.08) ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + r * 1.05, by);
        ctx.lineTo(x + r * 1.05, by - stem);
        ctx.stroke();
      }
      ctx.beginPath();
      if (heads === 2) {
        ctx.moveTo(xs[0] + r * 1.05, by - stem);
        ctx.lineTo(xs[1] + r * 1.05, by - stem - size * 0.04);
      } else {
        ctx.moveTo(xs[0] + r * 1.05, by - stem);
        ctx.quadraticCurveTo(xs[0] + r * 3.4, by - stem * 0.7, xs[0] + r * 2.6, by - stem * 0.3);
      }
      ctx.stroke();
    };
    paint(size * 0.16, '#FFFFFF');
    paint(size * 0.075, col);
    return c;
  }),
  rainbow: size => ['#FF5A5F', '#FF9F1C', '#FFD23F', '#5DD39E', '#3FA7F5', '#8B6CFF'].map(col => {
    const [c, ctx] = surface(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, col);
    g.addColorStop(0.55, col);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  }),
};

/** How each trail's bits come out of the scooter and move (per second, in design units of `s`). */
const TRAIL_MOTION = {
  hearts: { every: 0.2, life: 1.3, size: 20, rise: 34, spread: 0.5 },
  sparkles: { every: 0.11, life: 0.8, size: 22, rise: 10, spread: 0.7, twinkle: true },
  bubbles: { every: 0.17, life: 1.4, size: 22, rise: 40, spread: 0.6, pop: true },
  petals: { every: 0.16, life: 1.5, size: 17, rise: -8, spread: 0.6, spin: true },
  notes: { every: 0.26, life: 1.3, size: 24, rise: 38, spread: 0.4, sway: true },
  rainbow: { every: 0.028, life: 0.75, size: 13, rise: 0, spread: 0, ribbon: true },
};

export const TRAIL_IDS = Object.keys(TRAIL_ART);

/** Sprites for a trail at scale `s` (null for no trail). */
export function trailSprites(id, s) {
  const art = TRAIL_ART[id];
  return art ? art(TRAIL_MOTION[id].size * s) : null;
}

/**
 * The trail behind a rider. `update` spawns and ages the bits; `draw` paints them. Everything is
 * a pre-rendered sprite moved with one transform, like the rest of the game's particles.
 */
export class Trail {
  constructor(id, s) {
    this.id = id;
    this.s = s;
    this.sprites = trailSprites(id, s);
    this.motion = TRAIL_MOTION[id];
    this.bits = [];
    this.next = 0;
    this.n = 0;
  }

  /** `x, y`: where bits come out (behind the rider); `drift`: how fast the road runs left, px/s. */
  update(t, x, y, drift, on = true) {
    const m = this.motion;
    if (!this.sprites) return;
    if (this.next === 0) this.next = t;
    if (!on) this.next = t;
    const s = this.s;
    while (on && this.next <= t) {
      this.next += m.every;
      const i = this.n++;
      this.bits.push({
        t0: this.next,
        x: x + (m.ribbon ? 0 : (Math.random() - 0.3) * 14 * s),
        y: y + (m.ribbon ? Math.sin(this.next * 7) * 3.5 * s : (Math.random() - 0.5) * 22 * s * m.spread),
        sprite: this.sprites[i % this.sprites.length],
        vx: -drift * (m.ribbon ? 1 : 0.45 + Math.random() * 0.25),
        vy: -(m.rise * (0.7 + Math.random() * 0.6)) * s,
        rot: (Math.random() - 0.5) * 0.6,
        vr: m.spin ? (Math.random() - 0.5) * 5 : 0,
        seed: Math.random() * TAU,
      });
    }
    let alive = 0;
    for (const b of this.bits) if (t - b.t0 < m.life) this.bits[alive++] = b;
    this.bits.length = alive;
    if (this.bits.length > 120) this.bits.splice(0, this.bits.length - 120);
  }

  draw(ctx, t, dpr) {
    const m = this.motion, s = this.s;
    for (const b of this.bits) {
      const a = t - b.t0;
      if (a < 0) continue;
      const k = a / m.life;
      let x = b.x + b.vx * a, y = b.y + b.vy * a;
      let scale = Math.min(1, a / 0.12), alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      let rot = b.rot + b.vr * a;
      if (m.sway) x += Math.sin(a * 6 + b.seed) * 5 * s;
      if (m.spin) { x += Math.sin(a * 4 + b.seed) * 6 * s; y += 0.5 * 30 * s * a * a; }
      if (m.twinkle) scale *= 0.55 + 0.45 * Math.abs(Math.sin(a * 9 + b.seed));
      if (m.pop && k > 0.85) { scale *= 1 + (k - 0.85) * 3; alpha = 1 - (k - 0.85) / 0.15; }
      if (m.ribbon) { scale = 1 - k * 0.45; alpha = 1 - k; }
      if (!m.spin && !m.sway && !m.ribbon) rot = b.rot * 0.4;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      const c = Math.cos(rot) * scale * dpr, sn = Math.sin(rot) * scale * dpr;
      ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr);
      const img = b.sprite;
      ctx.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
  }
}

