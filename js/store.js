// Saved progress in localStorage, mirroring the iOS keys.

import { changed } from './backup.js';

export const store = {
  int(key, fallback = 0) {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  },
  bool(key) { return localStorage.getItem(key) === 'true'; },
  json(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    } catch {}
    changed();
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
    changed();
  },
};

/** Lifetime Challenge record: best score, wins and win streaks. */
export const Stats = {
  get best() { return store.int('best'); },
  get wins() { return store.int('wins'); },
  get games() { return store.int('games'); },
  get streak() { return store.int('streak'); },
  get bestStreak() { return store.int('bestStreak'); },

  /** Returns true when `score` beats the previous best. */
  submit(score) {
    if (score <= this.best) return false;
    store.set('best', score);
    return true;
  },
  recordWin() {
    store.set('games', this.games + 1);
    store.set('wins', this.wins + 1);
    store.set('streak', this.streak + 1);
    store.set('bestStreak', Math.max(this.bestStreak, this.streak));
  },
  recordLoss() {
    store.set('games', this.games + 1);
    store.set('streak', 0);
  },
};

export const MODES = ['levels', 'challenge', 'big'];
export const savedMode = () => {
  const m = localStorage.getItem('mode');
  return MODES.includes(m) ? m : 'levels';
};
