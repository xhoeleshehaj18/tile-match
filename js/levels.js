// What each level asks of her: the twists on the board, the clock to beat and the combo to reach.
//
// Every five levels is a chapter that brings in one new twist, and the chapter's five levels turn
// it up step by step. From level 25 every level pairs two of the four twists, taking turns through
// every pairing, and keeps getting harder up to level 60 or so. Never more than two on one board:
// all four at once was more chaos than puzzle.

import { Board, DOWN, withSeed, hashSeed, random } from './board.js';

/** The pairings the levels from 25 on take turns through, one a level. */
const PAIRS = [['stones', 'gravity'], ['ice', 'gifts'], ['stones', 'ice'], ['gravity', 'gifts'], ['stones', 'gifts'], ['gravity', 'ice']];

/** The chapter a level belongs to, by the twist it introduced. */
export function chapterOf(level) {
  if (level < 5) return 'basics';
  if (level < 10) return 'stones';
  if (level < 15) return 'gravity';
  if (level < 20) return 'ice';
  if (level < 25) return 'gifts';
  return 'mix';
}

/** Seconds on the clock per pair, before twists: generous early, tight later. */
const perPair = eff => Math.max(2.9, 4.2 - 0.035 * (eff - 1));

function finish(r, pairs) {
  // frozen and wrapped tiles take thinking time, so the clock allows for them
  const extra = (r.ice + r.ice2) * 1.1 + r.gifts * 0.6 + (r.gravity ? pairs * 0.25 : 0);
  r.par = Math.round((pairs * perPair(r.eff ?? r.level) + extra) / 5) * 5;
  return r;
}

/**
 * Someone who was already far along when the twists arrived (`since`, the level she was on) hasn't
 * met any of them. Rather than dropping her straight into level 110's everything-at-once, her
 * next eight levels play two of each chapter in turn, each new twist with its card, and then the
 * pairs start from the easy end and climb two steps a level until they catch up with her level.
 * Returns the level whose recipe to use, and the twist to introduce.
 */
const REFRESHER = [7, 9, 12, 14, 17, 19, 22, 24];
export const catchingUp = since => since > 5;

function recipeLevel(level, since) {
  if (!catchingUp(since)) return { eff: level, intro: null };
  const k = level - since;
  if (k < REFRESHER.length) {
    const eff = REFRESHER[Math.max(0, k)];
    return { eff, intro: k >= 0 && k % 2 === 0 ? chapterOf(eff) : null };
  }
  const extra = k - REFRESHER.length;
  return { eff: Math.min(level, 26 + 2 * extra), intro: extra === 0 ? 'mix' : extra === 2 ? 'ice2' : null };
}

/**
 * The recipe for a level in Levels mode (or on the Big board, which has ~1.5x the cells).
 * `since` is the level this save was on when the twists arrived (see recipeLevel).
 * Returns { level, share, stones, ice, ice2, gifts, gravity, intro, comboGoal, par, milestone }.
 */
export function levelRules(level, big = false, since = 1) {
  const { eff, intro } = recipeLevel(level, since);
  const r = { level, eff, stones: 0, ice: 0, ice2: 0, gifts: 0, gravity: null, intro: null };
  const k = (eff - 1) % 5;
  const ch = chapterOf(eff);
  if (ch === 'stones') r.stones = 4 + 2 * k;
  if (ch === 'gravity') { r.gravity = DOWN; r.stones = 2 + 2 * Math.floor(k / 2); }
  if (ch === 'ice') { r.ice = 8 + 3 * k; r.stones = 4; }
  if (ch === 'gifts') { r.gifts = 12 + 4 * k; r.ice = 6; }
  if (ch === 'mix') {
    const n = eff - 25;
    // the pair goes by the level itself: a save catching up climbs two steps a level, and would
    // otherwise only ever meet every other pairing
    const pair = PAIRS[Math.max(0, level - 25) % PAIRS.length];
    if (pair.includes('stones')) r.stones = 6 + 2 * Math.floor(Math.min(n, 18) / 3);
    if (pair.includes('gravity')) r.gravity = DOWN;
    if (pair.includes('ice')) {
      r.ice = 10 + Math.min(n, 24);
      // thick ice from level 30
      r.ice2 = n >= 5 ? Math.min(r.ice, Math.floor((n - 3) / 2) * 2) : 0;
    }
    if (pair.includes('gifts')) r.gifts = 12 + Math.min(Math.round(n * 1.2), 30);
  }
  if (catchingUp(since)) r.intro = intro;
  else if (level % 5 === 0 && level <= 25) r.intro = ch;
  else if (level === 30) r.intro = 'ice2';
  r.share = Board.touchingShare(level);
  r.comboGoal = Math.min(20, 5 + Math.floor((eff - 1) / 3));
  r.milestone = level % 5 === 0;
  if (big) {
    for (const key of ['stones', 'ice', 'ice2', 'gifts']) r[key] = Math.round(r[key] * 1.45);
    r.comboGoal = Math.min(24, r.comboGoal + 2);
  }
  return finish(r, big ? 102 - r.stones / 2 : 70 - r.stones / 2);
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
export const DAILY_THEMES = ['sweet', 'stones', 'gravity', 'ice', 'gifts', 'duo', 'mix'];

/** The recipe for the daily board on `date`: the same for everyone who plays that day. */
export function dailyRules(date) {
  const [y, m, d] = date.split('-').map(Number);
  const theme = DAILY_THEMES[new Date(y, m - 1, d).getDay()];
  const r = { level: 20, date, theme, stones: 0, ice: 0, ice2: 0, gifts: 0, gravity: null, intro: null, share: 0.08, milestone: false };
  withSeed(hashSeed('daily' + date), () => {
    // Friday and Saturday pair two twists, like the later levels; Saturday's pair is the tougher
    const pair = PAIRS[Math.floor(random() * PAIRS.length)];
    const big = theme === 'mix';
    if (theme === 'sweet') r.share = 0.2;
    if (theme === 'stones') r.stones = 10;
    if (theme === 'gravity') { r.gravity = DOWN; r.stones = 4; }
    if (theme === 'ice') { r.ice = 18; r.ice2 = 4; }
    if (theme === 'gifts') { r.gifts = 26; r.stones = 2; }
    if (theme === 'duo' || theme === 'mix') {
      if (pair.includes('stones')) r.stones = big ? 10 : 6;
      if (pair.includes('gravity')) r.gravity = DOWN;
      if (pair.includes('ice')) { r.ice = big ? 16 : 10; r.ice2 = big ? 6 : 0; }
      if (pair.includes('gifts')) r.gifts = big ? 26 : 16;
    }
  });
  r.comboGoal = theme === 'sweet' ? 14 : 10;
  return finish(r, 70 - r.stones / 2);
}

/** Challenge keeps the original rules: no twists, no clock. */
export const CHALLENGE_RULES = { level: 1, stones: 0, ice: 0, ice2: 0, gifts: 0, gravity: null, intro: null, comboGoal: 0, par: 0, milestone: false };

/** The arrow icon for a gravity direction, as a `{name}` token for the HUD. */
export const arrowOf = d => (!d ? '' : `{arrow${d.dr > 0 ? 'Down' : d.dr < 0 ? 'Up' : d.dc < 0 ? 'Left' : 'Right'}}`);
