// A copy of her progress kept in the page address (?s=...), so losing the phone's storage never
// loses the game.
//
// Two ways storage goes missing, and both leave the address alone:
//  - Safari deletes a website's saved data after 7 days without a visit (Home Screen apps are
//    exempt). The tab it restores still has the address, so the game reads its progress back.
//  - A Home Screen icon gets storage of its own, starting empty. It opens at the address it was
//    added from, so the progress she had in Safari comes with it — the same way the photo key does.
//
// The copy is only ever read into empty storage: it can fill a gap, never overwrite a newer game.
//
// This module has no imports and must be the first thing main.js imports, so the progress is back
// in storage before any other module reads its settings from there.

const FORMAT = 1;
const PARAM = 's';
const MODE_KEYS = ['hints', 'shuffles', 'secondChanceUsed', 'score', 'level', 'board', 'boardTotal'];
const LEVEL_KEYS = ['boardFx', 'time', 'bestCombo'];
const KEYS = [
  ...MODE_KEYS, ...MODE_KEYS.map(k => 'levels.' + k),
  'best', 'wins', 'games', 'streak', 'bestStreak',
  'mode', 'sound', 'haptics', 'volume', 'chinese',
  // added later: new keys only ever go on the end, so an older link still reads back correctly
  ...MODE_KEYS.map(k => 'big.' + k),
  // v21: twists on the board, the clock, the daily board and the photo puzzle
  ...['', 'levels.', 'big.'].flatMap(p => LEVEL_KEYS.map(k => p + k)),
  ...MODE_KEYS.map(k => 'daily.' + k), ...LEVEL_KEYS.map(k => 'daily.' + k),
  'daily.date', 'daily.best', 'daily.streak', 'daily.last', 'daily.returnTo',
  'puzzle.photo', 'puzzle.pieces', 'puzzle.album', 'levels.intro', 'big.intro',
  'levels.since', 'big.since', 'puzzle.welcome',
  // v23: the shop, and what a board in progress has earned toward it
  'coins', 'coins.earned', 'shop.owned', 'shop.rider', 'shop.trail', 'shop.gift',
  ...['', 'levels.', 'big.', 'daily.'].map(p => p + 'fevers'), 'paidScore',
];
const isBoard = k => k === 'board' || k.endsWith('.board');

// A board is 140 kinds (204 on the Big board); as a JSON array it would be most of the address. One character per cell
// instead (0 = empty, then kind + 1), from the characters an address carries untouched.
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function packBoard(raw) {
  const kinds = JSON.parse(raw);
  if (!Array.isArray(kinds) || kinds.some(k => !Number.isInteger(k) || k + 1 >= ABC.length)) return null;
  return kinds.map(k => ABC[Math.max(0, k + 1)]).join('');
}

function unpackBoard(s) {
  if (typeof s !== 'string') return null;
  const kinds = [];
  for (const ch of s) {
    const i = ABC.indexOf(ch);
    if (i < 0) return null;
    kinds.push(i - 1);
  }
  return JSON.stringify(kinds);
}

const b64url = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function encode() {
  const out = [FORMAT];
  for (const k of KEYS) {
    let v = localStorage.getItem(k);
    if (v !== null && isBoard(k)) {
      try { v = packBoard(v); } catch { v = null; }
    }
    out.push(v);
  }
  // trailing missing values carry nothing
  while (out.length > 1 && out[out.length - 1] === null) out.pop();
  return b64url(JSON.stringify(out));
}

/** Puts the copy back into storage. Returns true when it did. */
function restore(param) {
  let list;
  try { list = JSON.parse(unb64url(param)); } catch { return false; }
  if (!Array.isArray(list) || list[0] !== FORMAT) return false;
  let any = false;
  KEYS.forEach((k, i) => {
    let v = list[i + 1];
    if (v === null || v === undefined) return;
    if (isBoard(k)) v = unpackBoard(v);
    if (typeof v !== 'string') return;
    try { localStorage.setItem(k, v); any = true; } catch {}
  });
  return any;
}

export let restoredFromLink = false;
export let persisted = null;

try {
  const param = new URLSearchParams(location.search).get(PARAM);
  const empty = KEYS.every(k => localStorage.getItem(k) === null);
  if (param && empty) restoredFromLink = restore(param);
} catch {}

// Ask the browser to treat this site's storage as something to keep. Safari only says yes to a
// Home Screen app, but asking costs nothing and other browsers honour it more readily.
try {
  const st = navigator.storage;
  if (st && st.persist) {
    st.persisted().then(already => (already ? true : st.persist())).then(v => { persisted = v; }, () => {});
  }
} catch {}

// ---------------------------------------------------------------- keeping the address current

let last = null;
let timer = 0;

function write() {
  clearTimeout(timer);
  timer = 0;
  try {
    // Storage emptied under a running page (site data cleared in Settings) must not wipe the one
    // copy left; the game's next save writes a real one.
    if (KEYS.every(k => localStorage.getItem(k) === null)) return;
    const value = encode();
    if (value === last) return;
    const url = new URL(location.href);
    url.searchParams.set(PARAM, value);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    last = value;
  } catch {
    // Safari refuses more than 100 address changes in a short window; the next save retries.
  }
}

/**
 * Called whenever something is saved. A clear saves several keys at once and she can clear a pair
 * every fraction of a second, so the address is written once things have been quiet for a moment
 * — well under Safari's limit — and straight away when the game goes to the background.
 */
export function changed() {
  if (!timer) timer = setTimeout(write, 1500);
}

addEventListener('pagehide', write);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') write(); });
changed();
