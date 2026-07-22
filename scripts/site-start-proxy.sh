#!/usr/bin/env sh
# Start mudgate-proxy using private Node if present; loads repo-root .env via cli.
set -e
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

if [ -x "$HOME/opt/node-20/bin/node" ]; then
  export PATH="$HOME/opt/node-20/bin:$PATH"
fi

if [ ! -f .env ]; then
  echo "missing .env — copy .env.site.example or .env.example to .env" >&2
  exit 1
fi

if [ ! -f apps/proxy/dist/cli.js ]; then
  echo "building protocol + proxy..."
  npm run build -w @mudgate/protocol
  npm run build -w @mudgate/proxy
fi

exec node apps/proxy/dist/cli.js
