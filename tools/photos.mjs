#!/usr/bin/env node
// Owner-only: turns the photos in "Game for gf/Our Photos" into encrypted files in web/photos/.
// The originals and the key never leave this Mac; the site only ever contains scrambled .bin files,
// which the game can unlock only with the key from the private link.
//
//   node tools/photos.mjs            (then publish, e.g. git add -A && git commit && git push)

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = resolve(web, '..');
const source = resolve(process.argv[2] ?? join(home, 'Our Photos'));
const keyFile = join(home, '.photo-key');
const out = join(web, 'photos');

const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

if (!existsSync(keyFile)) writeFileSync(keyFile, b64url(randomBytes(32)) + '\n', { mode: 0o600 });
const keyText = readFileSync(keyFile, 'utf8').trim();
const keyBytes = Buffer.from(keyText.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const key = await webcrypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);

if (!existsSync(source)) {
  mkdirSync(source, { recursive: true });
  console.log(`Created "${source}". Put your photos there and run this again.`);
  process.exit(0);
}
mkdirSync(out, { recursive: true });

const exts = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tif', '.tiff']);
const files = readdirSync(source).filter(f => exts.has(extname(f).toLowerCase())).sort();
const tmp = join(tmpdir(), `tm-photos-${process.pid}.jpg`);
const clean = join(tmpdir(), `tm-photos-${process.pid}-clean.jpg`);
const entries = [];
const keep = new Set(['index.json']);

for (const f of files) {
  const src = join(source, f);
  // stable name per photo+key, so re-running only touches new photos
  const name = createHash('sha256').update(readFileSync(src)).update(keyText).digest('hex').slice(0, 20) + '.bin';
  keep.add(name);
  entries.push({ f: name, t: 'image/jpeg' });
  if (existsSync(join(out, name))) continue;
  // convert to JPEG first (also handles HEIC photos from iPhones)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', src, '--out', tmp], { stdio: 'ignore' });
  // strip hidden metadata (GPS location, camera, dates) so nothing but the picture is shared
  execFileSync('python3', [join(web, 'tools', 'clean_photo.py'), tmp, clean], { stdio: 'inherit' });
  const iv = randomBytes(12);
  const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, readFileSync(clean));
  writeFileSync(join(out, name), Buffer.concat([iv, Buffer.from(ct)]));
  console.log(`+ ${f}`);
}
rmSync(tmp, { force: true });
rmSync(clean, { force: true });

for (const f of readdirSync(out)) {
  if (!keep.has(f)) { rmSync(join(out, f)); console.log(`- removed ${f}`); }
}
writeFileSync(join(out, 'index.json'), JSON.stringify({ photos: entries }) + '\n');

let site = '';
try {
  const remote = execFileSync('git', ['-C', web, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (m) site = `https://${m[1].toLowerCase()}.github.io/${m[2]}/`;
} catch {}
console.log(`\n${entries.length} photo(s) ready.`);
console.log(`Private link (send this to her; it contains the key):\n  ${site || '<site url>/'}?k=${keyText}`);
