// The days of the year that bring something: festival gifts (a hat that waits to be opened from
// that day on, and never expires), decorations on the house for a few days around them, and notes.
// Her own dates (birthday, anniversary) are not here: they live in the encrypted notes bundle
// (notes.js), so the public site never carries them.
//
// `?date=YYYY-MM-DD` pretends it's that day, for testing, but only on a local dev host, and it is
// always stripped from the address at once: backup.js keeps other query params, and a Home Screen
// icon reopens the address it was added from, so a leftover ?date= would otherwise pin the date forever.

import { todayKey } from './levels.js';

/**
 * `gift` is 'hat:<id>'; `decor` is drawn on the house while the day is within `days` ([before,
 * after], default the day alone); `note` means a note from him may be waiting (notes.js).
 * 冬至 food is regional (饺子 in the north, 汤圆 in the south): the dumpling hat comes on 冬至 and
 * the tangyuan hat on 元宵, so both traditions get theirs. Swap them here if hers is the other way.
 */
export const FESTIVALS = [
  { d: '2026-10-31', id: 'halloween', gift: 'hat:witch', decor: 'pumpkin', days: [-3, 1] },
  { d: '2026-12-22', id: 'dongzhi', gift: 'hat:jiaozi', decor: 'steam' },
  { d: '2026-12-24', id: 'christmas', gift: 'hat:santa', decor: 'snow', days: [-4, 2] },
  { d: '2027-02-06', id: 'lny', gift: 'hat:goat', decor: 'lanterns', days: [-1, 14] }, // 除夕 is 02-05
  { d: '2027-02-14', id: 'valentine', note: true }, // 初九, inside the new-year fortnight: a note, not a second gift
  { d: '2027-02-20', id: 'lantern', gift: 'hat:tangyuan', decor: 'lanterns' }, // 元宵
  { d: '2027-05-20', id: '520', note: true },
  { d: '2027-06-09', id: 'duanwu' }, // greeting: 端午安康, not 快乐
  { d: '2027-08-08', id: 'qixi', note: true },
  { d: '2027-09-15', id: 'midautumn', decor: 'moon', days: [-1, 1] },
  { d: '2027-10-31', id: 'halloween27', gift: 'hat:pumpkin', decor: 'pumpkin', days: [-3, 1] },
];

const DEV = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
let override = null;
{
  const url = new URL(location.href);
  const q = url.searchParams.get('date');
  if (DEV && /^\d{4}-\d{2}-\d{2}$/.test(q ?? '')) override = q;
  if (url.searchParams.has('date')) {
    url.searchParams.delete('date');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
}

/** Today as YYYY-MM-DD (the dev override is never saved). */
export const today = () => override ?? todayKey();

/** `date` moved by `n` days. */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}

/** The festival that gives `gift` ('hat:witch'), if any. */
export const festivalFor = gift => FESTIVALS.find(f => f.gift === gift) ?? null;

/** The decoration the house wears on `date` (or null): the festival whose window it falls in. */
export function decorOn(date = today()) {
  for (const f of FESTIVALS) {
    if (!f.decor) continue;
    const [before, after] = f.days ?? [0, 0];
    if (date >= addDays(f.d, before) && date <= addDays(f.d, after)) return f.decor;
  }
  return null;
}
