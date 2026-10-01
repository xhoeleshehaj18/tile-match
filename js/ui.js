// The menu (play, shop, album, settings), result screens and photo breaks: HTML overlays on top
// of the game canvas (ported from the SwiftUI panels). Only opacity/transform are animated, so
// they stay on the GPU.

import { L, isChinese, setChinese } from './i18n.js';
import { sound } from './sound.js';
import { photos } from './photos.js';
import { VERSION } from './version.js';
import * as report from './report.js';
import { puzzle, loadPhoto, jigsawFor, bitCount, PIECES } from './puzzle.js';
import { pieceScene, framedBoard, FRAME, LIP } from './puzzlefx.js';
import { store } from './store.js';
import { Daily } from './store.js';
import { todayKey, dailyRules } from './levels.js';
import { shop, RIDER_ITEMS, HAT_ITEMS, TRAIL_ITEMS, TRY_ON, COINS_PER_LEVEL } from './shop.js';
import { wearHat, snapshot } from './hats.js';
import { noteText, noteNow, notesLoaded } from './notes.js';
import { riderFrame, riderFrames, frameAt, Trail, trailSprites } from './riders.js';
import { ShopRider, isAnimal } from './shoprider.js';
import { renderSVG } from './svgrider.js';
import { poseAt } from './animals.js';
import { iconEl, rich, splitIcon, uiScale } from './icons.js';

const SHOP_ITEMS = { rider: RIDER_ITEMS, hat: HAT_ITEMS, trail: TRAIL_ITEMS };
const KINDS = Object.keys(SHOP_ITEMS);

/** A small pink "new" dot, with the word for VoiceOver. */
function newDot() {
  const d = h('span', 'new-dot');
  d.append(h('span', 'sr-only', L.newItem()));
  return d;
}

/** Sets an element's text; `{name}` in it becomes that drawn icon (see icons.js). */
const setText = (el, text) => {
  if (text.includes('{')) el.replaceChildren(rich(text));
  else el.textContent = text;
};

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) setText(el, text);
  return el;
};

/** A drawn icon on its own, big, at the top of a card (in place of an emoji). */
function bigIcon(...names) {
  const el = h('div', 'big-icon');
  el.append(...names.map((n, i) => iconEl(n, i ? 'ic extra' : 'ic')));
  return el;
}

/** A phone on its side: style.css covers the game and asks her to turn it back, so it waits. */
const sideways = matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)');

/** Playing from a Home Screen icon, where Safari never clears the saved game. */
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const inWeChat = () => /MicroMessenger/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** The big sticker buttons: 'pink' for the main thing to do, 'cream' for the other way out. */
function button(label, onClick, variant = 'pink') {
  const b = h('button', `chunky ${variant}`, label);
  b.addEventListener('click', () => { sound.unlock(); sound.play('tap'); onClick(); });
  return b;
}

function rowLabel(icon, text) {
  const el = h('span', 'row-label');
  el.append(iconEl(icon, 'ic row-icon'), h('span', '', text));
  return el;
}

function toggle(icon, label, on, onChange) {
  const row = h('label', 'row');
  row.append(rowLabel(icon, label));
  const input = h('input', 'switch');
  input.type = 'checkbox';
  input.checked = on;
  input.addEventListener('change', () => { onChange(input.checked); sound.play('tap'); });
  row.append(input);
  return row;
}

/**
 * Sound on/off and volume in one row: the speaker mutes, the slider sets the level (and turns the
 * sound back on). Dragging plays a tap at the new level so she can hear what she is choosing.
 */
function volumeRow() {
  const row = h('div', 'row volume');
  const mute = h('button', 'mute');
  const input = h('input', 'slider');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(sound.volume * 100));
  input.setAttribute('aria-label', L.volume());
  const paint = () => {
    const on = sound.enabled && sound.volume > 0;
    mute.replaceChildren(iconEl(on ? 'sound' : 'mute'));
    mute.setAttribute('aria-label', L.sound());
    mute.setAttribute('aria-pressed', String(on));
    row.classList.toggle('off', !on);
    input.style.setProperty('--fill', `${input.value}%`);
  };
  paint();
  mute.addEventListener('click', () => {
    sound.unlock();
    sound.setEnabled(!sound.enabled);
    if (sound.enabled && sound.volume <= 0) { sound.setVolume(0.5); input.value = '50'; }
    paint();
    sound.play('tap');
  });
  let lastHeard = -1;
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    sound.setVolume(v);
    if (v > 0 && !sound.enabled) sound.setEnabled(true);
    paint();
    // one preview per step, so sliding doesn't fire a burst of overlapping taps
    if (v > 0 && input.value !== lastHeard) { lastHeard = input.value; sound.play('tap'); }
  });
  row.append(mute, input);
  return row;
}

function segmented(options, value, onChange) {
  const seg = h('div', 'segmented');
  for (const [val, text] of options) {
    const b = h('button', val === value ? 'on' : '', text);
    b.addEventListener('click', () => {
      if (b.classList.contains('on')) return;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      sound.play('tap');
      onChange(val);
    });
    seg.append(b);
  }
  return seg;
}

/** A small icon button with a caption, for the footer row. */
function tool(icon, label, onClick) {
  const b = h('button', 'tool');
  b.append(iconEl(icon, 'ic tool-icon'), h('span', 'tool-label', label));
  b.addEventListener('click', () => { sound.play('tap'); onClick(); });
  return b;
}

/** A secondary, quiet action ("Not now", "Cancel"): a plain button under the big one. */
function quietButton(label, onClick) {
  const b = h('button', 'update-btn', label);
  b.addEventListener('click', () => { sound.play('tap'); onClick(); });
  return b;
}

/** A reward chip: the amount and its icon. */
function prizeChip(cls, amount, icon) {
  const chip = h('span', `prize ${cls}`.trim());
  if (amount) chip.append(h('span', '', amount));
  chip.append(iconEl(icon));
  return chip;
}

/** A coin and an amount. `chip.set(n)` changes the amount. */
/** Coins as she'd write them: 1314, not 1,314 (the number is the point); grouped from 10,000. */
const coins = n => (n < 10000 ? String(n) : n.toLocaleString());

function coinChip(n, cls = '') {
  const chip = h('span', `coin-chip ${cls}`.trim());
  const num = h('b', '', coins(n));
  chip.append(iconEl('coin', 'ic coin'), num);
  chip.value = n;
  chip.set = v => { chip.value = v; num.textContent = coins(Math.round(v)); };
  return chip;
}

/** Runs a chip's number from where it is to `to`, easing out, starting after `delay` seconds. */
function countTo(chip, to, dur = 0.6, delay = 0) {
  const from = chip.value;
  if (from === to) return;
  const t0 = performance.now() + delay * 1000;
  const step = () => {
    const a = Math.min(1, Math.max(0, (performance.now() - t0) / (dur * 1000)));
    chip.set(from + (to - from) * (1 - Math.pow(1 - a, 3)));
    if (a < 1 && chip.isConnected) requestAnimationFrame(step);
    else chip.set(to);
  };
  requestAnimationFrame(step);
}

/** What a board paid, and why: the coin chip counting up, and the reasons in one quiet line. */
function coinReward(coins) {
  const chip = coinChip(0, 'prize coins');
  countTo(chip, coins.total, 0.8, 0.85);
  const why = h('p', 'note coin-lines', coins.lines.map(([k, n]) => `${L.coinReason(k)} +${n}`).join('  ·  '));
  return [chip, why];
}

const TWIST_ICONS = { gravity: 'arrowDown', sweet: 'candy' };

/**
 * The photo puzzle as a little board: the pieces in `mask` in place on their tray, the rest
 * waiting as outlines. `card.paint(mask, whole)` redraws it, e.g. once new pieces have flown in;
 * `card.ready` resolves once the photo is loaded and cut.
 */
function puzzleCard(photoId, mask, maxW, maxH) {
  const u = uiScale();
  maxW *= u;
  maxH *= u;
  const card = h('div', 'jig-card');
  const canvas = h('canvas');
  card.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const room = 1 + 2 * FRAME; // the tray around the photo (and under it, its lip)
  // until the photo is in, hold the space a phone photo would take
  const guess = Math.min(maxW / 3, maxH / 4);
  canvas.style.width = `${guess * 3}px`;
  canvas.style.height = `${guess * 4}px`;
  let jig = null, want = [mask, false];
  card.paint = (m, whole = false) => {
    want = [m, whole];
    if (!jig) return;
    const f = jig.fit((maxW / room) * dpr, (maxH / (room + FRAME * LIP)) * dpr);
    const art = framedBoard(jig, Math.round(f.w), Math.round(f.h), m, whole).canvas;
    canvas.width = art.width;
    canvas.height = art.height;
    canvas.getContext('2d').drawImage(art, 0, 0);
    canvas.style.width = `${art.width / dpr}px`;
    canvas.style.height = `${art.height / dpr}px`;
  };
  card.ready = jigsawFor(photoId).then(j => { jig = j; card.paint(...want); });
  card.canvas = canvas;
  return card;
}

/** A small canvas at device resolution, for the shop's thumbnails. */
function surfaceFor(w, hgt) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(hgt * dpr);
  c.w = w;
  c.h = hgt;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return [c, ctx];
}

function starRow(n, animated = true) {
  const row = h('div', 'stars');
  for (let i = 0; i < 3; i++) {
    const st = h('span', i < n ? 'star on' : 'star');
    st.append(iconEl(i < n ? 'star' : 'starOff'));
    if (animated && i < n) st.style.animationDelay = `${0.15 + i * 0.22}s`;
    row.append(st);
  }
  return row;
}

/** Makes sure the newest files are stored on the phone (installing a new build if there is one). */
async function forceUpdate() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  await reg.update();
  const incoming = reg.installing || reg.waiting;
  if (incoming) {
    // a new build is installing: wait until it has taken over
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 30000);
      const done = () => { clearTimeout(timer); resolve(); };
      if (incoming.state === 'activated') return done();
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'activated') done();
        if (incoming.state === 'redundant') { clearTimeout(timer); reject(new Error('install failed')); }
      });
    });
    return;
  }
  // same build: re-download its files anyway, in case anything was cached stale
  const worker = reg.active;
  if (!worker) return;
  await new Promise((resolve, reject) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('timeout')), 30000);
    ch.port1.onmessage = e => { clearTimeout(timer); e.data === 'ok' ? resolve() : reject(new Error(e.data)); };
    worker.postMessage('refresh', [ch.port2]);
  });
}

export class UI {
  constructor(root) {
    this.game = null;
    this.result = null;
    this.revivePending = null;
    this.breakKind = null;
    this.layers = {};
    for (const name of ['menu', 'result', 'photo', 'report', 'keepSafe', 'intro', 'daily', 'welcome', 'gift']) {
      const layer = h('div', `overlay ${name}`);
      layer.setAttribute('aria-hidden', 'true');
      root.append(layer);
      this.layers[name] = layer;
    }
    // Coins that arrive while the menu is open (the shop's gift, say) count up in its header;
    // spending is animated by the purchase itself.
    shop.onChange(() => {
      if (this.menu && shop.coins > this.menu.coins.value) countTo(this.menu.coins, shop.coins, 0.5);
    });
    // her dates and his notes arrive a moment after opening: a birthday gift or a note may now be due
    notesLoaded.then(() => {
      this.game?.refreshShop();
      if (this.giftsStarted && shop.giftWaiting) this.maybeShowShopGift();
    });
  }

  get anyOpen() { return sideways.matches || pieceScene.active || Object.values(this.layers).some(l => l.classList.contains('show')); }

  show(name) {
    const el = this.layers[name];
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  hide(name) {
    const el = this.layers[name];
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
    if (name === 'menu') {
      this.stopPreview?.();
      this.stopPreview = null;
      this.menu?.viewer.classList.remove('show');
    }
    if (this.untrackKeyboard) this.untrackKeyboard();
  }

  /** With the keyboard up, iOS keeps the layout viewport full height, which would leave the
   *  panel centred behind the keys. Follow the part of the screen that's actually visible. */
  trackKeyboard(layer) {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      layer.style.top = `${vv.offsetTop}px`;
      layer.style.height = `${vv.height}px`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    this.untrackKeyboard = () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      layer.style.top = '';
      layer.style.height = '';
      this.untrackKeyboard = null;
    };
  }

  panel(title) {
    const scrim = h('div', 'scrim');
    const panel = h('div', 'panel');
    panel.append(h('h1', '', title));
    return [scrim, panel];
  }

  // ---------------------------------------------------------------- the menu

  /**
   * Everything that isn't the board, in one panel with four tabs along the bottom: Play (continue,
   * which mode), Shop, Album and Settings (only real settings). The pause button opens it on Play
   * and the shop button on Shop.
   */
  openMenu(tab = 'play', select = null) {
    const layer = this.layers.menu;
    if (!layer.classList.contains('show') || !this.menu) {
      layer.replaceChildren();
      const scrim = h('div', 'scrim');
      scrim.addEventListener('click', () => this.hide('menu'));
      const panel = h('div', 'panel menu-panel');
      const head = h('div', 'menu-head');
      const title = h('h1', '');
      const coins = coinChip(shop.coins);
      const close = h('button', 'menu-close');
      close.append(iconEl('x'));
      close.setAttribute('aria-label', L.close());
      close.addEventListener('click', () => { sound.play('tap'); this.hide('menu'); });
      head.append(title, coins, close);
      const body = h('div', 'menu-body');
      const bar = h('nav', 'tabbar');
      const tabs = {};
      for (const key of ['play', 'shop', 'album', 'settings']) {
        const b = h('button', 'tab');
        b.append(iconEl({ play: 'gamepad', shop: 'bag', album: 'puzzle', settings: 'gear' }[key], 'ic tab-icon'), h('span', 'tab-label', L.tab(key)));
        b.addEventListener('click', () => {
          if (this.menu.tab === key) return;
          sound.play('tap', { gain: 0.7 });
          this.menuTab(key);
        });
        bar.append(b);
        tabs[key] = b;
      }
      const viewer = h('div', 'viewer');
      viewer.addEventListener('click', () => {
        viewer.classList.remove('show');
        const img = viewer.querySelector('img');
        if (img) { URL.revokeObjectURL(img.src); img.remove(); }
      });
      panel.append(head, body, bar);
      layer.append(scrim, panel, viewer);
      this.menu = { tab: null, title, coins, body, tabs, viewer, panel };
    }
    this.menuTab(tab, select);
    this.show('menu');
  }

  menuTab(tab, select = null) {
    const m = this.menu;
    this.stopPreview?.();
    this.stopPreview = null;
    m.tab = tab;
    for (const [key, b] of Object.entries(m.tabs)) b.classList.toggle('on', key === tab);
    m.tabs.shop.querySelector('.new-dot')?.remove();
    if (tab !== 'shop' && (shop.hasNew || shop.giftWaiting)) m.tabs.shop.append(newDot());
    m.title.textContent = tab === 'play' ? L.paused() : L.tab(tab);
    m.coins.classList.toggle('hidden', tab !== 'shop' && tab !== 'play');
    m.panel.dataset.tab = tab;
    const body = h('div', `menu-page page-${tab}`);
    if (tab === 'play') this.playPage(body);
    if (tab === 'shop') this.shopPage(body, select);
    if (tab === 'album') this.albumPage(body);
    if (tab === 'settings') this.settingsPage(body);
    m.body.replaceChildren(body);
    m.body.scrollTop = 0;
  }

  /** Continue, and the four ways to play as cards. */
  playPage(page) {
    const game = this.game;
    page.append(button(L.resume(), () => this.hide('menu')));

    page.append(h('h2', 'section', L.mode()));
    const grid = h('div', 'modes');
    for (const mode of ['levels', 'daily', 'challenge', 'big']) {
      const card = h('button', mode === game.mode ? 'mode-card on' : 'mode-card');
      card.append(iconEl(L.modeIcon(mode), 'ic mode-icon'), h('span', 'mode-name', L.modeName(mode)), h('span', 'mode-hint', L.modeHint(mode)));
      if (mode === game.mode) card.append(iconEl('check', 'ic tick'));
      card.addEventListener('click', () => {
        sound.play('tap');
        if (mode === game.mode) { this.hide('menu'); return; }
        if (mode === 'daily') localStorage.setItem('daily.returnTo', game.mode);
        this.hide('menu');
        game.switchMode(mode);
      });
      grid.append(card);
    }
    page.append(grid);
  }

  /** Volume, vibration and language — and, quietly underneath, update / keep safe / report. */
  settingsPage(page) {
    const group = h('div', 'group');
    group.append(volumeRow());
    if (sound.canFeel) group.append(toggle('vibrate', L.vibration(), sound.haptics, on => sound.setHaptics(on)));
    const lang = h('div', 'row');
    lang.append(rowLabel('globe', L.language()), segmented([[false, 'EN'], [true, '中文']], isChinese(), zh => {
      setChinese(zh);
      this.game.refreshLanguage();
      // everything in the panel is in the old language: rebuild it on the same tab
      this.menu = null;
      this.openMenu('settings');
    }));
    group.append(lang);
    page.append(group);

    const status = h('p', 'note status-line');
    const tools = h('div', 'tools');
    tools.append(this.updateTool(status));
    if (!standalone()) {
      tools.append(tool('phone', L.keepSafeShort(), () => { this.hide('menu'); this.openKeepSafe(); }));
    }
    tools.append(tool('bug', L.reportShort(), () => { this.hide('menu'); this.openReport(); }));
    page.append(tools);
    const waiting = report.pending();
    status.textContent = waiting ? L.reportWaiting(waiting) : L.version(VERSION);
    page.append(status);
  }

  /** "Check for updates": asks the server for the newest version, downloads it fresh and restarts. */
  updateTool(status) {
    const b = tool('refresh', L.updateShort(), async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.classList.add('busy');
      status.textContent = L.checking();
      try {
        const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
        const latest = (await res.json()).version;
        if (latest > VERSION) status.textContent = L.updating(latest);
        await forceUpdate();
        if (latest > VERSION) {
          location.reload();
          return;
        }
        status.textContent = L.upToDate(VERSION);
      } catch {
        status.textContent = L.updateFailed();
      }
      b.classList.remove('busy');
      b.disabled = false;
    });
    return b;
  }

  // ---------------------------------------------------------------- bug reports

  /** Her way to tell me something's wrong. The game attaches the details; she just types a line. */
  openReport() {
    const layer = this.layers.report;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.reportTitle());
    const close = () => this.hide('report');
    scrim.addEventListener('click', close);

    panel.append(h('p', 'note', L.reportHint()));

    const tags = new Set();
    const chips = h('div', 'chips');
    for (const [key, label] of [['froze', L.tagFroze()], ['slow', L.tagSlow()], ['sound', L.tagSound()],
      ['looks', L.tagLooks()], ['idea', L.tagIdea()]]) {
      const chip = h('button', 'chip', label);
      chip.addEventListener('click', () => {
        const on = !tags.has(key);
        on ? tags.add(key) : tags.delete(key);
        chip.classList.toggle('on', on);
        sound.play('tap', { gain: 0.6 });
      });
      chips.append(chip);
    }
    panel.append(chips);

    const box = h('textarea', 'report-text');
    box.placeholder = L.reportPlaceholder();
    box.maxLength = 600;
    box.rows = 4;
    box.autocapitalize = 'sentences';
    panel.append(box);

    const status = h('p', 'note status');
    const send = button(L.reportSend(), async () => {
      if (send.disabled) return;
      if (!box.value.trim() && !tags.size) { box.focus(); return; }
      send.disabled = true;
      send.textContent = L.reportSending();
      status.textContent = '';
      const outcome = await report.send(box.value, [...tags], this.game.diagnostics());
      if (outcome === 'sent') {
        this.reportDone(L.reportSent());
        return;
      }
      if (outcome === 'tooSoon') {
        setText(status, L.reportTooSoon());
        send.disabled = false;
        send.textContent = L.reportSend();
        return;
      }
      // no connection to the relay: it's saved on the phone, and she can paste it herself
      this.reportDone(L.reportQueued(), true);
    });
    panel.append(status, send);
    panel.append(quietButton(L.reportCancel(), close));

    layer.append(scrim, panel);
    this.show('report');
    this.trackKeyboard(layer);
    // let the panel finish growing before the keyboard slides up
    setTimeout(() => box.focus(), 350);
  }

  /** Replaces the form with a thank-you (and, when it couldn't be sent, a way to pass it on). */
  reportDone(message, offerShare = false) {
    const layer = this.layers.report;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.reportTitle());
    scrim.addEventListener('click', () => this.hide('report'));
    panel.replaceChildren(bigIcon(offerShare ? 'clipboard' : 'envelope'), h('p', 'sub', message));
    const share = offerShare && navigator.share;
    if (share) {
      panel.append(button(L.reportShare(), () => {
        navigator.share({ text: report.lastBody() }).catch(() => {});
      }));
    }
    panel.append(button(L.resume(), () => this.hide('report'), share ? 'cream' : 'pink'));
    layer.append(scrim, panel);
    this.show('report');
    if (!offerShare) setTimeout(() => this.hide('report'), 2600);
  }

  // ---------------------------------------------------------------- keeping progress safe

  /** How to move the game onto the Home Screen, where its saved progress is never cleared. */
  openKeepSafe() {
    const layer = this.layers.keepSafe;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.keepSafeTitle());
    const close = () => this.hide('keepSafe');
    scrim.addEventListener('click', close);
    const wechat = inWeChat();
    panel.append(bigIcon('phone'));
    panel.append(h('p', 'why', wechat ? L.keepSafeWeChatWhy() : L.keepSafeWhy()));
    const steps = h('ol', 'steps');
    const list = wechat ? L.keepSafeWeChatSteps() : isIOS() ? L.keepSafeSteps() : L.keepSafeOtherSteps();
    for (const step of list) {
      const li = h('li');
      li.append(h('span', '', step)); // one grid cell, so an icon stays on its line
      steps.append(li);
    }
    panel.append(steps);
    panel.append(button(L.gotIt(), close));
    layer.append(scrim, panel);
    this.show('keepSafe');
  }

  /**
   * Once on opening, and again every few days while she still plays in a browser tab: a tab's
   * saved game is the one Safari deletes. Never on a Home Screen icon, never over another panel.
   */
  maybeNudgeKeepSafe(force = false) {
    if (!force) {
      if (standalone() || !matchMedia('(pointer: coarse)').matches) return;
      let lastShown = 0;
      try { lastShown = Number(localStorage.getItem('keepSafeAt')) || 0; } catch {}
      if (Date.now() - lastShown < 3 * 24 * 3600e3) return;
    }
    if (this.anyOpen || this.breakKind || this.game.drag) {
      setTimeout(() => this.maybeNudgeKeepSafe(force), 10000);
      return;
    }
    try { localStorage.setItem('keepSafeAt', String(Date.now())); } catch {}
    report.note('keepSafe', inWeChat() ? 'wechat' : isIOS() ? 'ios' : 'other');
    this.openKeepSafe();
  }

  // ---------------------------------------------------------------- results

  showResult(r) {
    this.result = r;
    const layer = this.layers.result;
    layer.replaceChildren();
    let scrim, panel;

    if (r.level !== undefined) {
      [scrim, panel] = this.panel(r.daily ? L.dailyClear() : L.levelClear(r.level));
      panel.classList.add('result-panel');
      panel.append(starRow(r.stars));
      const goals = h('div', 'goals');
      const goal = (ok, text) => {
        const row = h('div', ok ? 'goal ok' : 'goal');
        row.append(ok ? iconEl('check', 'ic mark') : h('span', 'mark'), h('span', '', text));
        goals.append(row);
      };
      goal(true, L.goalClear());
      goal(r.comboOk, L.goalCombo(r.bestCombo, r.comboGoal));
      panel.append(goals);

      const prizes = h('div', 'prizes');
      const [coins, coinWhy] = coinReward(r.coins);
      prizes.append(coins);
      if (r.prize.chest) prizes.append(h('span', 'prize chest', L.chest()));
      prizes.append(prizeChip('', `+${r.prize.hints}`, 'bulb'));
      if (r.prize.shuffles) prizes.append(prizeChip('', `+${r.prize.shuffles}`, 'shuffle'));
      if (r.prize.pieces) prizes.append(prizeChip('piece', `+${r.prize.pieces}`, 'puzzle'));
      panel.append(prizes, coinWhy);
      if (r.daily) {
        panel.append(h('p', 'note daily-note', r.prize.pieces ? L.dailyStreak(r.streak) : L.dailyNoNewStars(r.best)));
      }
      this.appendPuzzle(panel, r.puzzle);
      if (r.daily) {
        panel.append(button(r.stars < 3 ? L.tryForMore() : L.playAgain(), () => this.nextLevel()));
        panel.append(button(L.backTo(this.dailyReturnMode()), () => {
          this.result = null;
          this.hide('result');
          this.game.switchMode(this.dailyReturnMode());
        }, 'cream slim'));
      } else {
        panel.append(button(L.nextLevel(), () => this.nextLevel()));
      }
    } else {
      [scrim, panel] = this.panel(r.won ? L.boardCleared() : L.outOfMoves());
      panel.append(r.won ? bigIcon('home', 'sparkle') : bigIcon('dizzy'));
      if (!r.won) panel.append(h('p', r.tilesLeft <= 20 ? 'sub close' : 'sub', L.tilesLeft(r.tilesLeft)));
      const score = h('div', 'score');
      score.append(h('span', 'label', L.score()), h('span', 'value', r.score.toLocaleString()));
      score.append(r.newBest ? h('span', 'new-best', L.newBest()) : h('span', 'best', L.bestScore(r.best.toLocaleString())));
      panel.append(score);
      const record = h('div', 'record');
      if (r.won && r.streak > 0) record.append(h('span', 'streak', L.streak(r.streak)));
      if (r.games > 0) record.append(h('span', 'games', L.record(r.wins, r.games)));
      panel.append(record);
      if (r.coins?.total) {
        const [coins, coinWhy] = coinReward(r.coins);
        const prizes = h('div', 'prizes');
        prizes.append(coins);
        panel.append(prizes, coinWhy);
      }
      if (r.won) this.appendPuzzle(panel, r.puzzle);
      if (r.canRevive) panel.append(button(L.secondChance(), () => this.secondChance()));
      panel.append(button(r.won ? L.playAgain() : L.tryAgain(), () => this.nextLevel(), r.canRevive ? 'cream' : 'pink'));
    }
    layer.append(scrim, panel);
    this.show('result');
  }

  nextLevel() {
    this.result = null;
    this.hide('result');
    this.game.nextLevel();
  }

  /**
   * The puzzle the new pieces went into, and a line on how far along it is. Once the stars have
   * landed the board lifts out of the card and the pieces fly in (see puzzlefx.js).
   */
  appendPuzzle(panel, p) {
    if (!p) return;
    const box = h('div', 'puzzle-box');
    const card = puzzleCard(p.photo, p.before, 210, 150);
    const line = h('p', 'puzzle-line', L.puzzleProgress(bitCount(p.before)));
    box.append(card, line);
    if (p.more) box.append(h('p', 'note', L.piecesToNext(p.more)));
    panel.append(box);
    const finish = () => {
      card.paint(p.after, p.completed);
      setText(line, p.completed ? L.photoUnlocked() : L.puzzleProgress(bitCount(p.after)));
      line.classList.add(p.completed ? 'done' : 'grew');
    };
    setTimeout(async () => {
      await card.ready;
      if (!box.isConnected || !this.layers.result.classList.contains('show')) { finish(); return; }
      const chip = panel.querySelector('.prize.piece');
      await pieceScene.play(p, { from: card.canvas, origin: chip ? chip.getBoundingClientRect() : null });
      finish();
    }, 950);
  }

  // ---------------------------------------------------------------- twists

  /** The card that introduces a new twist, the first time a level has it. */
  showIntro(twist) {
    if (this.anyOpen || this.breakKind || this.welcomeWaiting) { setTimeout(() => this.showIntro(twist), 1500); return; }
    const layer = this.layers.intro;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.twistTitle(twist));
    const close = () => this.hide('intro');
    scrim.addEventListener('click', close);
    panel.append(h('p', 'tag-new', L.newTwist()), bigIcon(TWIST_ICONS[twist] ?? 'sparkle'), h('p', 'why', L.twistText(twist)));
    panel.append(button(L.letsGo(), close));
    layer.append(scrim, panel);
    this.show('intro');
  }

  // ---------------------------------------------------------------- welcome back

  /**
   * A save from before the twists and the puzzle (past level 5) gets a welcome the first time:
   * what's new, and a whole photo for the levels already behind her. Returns the number of levels
   * cleared when it's owed, else 0; decided once, on the first run of this version.
   */
  welcomeOwed() {
    const state = localStorage.getItem('puzzle.welcome');
    if (state !== null) return 0;
    const best = Math.max(store.int('levels.level', 1), store.int('big.level', 1));
    // the welcome goes first: a twist's card holds back until the gift is opened
    if (best > 5) { this.welcomeWaiting = true; return best - 1; }
    store.set('puzzle.welcome', 'no');
    return 0;
  }

  showWelcome(cleared) {
    this.welcomeWaiting = true;
    if (this.anyOpen || this.breakKind) { setTimeout(() => this.showWelcome(cleared), 1500); return; }
    const layer = this.layers.welcome;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.welcomeTitle());
    panel.classList.add('welcome-panel');
    const gift = bigIcon('gift');
    gift.classList.add('gift-bob');
    panel.append(gift);
    panel.append(h('p', 'why', L.welcomeText()));
    panel.append(h('p', 'sub', L.welcomeGift(cleared)));
    const open = button(L.openGift(), async () => {
      const from = open.getBoundingClientRect();
      store.set('puzzle.welcome', 'given');
      this.hide('welcome');
      await photos.loaded;
      const p = puzzle.award(PIECES);
      await pieceScene.play(p, { origin: from });
      this.welcomeWaiting = false;
      this.game.checkAchievements();
    });
    panel.append(open);
    layer.append(scrim, panel);
    this.show('welcome');
  }

  // ---------------------------------------------------------------- daily board

  /** Where "Back" from the daily board goes: the mode she came from. */
  dailyReturnMode() {
    const m = localStorage.getItem('daily.returnTo');
    return m && m !== 'daily' ? m : 'levels';
  }

  openDaily() {
    const game = this.game;
    const layer = this.layers.daily;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.dailyTitle());
    const close = () => this.hide('daily');
    scrim.addEventListener('click', close);
    const today = todayKey();
    const rules = dailyRules(today);
    const best = Daily.best(today);
    const streak = Daily.streak;
    // the theme's own icon goes big, and comes out of the line under it
    const [themeIcon, themeText] = splitIcon(L.dailyTheme(rules.day));
    panel.append(bigIcon(themeIcon ?? TWIST_ICONS[rules.theme] ?? 'calendar'));
    panel.append(h('p', 'sub', themeText));
    panel.append(starRow(best, false));
    panel.append(h('p', 'why', best ? L.dailyBest(best) : L.dailyPitch()));
    if (streak > 0) panel.append(h('p', 'streak-line', L.dailyStreak(streak)));
    if (game.mode === 'daily') {
      panel.append(button(L.resume(), close));
      panel.append(button(L.backTo(this.dailyReturnMode()), () => { close(); game.switchMode(this.dailyReturnMode()); }, 'cream slim'));
    } else {
      panel.append(button(best >= 3 ? L.playAgain() : L.playDaily(), () => {
        close();
        localStorage.setItem('daily.returnTo', game.mode);
        game.switchMode('daily');
      }));
      panel.append(quietButton(L.notNow(), close));
    }
    layer.append(scrim, panel);
    this.show('daily');
  }

  // ---------------------------------------------------------------- shop

  /**
   * The shop: a little stage at the top where the chosen rider scoots along with its trail, what it
   * is and what it costs, and every rider (or hat, or trail) as a card to tap and try on. Nothing
   * changes until she buys or picks one; buying equips it straight away. Hats go on the animals: with
   * the girl riding, the stage shows the animal they'd go on (see shop.model).
   */
  shopPage(page, select) {
    let kind = select?.kind ?? this.shopKind ?? 'rider';
    let sel = select?.id ?? shop.current(kind);
    const seg = segmented([['rider', L.riders()], ['hat', L.hats()], ['trail', L.trails()]], kind, k => {
      kind = this.shopKind = k;
      sel = shop.current(k);
      paint();
    });
    seg.classList.add('wide');
    // what's new this visit: marked as it's looked at, so the dots and ribbons last for this visit
    const fresh = {};
    const look = k => {
      fresh[k] ??= new Set(shop.unseen(k));
      shop.markSeen(k);
      seg.querySelectorAll('button')[KINDS.indexOf(k)]?.querySelector('.new-dot')?.remove();
    };
    KINDS.forEach((k, i) => { if (shop.unseen(k).length) seg.querySelectorAll('button')[i].append(newDot()); });
    // the stage, with what's chosen and what to do about it on it, stays put while the cards scroll
    // under it: about 150px, so the grid starts above the fold even on a small phone
    const stage = h('div', 'shop-stage compact');
    const canvas = h('canvas');
    const ribbon = h('span', 'ribbon', L.legendary());
    const pop = h('span', 'stage-pop', L.yours());
    const info = h('div', 'stage-info');
    const name = h('h2', 'item-name');
    const text = h('p', 'item-text');
    const note = h('p', 'item-note');
    const action = h('div', 'item-action');
    const words = h('div', 'stage-words');
    words.append(name, text, note);
    info.append(words, action);
    stage.append(canvas, ribbon, pop, info);
    const top = h('div', 'shop-top');
    top.append(stage, seg);
    const grid = h('div', 'shop-grid');
    page.append(top, grid);
    const preview = this.startPreview(canvas, stage, 0.72);

    const paint = () => {
      look(kind);
      // the gift row: hers, ready to open, earned by playing, and the next one coming
      const items = SHOP_ITEMS[kind].filter(i => i.price != null || shop.giftShown(i));
      const item = items.find(i => i.id === sel) ?? items[0];
      if (kind === 'rider') preview.show(item.id, shop.trail, shop.hatOn(item.id));
      else if (kind === 'hat') preview.show(shop.model.id, shop.trail, item.id);
      else preview.show(shop.rider, item.id, shop.hat);
      stage.classList.toggle('legendary', !!item.legendary);
      name.textContent = L.itemName(kind, item.id);
      setText(text, L.itemText(kind, item.id));
      // a hat bought while the girl rides goes on an animal, or waits for one
      const model = shop.model;
      const away = kind === 'hat' && shop.rider === 'girl' && item.id !== 'nohat' && shop.owns('hat', item.id);
      note.hidden = !away;
      if (away) note.textContent = model.owned ? L.hatOnModel(model.id) : L.hatWaits();
      action.replaceChildren(this.itemButton(kind, item, bought => {
        if (bought) {
          sound.play('tap');
          sound.purchase();
          sound.ticks([[0, 0.8], [90, 0.5], [180, 0.9]]);
          preview.celebrate();
          pop.classList.remove('go');
          void pop.offsetWidth;
          pop.classList.add('go');
          countTo(this.menu.coins, shop.coins, 0.7);
          report.note(item.gift ? 'gift' : 'bought', `${kind}:${item.id} left ${shop.coins}`);
        } else {
          sound.play('tap');
          preview.hop();
        }
        paint();
      }));
      const pick = it => () => {
        if (sel === it.id) return;
        sel = it.id;
        sound.play('tap', { gain: 0.6 });
        paint();
        preview.hop(0.7);
        // trying on a hat: it drops onto the head
        if (kind === 'hat') preview.dropHat();
      };
      // for sale in price order, then the gifts in their own row; nothing moves after a purchase
      const cards = [];
      for (const it of items) {
        if (it.gift && !cards.gifts) { cards.gifts = true; cards.push(h('h3', 'grid-head', L.gifts())); }
        const card = this.itemCard(kind, it, it.id === item.id, pick(it));
        if (fresh[kind].has(it.id)) card.append(h('span', 'new-ribbon', L.newItem()));
        cards.push(card);
      }
      grid.replaceChildren(...cards);
    };
    paint();
  }

  /** The big button under the stage: in use, use it, buy it, open it, or how far away it still is. */
  itemButton(kind, item, done) {
    const current = shop.current(kind);
    if (item.id === current) {
      const b = h('button', 'chunky cream in-use', kind === 'hat' ? L.wearing() : L.inUse());
      b.disabled = true;
      return b;
    }
    if (shop.owns(kind, item.id)) {
      // a hat with only the try-on bunny to go on: it's hers, waiting for an animal
      if (kind === 'hat' && !shop.model.owned) {
        const b = h('button', 'chunky cream in-use', L.yours());
        b.disabled = true;
        return b;
      }
      return button(kind === 'hat' ? L.wearIt() : L.useThis(), () => { shop.equip(kind, item.id); done(false); }, 'cream');
    }
    // gifts have no price: checked first, as `coins >= null` would be true
    if (item.price == null) {
      if (shop.giftOpen(item)) return button(L.openHatGift(), () => { if (shop.claim(item)) done(true); });
      const b = h('button', 'chunky locked', item.earn ? L.earnHow(item.earn) : L.giftOn(L.giftDay(shop.giftDate(item))));
      b.disabled = true;
      return b;
    }
    if (shop.coins >= item.price) {
      const b = button('', () => { if (shop.buy(kind, item.id)) done(true); }, 'pink buy');
      b.append(h('span', '', L.buy()), coinChip(item.price, 'on-button'));
      return b;
    }
    const need = item.price - shop.coins;
    const b = h('button', 'chunky locked');
    b.disabled = true;
    b.append(coinChip(item.price, 'on-button'), h('span', 'need', L.needMore(need.toLocaleString(), Math.max(1, Math.ceil(need / COINS_PER_LEVEL)))));
    return b;
  }

  /** One rider, hat or trail in the grid: its picture, and its price, gift day or whether it's in use. */
  itemCard(kind, item, selected, onPick) {
    const current = shop.current(kind);
    const owned = shop.owns(kind, item.id);
    const gift = item.price == null, open = gift && shop.giftOpen(item);
    const cls = ['item-card'];
    if (selected) cls.push('sel');
    if (item.id === current) cls.push('equipped');
    if (!owned) cls.push(gift ? (open ? 'gift ready' : 'gift') : shop.coins >= item.price ? 'affordable' : 'locked');
    if (item.legendary) cls.push('legendary');
    if (item.legendary && kind === 'hat') cls.push('wide');
    const card = h('button', cls.join(' '));
    card.append(this.thumb(kind, item.id));
    if (item.legendary && kind === 'hat') card.append(h('span', 'card-name', L.itemName(kind, item.id)));
    let state;
    if (item.id === current) {
      card.append(iconEl('check', 'ic tick'));
      state = kind === 'hat' ? L.stateWearing() : L.stateInUse();
    } else if (owned) {
      state = L.stateOwned();
    } else if (item.earn) {
      card.append(h('span', 'card-price gift-chip', L.earnShort(item.earn)));
      state = L.earnHow(item.earn);
    } else if (gift) {
      const day = open ? '' : L.giftDay(shop.giftDate(item));
      card.append(h('span', 'card-price gift-chip', open ? L.openHatGift() : `{gift} ${day}`));
      state = open ? L.stateGift() : L.giftOn(day);
    } else {
      const chip = coinChip(item.price, 'card-price');
      // affordable shows in more than colour: the chip says "buy"
      if (shop.coins >= item.price) chip.append(h('span', 'buy-cue', L.buyShort()));
      card.append(chip);
      state = L.statePrice(coins(item.price));
    }
    card.setAttribute('aria-label', L.cardState(L.itemName(kind, item.id), state));
    card.addEventListener('click', onPick);
    return card;
  }

  /**
   * A card's picture, drawn once and kept: an animal in the hat it wears (or, on a hat card, the
   * model animal's head in that hat), the girl on her scooter, or a few bits of the trail. The
   * animals are drawn into images lazily, one at a time, as their cards scroll into view.
   */
  thumb(kind, id) {
    this.thumbs ??= new Map();
    const u = uiScale();
    const model = shop.model.id;
    const key = kind === 'hat' ? `hat:${id}:${u}:${model}` : kind === 'rider' ? `rider:${id}:${u}:${shop.hatOn(id)}` : `${kind}:${id}:${u}`;
    let c = this.thumbs.get(key);
    if (c) return c;
    if (kind === 'hat' || (kind === 'rider' && isAnimal(id))) {
      const hat = kind === 'hat';
      const w = hat ? 64 * u : 52 * u;
      c = h('span', 'hat-thumb');
      c.w = w;
      c.h = hat ? w : (w * 160) / 112;
      this.lazyThumb(c, () => snapshot(hat ? model : id, hat ? id : shop.hatOn(id), w, hat));
    } else if (kind === 'rider') {
      c = riderFrame(id, 64 * u);
    } else {
      const sprites = trailSprites(id, 1.05 * u);
      const [cv, ctx] = surfaceFor(64 * u, 64 * u);
      ctx.scale(u, u);
      if (sprites) {
        const spots = id === 'rainbow'
          ? [[10, 40], [18, 36], [26, 33], [34, 32], [42, 33], [50, 36], [56, 40]]
          : [[20, 40, -0.3, 0.85], [44, 26, 0.25, 1], [42, 50, 0.1, 0.7]];
        spots.forEach(([x, y, rot = 0, sc = 1], i) => {
          const img = sprites[i % sprites.length];
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.scale(sc / u, sc / u);
          ctx.drawImage(img, -img.w / 2, -img.h / 2, img.w, img.h);
          ctx.restore();
        });
      } else {
        ctx.strokeStyle = 'rgba(30,34,8,0.28)';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.setLineDash([7, 8]);
        ctx.beginPath();
        ctx.moveTo(12, 38);
        ctx.lineTo(54, 38);
        ctx.stroke();
      }
      c = cv;
    }
    c.classList.add('thumb-art');
    c.style.width = `${c.w}px`;
    c.style.height = `${c.h}px`;
    this.thumbs.set(key, c);
    return c;
  }

  /**
   * Fills placeholder `el` with the canvas `make()` resolves to, once it scrolls near the view.
   * One is drawn at a time, so opening a tab never stalls on twenty pictures at once.
   */
  lazyThumb(el, make) {
    const q = (this.thumbQueue ??= { jobs: [], busy: false });
    const run = () => {
      if (q.busy || !q.jobs.length) return;
      q.busy = true;
      const [target, job] = q.jobs.shift();
      job().then(cv => {
        cv.style.width = `${target.w}px`;
        cv.style.height = `${target.h}px`;
        target.replaceChildren(cv);
      }).catch(() => {}).finally(() => { q.busy = false; setTimeout(run, 0); });
    };
    this.thumbSeen ??= typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          this.thumbSeen.unobserve(e.target);
          q.jobs.push([e.target, e.target.make]);
        }
        run();
      }, { rootMargin: '200px' })
      : null;
    el.make = make;
    if (this.thumbSeen) this.thumbSeen.observe(el);
    else { q.jobs.push([el, make]); run(); }
  }

  /**
   * The shop's stage: sky, a road that scrolls, and the rider bobbing along with its trail. The
   * animals are live SVG that do tricks (shoprider.js); the girl is drawn in the canvas. Runs only
   * while the shop tab is showing. Returns { show(rider, trail, hat), hop(), celebrate() }.
   */
  startPreview(canvas, stage, scale = 1) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const u = uiScale() * scale;
    const H = 136 * u, RIDER = 104 * u, ROAD = 34 * u;
    const s = RIDER / 132;
    let W = 0, raf = 0, riderId = null, frames = null, trail = null, trailId = null;
    let hopT0 = -1, hopH = 0, bits = [], actor = null;
    const bg = document.createElement('canvas');
    const layout = () => {
      W = stage.clientWidth;
      if (!W) return false;
      canvas.width = bg.width = Math.round(W * dpr);
      canvas.height = bg.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const g = bg.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H - ROAD);
      sky.addColorStop(0, '#9ACBFA');
      sky.addColorStop(1, '#F4E6B4');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,246,208,0.9)';
      g.beginPath();
      g.arc(W * 0.8, 34 * u, 17 * u, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [x, y, r] of [[0.16, 30, 9], [0.22, 26, 12], [0.28, 31, 8], [0.55, 44, 7], [0.6, 40, 10], [0.65, 45, 7]]) {
        g.beginPath();
        g.arc(W * x, y * u, r * u, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#2B2A29';
      g.fillRect(0, H - ROAD, W, ROAD);
      g.fillStyle = '#4B4948';
      g.fillRect(0, H - ROAD + 3 * u, W, ROAD - 7 * u);
      return true;
    };
    const ctx = canvas.getContext('2d');
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!W && !layout()) return;
      const t = performance.now() / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // road markings, running left
      const period = 52 * s, speed = period / 0.45;
      const off = (t * speed) % period;
      ctx.fillStyle = '#D2D2D2';
      for (let x = -off; x < W; x += period) ctx.fillRect(x, H - ROAD / 2 - 1.5 * u, period * 0.55, 3 * u);
      let bob = -0.8 * u * (1 - Math.cos((Math.PI * 2 * t) / 0.44));
      if (hopT0 >= 0) {
        const a = (t - hopT0) / 0.36;
        if (a >= 1) hopT0 = -1; else bob -= hopH * 4 * a * (1 - a);
      }
      const x = W / 2, bottom = H - 11 * u;
      if (trail) {
        trail.update(t, x - RIDER * 0.3, bottom - RIDER * 0.3 + bob, speed);
        trail.draw(ctx, t, dpr);
      }
      if (actor) {
        actor.pose(t, x, bottom);
      } else {
        const img = frames[frameAt(riderId, t)];
        ctx.drawImage(img, x - img.w / 2, bottom - img.h + bob, img.w, img.h);
      }
      // a purchase: confetti and hearts burst out of the rider
      if (bits.length) {
        bits = bits.filter(b => t - b.t0 < b.life);
        for (const b of bits) {
          const a = t - b.t0;
          ctx.globalAlpha = Math.min(1, 2.5 * (1 - a / b.life));
          ctx.save();
          ctx.translate(b.x + b.vx * a, b.y + b.vy * a + 190 * u * a * a);
          ctx.rotate(b.rot + b.vr * a);
          if (b.sprite) ctx.drawImage(b.sprite, -b.sprite.w / 2, -b.sprite.h / 2, b.sprite.w, b.sprite.h);
          else { ctx.fillStyle = b.color; ctx.fillRect(-3.5 * u, -2 * u, 7 * u, 4 * u); }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
    const api = {
      show(rider, trailName, hat = 'nohat') {
        if (rider !== riderId) {
          riderId = rider;
          actor?.remove();
          actor = null;
          if (isAnimal(rider)) {
            actor = new ShopRider(rider, RIDER);
            stage.insertBefore(actor.el, canvas.nextSibling);
          } else {
            frames = riderFrames(rider, RIDER);
          }
        }
        actor?.setHat(hat);
        if (trailName !== trailId) { trailId = trailName; trail = trailName === 'none' ? null : new Trail(trailName, s); }
      },
      dropHat() { actor?.dropHat(); },
      hop(k = 1) {
        if (actor) actor.trick('hop', k);
        else { hopT0 = performance.now() / 1000; hopH = 10 * k * u; }
      },
      celebrate() {
        // a new animal does a flip (or, now and then, a wheelie); the girl jumps for joy
        if (actor) actor.trick(Math.random() < 0.7 ? 'flip' : 'wheelie');
        else { hopT0 = performance.now() / 1000; hopH = 18 * u; }
        const t = performance.now() / 1000;
        const hearts = trailSprites('hearts', 0.9 * u);
        const colors = ['#FF4FB8', '#FFE14A', '#6FD1FF', '#8BE36B', '#FF8A3D'];
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = (120 + Math.random() * 170) * u;
          bits.push({
            t0: t, life: 0.9 + Math.random() * 0.5, x: W / 2, y: H - 60 * u, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
            sprite: i % 4 === 0 ? hearts[i % hearts.length] : null, color: colors[i % colors.length],
          });
        }
      },
    };
    raf = requestAnimationFrame(frame);
    this.stopPreview = () => { cancelAnimationFrame(raf); actor?.remove(); };
    return api;
  }

  // ---------------------------------------------------------------- the shop opening

  /**
   * Gifts, shown when the app opens: once, when the shop first exists, what it is and a starter gift
   * of coins; then each gift hat that has arrived (the welcome beanie, the witch hat on Halloween),
   * one at a time. Waits for the welcome, the opening deal and any panel to be out of the way.
   */
  maybeShowShopGift() {
    this.giftsStarted = true; // from the first call, a few moments after the game appears
    const hat = shop.pendingGifts()[0];
    const queued = shop.queue()[0];
    const note = shop.pendingNotes()[0];
    if (!shop.giftPending && !hat && !queued && !note) return;
    if (this.anyOpen || this.breakKind || this.welcomeWaiting || this.game.drag || this.game.finishing) {
      clearTimeout(this.giftTimer);
      this.giftTimer = setTimeout(() => this.maybeShowShopGift(), 2500);
      return;
    }
    if (shop.giftPending) this.showStarterGift();
    else if (hat) this.showHatGift(hat);
    else if (queued) this.showQueuedGift(shop.unqueue());
    else this.showNote(note);
  }

  /** Closes a gift panel, and lets the next gift (if any) come along after it. */
  closeGift() {
    this.hide('gift');
    clearTimeout(this.giftTimer);
    this.giftTimer = setTimeout(() => this.maybeShowShopGift(), 900);
  }

  showStarterGift() {
    const gift = shop.giveStarterGift();
    const layer = this.layers.gift;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.shopOpenTitle());
    panel.classList.add('gift-panel');
    const close = () => this.closeGift();
    scrim.addEventListener('click', close);
    const trio = h('div', 'gift-riders');
    for (const id of ['bunny', 'capy', 'kitty']) {
      const c = riderFrame(id, (id === 'capy' ? 104 : 84) * uiScale());
      c.style.width = `${c.w}px`;
      c.style.height = `${c.h}px`;
      const wrap = h('div', `gift-rider r-${id}`);
      wrap.append(c);
      trio.append(wrap);
    }
    panel.append(trio, h('p', 'why', L.shopOpenText()));
    const line = h('div', 'gift-line');
    const chip = coinChip(0, 'big');
    countTo(chip, gift, 0.9, 0.5);
    line.append(h('span', '', L.shopGift()), chip);
    panel.append(line);
    panel.append(button(L.takeALook(), () => {
      this.closeGift();
      this.openMenu('shop', { kind: 'rider', id: 'capy' });
    }));
    panel.append(quietButton(L.later(), close));
    layer.append(scrim, panel);
    this.show('gift');
    report.note('shopGift', String(gift));
  }

  /**
   * A gift hat: it's hers as soon as the panel opens (and on her animal), shown on every animal she
   * owns at once; with none yet, on the try-on bunny, waiting for her.
   */
  showHatGift(item, reason = item.gift, noteId = reason) {
    if (item.gift) shop.claim(item);
    const layer = this.layers.gift;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.giftTitle(reason));
    panel.classList.add('gift-panel');
    const close = () => this.closeGift();
    scrim.addEventListener('click', close);
    const mine = RIDER_ITEMS.filter(i => i.id !== 'girl' && shop.owns('rider', i.id)).map(i => i.id);
    const who = mine.length ? mine : [TRY_ON];
    const size = (who.length > 3 ? 62 : 80) * uiScale();
    const row = h('div', 'gift-riders hat-gift');
    who.forEach((id, i) => {
      const r = renderSVG(id, { style: 'rich', size: (size * 100) / 140, shadow: false });
      r.pose(poseAt(id, 1.8 + i * 0.37));
      wearHat(r, id, item.id);
      const wrap = h('div', 'gift-rider');
      wrap.style.animationDelay = `${-0.45 * i}s`;
      wrap.append(r.svg);
      row.append(wrap);
    });
    panel.append(row, h('p', 'why', L.giftText(reason, item.id)));
    this.appendNote(panel, noteId);
    if (!mine.length) panel.append(h('p', 'item-note', L.giftWaits()));
    panel.append(button(L.putItOn(), () => {
      this.closeGift();
      this.openMenu('shop', { kind: 'hat', id: item.id });
    }));
    panel.append(this.heartBack(`${L.itemName('hat', item.id)} (${reason})`), quietButton(L.later(), close));
    layer.append(scrim, panel);
    this.show('gift');
    sound.play('tap');
    report.note('hatGift', `${item.id} (${reason})`);
  }

  /** A gift from the queue (shop.grant): a hat earned by playing, the mystery gift, or its coins. */
  showQueuedGift(entry) {
    if (!entry) return;
    if (entry.kind === 'hat') {
      const item = shop.item('hat', entry.id);
      if (item) { this.showHatGift(item, entry.reason, entry.noteId ?? entry.reason); return; }
    }
    if (entry.kind !== 'coins') { this.closeGift(); return; }
    const layer = this.layers.gift;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.giftTitle(entry.reason));
    panel.classList.add('gift-panel');
    const close = () => this.closeGift();
    scrim.addEventListener('click', close);
    panel.append(bigIcon('gift'), h('p', 'why', L.giftText(entry.reason, 'coins')));
    this.appendNote(panel, entry.noteId);
    const line = h('div', 'gift-line');
    const chip = coinChip(0, 'big');
    countTo(chip, entry.n, 0.9, 0.5);
    line.append(chip);
    panel.append(line, button(L.thankYou(), close), this.heartBack(`${entry.n} coins (${entry.reason})`));
    layer.append(scrim, panel);
    this.show('gift');
    sound.play('tap');
    report.note('coinGift', `${entry.n} (${entry.reason})`);
  }

  /**
   * "Send a heart back": a small button she taps herself, which tells him she opened the gift.
   * Nothing is sent unless she taps, and only once per gift.
   */
  heartBack(what) {
    const b = h('button', 'quiet heart-back', L.heartBack());
    b.addEventListener('click', () => {
      sound.play('tap');
      b.disabled = true;
      setText(b, L.heartSent());
      report.ping(`She opened a gift and sent a heart back: ${what} 💗`).catch(() => {});
    }, { once: true });
    return b;
  }

  /** A day that brings only a note from him (Valentine's, 520, 七夕, the anniversary). */
  showNote(id) {
    const text = noteNow(id);
    shop.readNote(id);
    if (!text) { this.closeGift(); return; }
    const layer = this.layers.gift;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.noteTitle(id));
    panel.classList.add('gift-panel');
    const close = () => this.closeGift();
    scrim.addEventListener('click', close);
    const note = h('p', 'gift-note', text);
    panel.append(bigIcon('envelope'), note, button(L.thankYou(), close), this.heartBack(`the ${id} note`));
    layer.append(scrim, panel);
    this.show('gift');
    sound.play('tap');
    report.note('note', id);
  }

  /** His note for a gift, in her language, when there is one and it can be read. */
  appendNote(panel, noteId) {
    if (!noteId) return;
    const el = h('p', 'gift-note');
    el.hidden = true;
    panel.append(el);
    noteText(noteId).then(text => { if (text) { el.textContent = text; el.hidden = false; } }).catch(() => {});
  }

  // ---------------------------------------------------------------- album

  /** Every photo she has unlocked, and the one she's collecting now. */
  albumPage(page) {
    const viewer = this.menu.viewer;
    const now = h('div', 'puzzle-box');
    now.append(puzzleCard(puzzle.current, puzzle.pieces, 250, 210), h('p', 'puzzle-line', L.puzzleProgress(puzzle.count)));
    page.append(now);

    const album = puzzle.album;
    page.append(h('p', 'album-count', L.albumCount(album.length)));
    const grid = h('div', 'album-grid');
    for (const id of album.slice().reverse()) {
      const cell = h('button', 'thumb');
      const canvas = h('canvas');
      canvas.width = canvas.height = 180;
      cell.append(canvas);
      grid.append(cell);
      cell.addEventListener('click', async () => {
        sound.play('tap');
        const img = await loadPhoto(id);
        if (!img) return;
        viewer.querySelector('img')?.remove();
        viewer.append(img);
        viewer.classList.add('show');
      });
    }
    if (!album.length) grid.append(h('p', 'note empty-album', L.albumEmpty()));
    page.append(grid);

    // thumbnails one at a time, so opening the album never stalls the page
    (async () => {
      const thumbs = [...grid.querySelectorAll('canvas')];
      const ids = album.slice().reverse();
      for (let i = 0; i < thumbs.length; i++) {
        if (!page.isConnected) return;
        const img = await loadPhoto(ids[i]);
        if (!img) { thumbs[i].parentElement.classList.add('nophoto'); thumbs[i].after(iconEl('hearts')); continue; }
        const c = thumbs[i], ctx = c.getContext('2d');
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.parentElement.classList.add('ready');
      }
    })();
  }

  /** Out of moves in Challenge: one photo break per game buys a rescue shuffle. */
  secondChance() {
    this.revivePending = this.result;
    this.result = null;
    this.hide('result');
    this.requestPhotoBreak('shuffle');
  }

  // ---------------------------------------------------------------- photo break

  /** Where the original game plays an ad, show one of our photos instead, then refill. */
  async requestPhotoBreak(kind) {
    if (this.breakKind) return;
    this.breakKind = kind;
    const layer = this.layers.photo;
    layer.replaceChildren();

    const blur = h('canvas', 'blur');
    const frame = h('div', 'frame');
    const top = h('div', 'top');
    top.append(h('span', 'tag', L.photoBreak()));
    const close = h('button', 'close');
    close.append(iconEl('x'));
    close.setAttribute('aria-label', L.close());
    close.addEventListener('click', () => this.finishPhotoBreak(false));
    top.append(close);
    const bottom = h('div', 'bottom');
    const countdown = h('span', 'countdown', L.rewardIn(5));
    bottom.append(countdown);
    layer.append(blur, frame, top, bottom);
    this.show('photo');

    const img = await photos.next();
    if (this.breakKind !== kind) return;
    if (img) {
      // shrink to 10px, then smooth back up to 80px: an even blur with no blocky edges.
      // The 10px square normally comes cut and ready from photos.load(); cutting one here from
      // the full-size photo stalls the main thread for over a frame (see blurSeed there).
      let seed = img.blurSeed;
      if (!seed) {
        const tiny = document.createElement('canvas');
        tiny.width = tiny.height = 10;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        tiny.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 10, 10);
        seed = tiny;
      }
      blur.width = blur.height = 80;
      const bctx = blur.getContext('2d');
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(seed, 0, 0, 80, 80);
      img.className = 'photo';
      frame.append(img);
      this.breakImage = img;
      requestAnimationFrame(() => layer.classList.add('loaded'));
    } else {
      frame.append(bigIcon('hearts'), h('p', 'empty-text', L.noPhotos()));
      layer.classList.add('loaded');
    }

    let remaining = 5;
    this.breakTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        countdown.textContent = L.rewardIn(remaining);
        return;
      }
      clearInterval(this.breakTimer);
      const label = kind === 'hint' ? L.collect('hint') : this.game.relaxed ? L.collectShuffles() : L.collect('shuffle');
      bottom.replaceChildren(button(label, () => this.finishPhotoBreak(true)));
    }, 1000);
  }

  finishPhotoBreak(reward) {
    const kind = this.breakKind;
    if (!kind) return;
    this.breakKind = null;
    clearInterval(this.breakTimer);
    this.hide('photo');
    const layer = this.layers.photo;
    setTimeout(() => {
      if (this.breakKind) return;
      layer.classList.remove('loaded');
      layer.replaceChildren();
      if (this.breakImage) {
        URL.revokeObjectURL(this.breakImage.src);
        this.breakImage.blurSeed?.close?.();
        this.breakImage = null;
      }
    }, 300);
    const pending = this.revivePending;
    this.revivePending = null;
    if (reward) this.game.grant(kind);
    else if (pending) this.showResult(pending); // backed out of the second chance: still game over
  }
}
