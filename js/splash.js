// The opening animation (markup in index.html, motion in style.css). It already plays and fades
// by itself; this adds the rider (whoever she picked in the shop) and her house, tap-to-skip, and
// a replay when she comes back to the game after a while (iOS usually resumes a Home Screen app
// instead of starting it again).

import * as Art from './art.js';
import { isChinese } from './i18n.js';
import { iconEl, rich } from './icons.js';
import { riderFrame } from './riders.js';
import { shop } from './shop.js';

const el = document.getElementById('splash');
const AWAY = 10 * 60e3; // back after this long counts as opening the game again

let onReveal = () => {};
let revealed = false;
let hiddenAt = 0;

function paintArt() {
  const sw = Math.min(innerWidth, innerHeight * 0.62);
  const put = (selector, canvas) => {
    canvas.style.width = `${canvas.w}px`;
    canvas.style.height = `${canvas.h}px`;
    el.querySelector(selector).replaceChildren(canvas);
  };
  put('.sp-bob', riderFrame(shop.rider, sw * 0.24));
  put('.sp-home', Art.house(sw * 0.2));
  el.querySelector('.sp-sub').replaceChildren(rich(isChinese() ? '送给你 {hearts}' : 'made for you {hearts}'));
}

function play() {
  revealed = false;
  el.classList.remove('play', 'skip');
  void el.offsetWidth; // restart every CSS animation from the top
  el.classList.add('play');
}

function reveal() {
  if (revealed) return;
  revealed = true;
  onReveal();
}

el.addEventListener('animationstart', e => { if (e.target === el) reveal(); });
el.addEventListener('animationend', e => {
  if (e.target !== el) return;
  el.classList.remove('play', 'skip');
});
el.addEventListener('pointerdown', () => {
  if (!el.classList.contains('play') || el.classList.contains('skip')) return;
  el.classList.add('skip');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > AWAY) {
    paintArt();
    play();
  }
});

// the two heart tiles that match, the sparks and little hearts they burst into, and the pair
// of hearts that floats up
for (const t of el.querySelectorAll('.sp-pair .sp-t')) t.replaceChildren(iconEl('heart'));
el.querySelectorAll('.sp-burst i').forEach((i, k) => i.replaceChildren(iconEl(k % 2 ? 'heart' : 'spark')));
el.querySelector('.sp-heart').replaceChildren(iconEl('hearts'));
paintArt();

// An update reload right after opening would otherwise play the whole scene a second time.
const SKIP = 'tm-skip-splash';
try {
  if (sessionStorage.getItem(SKIP)) {
    sessionStorage.removeItem(SKIP);
    el.classList.add('skip');
  }
} catch {}

/** The next page load (an update reload) lifts the splash straight away. */
export function skipNextLoad() {
  try { sessionStorage.setItem(SKIP, '1'); } catch {}
}

/** Runs `fn` each time the splash starts to fade and uncovers the game. */
export function whenRevealed(fn) {
  onReveal = fn;
  if (revealed || !el.classList.contains('play')) fn();
}

export const showing = () => el.classList.contains('play');
