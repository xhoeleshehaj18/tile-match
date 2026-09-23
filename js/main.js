// Never run inside someone else's page (e.g. a site framing the game to trick taps).
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  throw new Error('framed');
}

// First: puts back progress Safari may have cleared, before anything reads it (see backup.js).
import './backup.js';
import * as splash from './splash.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { sound } from './sound.js';
import * as report from './report.js';

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

// A report she sent with no connection waits on the phone; try again now and on every return.
report.flush();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') report.flush();
});
addEventListener('online', () => report.flush());

// The board deals in as the opening animation fades, so she sees it land. A game saved in a
// browser tab can be cleared by Safari (or WeChat): suggest the Home Screen once the deal is done.
let firstReveal = true;
splash.whenRevealed(() => {
  game.dealIn();
  if (firstReveal) {
    firstReveal = false;
    setTimeout(() => ui.maybeNudgeKeepSafe(), 2000);
  }
});

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

// Updates: check for a new version whenever the game is opened or brought back to the front.
// iOS often keeps a Home Screen app suspended instead of restarting it, so "close and reopen"
// alone isn't enough. A new version is applied right after opening, or the next time the game
// comes back to the front, never in the middle of play (progress is saved after every move).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let shownAt = performance.now();
  let updateReady = false;
  const hadController = !!navigator.serviceWorker.controller;
  const check = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(check).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install: this page is already the newest
    if (performance.now() - shownAt < 20000) { splash.skipNextLoad(); location.reload(); }
    else updateReady = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (updateReady) { splash.skipNextLoad(); location.reload(); return; }
    shownAt = performance.now();
    check();
  });
}

// Debug helpers for testing: ?autoplay (&slides), ?stuck, ?endgame, ?nopowerups, ?nudge
// (local test server only; they do nothing on the published site)
const local = location.hostname === 'localhost';
const params = local ? new URLSearchParams(location.search) : new URLSearchParams();
if (params.has('fps')) game.perf = { frames: 0, slow: 0, ours: 0, lastWork: 0, maxWork: 0, sumWork: 0, budget: 1 / 60 };
if (params.has('nudge')) setTimeout(() => ui.maybeNudgeKeepSafe(true), 3000);
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
if (local) { window.__game = game; window.__sound = sound; }

