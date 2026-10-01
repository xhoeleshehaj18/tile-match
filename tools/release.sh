#!/bin/sh
# Bumps the version everywhere it lives (js/version.js, version.json, sw.js cache name).
# Usage: tools/release.sh        -> prints the new version
set -e
cd "$(dirname "$0")/.."
old=$(sed -n 's/.*VERSION = \([0-9]*\);.*/\1/p' js/version.js)
new=$((old + 1))
# -i.bak then rm: the one in-place form both macOS and GNU sed accept
sed -i.bak "s/VERSION = $old;/VERSION = $new;/" js/version.js
printf '{"version":%s}\n' "$new" > version.json
sed -i.bak "s/const CACHE = 'tile-match-v[0-9]*';/const CACHE = 'tile-match-v$new';/" sw.js
sed -i.bak "s/const BUILD = [0-9]*;/const BUILD = $new;/" sw.js
rm -f js/version.js.bak sw.js.bak
echo "$new"
