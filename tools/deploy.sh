#!/bin/sh
# Build and publish dist/ to the gh-pages branch (GitHub Pages source).
set -e
cd "$(dirname "$0")/.."
node tools/build.mjs
touch dist/.nojekyll
TMP=$(mktemp -d); cp -r dist/. "$TMP"
cd "$TMP" && git init -q -b gh-pages && git add -A && git -c user.name="Rx Pharmwu" -c user.email="rx@users.noreply.github.com" commit -qm "Deploy $(date +%F_%T)"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
