// Dates for the gifts that arrive on a day (the witch hat on Halloween).
//
// `?date=YYYY-MM-DD` pretends it's that day, for testing, but only on a local dev host, and it is
// always stripped from the address at once: backup.js keeps other query params, and a Home Screen
// icon reopens the address it was added from, so a leftover ?date= would otherwise pin the date forever.

import { todayKey } from './levels.js';

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
