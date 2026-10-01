// Hats for the shop animals, drawn in the same rider design space and ink style as animals.js,
// and slipped into a live renderSVG() rider so they follow the head's pose.
//
// Each hat is drawn around its own origin: (0, 0) is the middle of where it meets the top of the head,
// up is -y, and it's designed for a head 32 units wide. FIT says where each animal's crown is, and
// what happens to the things already on top of its head:
//
//   hide   parts the hat replaces (the penguin's tuft)
//   lift   parts that poke through the hat, so they're drawn over it (the unicorn's horn)
//   carry  parts that ride on the hat: to its `perch` (the capybara's yuzu, the panda's sprout)
//          or pinned to its band at `pin` (the bunny's bow)
//
// The shop wears them live (shoprider.js); the game draws them into four still frames (hatFrames),
// simplified for its ~20px hats (`lod: 'small'`). Names live in i18n.js. Prototype: art-lab/hats.html.

import { P, INK, mix, keyPose } from './animals.js';
import { renderSVG } from './svgrider.js';
import { SHEET } from './painted.js';
import { surface } from './art.js';

const n2 = v => Math.round(v * 100) / 100;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where each animal's crown is (head coordinates), and what happens to its own head things. */
export const FIT = {
  bunny: { x: 47, y: 46.5, w: 30, r: -0.05, carry: [{ part: 'bow', at: [46.5, 45.5], to: 'pin', k: 0.62 }] },
  capy: { x: 61, y: 44.8, w: 26, r: 0.03, carry: [{ part: 'yuzu', at: [57.5, 44.3], to: 'perch' }] },
  kitty: { x: 47.5, y: 46, w: 28, r: 0.03 },
  penguin: { x: 48, y: 51.5, w: 29, r: 0.05, hide: ['tuft'] },
  panda: { x: 46.5, y: 46, w: 27, r: 0, carry: [{ part: 'sprout', at: [47, 45], to: 'perch' }] },
  unicorn: { x: 48.5, y: 45.5, w: 28, r: -0.03, lift: ['horn', 'twinkle'],
    // tall cones slide to the back of the head and lean away, so the horn stands in front of them
    per: { party: { dx: -6, dy: 1, r: -0.32 }, witch: { dx: -5, dy: 0.5, r: -0.22 }, tophat: { dx: -6, dy: 0.5, r: -0.2 } } },
};

/** A tiny drawing kit with the same looks as svgrider.js, writing into one SVG's <defs>. */
let uid = 0;
function kit(svg, style, small = false) {
  const defs = svg.querySelector('defs');
  const pre = `h${++uid}`;
  const grads = new Map();
  let clipN = 0;
  const add = s => defs.insertAdjacentHTML('beforeend', s);
  const paint = c => {
    if (style !== 'rich' || !/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (!grads.has(c)) {
      const id = `${pre}g${grads.size}`;
      grads.set(c, id);
      add(`<linearGradient id="${id}" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${mix(c, '#FFFFFF', 0.28)}"/><stop offset="0.55" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, '#7A4A6A', 0.07)}"/></linearGradient>`);
    }
    return `url(#${grads.get(c)})`;
  };
  const k = {
    shape: (d, f, lw = 2.2) => `<path d="${d}" fill="${paint(f)}" stroke="${INK}" stroke-width="${lw}"/>`,
    fill: (d, f) => `<path d="${d}" fill="${f}"/>`,
    line: (d, w, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`,
    /** Filled, shaded on its back edge, outlined: the animals' "solid". */
    solid(d, f, sh, { lw = 2.2, dir = [-1.8, 2], inside = '' } = {}) {
      const id = `${pre}c${clipN++}`;
      add(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
      const [dx, dy] = dir;
      const gloss = style === 'rich' ? `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" transform="translate(${-dx * 0.35} ${-dy * 0.35})"/>` : '';
      return `<path d="${d}" fill="${sh}"/><g clip-path="url(#${id})"><path d="${d}" fill="${paint(f)}" transform="translate(${-dx} ${-dy})"/>${inside}${gloss}</g>`
        + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${lw}"/>`;
    },
    /** Round puffs outlined as one (cuffs, pompoms, the chef's hat). */
    cloud(puffs, lw = 2.2) {
      return puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + lw / 2}" fill="${INK}"/>`).join('')
        + puffs.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r - lw / 2}" fill="${paint(c)}"/>`).join('')
        + (style === 'rich' ? puffs.map(([x, y, r]) => { const rr = r - 2.6; return rr > 1 ? `<path d="${P.arc(x, y, rr, rr, -2.5, -1.7)}" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.3"/>` : ''; }).join('') : '');
    },
    /** A part that moves on its own (see animate()). */
    anim: (kind, [px, py], body) => small && kind === 'twinkle' ? '' : `<g data-hat-anim="${kind}" data-px="${px}" data-py="${py}">${body}</g>`,
    /** A small five-petal flower. */
    flower(x, y, r, petal, heart = '#FFD23F') {
      const ps = [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55, petal]; });
      return k.cloud(ps, 1.6) + `<circle cx="${x}" cy="${y}" r="${r * 0.36}" fill="${heart}" stroke="${INK}" stroke-width="1.2"/>`;
    },
    leaf: (x, y, l, rot, c = '#5DBB4A') => k.shape(P.ell(x, y, l, l * 0.45, rot), c, 1.6),
  };
  return k;
}

const STRAW_LINES = (k, rx, ry, y) => [0.55, 0.8].map(f => k.line(P.arc(0, y, rx * f, ry * f, 0.25, Math.PI - 0.25), 1.1, 'rgba(150,100,20,0.35)')).join('');

/**
 * The hats. `perch` is where something riding on the hat sits (its bottom), `pin` is a spot on its band.
 * `draw(k, small)`: `small` is the game-size version, with the fine detail left out.
 */
export const HATS = {
  beanie: {
    tier: 'common', perch: [0, -25], pin: [-12, 1],
    draw: k => k.solid('M-15.5 0C-16 -11 -9 -16.5 0 -16.5C9 -16.5 16 -11 15.5 0Z', '#FF9CC2', '#F07FAA', {
      inside: [-10, -5, 0, 5, 10].map(x => k.line(`M${x} 0Q${n2(x * 1.04)} -9 ${n2(x * 0.62)} ${n2(-15.6 + Math.abs(x) * 0.1)}`, 1.3, 'rgba(170,40,100,0.28)')).join(''),
    })
      + k.solid('M-17.5 -1.5Q0 -6 17.5 -1.5L17 5Q0 1 -17 5Z', '#FFC6DB', '#F4A6C4', {
        inside: [-13, -9, -5, -1, 3, 7, 11, 15].map(x => k.line(`M${x} ${n2(-1.5 - 3.6 * (1 - (x / 17.5) ** 2) + 1.2)}L${x} ${n2(4.2 - 3 * (1 - (x / 17) ** 2) - 0.6)}`, 1.1, 'rgba(170,40,100,0.25)')).join(''),
      })
      + k.anim('wobble', [0, -16], k.cloud([[0, -20.5, 5.4, '#FFF6FA']], 2)),
  },
  beret: {
    tier: 'common', perch: [3, -13.5], pin: [-10, -3],
    draw: k => k.solid('M-14 1.5Q0 -1.5 14 1.5L14.5 -2.5Q0 -5.5 -14.5 -2.5Z', '#C93E50', '#B0303F')
      + k.solid(P.ell(3, -6.5, 19.5, 7.2, -0.1), '#FF5C6F', '#E04558', { dir: [-1.5, 2.2] })
      + k.line('M4.3 -13.4L5.2 -16.6', 2.6),
  },
  flowers: {
    tier: 'common', perch: [1, -5], pin: [-15, 1],
    // a pink ribbon band and coloured daisies: lone white flowers on the head mean mourning,
    // and nothing here may read as a green hat
    draw: k => k.line('M-17.5 2.5Q0 -5 17.5 2.5', 2.8, '#FF8FB5')
      // three big daisies rather than five small ones, so they still read as flowers at game size
      + [[-16, 1.5, -0.9], [-5.5, -2.8, 0.4], [6.5, -2.8, -0.4], [16, 1.5, 0.9]].map(([x, y, r]) => k.leaf(x, y - 2, 3.6, r)).join('')
      + [[-11.5, 0, 5.2, '#FFE07A', '#FF9A3C'], [0.5, -3, 5.8, '#FFB3CB', '#FFD23F'], [12, 0, 5.2, '#FFCBA4', '#FFD23F']]
        .map(([x, y, r, c, h]) => k.flower(x, y, r, c, h)).join(''),
  },
  party: {
    tier: 'common', perch: [2, -33], pin: [-7, -3],
    draw: k => k.solid('M-10.5 1.5L2 -27L10.5 1.5Q0 4 -10.5 1.5Z', '#C3A2FF', '#A584E6', {
      inside: [[-4, -1], [4.5, -9], [-1.5, -15], [5, 0.5], [0.5, -5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#FF7FA8"/>`).join('')
        + k.line('M-11 -6Q2 -10 12 -6', 2.2, '#FFE07A') + k.line('M-7 -16Q2 -19 9 -16', 2, '#FFE07A'),
    })
      + k.anim('wobble', [2, -27], k.cloud([[2, -29, 3.6, '#FFDB7E'], [-1.2, -30.5, 2.6, '#FFDB7E'], [5, -30.4, 2.6, '#FFDB7E']], 1.8)),
  },
  witch: {
    tier: 'seasonal', season: 'Halloween', perch: [16.5, -1.5], pin: [-7, -5],
    draw: k => k.solid(P.ell(0, 0, 22, 4.6), '#7A5BC4', '#5E43A3', { dir: [-1, 1.4] })
      + k.solid('M-11 -1C-10 -12 -7 -20 -4 -24C-2 -28 -6 -32 -12 -31C-7 -35 1 -33 2 -26C3 -18 8 -9 11 -1Q0 2 -11 -1Z', '#8E6FD8', '#6E51B8', {
        inside: k.solid('M-10.6 -3.5Q0 -1 10.4 -3.5L9.4 -7.6Q0 -5.4 -9.6 -7.6Z', '#FFA630', '#F08A1A', { lw: 1.6 })
          + `<rect x="-2.6" y="-7.4" width="5.2" height="4.4" rx="1" fill="#FFD76A" stroke="${INK}" stroke-width="1.2"/>`
          + k.shape(P.star4(5, -15, 3.2, 0.3), '#FFE07A', 1.1),
      }),
  },
  santa: {
    tier: 'seasonal', season: 'Christmas', perch: [1, -21], pin: [-10, -1],
    draw: k => k.anim('wobble', [-3, -17], k.solid('M-3 -19C-11 -21 -18 -17 -22 -8L-17 -6C-14 -11 -9 -14 -2 -13Z', '#FF5C6F', '#E04558')
      + k.cloud([[-20.5, -6.5, 4.4, '#FFFFFF']], 2))
      + k.solid(P.blob([[-13.5, 1], [-14.5, -12], [-5, -20.5], [6, -19.5], [13, -12], [13.5, 1]]), '#FF5C6F', '#E04558')
      + k.cloud([-15, -10, -5, 0, 5, 10, 15].map((x, i) => [x, 0.5 - 2.6 * (1 - (x / 16) ** 2) + (i % 2) * 0.6, 3.6, '#FFFFFF']), 2),
  },
  straw: {
    tier: 'common', perch: [17.5, -1.8], pin: [-9, -4],
    draw: k => k.solid(P.ell(0, 0, 25, 5.6), '#F6D886', '#E8BE5C', { dir: [-1, 1.4], inside: STRAW_LINES(k, 25, 5.6, 0) })
      + k.anim('wobble', [-11, -4], k.shape('M-11 -3.5C-15 -2 -19 1 -22 6L-18.5 6.5C-16 2.5 -13.5 0.5 -10.5 -0.5Z', '#FF7FA8', 1.6))
      + k.solid('M-12 -1C-12.5 -9 -8 -13.5 0 -13.5C8 -13.5 12.5 -9 12 -1Q0 1.5 -12 -1Z', '#F6D886', '#E8BE5C', {
        inside: k.fill('M-13 -2.6Q0 0 13 -2.6L13 -6.4Q0 -4 -13 -6.4Z', '#FF7FA8') + STRAW_LINES(k, 11, 8, -1),
      })
      + k.flower(8.5, -4.5, 3.4, '#FFE07A', '#FF9A3C'), // not white: see the daisy crown
  },
  tophat: {
    tier: 'rare', perch: [1, -19.5], pin: [-6, -3], scale: 0.86, smallScale: 0.95, tilt: -0.14, // a dark block when small
    draw: k => k.solid(P.ell(0, 0, 14, 3.4), '#4A3E58', '#362C42', { dir: [-0.8, 1] })
      + k.solid('M-8.5 -1Q0 1 8.5 -1L9.5 -18.5Q0 -16.5 -9.5 -18.5Z', '#4A3E58', '#362C42', {
        inside: k.fill('M-9 -3Q0 -1 9 -3L9.3 -7.3Q0 -5.3 -9.3 -7.3Z', '#FF6FA8'),
      })
      + k.shape(P.ell(0, -18.5, 9.5, 2.3), '#5C4E6C', 2)
      + k.shape(P.heart(4, -5.2, 2.4), '#FFE07A', 1.1),
  },
  chef: {
    tier: 'common', perch: [0, -27], pin: [-9, -2],
    draw: k => k.cloud([[-7.5, -12.5, 6.4, '#FFFFFF'], [0.5, -17, 7.6, '#FFFFFF'], [8, -12, 6.2, '#FFFFFF'], [0, -10, 6, '#FFFFFF']], 2.2)
      // a pink band, because all-white headwear reads as mourning (孝帽)
      + k.solid('M-11 -6.5Q0 -8 11 -6.5L11.5 1.5Q0 3.5 -11.5 1.5Z', '#FFFFFF', '#E9E4F0', { dir: [-1, 1.4],
        inside: k.fill('M-11.3 -3.4Q0 -5 11.3 -3.4L11.4 -0.4Q0 -2 -11.4 -0.4Z', '#FFB3CB') }),
  },
  duck: { // a duckling bucket hat: never a green one, since 戴绿帽子 means being cheated on
    tier: 'rare', perch: [-1, -19], pin: [-11, -1],
    draw: k => k.solid('M-19 3.5Q0 -1.5 19 3.5L14.5 -3Q0 -6.5 -14.5 -3Z', '#FFD54F', '#F2BC2E', { dir: [-1, 1.2] })
      + k.solid('M-13 -2C-13 -11 -7 -14.5 0 -14.5C7 -14.5 13 -11 13 -2Q0 -5 -13 -2Z', '#FFE07A', '#F5C84A', {
        inside: `<ellipse cx="9.6" cy="-5.6" rx="2" ry="1.2" fill="rgba(255,112,150,0.5)"/>`
          + `<circle cx="6.2" cy="-8.6" r="1.5" fill="${INK}"/><circle cx="6.7" cy="-9.1" r="0.55" fill="#fff"/>`,
      })
      + k.shape('M11.5 -7.6Q17.5 -8.6 18.8 -5.6Q17 -3.2 11.5 -4.2Z', '#FFA630', 1.6)
      + k.line('M-1.5 -14.4Q-3.2 -18 -0.6 -19.6M1.2 -14.6Q1.6 -17.6 4.4 -18.4', 1.8),
  },
  strawberry: {
    tier: 'rare', perch: [1.5, -23], pin: [-11, -2],
    // small: a few bigger seeds, as eight little ones blur into speckle
    draw: (k, small) => k.solid('M-15 1C-16 -10 -8 -16.5 0 -16.5C8 -16.5 16 -10 15 1Q0 4.5 -15 1Z', '#FF5C6F', '#E04558', {
      inside: (small ? [[-8, -5, 1.6], [0, -10, 1.6], [7, -5, 1.6], [-1, -3, 1.6]] : [[-10, -4], [-5, -9], [1, -4], [6, -10], [10, -3], [-2, -12.5], [-11, -10], [4, -1]])
        .map(([x, y, s = 1]) => k.fill(P.ell(x, y, 0.9 * s, 1.3 * s, 0.3), '#FFE7A0')).join(''),
    })
      + [-1.1, -0.5, 0.15, 0.75, 1.4].map(a => k.leaf(n2(Math.sin(a) * 5), n2(-15.5 - Math.cos(a) * 2.2), 4.2, a - Math.PI / 2, '#5DBB4A')).join('')
      + k.line('M0.5 -17L1.6 -22.5', 2.4, '#4E9C3E'),
  },
  tiger: {
    tier: 'rare', perch: [0, -19], pin: [-12, -2],
    draw: (k, small) => [[-9.5, -13.5], [9.5, -13.5]].map(([x, y]) => k.shape(P.ell(x, y, 4.4, 4), '#FFA630', 2) + k.fill(P.ell(x, y + 0.4, 2.2, 2), '#FFC6DB')).join('')
      + k.solid('M-15.5 1C-16 -10 -9 -15.5 0 -15.5C9 -15.5 16 -10 15.5 1Q0 4 -15.5 1Z', '#FFA630', '#F08A1A', {
        inside: (small ? '' : [-12.5, -8].map(x => k.line(`M${x} -6Q${x + 2} -8.5 ${x + 1} -12`, 2.2, '#8C4A12')).join('')
          + k.line('M13 -6Q11 -8.5 12 -12', 2.2, '#8C4A12'))
          // a big, bold 王: thinner strokes blur into an orange cap at game size
          + k.line('M-2 -12.5L7 -12.5M-1.2 -8.6L6.2 -8.6M-2.4 -4.4L7.4 -4.4M2.5 -12.5L2.5 -4.4', 2.4, '#8C1A12'),
      })
      + k.solid('M-16.5 -0.5Q0 -4 16.5 -0.5L16 4Q0 1 -16 4Z', '#FFF4E4', '#F1DCC0', { lw: 2 }),
  },
  crown: {
    tier: 'legendary', perch: [0, -18.5], pin: [-10, -1], scale: 0.9,
    draw: (k, small) => k.solid('M-12.5 1Q0 -1 12.5 1L13 -5L15 -15L7 -9L0 -18L-7 -9L-15 -15L-13 -5Z', '#FFD76A', '#F2BA3A', {
      inside: k.fill('M-13 -1.5Q0 -3.5 13 -1.5L13.4 -5Q0 -7 -13.4 -5Z', '#F2BA3A'),
    })
      + [[-15, -15, '#9CCBFF'], [0, -18, '#FF7FA8'], [15, -15, '#98E8CB']].map(([x, y, c]) => k.shape(P.ell(x, y, 2.4, 2.4), c, 1.4)).join('')
      + k.shape(P.heart(0, -6, 2.6), '#FF5C8A', 1.2)
      + (small ? [] : [[-7.5, -3.6, '#9CCBFF'], [7.5, -3.6, '#98E8CB']]).map(([x, y, c]) => k.shape(P.ell(x, y, 1.5, 1.5), c, 1.1)).join('')
      + k.anim('twinkle', [11, -22], k.shape(P.star4(11, -22, 4, 0.22), '#FFF08A', 1)),
  },
  halo: {
    tier: 'legendary', perch: null,
    draw: k => k.anim('bob', [0, -12], k.line(P.ell(0, -12, 12.5, 3.4), 5.4, INK) + k.line(P.ell(0, -12, 12.5, 3.4), 2.8, '#FFE07A')
      + k.line(P.arc(0, -12, 12.5, 3.4, 3.6, 4.6), 1.2, 'rgba(255,255,255,0.9)')),
  },
  propeller: {
    tier: 'rare', perch: [-11, -9], pin: [-12, 0],
    draw: k => k.shape('M11 -1Q20 -1.5 23 2.5Q15 4.5 10.5 3Z', '#FF6F7F', 2)
      + k.solid('M-15 1C-16 -10 -8 -15 0 -15C8 -15 16 -10 15 1Q0 3.5 -15 1Z', '#7CC8FF', '#5AAEEB', {
        inside: k.fill('M-15 1C-16 -10 -8 -15 0 -15L0 2Z', '#FFDB7E') + k.fill('M0 -15C8 -15 16 -10 15 1L0 2Z', '#FF9CC2')
          + k.fill('M-4 -15L4 -15L3 2L-3 2Z', '#C3A2FF'),
      })
      + k.line('M0 -15L0 -19', 2)
      + k.anim('spin', [0, -19.5], k.shape(P.ell(-6.5, -19.5, 6.5, 1.8), '#FF6F7F', 1.6) + k.shape(P.ell(6.5, -19.5, 6.5, 1.8), '#FFDB7E', 1.6))
      + k.shape(P.ell(0, -19.5, 1.8, 1.8), '#C3A2FF', 1.4),
  },
};
export const HAT_IDS = Object.keys(HATS);

/** The SVG nodes of a part, outermost first (the <g> that places it). */
const partOf = (svg, name) => svg.querySelector(`g.p-${name}`)?.parentNode;

/**
 * Puts hat `hatId` on a rider from renderSVG(), inside its head group so it follows every pose.
 * Returns animate(t, pose) for the hat's own moving bits, and remove() to take it off again.
 */
export function wearHat(r, id, hatId, { style = 'rich', lod = 'full' } = {}) {
  const small = lod === 'small';
  const hat = HATS[hatId], base = FIT[id], o = base.per?.[hatId] ?? {};
  const fit = { ...base, x: base.x + (o.dx ?? 0), y: base.y + (o.dy ?? 0), r: base.r + (o.r ?? 0) };
  const svg = r.svg;
  const head = svg.querySelector('g.p-head > g');
  const k = kit(svg, style, small);
  const s = (fit.w / 32) * ((small ? hat.smallScale : null) ?? hat.scale ?? 1), rot = fit.r + (hat.tilt ?? 0);
  const place = ([px, py]) => [fit.x + s * (px * Math.cos(rot) - py * Math.sin(rot)), fit.y + s * (px * Math.sin(rot) + py * Math.cos(rot))];

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'hat');
  g.setAttribute('transform', `translate(${n2(fit.x)} ${n2(fit.y)}) rotate(${n2(rot * 180 / Math.PI)}) scale(${n2(s)})`);
  g.innerHTML = hat.draw(k, small);
  head.append(g);

  const undo = [];
  for (const name of fit.hide ?? []) {
    const el = partOf(svg, name);
    if (!el) continue;
    // a still frame drops it outright: a display style would be serialised into the frame's image
    if (small) { el.remove(); continue; }
    el.style.display = 'none'; undo.push(() => (el.style.display = ''));
  }
  for (const name of fit.lift ?? []) {
    const el = partOf(svg, name);
    if (!el) continue;
    const before = el.nextSibling;
    head.append(el);
    undo.push(() => el.parentNode.insertBefore(el, before));
  }
  for (const c of fit.carry ?? []) {
    const el = partOf(svg, c.part);
    if (!el) continue;
    const spot = hat[c.to];
    if (!spot) continue; // nowhere on this hat for it to ride: it stays where it lives
    const [x, y] = place(spot), sc = c.k ?? 1;
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrap.setAttribute('transform', `translate(${n2(x)} ${n2(y)}) rotate(${n2(rot * 180 / Math.PI)}) scale(${sc}) translate(${-c.at[0]} ${-c.at[1]})`);
    const before = el.nextSibling, parent = el.parentNode;
    wrap.append(el);
    head.append(wrap);
    undo.push(() => { parent.insertBefore(el, before); wrap.remove(); });
  }

  // still frames: everything that moves stays at rest (the propeller's blades flat, the pompom hanging)
  if (small) return { animate() {}, remove() { g.remove(); undo.reverse().forEach(f => f()); } };
  const moving = [...g.querySelectorAll('[data-hat-anim]')].map(el => ({ el, kind: el.dataset.hatAnim, px: +el.dataset.px, py: +el.dataset.py }));
  // with reduced motion nothing moves, and a twinkle rests as a small still sparkle instead of a full-size star
  if (REDUCED) for (const { el, kind, px, py } of moving) {
    if (kind === 'twinkle') el.setAttribute('transform', `translate(${px} ${py}) scale(0.6) translate(${-px} ${-py})`);
  }
  return {
    /** Pompoms and tips lag behind the head, propellers spin, halos bob. */
    animate(t, p = {}) {
      if (REDUCED) return; // pompoms hang still, propellers rest, halos stay put
      const hr = (p.head?.r ?? 0) * 180 / Math.PI;
      for (const { el, kind, px, py } of moving) {
        let tr = '';
        if (kind === 'wobble') tr = `rotate(${n2(-hr * 2.6 + 4 * Math.sin(t * 8.5))} ${px} ${py})`;
        else if (kind === 'spin') tr = `translate(${px} ${py}) scale(${n2(Math.cos(t * 22))} 1) translate(${-px} ${-py})`;
        else if (kind === 'bob') tr = `translate(0 ${n2(-1.4 + 1.4 * Math.sin(t * 3))})`;
        else if (kind === 'twinkle') { const u = (t % 2.2) / 2.2, a = u < 0.3 ? Math.sin(u / 0.3 * Math.PI) : 0; tr = `translate(${px} ${py}) scale(${n2(a)}) rotate(${n2(u * 120)}) translate(${-px} ${-py})`; }
        el.setAttribute('transform', tr);
      }
    },
    remove() { g.remove(); undo.reverse().forEach(f => f()); },
  };
}

/** A finished SVG element as a canvas `w` × `h` CSS pixels (through an image, so no DOM is needed). */
async function rasterise(svg, w, h) {
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const [c, ctx] = surface(w, h);
    ctx.drawImage(img, 0, 0, c.w, c.h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The game's frames of animal `id` in hat `hatId`, `height` tall like paintedFrames(): the four key
 * poses (plain, blink, idle move, both), in the same box as the painted sheets so they draw in the same place.
 */
export async function hatFrames(id, hatId, height) {
  if (!FIT[id] || !HATS[hatId]) throw new Error(`hat ${hatId} on ${id}`);
  const s = height / 140, frames = [];
  for (let f = 0; f < 4; f++) {
    const r = renderSVG(id, { style: 'rich', shadow: false });
    r.pose(keyPose(id, f & 1, f & 2));
    wearHat(r, id, hatId, { lod: 'small' });
    const svg = r.svg;
    svg.setAttribute('viewBox', `${SHEET.x0} ${SHEET.y0} ${SHEET.w} ${SHEET.h}`);
    svg.setAttribute('width', Math.round(SHEET.w * s * 2));
    svg.setAttribute('height', Math.round(SHEET.h * s * 2));
    frames.push(await rasterise(svg, SHEET.w * s, SHEET.h * s));
  }
  return frames;
}

/** The hat on its own, as a canvas `size` CSS pixels square (the shop's hat cards). */
const alone = new Map();
export function hatThumb(hatId, size) {
  const key = `${hatId}:${size}`;
  if (!alone.has(key)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '-27 -40.5 54 54');
    svg.setAttribute('width', size * 2);
    svg.setAttribute('height', size * 2);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = '<defs></defs>';
    const k = kit(svg, 'rich', true);
    svg.insertAdjacentHTML('beforeend', HATS[hatId].draw(k, false));
    alone.set(key, rasterise(svg, size, size).catch(e => { alone.delete(key); throw e; }));
  }
  return alone.get(key);
}
