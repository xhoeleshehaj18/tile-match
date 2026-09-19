#!/bin/sh
# Bumps the version everywhere it lives (js/version.js, version.json, sw.js cache name).
# Usage: tools/release.sh        -> prints the new version
set -e
cd "$(dirname "$0")/.."
old=$(sed -n 's/.*VERSION = \([0-9]*\);.*/\1/p' js/version.js)
new=$((old + 1))
sed -i '' "s/VERSION = $old;/VERSION = $new;/" js/version.js
printf '{"version":%s}\n' "$new" > version.json
sed -i '' "s/const CACHE = 'tile-match-v[0-9]*';/const CACHE = 'tile-match-v$new';/" sw.js
sed -i '' "s/const BUILD = [0-9]*;/const BUILD = $new;/" sw.js
echo "$new"
