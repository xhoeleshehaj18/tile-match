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

import { P, INK, mix, keyPose, poseAt } from './animals.js';
import { renderSVG } from './svgrider.js';
import { SHEET } from './painted.js';
import { surface } from './art.js';

const n2 = v => Math.round(v * 100) / 100;
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where each animal's crown is (head coordinates), and what happens to its own head things. */
export const FIT = {
  bunny: { x: 47, y: 46.5, w: 30, r: -0.05, carry: [{ part: 'bow', at: [46.5, 45.5], to: 'pin', k: 0.62 }], per: { goat: { spread: 0.75, horns: 0.8 } } },
  capy: { x: 61, y: 44.8, w: 26, r: 0.03, carry: [{ part: 'yuzu', at: [57.5, 44.3], to: 'perch' }] },
  kitty: { x: 47.5, y: 46, w: 28, r: 0.03, per: { goat: { spread: 0.8, horns: 0.8 } } },
  penguin: { x: 48, y: 51.5, w: 29, r: 0.05, hide: ['tuft'] },
  panda: { x: 46.5, y: 46, w: 27, r: 0, carry: [{ part: 'sprout', at: [47, 45], to: 'perch' }], per: { goat: { spread: 0.85, horns: 0.8 } } },
  unicorn: { x: 48.5, y: 45.5, w: 28, r: -0.03, lift: ['horn', 'twinkle'],
    // tall cones slide to the back of the head and lean away, so the horn stands in front of them
    per: { party: { dx: -6, dy: 1, r: -0.32 }, witch: { dx: -5, dy: 0.5, r: -0.22 }, tophat: { dx: -6, dy: 0.5, r: -0.2 },
      cake: { dx: -5, dy: 0.5, r: -0.22 }, jiaozi: { dx: -5, dy: 0.5, r: -0.12 }, tangyuan: { dx: -5, dy: 0.5, r: -0.12 },
      pumpkin: { dx: -4, dy: 0.5, r: -0.15 }, gradcap: { dy: -1, r: -0.08 }, nightcap: { dx: -2, r: -0.1 },
      // its own horn is the star: the goat band goes on without horns
      goat: { horns: 0 } } },
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
    anim: (kind, [px, py], body, attrs = '') => small && (kind === 'twinkle' || kind === 'pop') ? '' : `<g data-hat-anim="${kind}" data-px="${px}" data-py="${py}"${attrs}>${body}</g>`,
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
    react: 'squash', tier: 'common', perch: [0, -25], pin: [-12, 1],
    draw: k => k.solid('M-15.5 0C-16 -11 -9 -16.5 0 -16.5C9 -16.5 16 -11 15.5 0Z', '#FF9CC2', '#F07FAA', {
      inside: [-10, -5, 0, 5, 10].map(x => k.line(`M${x} 0Q${n2(x * 1.04)} -9 ${n2(x * 0.62)} ${n2(-15.6 + Math.abs(x) * 0.1)}`, 1.3, 'rgba(170,40,100,0.28)')).join(''),
    })
      + k.solid('M-17.5 -1.5Q0 -6 17.5 -1.5L17 5Q0 1 -17 5Z', '#FFC6DB', '#F4A6C4', {
        inside: [-13, -9, -5, -1, 3, 7, 11, 15].map(x => k.line(`M${x} ${n2(-1.5 - 3.6 * (1 - (x / 17.5) ** 2) + 1.2)}L${x} ${n2(4.2 - 3 * (1 - (x / 17) ** 2) - 0.6)}`, 1.1, 'rgba(170,40,100,0.25)')).join(''),
      })
      + k.anim('wobble', [0, -16], k.cloud([[0, -20.5, 5.4, '#FFF6FA']], 2)),
  },
  beret: {
    react: 'slide', tier: 'common', perch: [3, -13.5], pin: [-10, -3],
    draw: k => k.solid('M-14 1.5Q0 -1.5 14 1.5L14.5 -2.5Q0 -5.5 -14.5 -2.5Z', '#C93E50', '#B0303F')
      + k.solid(P.ell(3, -6.5, 19.5, 7.2, -0.1), '#FF5C6F', '#E04558', { dir: [-1.5, 2.2] })
      + k.line('M4.3 -13.4L5.2 -16.6', 2.6),
  },
  flowers: {
    react: 'wiggle', tier: 'common', perch: [1, -5], pin: [-15, 1],
    // a pink ribbon band and coloured daisies: lone white flowers on the head mean mourning,
    // and nothing here may read as a green hat
    draw: k => k.line('M-17.5 2.5Q0 -5 17.5 2.5', 2.8, '#FF8FB5')
      // three big daisies rather than five small ones, so they still read as flowers at game size
      + [[-16, 1.5, -0.9], [-5.5, -2.8, 0.4], [6.5, -2.8, -0.4], [16, 1.5, 0.9]].map(([x, y, r]) => k.leaf(x, y - 2, 3.6, r)).join('')
      + [[-11.5, 0, 5.2, '#FFE07A', '#FF9A3C'], [0.5, -3, 5.8, '#FFB3CB', '#FFD23F'], [12, 0, 5.2, '#FFCBA4', '#FFD23F']]
        .map(([x, y, r, c, h]) => k.flower(x, y, r, c, h)).join(''),
  },
  party: {
    react: 'squash', tier: 'common', perch: [2, -33], pin: [-7, -3],
    draw: k => k.solid('M-10.5 1.5L2 -27L10.5 1.5Q0 4 -10.5 1.5Z', '#C3A2FF', '#A584E6', {
      inside: [[-4, -1], [4.5, -9], [-1.5, -15], [5, 0.5], [0.5, -5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#FF7FA8"/>`).join('')
        + k.line('M-11 -6Q2 -10 12 -6', 2.2, '#FFE07A') + k.line('M-7 -16Q2 -19 9 -16', 2, '#FFE07A'),
    })
      + k.anim('wobble', [2, -27], k.cloud([[2, -29, 3.6, '#FFDB7E'], [-1.2, -30.5, 2.6, '#FFDB7E'], [5, -30.4, 2.6, '#FFDB7E']], 1.8)),
  },
  witch: {
    react: 'twirl', tier: 'seasonal', season: 'Halloween', perch: [16.5, -1.5], pin: [-7, -5],
    draw: k => k.solid(P.ell(0, 0, 22, 4.6), '#7A5BC4', '#5E43A3', { dir: [-1, 1.4] })
      + k.solid('M-11 -1C-10 -12 -7 -20 -4 -24C-2 -28 -6 -32 -12 -31C-7 -35 1 -33 2 -26C3 -18 8 -9 11 -1Q0 2 -11 -1Z', '#8E6FD8', '#6E51B8', {
        inside: k.solid('M-10.6 -3.5Q0 -1 10.4 -3.5L9.4 -7.6Q0 -5.4 -9.6 -7.6Z', '#FFA630', '#F08A1A', { lw: 1.6 })
          + `<rect x="-2.6" y="-7.4" width="5.2" height="4.4" rx="1" fill="#FFD76A" stroke="${INK}" stroke-width="1.2"/>`
          + k.shape(P.star4(5, -15, 3.2, 0.3), '#FFE07A', 1.1),
      }),
  },
  santa: {
    react: 'lift', tier: 'seasonal', season: 'Christmas', perch: [1, -21], pin: [-10, -1],
    draw: k => k.anim('wobble', [-3, -17], k.solid('M-3 -19C-11 -21 -18 -17 -22 -8L-17 -6C-14 -11 -9 -14 -2 -13Z', '#FF5C6F', '#E04558')
      + k.cloud([[-20.5, -6.5, 4.4, '#FFFFFF']], 2))
      + k.solid(P.blob([[-13.5, 1], [-14.5, -12], [-5, -20.5], [6, -19.5], [13, -12], [13.5, 1]]), '#FF5C6F', '#E04558')
      + k.cloud([-15, -10, -5, 0, 5, 10, 15].map((x, i) => [x, 0.5 - 2.6 * (1 - (x / 16) ** 2) + (i % 2) * 0.6, 3.6, '#FFFFFF']), 2),
  },
  straw: {
    react: 'lift', tier: 'common', perch: [17.5, -1.8], pin: [-9, -4],
    draw: k => k.solid(P.ell(0, 0, 25, 5.6), '#F6D886', '#E8BE5C', { dir: [-1, 1.4], inside: STRAW_LINES(k, 25, 5.6, 0) })
      + k.anim('wobble', [-11, -4], k.shape('M-11 -3.5C-15 -2 -19 1 -22 6L-18.5 6.5C-16 2.5 -13.5 0.5 -10.5 -0.5Z', '#FF7FA8', 1.6))
      + k.solid('M-12 -1C-12.5 -9 -8 -13.5 0 -13.5C8 -13.5 12.5 -9 12 -1Q0 1.5 -12 -1Z', '#F6D886', '#E8BE5C', {
        inside: k.fill('M-13 -2.6Q0 0 13 -2.6L13 -6.4Q0 -4 -13 -6.4Z', '#FF7FA8') + STRAW_LINES(k, 11, 8, -1),
      })
      + k.flower(8.5, -4.5, 3.4, '#FFE07A', '#FF9A3C'), // not white: see the daisy crown
  },
  tophat: {
    react: 'lift', tier: 'rare', perch: [1, -19.5], pin: [-6, -3], scale: 0.86, smallScale: 0.95, tilt: -0.14, // a dark block when small
    draw: k => k.solid(P.ell(0, 0, 14, 3.4), '#4A3E58', '#362C42', { dir: [-0.8, 1] })
      + k.solid('M-8.5 -1Q0 1 8.5 -1L9.5 -18.5Q0 -16.5 -9.5 -18.5Z', '#4A3E58', '#362C42', {
        inside: k.fill('M-9 -3Q0 -1 9 -3L9.3 -7.3Q0 -5.3 -9.3 -7.3Z', '#FF6FA8'),
      })
      + k.shape(P.ell(0, -18.5, 9.5, 2.3), '#5C4E6C', 2)
      + k.shape(P.heart(4, -5.2, 2.4), '#FFE07A', 1.1)
      // the magic trick: on a flip, a little heart pops out of the top (hidden until then)
      + k.anim('pop', [0, -20], k.shape(P.heart(0, -25, 5), '#FF6FA8', 1.6), ' opacity="0"'),
  },
  chef: {
    react: 'squash', tier: 'common', perch: [0, -27], pin: [-9, -2],
    draw: k => k.cloud([[-7.5, -12.5, 6.4, '#FFFFFF'], [0.5, -17, 7.6, '#FFFFFF'], [8, -12, 6.2, '#FFFFFF'], [0, -10, 6, '#FFFFFF']], 2.2)
      // a pink band, because all-white headwear reads as mourning (孝帽)
      + k.solid('M-11 -6.5Q0 -8 11 -6.5L11.5 1.5Q0 3.5 -11.5 1.5Z', '#FFFFFF', '#E9E4F0', { dir: [-1, 1.4],
        inside: k.fill('M-11.3 -3.4Q0 -5 11.3 -3.4L11.4 -0.4Q0 -2 -11.4 -0.4Z', '#FFB3CB') }),
  },
  duck: { // a duckling bucket hat: never a green one, since 戴绿帽子 means being cheated on
    react: 'squash', tier: 'rare', perch: [-1, -19], pin: [-11, -1],
    draw: k => k.solid('M-19 3.5Q0 -1.5 19 3.5L14.5 -3Q0 -6.5 -14.5 -3Z', '#FFD54F', '#F2BC2E', { dir: [-1, 1.2] })
      + k.solid('M-13 -2C-13 -11 -7 -14.5 0 -14.5C7 -14.5 13 -11 13 -2Q0 -5 -13 -2Z', '#FFE07A', '#F5C84A', {
        inside: `<ellipse cx="9.6" cy="-5.6" rx="2" ry="1.2" fill="rgba(255,112,150,0.5)"/>`
          + `<circle cx="6.2" cy="-8.6" r="1.5" fill="${INK}"/><circle cx="6.7" cy="-9.1" r="0.55" fill="#fff"/>`,
      })
      + k.shape('M11.5 -7.6Q17.5 -8.6 18.8 -5.6Q17 -3.2 11.5 -4.2Z', '#FFA630', 1.6)
      + k.line('M-1.5 -14.4Q-3.2 -18 -0.6 -19.6M1.2 -14.6Q1.6 -17.6 4.4 -18.4', 1.8),
  },
  strawberry: {
    react: 'wiggle', tier: 'rare', perch: [1.5, -23], pin: [-11, -2],
    // small: a few bigger seeds, as eight little ones blur into speckle
    draw: (k, small) => k.solid('M-15 1C-16 -10 -8 -16.5 0 -16.5C8 -16.5 16 -10 15 1Q0 4.5 -15 1Z', '#FF5C6F', '#E04558', {
      inside: (small ? [[-8, -5, 1.6], [0, -10, 1.6], [7, -5, 1.6], [-1, -3, 1.6]] : [[-10, -4], [-5, -9], [1, -4], [6, -10], [10, -3], [-2, -12.5], [-11, -10], [4, -1]])
        .map(([x, y, s = 1]) => k.fill(P.ell(x, y, 0.9 * s, 1.3 * s, 0.3), '#FFE7A0')).join(''),
    })
      + [-1.1, -0.5, 0.15, 0.75, 1.4].map(a => k.leaf(n2(Math.sin(a) * 5), n2(-15.5 - Math.cos(a) * 2.2), 4.2, a - Math.PI / 2, '#5DBB4A')).join('')
      + k.line('M0.5 -17L1.6 -22.5', 2.4, '#4E9C3E'),
  },
  tiger: {
    react: 'wiggle', tier: 'rare', perch: [0, -19], pin: [-12, -2],
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
    react: 'lift', tier: 'legendary', perch: [0, -18.5], pin: [-10, -1], scale: 0.9,
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
    react: 'lift', tier: 'rare', perch: [-11, -9], pin: [-12, 0],
    draw: k => k.shape('M11 -1Q20 -1.5 23 2.5Q15 4.5 10.5 3Z', '#FF6F7F', 2)
      + k.solid('M-15 1C-16 -10 -8 -15 0 -15C8 -15 16 -10 15 1Q0 3.5 -15 1Z', '#7CC8FF', '#5AAEEB', {
        inside: k.fill('M-15 1C-16 -10 -8 -15 0 -15L0 2Z', '#FFDB7E') + k.fill('M0 -15C8 -15 16 -10 15 1L0 2Z', '#FF9CC2')
          + k.fill('M-4 -15L4 -15L3 2L-3 2Z', '#C3A2FF'),
      })
      + k.line('M0 -15L0 -19', 2)
      + k.anim('spin', [0, -19.5], k.shape(P.ell(-6.5, -19.5, 6.5, 1.8), '#FF6F7F', 1.6) + k.shape(P.ell(6.5, -19.5, 6.5, 1.8), '#FFDB7E', 1.6))
      + k.shape(P.ell(0, -19.5, 1.8, 1.8), '#C3A2FF', 1.4),
  },

  // ---- gifts for the days of the year (see dates.js FESTIVALS) and things she earns

  jiaozi: { // 冬至 in the north: a little bowl of dumplings, cream with blush faces (never all white)
    react: 'hop', tier: 'seasonal', season: '冬至', perch: [10.5, -10.5], pin: [-11, -4], scale: 1.1,
    draw: (k, small) => BOWL(k, small)
      + [[-7, -9.5, -0.25], [7, -9.5, 0.25], [0, -12.5, 0]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${n2(r * 57.3)})">`
        + k.solid('M-6 0C-6.5 -4 -3.5 -7 0 -7C3.5 -7 6.5 -4 6 0Q0 1.6 -6 0Z', '#FFF1D6', '#F0D9AE', { lw: 1.8 })
        + (small ? '' : k.line('M-3 -6.2L-2.3 -4.6M0 -7L0 -5.3M3 -6.2L2.3 -4.6', 1, 'rgba(160,110,50,0.45)'))
        + FACE(0, -2.2) + '</g>').join('')
      + (small ? '' : STEAM(k, [[-4, -21], [4, -22]])),
  },
  tangyuan: { // 汤圆: pink, cream and yellow, for 元宵 (or 冬至 in the south)
    react: 'hop', tier: 'seasonal', season: '元宵', perch: [10.5, -10.5], pin: [-11, -4], scale: 1.1,
    draw: (k, small) => BOWL(k, small)
      + [[-6.5, -11, '#FFB3CB'], [6.5, -11, '#FFE07A'], [0, -14, '#FFF1D6']].map(([x, y, c]) => k.solid(P.ell(x, y, 5, 4.6), c, mix(c, '#C06080', 0.12), { lw: 1.8 })
        + FACE(x, y + 0.6)).join('')
      + (small ? '' : STEAM(k, [[-3, -22], [5, -23]])),
  },
  nightcap: { // pale blue, a droopy tip and a moon on the end
    react: 'wiggle', tier: 'rare', perch: [1, -20], pin: [-10, -1],
    draw: k => k.anim('wobble', [6, -16], k.solid('M5 -18C12 -20 19 -15 21 -6L16.5 -5C15 -10 11 -13 5 -12Z', '#A9D4FF', '#88BDF2')
      + k.shape('M19.5 -7.5A4.3 4.3 0 1 0 22.4 0.4A3.4 3.4 0 1 1 19.5 -7.5Z', '#FFE07A', 1.6))
      + k.solid(P.blob([[-13.5, 1], [-14, -11], [-4, -19.5], [7, -19], [13.5, -11], [13.5, 1]]), '#A9D4FF', '#88BDF2', {
        inside: [[-6, -12], [3, -8], [-9, -4], [7, -14]].map(([x, y]) => k.shape(P.star4(x, y, 1.9, 0.3), '#FFF6C8', 0.8)).join(''),
      })
      + k.solid('M-15 -3Q0 -6 15 -3L15 3Q0 0 -15 3Z', '#D8ECFF', '#BBDAF7', { lw: 2 }),
  },
  gradcap: { // navy mortarboard with a gold tassel
    react: 'wiggle', tier: 'rare', perch: [-6, -11], pin: [-10, -1],
    draw: k => k.solid('M-11.5 1C-12 -4 -11 -7 -10 -8L10 -8C11 -7 12 -4 11.5 1Q0 3 -11.5 1Z', '#3B4A7A', '#2C3862')
      + k.solid('M-20 -9L0 -15L20 -9L0 -3Z', '#4A5B92', '#36457A', { dir: [-0.6, 1.4] })
      + k.shape(P.ell(0, -9, 1.6, 1), '#FFD23F', 1.1)
      + k.line('M0 -9L12 -7.4', 1.4, '#E8B020')
      + k.anim('wobble', [12, -7.4], k.line('M12 -7.4L12.4 -1.5', 1.6, '#E8B020')
        + k.shape('M10.6 -2.2L14.2 -2.2L14.8 3L10 3Z', '#FFD23F', 1.2)),
  },
  cake: { // two pink tiers and one candle (for her birthday)
    react: 'squash', tier: 'seasonal', perch: [6.5, -15], pin: [-9, -4],
    draw: (k, small) => k.solid('M-13 1L-13 -8Q0 -10 13 -8L13 1Q0 3 -13 1Z', '#FFB3CB', '#F48FB0')
      + k.shape('M-13 -8Q0 -10 13 -8L13 -5.5Q10.5 -3 9 -5.5Q6 -2.5 4 -5.5Q1 -3 -1 -5.5Q-4 -2.5 -6 -5.5Q-9 -3 -11 -5.5Q-12 -4 -13 -5.5Z', '#FFF4E4', 1.6)
      + k.solid('M-8.5 -8.6L-8.5 -15Q0 -16.5 8.5 -15L8.5 -8.6Q0 -7.4 -8.5 -8.6Z', '#FF8FB5', '#EE6E98')
      + k.shape('M-8.5 -15Q0 -16.5 8.5 -15L8.5 -13Q6.5 -11 5 -13Q2.5 -10.5 0.5 -13Q-2 -11 -4 -13Q-6.5 -11 -8.5 -13Z', '#FFF4E4', 1.4)
      + (small ? '' : [[-9, -2.5, '#7CC8FF'], [-3, -1.6, '#FFE07A'], [3.5, -2.4, '#C3A2FF'], [9, -1.8, '#98E8CB'], [-4, -11, '#FFE07A'], [4, -10.6, '#7CC8FF']]
        .map(([x, y, c]) => `<rect x="${x - 1}" y="${y - 0.45}" width="2" height="0.9" rx="0.45" fill="${c}" transform="rotate(${(x * 37) % 60 - 30} ${x} ${y})"/>`).join(''))
      + k.shape('M-1.2 -15.5L-1.2 -21.5L1.2 -21.5L1.2 -15.5Z', '#9CCBFF', 1.2)
      + k.anim('flicker', [0, -22], k.shape('M0 -27.5C2.4 -25 2.4 -22.5 0 -21.8C-2.4 -22.5 -2.4 -25 0 -27.5Z', '#FFB23F', 1.1)),
  },
  goat: { // 2027 is the year of the goat: cream curled horns on a band (not red goat imagery, not 喜羊羊)
    react: 'wiggle', tier: 'seasonal', season: '春节', perch: null, pin: [-13, -1],
    draw: (k, small, o = {}) => {
      const sp = o.spread ?? 1, hs = o.horns ?? 1;
      const horn = side => `<g transform="translate(${n2(side * 11 * sp)} -3) scale(${n2(side * hs)} ${n2(hs)})">`
        + k.shape('M-2.5 1C-3 -5 1 -9.5 6 -9C10 -8.5 11.5 -4 9 -1.5C7 0.5 4 -0.5 4.5 -3C5 -4.8 7.2 -4.5 7 -3', '#FFF4E4', 1.8)
        + k.line('M-1.5 -2.5Q0.5 -6 4 -7M0.5 0Q1.5 -3 4 -4', 1, 'rgba(160,110,50,0.4)') + '</g>';
      return (hs ? horn(-1) + horn(1) : '')
        + k.line('M-16 2Q-15 -6 0 -7Q15 -6 16 2', 3.6, INK) + k.line('M-16 2Q-15 -6 0 -7Q15 -6 16 2', 1.8, '#FFC48A')
        + (small ? '' : k.shape('M0 -12L3.6 -8L0 -4L-3.6 -8Z', '#FF5C6F', 1.2)
          + `<text x="0" y="-6.6" font-size="4" text-anchor="middle" fill="#FFE07A" font-weight="700">福</text>`);
    },
  },
  pumpkin: { // Halloween 2027: a little pumpkin with a smile
    react: 'squash', tier: 'seasonal', season: 'Halloween', perch: [6.5, -16.5], pin: [-11, -4],
    draw: (k, small) => k.solid('M-14 0C-17 -6 -14 -15 -6 -15.5Q0 -17 6 -15.5C14 -15 17 -6 14 0Q0 3.5 -14 0Z', '#FFA630', '#F08A1A', {
      inside: k.line('M-6 -15.2Q-9 -7 -7 0.8M6 -15.2Q9 -7 7 0.8M0 -16.5L0 1.6', 1.3, 'rgba(160,70,0,0.35)')
        + (small ? k.line('M-6 -5Q0 -1 6 -5', 1.8)
          : `<path d="M-6.5 -10L-4 -12.5L-1.5 -10Z M1.5 -10L4 -12.5L6.5 -10Z" fill="${INK}"/>` + k.line('M-7 -6Q0 -1 7 -6', 1.8)),
    })
      + k.line('M0 -16C0 -19 1.5 -20.5 3.5 -20.5C5.5 -20.5 6 -18.5 4.5 -18', 2.4, '#7A4A1C')
      + k.leaf(-4, -18, 3.4, -0.5),
  },
};

/** The bowl the 冬至 and 元宵 hats sit in: blue porcelain with a pink band. */
function BOWL(k, small) {
  return k.solid('M-14 -9Q-13.5 1 0 1.5Q13.5 1 14 -9Z', '#9CCBFF', '#7CB2EE', {
    inside: k.fill('M-13.7 -6Q0 -4.5 13.7 -6L13.2 -3.6Q0 -2 -13.2 -3.6Z', '#FF9CC2')
      + (small ? '' : [[-7, -1.3], [0, -0.5], [7, -1.3]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#FFF6FA"/>`).join('')),
  })
    + k.shape(P.ell(0, -9, 14.4, 2.4), '#EAF4FF', 1.8);
}
/** A tiny sleepy-happy face for a dumpling: two dots and blush. */
const FACE = (x, y) => `<circle cx="${n2(x - 1.6)}" cy="${y}" r="0.6" fill="${INK}"/><circle cx="${n2(x + 1.6)}" cy="${y}" r="0.6" fill="${INK}"/>`
  + `<ellipse cx="${n2(x - 2.9)}" cy="${n2(y + 1)}" rx="1" ry="0.6" fill="rgba(255,112,150,0.55)"/><ellipse cx="${n2(x + 2.9)}" cy="${n2(y + 1)}" rx="1" ry="0.6" fill="rgba(255,112,150,0.55)"/>`;
/** Wisps of steam rising off a bowl. */
const STEAM = (k, spots) => spots.map(([x, y], i) => k.anim('steam', [x, y + i * 0.5],
  k.line(`M${x} ${y + 5}C${x - 2} ${y + 3} ${x + 2} ${y + 1.5} ${x} ${y - 1}`, 1.4, 'rgba(255,255,255,0.9)'))).join('');
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
  g.innerHTML = hat.draw(k, small, o);
  head.append(g);

  const undo = [], riders = []; // riders: what rides on the hat, which moves with its reactions
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
    riders.push([wrap, wrap.getAttribute('transform')]);
    undo.push(() => { parent.insertBefore(el, before); wrap.remove(); });
  }

  // still frames: everything that moves stays at rest (the propeller's blades flat, the pompom hanging)
  if (small) return { animate() {}, react() {}, remove() { undo.reverse().forEach(f => f()); g.remove(); } };
  const moving = [...g.querySelectorAll('[data-hat-anim]')].map(el => ({ el, kind: el.dataset.hatAnim, px: +el.dataset.px, py: +el.dataset.py }));
  // with reduced motion nothing moves, and a twinkle rests as a small still sparkle instead of a full-size star
  if (REDUCED) for (const { el, kind, px, py } of moving) {
    if (kind === 'twinkle') el.setAttribute('transform', `translate(${px} ${py}) scale(0.6) translate(${-px} ${-py})`);
  }
  const rest = g.getAttribute('transform');
  // a reaction is in the hat's own units: what rides on it goes into those units, moves, and comes back
  const unhat = `scale(${n2(1 / s)}) rotate(${n2(-rot * 180 / Math.PI)}) translate(${n2(-fit.x)} ${n2(-fit.y)})`;
  let kick = null; // the last trick (or try-on), which the hat reacts to as it fades
  return {
    /**
     * Pompoms and tips lag behind the head, propellers spin, halos bob; after react(), the hat's
     * own reaction plays on top and fades out.
     */
    animate(t, p = {}) {
      if (REDUCED) return; // pompoms hang still, propellers rest, halos stay put
      const a = kick ? t - kick.t0 : Infinity, k = kick?.kind;
      if (a > 2) kick = null;
      const fade = Math.exp(-3 * Math.max(0, a)); // how much of the kick is left
      const hr = (p.head?.r ?? 0) * 180 / Math.PI;
      for (const { el, kind, px, py } of moving) {
        let tr = '';
        if (kind === 'wobble') tr = `rotate(${n2(-hr * 2.6 + 4 * Math.sin(t * 8.5) + (kick ? 26 * fade * Math.sin(a * 13) : 0))} ${px} ${py})`;
        else if (kind === 'spin') tr = `translate(${px} ${py}) scale(${n2(Math.cos(t * (kick && a < 1.4 ? 44 : 22)))} 1) translate(${-px} ${-py})`;
        else if (kind === 'bob') {
          // the halo turns once on its axis
          const turn = kick && a < 0.8 ? Math.cos(Math.PI * 2 * a / 0.8) : 1;
          tr = `translate(0 ${n2(-1.4 + 1.4 * Math.sin(t * 3))}) translate(${px} ${py}) scale(${n2(turn)} 1) translate(${-px} ${-py})`;
        } else if (kind === 'twinkle') {
          // a trick bursts the crown's star: bigger, and at once
          const burst = kick && a < 0.7;
          const u = burst ? a / 0.7 : (t % 2.2) / 2.2, s = burst ? 1.5 * Math.sin(u * Math.PI) : u < 0.3 ? Math.sin(u / 0.3 * Math.PI) : 0;
          tr = `translate(${px} ${py}) scale(${n2(s)}) rotate(${n2(u * 120)}) translate(${-px} ${-py})`;
        } else if (kind === 'flicker') {
          // the candle flares, puffs out and lights again
          let s = 1 + 0.08 * Math.sin(t * 17), sy = 1 + 0.16 * Math.sin(t * 11 + 1);
          if (kick && a < 0.25) { s *= 1 + 2 * a; sy *= 1 + 3 * a; }
          else if (kick && a < 0.7) s = sy = 0;
          else if (kick && a < 0.95) { s *= (a - 0.7) / 0.25; sy *= (a - 0.7) / 0.25; }
          tr = `translate(${px} ${py}) scale(${n2(s)} ${n2(sy)}) translate(${-px} ${-py})`;
        } else if (kind === 'steam') {
          const u = (t * (kick && a < 1 ? 1.1 : 0.55) + px * 0.13) % 1;
          tr = `translate(0 ${n2(-5 * u)})`;
          el.setAttribute('opacity', n2(Math.sin(u * Math.PI)));
        } else if (kind === 'pop') {
          // the top hat's heart, only on a flip
          const u = k === 'flip' && a > 0.3 ? (a - 0.3) / 0.9 : 1;
          el.setAttribute('opacity', n2(u < 1 ? Math.min(1, 4 * u) * (1 - u * u) : 0));
          if (u < 1) tr = `translate(0 ${n2(-12 * Math.sqrt(u))}) translate(${px} ${py}) scale(${n2(Math.min(1, 3 * u))}) translate(${-px} ${-py})`;
        }
        el.setAttribute('transform', tr);
      }
      const move = kick ? reaction(k === 'drop' ? 'drop' : hat.react, k, a) : '';
      g.setAttribute('transform', rest + ' ' + move);
      for (const [wrap, own] of riders) wrap.setAttribute('transform', move ? `${rest} ${move} ${unhat} ${own}` : own);
    },
    /** A trick ('hop', 'flip', 'wheelie') or a try-on ('drop'): the hat reacts in the next frames. */
    react(kind) { if (!REDUCED) kick = { kind, t0: performance.now() / 1000 }; },
    // everything moved goes back first, as a part may have sat just before the hat
    remove() { undo.reverse().forEach(f => f()); g.remove(); },
  };
}

/**
 * How the whole hat moves `a` seconds into a reaction, as an SVG transform in hat units (about
 * the middle of the hat, so it squashes and turns in place). `trick` is what set it off.
 */
function reaction(type, trick, a) {
  const at = (tr) => `translate(0 -8) ${tr} translate(0 8)`;
  const settle = Math.exp(-4 * a);
  switch (type) {
    case 'drop': { // tried on: it falls onto the head, bumps and squashes, and settles
      if (a < 0.26) return `translate(0 ${n2(-34 * (1 - (a / 0.26) ** 2))})`;
      const b = a - 0.26, s = 0.16 * Math.exp(-7 * b) * Math.cos(b * 22);
      return at(`scale(${n2(1 + s)} ${n2(1 - s)})`);
    }
    case 'squash': { const s = 0.2 * settle * Math.sin(a * 16); return at(`scale(${n2(1 + s)} ${n2(1 - s)})`); }
    case 'wiggle': return at(`rotate(${n2(10 * settle * Math.sin(a * 24))})`);
    case 'slide': // the beret slides to a jauntier angle on a flip, and back
      if (trick !== 'flip') return at(`rotate(${n2(6 * settle * Math.sin(a * 20))})`);
      return at(`rotate(${n2(16 * Math.min(1, a / 0.2) * Math.max(0, Math.min(1, (1.6 - a) / 0.6)))})`);
    case 'lift': { // on a flip it lifts off the head and drops back; a smaller bump otherwise
      const h = trick === 'flip' ? 9 : 4, d = trick === 'flip' ? 0.8 : 0.4;
      return a < d ? `translate(0 ${n2(-h * Math.sin(Math.PI * a / d))})` : '';
    }
    case 'twirl': { // the witch hat floats up, spins once and lands
      if (a > 0.9) return '';
      const u = a / 0.9;
      return `translate(0 ${n2(-10 * Math.sin(Math.PI * u))}) ${at(`scale(${n2(Math.cos(Math.PI * 2 * u))} 1)`)}`;
    }
    case 'hop': return a < 0.5 ? `translate(0 ${n2(-4 * Math.abs(Math.sin(a * 2 * Math.PI / 0.25)) * (1 - a / 0.5))})` : '';
    default: return '';
  }
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

/**
 * Animal `id` in hat `hatId` ('nohat' for none), standing still, as a canvas: the whole rider
 * `w` CSS pixels wide (the shop's rider cards), or with `close` a head close-up `w` square (the hat
 * cards). Drawn once through an image, so a grid of them costs no more than pictures.
 */
const snaps = new Map();
export function snapshot(id, hatId, w, close = false) {
  const key = `${id}:${hatId}:${w}:${close}`;
  if (!snaps.has(key)) {
    const r = renderSVG(id, { style: 'rich', shadow: false });
    r.pose(poseAt(id, 1.8));
    if (hatId !== 'nohat' && HATS[hatId]) wearHat(r, id, hatId, { lod: 'full' });
    const svg = r.svg;
    // a close-up is framed on the crown, so the hat fills it; a whole rider has room for a tall hat
    const f = FIT[id];
    const [vx, vy, vw, vh] = close ? [f.x - 30, f.y - 31, 60, 60] : [-6, -16, 112, 160];
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    svg.setAttribute('width', Math.round(w * 2));
    svg.setAttribute('height', Math.round((w * vh / vw) * 2));
    svg.removeAttribute('class');
    snaps.set(key, rasterise(svg, w, (w * vh) / vw).catch(e => { snaps.delete(key); throw e; }));
  }
  return snaps.get(key);
}
