// Renders an animal's scene graph as live SVG. Every group is three nested <g>s: the outer one places
// it and moves the pivot to the origin, the middle one (class "p-<name>") is the one that animates,
// and the inner one moves the pivot back. So a CSS animation, a GSAP tween or a JS pose can all
// rotate and squash the middle group around 0 0 and it pivots where the drawing wants.
//
// style: 'flat'  the game's look (flat colours, crescent shading)
//        'rich'  soft gradients, a soft shading terminator, airbrushed cheeks, a ground shadow

import { scene, INK, mix, samplePath } from './animals.js';

let uid = 0;
const r4 = v => Math.round(v * 1000) / 1000;
const hex = c => /^#[0-9a-f]{6}$/i.test(c);

export function renderSVG(id, { style = 'rich', size = 300, shadow = true, cls = '' } = {}) {
  const pre = `a${++uid}`;
  const defs = [];
  const grads = new Map();
  let clipN = 0;

  /** A top-lit gradient for a colour (rich style), cached per colour. */
  const paint = c => {
    if (style !== 'rich' || !hex(c)) return c;
    if (!grads.has(c)) {
      const gid = `${pre}g${grads.size}`;
      grads.set(c, gid);
      const top = mix(c, '#FFFFFF', 0.28), bot = mix(c, '#7A4A6A', 0.07);
      defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${c}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`);
    }
    return `url(#${grads.get(c)})`;
  };

  const dynAttr = n => (n.dyn ? ` data-dyn="${n.dyn}"` : '');

  function node(n) {
    switch (n.t) {
      case 'g': {
        const [bx, by, br] = n.base ?? [0, 0, 0];
        const [ox, oy] = n.o;
        const outer = `translate(${r4(bx + (n.base ? 0 : 0))} ${r4(by)}) rotate(${r4((br * 180) / Math.PI)}) translate(${r4(ox)} ${r4(oy)})`;
        return `<g transform="${outer}"><g class="p p-${n.name}" data-name="${n.name}"><g transform="translate(${r4(-ox)} ${r4(-oy)})">${n.c.map(node).join('')}</g></g></g>`;
      }
      case 'fill':
        return `<path d="${n.d}" fill="${n.f}"${dynAttr(n)}/>`;
      case 'shape':
        return `<path d="${n.d}" fill="${paint(n.f)}" stroke="${INK}" stroke-width="${n.lw}"${dynAttr(n)}/>`;
      case 'line':
        return `<path d="${n.d}" fill="none" stroke="${n.c}" stroke-width="${n.w}"${dynAttr(n)}/>`;
      case 'limb':
        return `<path d="${n.d}" fill="none" stroke="${INK}" stroke-width="${n.w + 3.6}"${dynAttr(n)}/><path d="${n.d}" fill="none" stroke="${n.c}" stroke-width="${n.w}"${dynAttr(n)}/>`;
      case 'blush': {
        if (style !== 'rich') return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}" fill="rgba(255,112,150,0.48)"/>`;
        return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx * 1.35}" ry="${n.ry * 1.45}" fill="url(#${pre}blush)"/>`;
      }
      case 'cloud': {
        const lw = 2.4;
        const o = n.puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + lw / 2}" fill="${INK}"/>`).join('');
        const f = n.puffs.map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r - lw / 2}" fill="${paint(c)}"/>`).join('');
        const gl = n.puffs.map(([x, y, r]) => {
          const rr = r - 3.2, a0 = -2.5, a1 = -1.7;
          return `<path d="M${r4(x + rr * Math.cos(a0))} ${r4(y + rr * Math.sin(a0))}A${rr} ${rr} 0 0 1 ${r4(x + rr * Math.cos(a1))} ${r4(y + rr * Math.sin(a1))}" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.7"/>`;
        }).join('');
        return o + f + gl;
      }
      case 'solid': {
        const cid = `${pre}c${clipN++}`;
        defs.push(`<clipPath id="${cid}"><path d="${n.d}"${dynAttr(n)}/></clipPath>`);
        const [dx, dy] = n.dir;
        const lit = n.sh
          ? `<path d="${n.d}" fill="${paint(n.f)}" transform="translate(${-dx} ${-dy})"${style === 'rich' ? ` filter="url(#${pre}soft)"` : ''}${dynAttr(n)}/>`
          : '';
        return `<path d="${n.d}" fill="${n.sh ? n.sh : paint(n.f)}"${dynAttr(n)}/>`
          + `<g clip-path="url(#${cid})">${lit}${n.inside.map(node).join('')}${style === 'rich' ? `<path d="${n.d}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.6" transform="translate(${-dx * 0.35} ${-dy * 0.35})"${dynAttr(n)}/>` : ''}</g>`
          + `<path d="${n.d}" fill="none" stroke="${INK}" stroke-width="${n.lw}"${dynAttr(n)}/>`;
      }
    }
    return '';
  }

  const root = scene(id);
  const body = node(root);
  defs.push(`<filter id="${pre}soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.9"/></filter>`);
  defs.push(`<radialGradient id="${pre}blush"><stop offset="0" stop-color="#FF6F96" stop-opacity="0.62"/><stop offset="0.55" stop-color="#FF7FA0" stop-opacity="0.35"/><stop offset="1" stop-color="#FF8FB0" stop-opacity="0"/></radialGradient>`);
  defs.push(`<radialGradient id="${pre}shadow"><stop offset="0" stop-color="#3A2440" stop-opacity="0.28"/><stop offset="1" stop-color="#3A2440" stop-opacity="0"/></radialGradient>`);
  const ground = shadow ? `<ellipse class="ground-shadow" cx="49" cy="138.6" rx="44" ry="4.2" fill="url(#${pre}shadow)"/>` : '';

  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="animal ${cls}" viewBox="0 0 100 144" width="${size}" height="${(size * 144) / 100}" overflow="visible"
    stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><defs>${defs.join('')}</defs>${ground}${body}</svg>`;
  const svg = wrap.firstElementChild;

  const groups = [...svg.querySelectorAll('g.p')].map(el => ({ el, name: el.dataset.name }));
  const dyns = [...svg.querySelectorAll('[data-dyn]')];

  /** Applies a pose from poseAt() (for the JS-driven pages). */
  function pose(p) {
    for (const { el, name } of groups) {
      const q = p[name];
      if (!q) { el.removeAttribute('transform'); el.style.opacity = ''; continue; }
      el.setAttribute('transform', `translate(${r4(q.x ?? 0)} ${r4(q.y ?? 0)}) rotate(${r4(((q.r ?? 0) * 180) / Math.PI)}) scale(${r4(q.sx ?? 1)} ${r4(q.sy ?? 1)})`);
      el.style.opacity = q.a ?? '';
    }
    if (p.d) for (const el of dyns) { const d = p.d[el.dataset.dyn]; if (d) el.setAttribute('d', d); }
  }

  /** Every animating group by name, for GSAP. */
  const parts = name => groups.filter(g => g.name === name).map(g => g.el);
  return { svg, pose, parts, dyns };
}

// the points of a path, re-exported for pages that sample shapes (particles along an outline)
export { samplePath };
