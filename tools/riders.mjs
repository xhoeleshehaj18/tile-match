#!/usr/bin/env node
// Gives each painted rider sheet a name that changes when its picture does: riders/<id>.webp, as
// art-lab/bake.mjs writes it, becomes riders/<id>.<hash>.webp, and the names are written into
// js/painted.js (which loads them) and sw.js (which keeps them in a cache that survives updates, so
// a release never downloads a sheet again unless it really changed). Run it after every bake:
//
//   node tools/riders.mjs

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(web, 'riders');
const files = {};

// freshly baked sheets first, then the hashed ones already here
for (const f of readdirSync(dir).sort()) {
  const m = f.match(/^([a-z]+)\.webp$/);
  if (!m) continue;
  const hash = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex').slice(0, 8);
  const name = `${m[1]}.${hash}.webp`;
  for (const old of readdirSync(dir)) if (old !== name && new RegExp(`^${m[1]}\\.[0-9a-f]{8}\\.webp$`).test(old)) rmSync(join(dir, old));
  renameSync(join(dir, f), join(dir, name));
  console.log(`${f} -> ${name}`);
}
for (const f of readdirSync(dir).sort()) {
  const m = f.match(/^([a-z]+)\.[0-9a-f]{8}\.webp$/);
  if (m) files[m[1]] = f;
}

const q = v => `'${v}'`;
const line = `export const SHEETS = { ${Object.entries(files).map(([id, f]) => `${id}: ${q(f)}`).join(', ')} };`;
const swLine = `const RIDER_FILES = [${Object.values(files).map(f => q(`riders/${f}`)).join(', ')}];`;
const patch = (file, re, text) => {
  const path = join(web, file);
  const src = readFileSync(path, 'utf8');
  if (!re.test(src)) throw new Error(`${file}: no line to replace`);
  writeFileSync(path, src.replace(re, text));
};
patch('js/painted.js', /^export const SHEETS = .*;$/m, line);
patch('sw.js', /^const RIDER_FILES = .*;$/m, swLine);
console.log(`${Object.keys(files).length} sheets named in js/painted.js and sw.js`);
