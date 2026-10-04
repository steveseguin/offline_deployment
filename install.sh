#!/usr/bin/env bash
# Prepare only this repository's ignored site/ directory. No sudo or OS changes.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

for tool in node npm git openssl; do
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
npm ci --omit=dev
git init --quiet site
git -C site remote add origin https://github.com/steveseguin/vdo.ninja.git
git -C site -c pack.threads=2 fetch --depth=1 origin "$revision"
git -C site checkout --detach FETCH_HEAD
node scripts/configure-site.js site
echo 'Website ready. Next: node scripts/create-certificates.js YOUR_SERVER_IP'
echo 'Then follow README.md to start HTTPS and trust your root certificate.'
