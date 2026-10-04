#!/usr/bin/env bash
# Prepare only this repository's ignored site/ directory. No sudo or OS changes.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

for tool in node npm git; do
  command -v "$tool" >/dev/null || { echo "Missing $tool. See README.md step 2." >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Use Node.js 22 or newer (supported LTS recommended)."); process.exit(1); }'
if [[ -e site ]]; then
  echo 'site/ already exists; leaving it untouched. See docs/maintenance.md to update or recover.' >&2
  exit 1
fi
revision=$(tr -d '\r\n' < vdoninja-version.txt)
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid vdoninja-version.txt' >&2; exit 1; }

export npm_config_jobs=2
export UV_THREADPOOL_SIZE=2
export MAKEFLAGS=-j2
if [[ "${1:-}" != "--website-only" ]]; then
  npm ci --omit=dev
fi
git init --quiet site
git -C site remote add origin https://github.com/steveseguin/vdo.ninja.git
git -C site -c pack.threads=2 fetch --depth=1 origin "$revision"
git -C site checkout --detach FETCH_HEAD
node <<'NODE'
const fs = require('fs');
const file = 'site/index.html';
const html = fs.readFileSync(file, 'utf8');
const marker = '// session.customWSS = true;';
if (html.split(marker).length !== 2) {
  throw new Error('Expected one self-hosting configuration marker. Website left unchanged.');
}
fs.writeFileSync(file, html.replace(marker, [
  '// offline_deployment: local HTTPS signaling',
  'session.wss = "wss://" + window.location.host;',
  'session.customWSS = false;',
  'session.salt = "vdo.ninja";',
  'session.configuration = {};'
].join('\n')));
NODE
echo 'Website ready. Follow README.md to create certificates and start the server.'
