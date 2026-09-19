// Never run inside someone else's page (e.g. a site framing the game to trick taps).
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  throw new Error('framed');
}

import { Game } from './game.js';
import { UI } from './ui.js';
import { sound } from './sound.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const probe = document.getElementById('safe-probe');
const fullHeight = document.getElementById('lvh-probe');
// Home Screen web app: iOS reports a viewport one status bar shorter than the screen it draws on.
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
if (standalone) document.documentElement.classList.add('standalone');
const ui = new UI(document.getElementById('ui'));
const game = new Game(canvas, ui);
ui.game = game;

// iOS: stop pinch-zoom and the double-tap magnifier from ever kicking in.
for (const type of ['gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', e => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

let lastSize = '';
function fit() {
  const vw = window.innerWidth;
  const vh = standalone ? Math.max(window.innerHeight, fullHeight.offsetHeight) : window.innerHeight;
  if (vw < 100 || vh < 200) return; // not laid out yet
  // phones use the full screen; wide screens get a phone-shaped column in the middle
  const w = Math.round(Math.min(vw, vh * 0.62));
  const cs = getComputedStyle(probe);
  const safe = {
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
  };
  const key = `${w}x${vh}:${safe.top}:${safe.bottom}`;
  if (key === lastSize) return;
  lastSize = key;
  stage.style.width = `${w}px`;
  stage.style.height = `${vh}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${vh}px`;
  game.layout(w, vh, safe);
}

let pending = false;
const scheduleFit = () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; fit(); });
};
window.addEventListener('resize', scheduleFit);
window.addEventListener('orientationchange', scheduleFit);
fit();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  // A new version just took over right after opening: reload once so it's used straight away
  // (progress is saved after every move, so nothing is lost).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && performance.now() < 15000) location.reload();
  });
}

// Debug helpers for testing: ?autoplay (&slides), ?stuck, ?endgame, ?nopowerups
// (local test server only; they do nothing on the published site)
const local = location.hostname === 'localhost';
const params = local ? new URLSearchParams(location.search) : new URLSearchParams();
if (params.has('fps')) game.perf = { frames: 0, slow: 0, ours: 0, lastWork: 0, maxWork: 0, sumWork: 0, budget: 1 / 60 };
if (params.has('kinds')) setTimeout(() => game.debugAllKinds(), 1500);
if (params.has('stuck')) setTimeout(() => game.debugStuck(), 1500);
if (params.has('endgame')) setTimeout(() => game.debugEndgame(), 1500);
if (params.has('nopowerups')) setTimeout(() => { game.hints = 0; game.shuffles = 0; game.updateBadges(); }, 1200);
if (params.has('autoplay')) {
  setInterval(() => {
    if (ui.result) {
      if (ui.result.canRevive) ui.secondChance(); else ui.nextLevel();
    } else if (ui.breakKind) {
      ui.finishPhotoBreak(true);
    } else {
      game.autoplayStep(params.has('slides'));
    }
  }, params.has('fast') ? 350 : 900);
}
if (local) window.__game = game;

