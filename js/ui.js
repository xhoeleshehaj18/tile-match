// Settings, result screens and photo breaks: HTML overlays on top of the game canvas
// (ported from the SwiftUI panels). Only opacity/transform are animated, so they stay on the GPU.

import { L, isChinese, setChinese } from './i18n.js';
import { sound } from './sound.js';
import { photos } from './photos.js';
import { VERSION } from './version.js';
import * as report from './report.js';
import { puzzle, loadPhoto, jigsawFor, bitCount, PIECES } from './puzzle.js';
import { pieceScene, framedBoard, FRAME } from './puzzlefx.js';
import { store } from './store.js';
import { Daily } from './store.js';
import { todayKey, dailyRules } from './levels.js';

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

/** Playing from a Home Screen icon, where Safari never clears the saved game. */
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const inWeChat = () => /MicroMessenger/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function button(label, onClick, variant = 'blue') {
  const b = h('button', `chunky ${variant}`, label);
  b.addEventListener('click', () => { sound.unlock(); sound.play('tap'); onClick(); });
  return b;
}

function rowLabel(icon, text) {
  const el = h('span', 'row-label');
  el.append(h('span', 'row-icon', icon), h('span', '', text));
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
    mute.textContent = on ? '🔊' : '🔇';
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
  b.append(h('span', 'tool-icon', icon), h('span', 'tool-label', label));
  b.addEventListener('click', () => { sound.play('tap'); onClick(); });
  return b;
}

const TWIST_ICONS = { stones: '🪨', gravity: '⬇️', ice: '🧊', gifts: '🎁', duo: '✌️', mix: '✌️', ice2: '🧊', sweet: '🍬' };
const clock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * The photo puzzle as a little board: the pieces in `mask` in place on their tray, the rest
 * waiting as outlines. `card.paint(mask, whole)` redraws it, e.g. once new pieces have flown in;
 * `card.ready` resolves once the photo is loaded and cut.
 */
function puzzleCard(photoId, mask, maxW, maxH) {
  const card = h('div', 'jig-card');
  const canvas = h('canvas');
  card.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const room = 1 + 2 * FRAME;
  // until the photo is in, hold the space a phone photo would take
  const guess = Math.min(maxW / 3, maxH / 4);
  canvas.style.width = `${guess * 3}px`;
  canvas.style.height = `${guess * 4}px`;
  let jig = null, want = [mask, false];
  card.paint = (m, whole = false) => {
    want = [m, whole];
    if (!jig) return;
    const f = jig.fit((maxW / room) * dpr, (maxH / room) * dpr);
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

function starRow(n, animated = true) {
  const row = h('div', 'stars');
  for (let i = 0; i < 3; i++) {
    const st = h('span', i < n ? 'star on' : 'star', '★');
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
    this.root = root;
    this.game = null;
    this.result = null;
    this.revivePending = null;
    this.breakKind = null;
    this.layers = {};
    for (const name of ['settings', 'result', 'photo', 'report', 'keepSafe', 'intro', 'daily', 'album', 'welcome']) {
      const layer = h('div', `overlay ${name}`);
      layer.setAttribute('aria-hidden', 'true');
      root.append(layer);
      this.layers[name] = layer;
    }
  }

  get anyOpen() { return pieceScene.active || Object.values(this.layers).some(l => l.classList.contains('show')); }

  show(name) {
    const el = this.layers[name];
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  hide(name) {
    const el = this.layers[name];
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
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

  // ---------------------------------------------------------------- settings

  openSettings() {
    const layer = this.layers.settings;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.settings());
    panel.classList.add('settings-panel');
    scrim.addEventListener('click', () => this.hide('settings'));

    // Mode first: it's the one choice that changes the game. One line says what the chosen one is.
    const hints = { levels: L.levelsHint, daily: L.dailyHint, challenge: L.challengeHint, big: L.bigHint };
    const mode = segmented([['levels', L.levelsMode()], ['daily', L.dailyMode()], ['challenge', L.challengeMode()], ['big', L.bigMode()]], this.game.mode, m => {
      this.game.switchMode(m);
      this.openSettings();
    });
    mode.classList.add('wide');
    panel.append(mode, h('p', 'hint', hints[this.game.mode]()));

    const group = h('div', 'group');
    group.append(volumeRow());
    if (sound.canFeel) group.append(toggle('📳', L.vibration(), sound.haptics, on => sound.setHaptics(on)));
    const lang = h('div', 'row');
    lang.append(rowLabel('🌐', L.language()), segmented([[false, 'EN'], [true, '中文']], isChinese(), zh => {
      setChinese(zh);
      this.game.refreshLanguage();
      this.openSettings();
    }));
    group.append(lang);
    panel.append(group);

    // Continue is the big one. Restart sits under it, smaller, and a game in progress takes a
    // second tap within a few seconds so a slip can't cost her the board (or her streak).
    panel.append(button(L.resume(), () => this.hide('settings')));
    const levels = this.game.relaxed;
    const label = levels ? L.restartLevel() : L.newGame();
    let armed = 0;
    const restart = button(label, () => {
      if (this.game.inProgress && !armed) {
        restart.textContent = levels ? L.confirmRestart() : L.confirmNewGame();
        restart.classList.add('armed');
        armed = setTimeout(() => { armed = 0; restart.textContent = label; restart.classList.remove('armed'); }, 3000);
        return;
      }
      clearTimeout(armed);
      armed = 0;
      this.hide('settings');
      this.game.restartLevel();
    }, 'orange slim');
    panel.append(restart);

    // the rarely needed things, as one quiet row of icons
    const status = h('p', 'note status-line');
    const tools = h('div', 'tools');
    tools.append(tool('🧩', L.albumShort(), () => { this.hide('settings'); this.openAlbum(); }));
    tools.append(this.updateTool(status));
    if (!standalone()) {
      tools.append(tool('📲', L.keepSafeShort(), () => { this.hide('settings'); this.openKeepSafe(); }));
    }
    tools.append(tool('🐞', L.reportShort(), () => { this.hide('settings'); this.openReport(); }));
    panel.append(tools);
    const waiting = report.pending();
    status.textContent = waiting ? L.reportWaiting(waiting) : L.version(VERSION);
    panel.append(status);
    layer.append(scrim, panel);
    this.show('settings');
  }

  /** "Check for updates": asks the server for the newest version, downloads it fresh and restarts. */
  updateTool(status) {
    const b = tool('🔄', L.updateShort(), async () => {
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
        status.textContent = L.reportTooSoon();
        send.disabled = false;
        send.textContent = L.reportSend();
        return;
      }
      // no connection to the relay: it's saved on the phone, and she can paste it herself
      this.reportDone(L.reportQueued(), true);
    });
    panel.append(status, send);
    const cancel = h('button', 'update-btn', L.reportCancel());
    cancel.addEventListener('click', () => { sound.play('tap'); close(); });
    panel.append(cancel);

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
    panel.replaceChildren(h('div', 'big-emoji', offerShare ? '📋' : '💌'), h('p', 'sub', message));
    if (offerShare && navigator.share) {
      panel.append(button(L.reportShare(), () => {
        navigator.share({ text: report.lastBody() }).catch(() => {});
      }, 'pink'));
    }
    panel.append(button(L.resume(), () => this.hide('report')));
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
    panel.append(h('div', 'big-emoji', '📲'));
    panel.append(h('p', 'why', wechat ? L.keepSafeWeChatWhy() : L.keepSafeWhy()));
    const steps = h('ol', 'steps');
    const list = wechat ? L.keepSafeWeChatSteps() : isIOS() ? L.keepSafeSteps() : L.keepSafeOtherSteps();
    for (const step of list) steps.append(h('li', '', step));
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
      const goal = (ok, text) => goals.append(h('div', ok ? 'goal ok' : 'goal', `${ok ? '✓' : '✗'}  ${text}`));
      goal(true, L.goalClear());
      goal(r.timeOk, L.goalTime(clock(r.time), clock(r.par)));
      goal(r.comboOk, L.goalCombo(r.bestCombo, r.comboGoal));
      panel.append(goals);

      const prizes = h('div', 'prizes');
      if (r.prize.chest) prizes.append(h('span', 'prize chest', L.chest()));
      prizes.append(h('span', 'prize', `+${r.prize.hints} 💡`));
      if (r.prize.shuffles) prizes.append(h('span', 'prize', `+${r.prize.shuffles} 🔀`));
      if (r.prize.pieces) prizes.append(h('span', 'prize piece', `+${r.prize.pieces} 🧩`));
      panel.append(prizes);
      if (r.daily) {
        panel.append(h('p', 'note daily-note', r.prize.pieces ? L.dailyStreak(r.streak) : L.dailyNoNewStars(r.best)));
      }
      this.appendPuzzle(panel, r.puzzle);
      if (r.daily) {
        panel.append(button(r.stars < 3 ? L.tryForMore() : L.playAgain(), () => this.nextLevel(), r.stars < 3 ? 'pink' : 'blue'));
        panel.append(button(L.backTo(this.dailyReturnMode()), () => {
          this.result = null;
          this.hide('result');
          this.game.switchMode(this.dailyReturnMode());
        }, 'orange slim'));
      } else {
        panel.append(button(L.nextLevel(), () => this.nextLevel()));
      }
    } else {
      [scrim, panel] = this.panel(r.won ? L.boardCleared() : L.outOfMoves());
      panel.append(h('div', 'big-emoji', r.won ? '🏠✨' : '😵‍💫'));
      if (!r.won) panel.append(h('p', r.tilesLeft <= 20 ? 'sub close' : 'sub', L.tilesLeft(r.tilesLeft)));
      const score = h('div', 'score');
      score.append(h('span', 'label', L.score()), h('span', 'value', r.score.toLocaleString()));
      score.append(r.newBest ? h('span', 'new-best', L.newBest()) : h('span', 'best', L.bestScore(r.best)));
      panel.append(score);
      const record = h('div', 'record');
      if (r.won && r.streak > 0) record.append(h('span', 'streak', L.streak(r.streak)));
      if (r.games > 0) record.append(h('span', 'games', L.record(r.wins, r.games)));
      panel.append(record);
      if (r.won) this.appendPuzzle(panel, r.puzzle);
      if (r.canRevive) panel.append(button(L.secondChance(), () => this.secondChance(), 'pink'));
      panel.append(button(r.won ? L.playAgain() : L.tryAgain(), () => this.nextLevel()));
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
      line.textContent = p.completed ? L.photoUnlocked() : L.puzzleProgress(bitCount(p.after));
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
    panel.append(h('p', 'tag-new', L.newTwist()), h('div', 'big-emoji', TWIST_ICONS[twist] ?? '✨'), h('p', 'why', L.twistText(twist)));
    panel.append(button(L.letsGo(), close, 'pink'));
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
    panel.append(h('div', 'big-emoji gift-bob', '🎁'));
    panel.append(h('p', 'why', L.welcomeText()));
    panel.append(h('p', 'sub', L.welcomeGift(cleared)));
    if (this.game.since > 5) panel.append(h('p', 'note', L.welcomeRefresher()));
    const open = button(L.openGift(), async () => {
      const from = open.getBoundingClientRect();
      store.set('puzzle.welcome', 'given');
      this.hide('welcome');
      await photos.loaded;
      const p = puzzle.award(PIECES);
      await pieceScene.play(p, { origin: from });
      this.welcomeWaiting = false;
    }, 'pink');
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
    panel.append(h('p', 'note', new Date().toLocaleDateString(isChinese() ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })));
    panel.append(h('div', 'big-emoji', TWIST_ICONS[rules.theme] ?? '📅'));
    panel.append(h('p', 'sub', L.dailyTheme(rules.theme)));
    panel.append(starRow(best, false));
    panel.append(h('p', 'why', best ? L.dailyBest(best) : L.dailyPitch()));
    if (streak > 0) panel.append(h('p', 'streak-line', L.dailyStreak(streak)));
    if (game.mode === 'daily') {
      panel.append(button(L.resume(), close));
      panel.append(button(L.backTo(this.dailyReturnMode()), () => { close(); game.switchMode(this.dailyReturnMode()); }, 'orange slim'));
    } else {
      panel.append(button(best >= 3 ? L.playAgain() : L.playDaily(), () => {
        close();
        localStorage.setItem('daily.returnTo', game.mode);
        game.switchMode('daily');
      }, 'pink'));
      panel.append(button(L.notNow(), close, 'orange slim'));
    }
    layer.append(scrim, panel);
    this.show('daily');
  }

  // ---------------------------------------------------------------- album

  /** Every photo she has unlocked, and the one she's collecting now. */
  openAlbum() {
    const layer = this.layers.album;
    layer.replaceChildren();
    const [scrim, panel] = this.panel(L.albumTitle());
    panel.classList.add('album-panel');
    const close = () => this.hide('album');
    scrim.addEventListener('click', close);

    panel.append(h('p', 'note', L.albumHint()));
    const now = h('div', 'puzzle-box');
    now.append(puzzleCard(puzzle.current, puzzle.pieces, 250, 230), h('p', 'puzzle-line', L.puzzleProgress(puzzle.count)));
    panel.append(now);

    const album = puzzle.album;
    panel.append(h('p', 'album-count', L.albumCount(album.length)));
    const grid = h('div', 'album-grid');
    const viewer = h('div', 'viewer');
    viewer.addEventListener('click', () => {
      viewer.classList.remove('show');
      const img = viewer.querySelector('img');
      if (img) { URL.revokeObjectURL(img.src); img.remove(); }
    });
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
    panel.append(grid, button(L.resume(), close));
    layer.append(scrim, panel, viewer);
    this.show('album');

    // thumbnails one at a time, so opening the album never stalls the page
    (async () => {
      const thumbs = [...grid.querySelectorAll('canvas')];
      const ids = album.slice().reverse();
      for (let i = 0; i < thumbs.length; i++) {
        if (!layer.classList.contains('show')) return;
        const img = await loadPhoto(ids[i]);
        if (!img) { thumbs[i].parentElement.classList.add('nophoto'); continue; }
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
    const close = h('button', 'close', '✕');
    close.setAttribute('aria-label', 'Close');
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
      frame.append(h('div', 'empty', '💑'), h('p', 'empty-text', L.noPhotos()));
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
      bottom.replaceChildren(button(label, () => this.finishPhotoBreak(true), 'pink'));
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
