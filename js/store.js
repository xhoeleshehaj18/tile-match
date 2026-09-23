// Saved progress in localStorage, mirroring the iOS keys.

import { changed } from './backup.js';
import { todayKey, yesterdayKey } from './levels.js';

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

export const MODES = ['levels', 'daily', 'challenge', 'big'];
export const savedMode = () => {
  const m = localStorage.getItem('mode');
  return MODES.includes(m) ? m : 'levels';
};

/** The daily board: today's best stars, and how many days in a row she has cleared it. */
export const Daily = {
  best(date) {
    const b = store.json('daily.best');
    return b && b.d === date ? b.s : 0;
  },
  /** A streak still counts while yesterday's (or today's) board was the last one cleared. */
  get streak() {
    const last = localStorage.getItem('daily.last');
    return last === todayKey() || last === yesterdayKey() ? store.int('daily.streak') : 0;
  },
  /** Records a cleared daily board. Returns how many stars are new today (one puzzle piece each). */
  record(date, stars) {
    const before = this.best(date);
    if (stars > before) store.set('daily.best', { d: date, s: stars });
    const last = localStorage.getItem('daily.last');
    if (last !== date) {
      const [y, m, d] = date.split('-').map(Number);
      const prev = todayKey(new Date(y, m - 1, d - 1));
      store.set('daily.streak', last === prev ? store.int('daily.streak') + 1 : 1);
      store.set('daily.last', date);
    }
    return Math.max(0, stars - before);
  },
};
