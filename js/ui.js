// Settings, result screens and photo breaks: HTML overlays on top of the game canvas
// (ported from the SwiftUI panels). Only opacity/transform are animated, so they stay on the GPU.

import { L, isChinese, setChinese } from './i18n.js';
import { sound } from './sound.js';
import { photos } from './photos.js';

/** Shown at the bottom of Settings, so it's easy to tell which version a phone is running. */
export const VERSION = 6;

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

function button(label, onClick, variant = 'blue') {
  const b = h('button', `chunky ${variant}`, label);
  b.addEventListener('click', () => { sound.unlock(); sound.play('tap'); onClick(); });
  return b;
}

function toggle(label, on, onChange) {
  const row = h('label', 'row');
  row.append(h('span', '', label));
  const input = h('input', 'switch');
  input.type = 'checkbox';
  input.checked = on;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(input);
  return row;
}

function segmented(label, options, value, onChange) {
  const row = h('div', 'row');
  row.append(h('span', '', label));
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
  row.append(seg);
  return row;
}

export class UI {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.result = null;
    this.revivePending = null;
    this.breakKind = null;
    this.layers = {};
    for (const name of ['settings', 'result', 'photo']) {
      const layer = h('div', `overlay ${name}`);
      layer.setAttribute('aria-hidden', 'true');
      root.append(layer);
      this.layers[name] = layer;
    }
  }

  get anyOpen() { return Object.values(this.layers).some(l => l.classList.contains('show')); }

  show(name) {
    const el = this.layers[name];
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  hide(name) {
    const el = this.layers[name];
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
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
    scrim.addEventListener('click', () => this.hide('settings'));

    const rows = h('div', 'rows');
    rows.append(toggle(L.sound(), sound.enabled, on => sound.setEnabled(on)));
    if (sound.canVibrate) rows.append(toggle(L.vibration(), sound.haptics, on => sound.setHaptics(on)));
    rows.append(segmented(L.language(), [[false, 'English'], [true, '中文']], isChinese(), zh => {
      setChinese(zh);
      this.game.refreshLanguage();
      this.openSettings();
    }));
    rows.append(segmented(L.mode(), [['levels', L.levelsMode()], ['challenge', L.challengeMode()]], this.game.mode, mode => {
      this.game.switchMode(mode);
      this.openSettings();
    }));
    rows.append(h('p', 'note', L.modeHint()));
    panel.append(rows);

    panel.append(button(this.game.mode === 'levels' ? L.restartLevel() : L.newGame(), () => {
      this.hide('settings');
      this.game.restartLevel();
    }, 'orange'));
    panel.append(button(L.resume(), () => this.hide('settings')));
    panel.append(h('p', 'version', `v${VERSION}`));
    layer.append(scrim, panel);
    this.show('settings');
  }

  // ---------------------------------------------------------------- results

  showResult(r) {
    this.result = r;
    const layer = this.layers.result;
    layer.replaceChildren();
    let scrim, panel;

    if (r.level !== undefined) {
      [scrim, panel] = this.panel(L.levelClear(r.level));
      panel.append(h('div', 'big-emoji', '🏠✨'), h('p', 'sub', L.madeItHome()));
      panel.append(button(L.nextLevel(), () => this.nextLevel()));
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
      // shrink to 10px, then smooth back up to 80px: an even blur with no blocky edges
      const tiny = document.createElement('canvas');
      tiny.width = tiny.height = 10;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      tiny.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 10, 10);
      blur.width = blur.height = 80;
      const bctx = blur.getContext('2d');
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(tiny, 0, 0, 80, 80);
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
      const label = kind === 'hint' ? L.collect('hint') : this.game.mode === 'levels' ? L.collectShuffles() : L.collect('shuffle');
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
      if (this.breakImage) { URL.revokeObjectURL(this.breakImage.src); this.breakImage = null; }
    }, 300);
    const pending = this.revivePending;
    this.revivePending = null;
    if (reward) this.game.grant(kind);
    else if (pending) this.showResult(pending); // backed out of the second chance: still game over
  }
}
