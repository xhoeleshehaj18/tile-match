#!/usr/bin/env node
// Owner-only: encrypts his notes and her own dates into notes/notes.bin, with the same key as the
// photos (../.photo-key, from tools/photos.mjs). The plain file lives outside the published folder,
// in ../private/notes.json, and is never committed; the site only ever has the scrambled bundle,
// which the game opens with the key from the private link. Without the key, notes and her dates
// quietly switch off.
//
//   node tools/notes.mjs            (then publish)
//
// ../private/notes.json:
//   {
//     "dates": { "birthday": "2027-03-14", "anniversary": "2027-05-01" },   // the next one, YYYY-MM-DD
//     "notes": {
//       "halloween": { "en": "…", "zh": "…" },     // a gift's note: its reason (see below)
//       "level50": "Fifty levels! …",               // one language is fine too
//       "valentine": { "en": "…", "zh": "…" }      // a day with only a note (dates.js `note: true`)
//     }
//   }
// Note ids: a festival's id in js/dates.js (halloween, dongzhi, christmas, lny, valentine, lantern,
// 520, qixi, halloween27), welcome, birthday, anniversary, streak, level100, album, level25/50/75/125….

import { randomBytes, webcrypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = resolve(web, '..');
const source = resolve(process.argv[2] ?? join(home, 'private', 'notes.json'));
const keyFile = join(home, '.photo-key');

if (!existsSync(keyFile)) {
  console.error(`No key at ${keyFile}: run node tools/photos.mjs first (the notes use the photos' key).`);
  process.exit(1);
}
if (!existsSync(source)) {
  mkdirSync(dirname(source), { recursive: true });
  writeFileSync(source, JSON.stringify({ dates: {}, notes: {} }, null, 2) + '\n');
  console.log(`Created "${source}". Write the notes and dates there and run this again.`);
  process.exit(0);
}
const bundle = JSON.parse(readFileSync(source, 'utf8'));
for (const [k, d] of Object.entries(bundle.dates ?? {})) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`dates.${k}: "${d}" is not YYYY-MM-DD`);
}

const keyText = readFileSync(keyFile, 'utf8').trim();
const key = await webcrypto.subtle.importKey('raw', Buffer.from(keyText.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), 'AES-GCM', false, ['encrypt']);
const iv = randomBytes(12);
const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(JSON.stringify(bundle)));
mkdirSync(join(web, 'notes'), { recursive: true });
writeFileSync(join(web, 'notes', 'notes.bin'), Buffer.concat([iv, Buffer.from(ct)]));
console.log(`notes/notes.bin: ${Object.keys(bundle.notes ?? {}).length} note(s), ${Object.keys(bundle.dates ?? {}).length} date(s).`);
