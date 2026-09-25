// The shop: coins earned by playing, and the riders and trails they buy.
//
// ---------------------------------------------------------------- the economy
//
// What a board pays (Levels, Daily and Big; see levelCoins):
//   clearing it              20
//   each star after the 1st  +15          (so 20 / 35 / 50 for 1 / 2 / 3 stars)
//   best combo               +1 a combo, up to +20
//   each Fever               +5, up to +20
//   later levels             +3 per 10 levels, up to +15   (they're harder and take longer)
//   every 5th level's chest  +40
//   the Big board            ×1.5         (about 1.5× the tiles)
//   Daily                    +15 a new star, and +5 a day of streak (up to +35) on the day's first clear
// Challenge pays score ÷ 100, and 25 more for clearing the board.
//
// A typical level (2 stars, a 10 combo, one Fever, around level 20) pays about 56; a great one
// (3 stars, 15 combo, two Fevers) about 80. With a chest every fifth level, that is ~65 a level.
// A level takes 4–5 minutes, so it's roughly 14 coins a minute of play; with a few levels and the
// daily board, a day of casual play (20–30 min) is ~300–400.
//
// Prices were set from that, so there is always something close to reach for:
//   first trail (Hearts, 250)     ≈ 4 levels — the first evening
//   first rider (Bunny, 400)      ≈ 6 levels
//   the Capybara (600)            ≈ 9 levels, day two (or at once with the starter gift, below)
//   mid riders (900–1,600)        ≈ 2–4 days each
//   legendary Unicorn (3,000)     ≈ 45 levels, a couple of weeks
//   everything (11,550)           ≈ 175 levels, 4–6 weeks of playing most days
//
// Someone who was already playing gets a starter gift when the shop opens: 150 plus 10 for every
// level already cleared, up to 600 — enough, from level 46 on, to take the Capybara home at once.

import { store } from './store.js';

export const RIDER_ITEMS = [
  { id: 'girl', price: 0 },
  { id: 'bunny', price: 400 },
  { id: 'capy', price: 600 },
  { id: 'kitty', price: 900 },
  { id: 'penguin', price: 1200 },
  { id: 'panda', price: 1600 },
  { id: 'unicorn', price: 3000, legendary: true },
];

export const TRAIL_ITEMS = [
  { id: 'none', price: 0 },
  { id: 'hearts', price: 250 },
  { id: 'sparkles', price: 400 },
  { id: 'bubbles', price: 400 },
  { id: 'petals', price: 600 },
  { id: 'notes', price: 700 },
  { id: 'rainbow', price: 1500, legendary: true },
];

const ITEMS = { rider: RIDER_ITEMS, trail: TRAIL_ITEMS };
/** Roughly what one level pays, for "≈ N levels to go". */
export const COINS_PER_LEVEL = 65;

const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

export const shop = {
  get coins() { return store.int('coins'); },
  /** Everything ever earned, for the bug report and the curious. */
  get earned() { return store.int('coins.earned'); },

  get rider() {
    const id = localStorage.getItem('shop.rider');
    return id && this.owns('rider', id) ? id : 'girl';
  },
  get trail() {
    const id = localStorage.getItem('shop.trail');
    return id && this.owns('trail', id) ? id : 'none';
  },

  owned() { return store.json('shop.owned') ?? []; },
  owns(kind, id) {
    const item = ITEMS[kind]?.find(i => i.id === id);
    return !!item && (item.price === 0 || this.owned().includes(`${kind}:${id}`));
  },
  item(kind, id) { return ITEMS[kind].find(i => i.id === id); },

  add(n) {
    if (!(n > 0)) return;
    store.set('coins', this.coins + n);
    store.set('coins.earned', this.earned + n);
    emit();
  },

  /** Spends the coins and equips the item. Returns false when she can't afford it. */
  buy(kind, id) {
    const item = this.item(kind, id);
    if (!item || this.owns(kind, id) || this.coins < item.price) return false;
    store.set('coins', this.coins - item.price);
    store.set('shop.owned', [...this.owned(), `${kind}:${id}`]);
    this.equip(kind, id);
    return true;
  },

  equip(kind, id) {
    if (!this.owns(kind, id)) return;
    store.set(kind === 'rider' ? 'shop.rider' : 'shop.trail', id);
    emit();
  },

  /** Calls `fn` whenever coins or the equipped items change. */
  onChange(fn) { listeners.add(fn); },

  /**
   * The one-time gift that opens the shop. Returns the amount given (and credits it), or 0 when
   * it was given before. Decided from how far along the save already is.
   */
  giveStarterGift() {
    if (localStorage.getItem('shop.gift') !== null) return 0;
    const cleared = Math.max(store.int('levels.level', 1), store.int('big.level', 1)) - 1;
    const gift = Math.min(600, 150 + 10 * cleared);
    store.set('shop.gift', gift);
    this.add(gift);
    return gift;
  },
  get giftPending() { return localStorage.getItem('shop.gift') === null; },
};

/**
 * Coins for a cleared board in Levels, Daily or Big, as a list of [reason, amount] lines and the
 * total. `r` is what the game knows about the board just cleared.
 */
export function levelCoins({ stars, bestCombo, fevers, level, milestone, big, daily, newStars = 0, streak = 0, firstToday = false }) {
  const lines = [['clear', 20]];
  if (stars > 1) lines.push(['stars', 15 * (stars - 1)]);
  const combo = Math.min(20, bestCombo);
  if (combo > 0) lines.push(['combo', combo]);
  const fever = 5 * Math.min(4, fevers);
  if (fever) lines.push(['fever', fever]);
  if (!daily) {
    const depth = Math.min(15, 3 * Math.floor(level / 10));
    if (depth) lines.push(['depth', depth]);
    if (milestone) lines.push(['chest', 40]);
  } else {
    if (newStars) lines.push(['newStars', 15 * newStars]);
    if (firstToday) lines.push(['streak', 5 * Math.min(7, Math.max(1, streak))]);
  }
  let total = lines.reduce((a, [, n]) => a + n, 0);
  if (big) {
    const extra = Math.round(total * 0.5);
    lines.push(['big', extra]);
    total += extra;
  }
  return { lines, total };
}

/** Coins at the end of a Challenge game, won or lost. */
export function challengeCoins(score, won) {
  const lines = [['score', Math.floor(score / 100)]];
  if (won) lines.push(['clear', 25]);
  return { lines, total: lines.reduce((a, [, n]) => a + n, 0) };
}
