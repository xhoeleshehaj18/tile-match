// The shop: coins earned by playing, and the riders, hats and trails they buy.
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
//
// Hats are for the animals (the girl keeps her cap). One bought hat can be worn by any of them, and
// each animal remembers its own. Some hats are never sold, only given: a welcome gift, and gifts that
// arrive on a day (from that day on they wait to be opened; they never expire). Hat prices:
//   beret 250, then the commons 300–380   ≈ 4–6 levels
//   strawberry 520 (我爱你), top hat 1314 (一生一世), tiger 888 (8 = 发): numbers chosen for her
//   legendary crown 2,000                 ≈ 31 levels, about a week
// Otherwise new prices keep away from the digit 4.

import { store } from './store.js';
import { today, festivalFor, FESTIVALS } from './dates.js';
import { personalDate, noteNow } from './notes.js';

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

/** Things on the house (it also dresses itself for the festivals, for free: see dates.js). */
export const DECOR_ITEMS = [
  { id: 'nodecor', price: 0 },
  { id: 'flowerbox', price: 300 },
  { id: 'lights', price: 500 },
  { id: 'mailbox', price: 600 }, // with a letter: tapping it opens a note from him
];

/** What flies out of a cleared pair (snowflakes in December and red paper at the new year are free). */
export const POP_ITEMS = [
  { id: 'pop-leaf', price: 0 }, // not 'petals' or 'hearts': those are trails, and names are keyed by id
  { id: 'pop-petal', price: 300 },
  { id: 'pop-heart', price: 380 },
  { id: 'pop-star', price: 600 },
];

/** How the tiles look. Every one keeps the emoji easy to read, and the lit tile stays yellow. */
export const TILE_ITEMS = [
  { id: 'tile-classic', price: 0 },
  { id: 'tile-cream', price: 500 },
  { id: 'tile-strawberry', price: 680 },
  { id: 'tile-jelly', price: 900 },
];

/** In the order the shop shows them: no hat, those for sale by price, then the gifts. */
export const HAT_ITEMS = [
  { id: 'nohat', price: 0 }, // not 'none': names in i18n.js are keyed by id alone, and trails have 'none'
  { id: 'beret', price: 250 },
  { id: 'flowers', price: 300 },
  { id: 'party', price: 330 },
  { id: 'straw', price: 360 },
  { id: 'chef', price: 380 },
  { id: 'strawberry', price: 520 },
  { id: 'duck', price: 600 },
  { id: 'propeller', price: 680 },
  { id: 'tiger', price: 888 },
  { id: 'tophat', price: 1314 },
  { id: 'crown', price: 2000, legendary: true },
  // gifts have no price (so never "free": price 0 would mean everyone owns them); dated ones come
  // from dates.js FESTIVALS, the birthday's from her encrypted dates (notes.js)
  { id: 'beanie', price: null, gift: 'welcome' },
  { id: 'witch', price: null, gift: 'halloween' },
  { id: 'jiaozi', price: null, gift: 'dongzhi' },
  { id: 'santa', price: null, gift: 'christmas' },
  { id: 'goat', price: null, gift: 'lny' },
  { id: 'tangyuan', price: null, gift: 'lantern' },
  { id: 'cake', price: null, gift: 'birthday' },
  { id: 'pumpkin', price: null, gift: 'halloween27' },
  // earned by playing, never bought (see ACHIEVEMENTS)
  { id: 'nightcap', price: null, earn: 'streak' },
  { id: 'gradcap', price: null, earn: 'level100' },
  { id: 'halo', price: null, earn: 'album' },
];

/** The hats the mystery gift (every 25th level) can bring: the commons, cheapest first. */
export const MYSTERY_HATS = ['beret', 'flowers', 'party', 'straw', 'chef'];
/** What the mystery gift brings once she has every one of them. */
export const MYSTERY_COINS = 300;

/** The animal a hat goes on when the rider is the girl and she has never ridden one: a try-on. */
export const TRY_ON = 'bunny';

/** Every kind of thing in the shop, in the order of its tabs. */
export const ITEMS = { rider: RIDER_ITEMS, hat: HAT_ITEMS, trail: TRAIL_ITEMS, decor: DECOR_ITEMS, pop: POP_ITEMS, tile: TILE_ITEMS };
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
  get trail() { return this.worn('trail'); },
  get decor() { return this.worn('decor'); },
  get pop() { return this.worn('pop'); },
  get tile() { return this.worn('tile'); },
  /** The `kind` in use: what she chose, if it's still hers, or the free one. */
  worn(kind) {
    const id = localStorage.getItem(`shop.${kind}`);
    return id && this.owns(kind, id) ? id : ITEMS[kind][0].id;
  },
  /** The hat on the rider in use ('nohat' for the girl, who keeps her cap). */
  get hat() { return this.hatOn(this.rider); },

  /** Which hat each animal wears, as she left it: { bunny: 'beanie', … }. */
  hats() { return store.json('shop.hats') ?? {}; },
  hatOn(animal) {
    const id = this.hats()[animal];
    return animal !== 'girl' && id && this.owns('hat', id) ? id : 'nohat';
  },
  /**
   * The animal the hats are shown on and go to: the rider in use, or when that's the girl, the
   * last animal she rode (or any she owns, for saves from before hats), or else a try-on bunny.
   * `owned` says whether it is really hers.
   */
  get model() {
    const last = localStorage.getItem('shop.lastAnimal');
    const any = RIDER_ITEMS.find(i => i.id !== 'girl' && this.owns('rider', i.id))?.id;
    const id = this.rider !== 'girl' ? this.rider : last && this.owns('rider', last) ? last : any ?? TRY_ON;
    return { id, owned: this.owns('rider', id) && id !== 'girl' };
  },
  /** What is equipped of `kind` (for hats, on the model animal). */
  current(kind) {
    if (kind === 'hat') return this.hatOn(this.model.id);
    return this[kind];
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

  /** Spends the coins and equips the item. Returns false when she can't afford it (or it's a gift). */
  buy(kind, id) {
    const item = this.item(kind, id);
    if (!item || item.gift || item.price == null || this.owns(kind, id) || this.coins < item.price) return false;
    store.set('coins', this.coins - item.price);
    store.set('shop.owned', [...this.owned(), `${kind}:${id}`]);
    this.equip(kind, id);
    return true;
  },

  /** Puts it on. A hat goes on the model animal, unless that's only the try-on (then it waits). */
  equip(kind, id) {
    if (!this.owns(kind, id)) return;
    if (kind === 'hat') {
      const { id: animal, owned } = this.model;
      if (owned) store.set('shop.hats', { ...this.hats(), [animal]: id });
    } else {
      store.set(`shop.${kind}`, id);
      if (kind === 'rider' && id !== 'girl') store.set('shop.lastAnimal', id);
    }
    emit();
  },

  // ------------------------------------------------ gifts

  claimed() { return store.json('shop.claimed') ?? []; },
  /** The day gift `item` arrives (YYYY-MM-DD), null for at once, or undefined when there's no day for it. */
  giftDate(item) {
    if (!item?.gift) return undefined;
    if (item.gift === 'welcome') return null;
    if (item.gift === 'birthday') return personalDate('birthday') ?? undefined;
    return festivalFor(`hat:${item.id}`)?.d;
  },
  /** The gift has arrived (its day has come). */
  giftOpen(item) {
    const d = this.giftDate(item);
    return d === null || (d !== undefined && today() >= d);
  },
  /** Shown in the shop's gift row: hers, ready to open, earned by playing, or the next one coming. */
  giftShown(item) {
    if (this.owns('hat', item.id) || item.earn || this.giftOpen(item)) return true;
    return item.id === this.nextGift()?.id;
  },
  /** The next dated gift still to come, for the teaser card. */
  nextGift() {
    return HAT_ITEMS.filter(i => this.giftDate(i) && !this.giftOpen(i))
      .sort((a, b) => (this.giftDate(a) < this.giftDate(b) ? -1 : 1))[0] ?? null;
  },
  /** Dated gift hats that have arrived and not been opened yet, oldest first. */
  pendingGifts() {
    const done = this.claimed();
    return HAT_ITEMS.filter(i => this.giftOpen(i) && !done.includes(i.gift));
  },
  /** Opens a gift: it's hers, and it goes straight on the model animal. */
  claim(item) {
    if (!this.giftOpen(item) || this.claimed().includes(item.gift)) return false;
    store.set('shop.claimed', [...this.claimed(), item.gift]);
    if (!this.owns('hat', item.id)) store.set('shop.owned', [...this.owned(), `hat:${item.id}`]);
    this.equip('hat', item.id);
    return true;
  },

  /**
   * Gives an item without coins (an achievement, the mystery gift) and queues its popup, which
   * shows the next time nothing else is on screen. Returns false when she has it already.
   */
  grant(kind, id, reason, noteId = null) {
    if (this.owns(kind, id)) return false;
    store.set('shop.owned', [...this.owned(), `${kind}:${id}`]);
    store.set('shop.queue', [...this.queue(), { kind, id, reason, noteId }]);
    emit();
    return true;
  },
  /** Coins as a gift (the mystery gift's fallback): unlike add(), not counted as earned. */
  gift(n, reason, noteId = null) {
    if (!(n > 0)) return;
    store.set('coins', this.coins + n);
    store.set('shop.queue', [...this.queue(), { kind: 'coins', n, reason, noteId }]);
    emit();
  },
  /** Gifts waiting for their popup, oldest first. */
  queue() { const q = store.json('shop.queue'); return Array.isArray(q) ? q : []; },
  /** The popup for the oldest queued gift is showing: it leaves the queue (a hat goes on). */
  unqueue() {
    const [first, ...rest] = this.queue();
    store.set('shop.queue', rest);
    if (first?.kind === 'hat') this.equip('hat', first.id);
    return first;
  },
  /**
   * Hats earned by playing, given the moment she qualifies (and on opening the game, for what she
   * did before they existed): a 7-day daily streak, level 100 cleared, the whole photo album.
   * Never taken back.
   */
  achievements({ streak = 0, cleared = 0, album = false }) {
    if (streak >= 7) this.grant('hat', 'nightcap', 'streak');
    if (cleared >= 100) this.grant('hat', 'gradcap', 'level100');
    if (album) this.grant('hat', 'halo', 'album');
  },
  /**
   * The mystery gift on every 25th level (level 100 brings the graduation cap instead): the cheapest
   * common hat she doesn't have yet, never a love-number hat, the tiger or the crown; once she has
   * them all, coins. Never random, and given once per level. Returns what it gave, or null.
   */
  mystery(level, mode) {
    if (level % 25 || level === 100) return null;
    const key = `${mode}:${level}`, given = store.json('shop.mystery') ?? [];
    if (given.includes(key)) return null;
    store.set('shop.mystery', [...given, key].slice(-24));
    const id = MYSTERY_HATS.find(h => !this.owns('hat', h));
    if (id) { this.grant('hat', id, 'mystery', `level${level}`); return id; }
    this.gift(MYSTERY_COINS, 'mystery', `level${level}`);
    return 'coins';
  },

  /**
   * Days that bring only a note from him (Valentine's, 520, 七夕, the anniversary) that have come,
   * have a note written for them, and haven't been read: their ids, oldest first.
   */
  pendingNotes() {
    const done = this.claimed(), now = today();
    const days = [...FESTIVALS.filter(f => f.note).map(f => [f.id, f.d]), ['anniversary', personalDate('anniversary')]];
    return days.filter(([id, d]) => d && now >= d && !done.includes(`note:${id}`) && noteNow(id)).map(([id]) => id);
  },
  /** A note has been read. */
  readNote(id) {
    if (!this.claimed().includes(`note:${id}`)) store.set('shop.claimed', [...this.claimed(), `note:${id}`]);
  },

  /** Something waits to be opened: the shop button wears a dot. */
  get giftWaiting() { return this.pendingGifts().length > 0 || this.queue().length > 0 || this.pendingNotes().length > 0; },

  // ------------------------------------------------ what's new

  /**
   * Everything she has seen in the shop, as 'kind:id'. A save from before this starts with every
   * rider and trail seen, so only the hats show as new.
   */
  seen() {
    const list = store.json('shop.seen');
    if (Array.isArray(list)) return list;
    const start = [...RIDER_ITEMS.map(i => `rider:${i.id}`), ...TRAIL_ITEMS.map(i => `trail:${i.id}`)];
    store.set('shop.seen', start);
    return start;
  },
  /** The ids of `kind` showing in the shop that she hasn't seen yet (new hats, a gift that arrived). */
  unseen(kind) {
    const seen = this.seen();
    return ITEMS[kind].filter(i => i.price !== 0 && !this.owns(kind, i.id) && (i.price != null || this.giftShown(i)) && !seen.includes(`${kind}:${i.id}`)).map(i => i.id);
  },
  get hasNew() { return Object.keys(ITEMS).some(k => this.unseen(k).length > 0); },
  /** She has looked at the `kind` tab: all of it counts as seen. */
  markSeen(kind) {
    const fresh = this.unseen(kind);
    if (!fresh.length) return;
    store.set('shop.seen', [...this.seen(), ...fresh.map(id => `${kind}:${id}`)]);
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
