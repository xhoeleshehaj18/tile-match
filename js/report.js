// Bug reports. She taps 🐞, types a line, and the game attaches everything needed to
// understand what happened: where she was in the game, what she just did, the exact board,
// and anything that went wrong under the hood.
//
// Sending is best-effort by design. The report is always copied to her clipboard first (so a
// paste into a chat works even with no network at all), then posted to the relay. Anything
// that doesn't get through is queued and retried the next time the game is opened.

import { VERSION } from './version.js';

// The relay forwards the report to my email. Its key is public by design — it can only submit
// to my own form, and it accepts one plain-text message and nothing else. Empty = copy only.
const ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = 'dd69cd41-6228-4b36-b472-e9e79c21dc82';

const MAX_TEXT = 600;      // she only needs a sentence; the diagnostics carry the detail
const MAX_LOG = 60;        // recent actions kept in memory
const MAX_QUEUE = 8;       // unsent reports kept on the phone
const MIN_GAP = 15;        // seconds between sends
const MAX_PER_HOUR = 8;

const t0 = Date.now();
const log = [];
const errors = [];
const counts = { tap: 0, clear: 0, fail: 0, slide: 0, shuffle: 0, hint: 0 };

let frames = 0, fpsAt = 0, fps = 0, slowFrames = 0, lastTick = 0;

// If the game ever locks up she'll close it and reopen before telling me, so the evidence has
// to survive that: the log and any errors are written down whenever the game goes to the
// background, and the previous run is attached to the next report.
let previous = null;
try { previous = JSON.parse(localStorage.getItem('reportPrev')); } catch {}

function remember() {
  try {
    localStorage.setItem('reportPrev', JSON.stringify({
      at: Date.now(), v: VERSION, errors, counts, log: log.slice(-25),
      fps, slowFrames, quietFor: lastTick ? +(performance.now() / 1000 - lastTick).toFixed(1) : null,
    }));
  } catch {}
}
addEventListener('pagehide', remember);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') remember(); });

/** Called once per frame: a rough frame rate and a count of visibly dropped frames. */
export function tick(now, raw) {
  frames++;
  lastTick = now;
  if (raw > 0.05 && fpsAt > 0) slowFrames++;
  if (now - fpsAt >= 1) {
    if (fpsAt > 0) fps = Math.round(frames / (now - fpsAt));
    frames = 0;
    fpsAt = now;
  }
}

/** A short line in the action log, e.g. note('clear', '4,7 12'). Cheap enough for every tap. */
export function note(kind, detail = '') {
  if (kind in counts) counts[kind]++;
  const last = log[log.length - 1];
  if (last && last.kind === kind && last.detail === detail) {
    last.n++;
    last.at = Date.now();
    return;
  }
  log.push({ at: Date.now(), kind, detail, n: 1 });
  if (log.length > MAX_LOG) log.shift();
}

function pushError(msg) {
  const text = String(msg).replace(/\s+/g, ' ').slice(0, 160);
  const hit = errors.find(e => e.text === text);
  if (hit) { hit.n++; return; }
  if (errors.length < 8) errors.push({ text, n: 1, at: Date.now() });
}

/** An exception the game caught and kept running through (a thrown frame is the likely cause
 *  of anything that looks frozen), so it still reaches me. */
export function crash(e) {
  pushError(`${e && e.message ? e.message : e}${e && e.lineno ? ` :${e.lineno}` : ''}`);
}

addEventListener('error', e => {
  if (e.message) pushError(`${e.message} @${String(e.filename || '').split('/').pop()}:${e.lineno}`);
});
addEventListener('unhandledrejection', e => {
  const r = e.reason;
  pushError('promise: ' + (r && r.message ? r.message : r));
});

// ---------------------------------------------------------------- composing

const pad = (s, n) => String(s).padStart(n, ' ');

function deviceLine() {
  const dpr = window.devicePixelRatio || 1;
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const ua = navigator.userAgent;
  const os = (ua.match(/OS (\d+[_.]\d+)/) || [])[1];
  const bits = [
    `${screen.width}x${screen.height}@${dpr}`,
    `win ${innerWidth}x${innerHeight}`,
    standalone ? 'home-screen app' : 'browser tab',
  ];
  if (os) bits.push('iOS ' + os.replace('_', '.'));
  if (!navigator.onLine) bits.push('OFFLINE');
  if (navigator.deviceMemory) bits.push(navigator.deviceMemory + 'GB');
  // "it didn't update" is its own class of bug: say whether the cache is actually in charge
  if ('serviceWorker' in navigator) bits.push(navigator.serviceWorker.controller ? 'cached build' : 'no service worker');
  return bits.join(' · ');
}

/** The board as rows of two-character kind numbers, so I can rebuild it exactly. */
function boardBlock(d) {
  if (!d.board || !d.cols) return '(no board)';
  const out = [];
  for (let r = 0; r < d.rows; r++) {
    const row = [];
    for (let c = 0; c < d.cols; c++) {
      const k = d.board[r * d.cols + c];
      row.push(k < 0 ? '..' : pad(k, 2));
    }
    out.push('  ' + row.join(' '));
  }
  return out.join('\n');
}

function clean(text) {
  // plain text only: no control characters (except line breaks), and no angle brackets,
  // since the relay drops the message into an HTML email
  const printable = Array.from(text).filter(ch => {
    const c = ch.codePointAt(0);
    return c === 10 || (c >= 32 && c !== 127);
  });
  return printable.join('').replace(/[<>]/g, '').trim().slice(0, MAX_TEXT);
}

/** Builds the whole report. `d` is Game.diagnostics(). */
export function compose(text, tags, d) {
  const id = Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const secs = n => (n / 1000).toFixed(1);
  const lines = [];

  lines.push(`report #${id} · v${VERSION}`);
  lines.push('');
  lines.push(clean(text) || '(no message)');
  lines.push('');
  if (tags && tags.length) lines.push('tags: ' + tags.join(', '));
  lines.push(`sent: ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}Z` +
    ` (her time ${new Date(now).toTimeString().slice(0, 5)}, UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60})`);
  lines.push(`playing: ${secs(now - t0)}s this session`);
  lines.push('');

  if (d) {
    lines.push(`mode: ${d.mode}` + (d.mode === 'levels' ? ` · level ${d.level}` : ` · score ${d.score} · best ${d.best}`));
    lines.push(`tiles: ${d.tiles} of ${d.total} left · a move exists: ${d.hasMove}`);
    lines.push(`power-ups: ${d.hints} hints · ${d.shuffles} shuffles` + (d.secondChanceUsed ? ' · second chance used' : ''));
    lines.push(`state: busy=${d.busy} finishing=${d.finishing} pointer=${d.pointer} drag=${d.drag}` +
      ` selected=${d.selected} lit=${d.lit} tweens=${d.tweens} timers=${d.timers} drawn=${d.drawn} overlay=${d.overlay}`);
    lines.push(`sound: ${d.sound ? 'on' : 'off'} (audio ${d.audio}) · vibration: ${d.haptics ? 'on' : 'off'} · photos: ${d.photos}`);
  }
  const quiet = lastTick ? performance.now() / 1000 - lastTick : 0;
  lines.push(`speed: ~${fps} fps, ${slowFrames} dropped frames` +
    (quiet > 0.5 ? `, LAST FRAME ${quiet.toFixed(1)}s AGO` : ''));
  lines.push(`device: ${deviceLine()}`);
  lines.push(`totals: ${counts.tap} taps · ${counts.clear} clears · ${counts.slide} slides · ${counts.fail} bad drags · ${counts.shuffle} shuffles · ${counts.hint} hints`);
  lines.push('');

  if (errors.length) {
    lines.push('ERRORS:');
    for (const e of errors) lines.push(`  ${e.n > 1 ? `${e.n}x ` : ''}${e.text}`);
    lines.push('');
  }

  lines.push('what she did (oldest first, seconds before sending):');
  for (const e of log) {
    lines.push(`  -${pad(secs(now - e.at), 6)}  ${e.kind}${e.n > 1 ? ` x${e.n}` : ''}${e.detail ? ' ' + e.detail : ''}`);
  }
  if (!log.length) lines.push('  (nothing)');
  lines.push('');

  if (previous && now - previous.at < 24 * 3600e3 && (previous.errors.length || previous.log.length)) {
    const mins = Math.round((now - previous.at) / 60000);
    lines.push(`PREVIOUS RUN (closed ${mins} min ago, v${previous.v}, ~${previous.fps} fps` +
      (previous.quietFor > 1 ? `, had gone quiet for ${previous.quietFor}s` : '') + '):');
    for (const e of previous.errors) lines.push(`  ERROR ${e.n > 1 ? `${e.n}x ` : ''}${e.text}`);
    for (const e of previous.log) lines.push(`  ${e.kind}${e.n > 1 ? ` x${e.n}` : ''}${e.detail ? ' ' + e.detail : ''}`);
    lines.push('');
  }

  if (d) {
    lines.push(`board (${d.cols}x${d.rows}, .. = empty):`);
    lines.push(boardBlock(d));
  }

  return { id, body: lines.join('\n') };
}

// ---------------------------------------------------------------- sending

async function post(id, body) {
  if (!ACCESS_KEY) throw new Error('no relay configured');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: ACCESS_KEY,
        subject: `🐞 Tile Match #${id}`,
        from_name: 'Tile Match',
        message: body,
      }),
      signal: ctl.signal,
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error('relay said ' + res.status);
  } finally {
    clearTimeout(timer);
  }
}

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem('reports')) || []; } catch { return []; }
};
const writeQueue = q => {
  try { localStorage.setItem('reports', JSON.stringify(q.slice(-MAX_QUEUE))); } catch {}
};

function enqueue(id, body) {
  const q = readQueue();
  if (q.some(r => r.id === id)) return;
  q.push({ id, body, at: Date.now(), tries: 0 });
  writeQueue(q);
}

/** Retries anything still waiting. Quiet: failures just leave it queued for next time. */
export async function flush() {
  if (!ACCESS_KEY || !navigator.onLine) return;
  let q = readQueue();
  if (!q.length) return;
  for (const r of q.slice()) {
    try {
      await post(r.id, r.body);
      q = readQueue().filter(x => x.id !== r.id);
      writeQueue(q);
    } catch {
      const live = readQueue();
      const hit = live.find(x => x.id === r.id);
      if (hit) {
        hit.tries++;
        writeQueue(live.filter(x => x.tries < 25));
      }
      return; // network is down; stop hammering it
    }
  }
}

export const pending = () => readQueue().length;

/** True when she's sending too fast (a stuck finger on the button, or something odd). */
function rateLimited() {
  let sends = [];
  try { sends = JSON.parse(localStorage.getItem('reportSends')) || []; } catch {}
  const now = Date.now();
  sends = sends.filter(at => now - at < 3600e3);
  if (sends.length >= MAX_PER_HOUR) return true;
  if (sends.length && now - sends[sends.length - 1] < MIN_GAP * 1000) return true;
  sends.push(now);
  try { localStorage.setItem('reportSends', JSON.stringify(sends)); } catch {}
  return false;
}

/**
 * Sends a report. Copies it first (inside her tap, so the clipboard permission still holds),
 * then tries the relay.
 * Resolves to 'sent' | 'queued' | 'tooSoon' — 'queued' means it's safe on the phone and
 * she should paste it into a chat.
 */
export async function send(text, tags, d) {
  if (rateLimited()) return 'tooSoon';
  const { id, body } = compose(text, tags, d);
  let copied = false;
  try {
    await navigator.clipboard.writeText(body);
    copied = true;
  } catch {}
  try {
    await post(id, body);
    return 'sent';
  } catch {
    enqueue(id, body);
    return copied ? 'queued' : 'queuedNoCopy';
  }
}

/** The newest report's text, for the share sheet and the copy button. */
export function lastBody() {
  const q = readQueue();
  return q.length ? q[q.length - 1].body : '';
}
