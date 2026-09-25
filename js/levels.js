// What each level asks of her: whether gravity pulls on the board, and the combo to reach.
//
// The first four levels are plain. Levels 5 to 9 bring in gravity, and from level 10 it comes back
// every other level, so boards take turns between the two.

import { Board, DOWN } from './board.js';

/** The first level with gravity, which gets its card. */
export const GRAVITY_FROM = 5;

const hasGravity = level => level >= GRAVITY_FROM && (level < 10 || level % 2 === 1);

/**
 * The recipe for a level in Levels mode (or on the Big board, which has ~1.5x the cells).
 * Returns { level, share, gravity, comboGoal, milestone }.
 */
export function levelRules(level, big = false) {
  const r = { level, gravity: hasGravity(level) ? DOWN : null };
  r.share = Board.touchingShare(level);
  r.comboGoal = Math.min(20, 5 + Math.floor((level - 1) / 3));
  r.milestone = level % 5 === 0;
  if (big) r.comboGoal = Math.min(24, r.comboGoal + 2);
  return r;
}

// ---------------------------------------------------------------- daily board

/** Today's date as the key the daily board is dealt from, e.g. "2026-09-23" (local time). */
export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/** Each weekday has its own theme, so the daily board feels different through the week. */
export const DAILY_THEMES = ['sweet', 'calm', 'gravity', 'calm', 'gravity', 'calm', 'gravity'];

/** The recipe for the daily board on `date`: the same for everyone who plays that day. */
export function dailyRules(date) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const theme = DAILY_THEMES[day];
  const r = { level: 20, date, day, theme, gravity: null, share: 0.08, milestone: false };
  if (theme === 'sweet') r.share = 0.2;
  if (theme === 'gravity') r.gravity = DOWN;
  r.comboGoal = theme === 'sweet' ? 14 : 10;
  return r;
}

/** Challenge keeps the original rules: no gravity. */
export const CHALLENGE_RULES = { level: 1, gravity: null, comboGoal: 0, milestone: false };

/** The arrow icon for a gravity direction, as a `{name}` token for the HUD. */
export const arrowOf = d => (!d ? '' : `{arrow${d.dr > 0 ? 'Down' : d.dr < 0 ? 'Up' : d.dc < 0 ? 'Left' : 'Right'}}`);
