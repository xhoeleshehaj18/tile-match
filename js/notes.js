// His notes for her and her own dates (birthday, anniversary), in notes/notes.bin: encrypted with
// the photos' key by tools/notes.mjs, so the public site never carries them. Without the key (or
// the file) everything here quietly says "nothing": no notes, no personal dates.

import { photos } from './photos.js';
import { isChinese } from './i18n.js';

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
}

let bundle = { dates: {}, notes: {} };

/** Resolves once the notes have been read (or found missing). */
export const notesLoaded = (async () => {
  await photos.loaded; // it puts the key from the private link into storage
  const k = localStorage.getItem('photoKey');
  if (!k || !crypto.subtle) return;
  const res = await fetch('notes/notes.bin', { cache: 'no-cache' });
  if (!res.ok) return;
  const buf = new Uint8Array(await res.arrayBuffer());
  const key = await crypto.subtle.importKey('raw', fromB64url(k), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
  const data = JSON.parse(new TextDecoder().decode(plain));
  bundle = { dates: data.dates ?? {}, notes: data.notes ?? {} };
})().catch(() => {});

/** Her date `id` ('birthday', 'anniversary') as YYYY-MM-DD, or null when it isn't known. */
export const personalDate = id => (/^\d{4}-\d{2}-\d{2}$/.test(bundle.dates[id] ?? '') ? bundle.dates[id] : null);

/** His note `id` in her language (or the one language it was written in), or null. */
export const noteNow = id => {
  const n = bundle.notes[id];
  if (!n) return null;
  if (typeof n === 'string') return n;
  return (isChinese() ? n.zh ?? n.en : n.en ?? n.zh) ?? null;
};
export const noteText = async id => { await notesLoaded; return noteNow(id); };
