#!/usr/bin/env bash
# Agent / ship pre-smoke gate — run BEFORE asking the user to manually verify.
# Exit 0 only when automated checks pass. Does not replace human smoke for
# "feels right" UX, but blocks obvious Runtime/bundle/serve failures.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_HOST="${MUDGATE_PRE_SMOKE_HOST:-127.0.0.1}"
WEB_PORT="${MUDGATE_PRE_SMOKE_WEB_PORT:-5173}"
PROXY_PORT="${MUDGATE_PRE_SMOKE_PROXY_PORT:-17788}"
FAIL=0

log() { printf 'pre-smoke: %s\n' "$*"; }
ok() { printf 'pre-smoke: OK  %s\n' "$*"; }
bad() { printf 'pre-smoke: FAIL %s\n' "$*"; FAIL=1; }

log "cwd=$ROOT"

# ── 1. tests ──────────────────────────────────────────────────────────
if npm test >/tmp/mudgate-pre-smoke-test.log 2>&1; then
  ok "npm test"
else
  bad "npm test (see /tmp/mudgate-pre-smoke-test.log)"
  tail -30 /tmp/mudgate-pre-smoke-test.log || true
fi

# ── 2. web build / tsc ────────────────────────────────────────────────
if npm run build -w @mudgate/web >/tmp/mudgate-pre-smoke-build.log 2>&1; then
  ok "web build"
else
  bad "web build (see /tmp/mudgate-pre-smoke-build.log)"
  tail -30 /tmp/mudgate-pre-smoke-build.log || true
fi

# ── 3. LAN servers up ─────────────────────────────────────────────────
if curl -sf "http://${WEB_HOST}:${WEB_PORT}/" -o /dev/null; then
  ok "web :${WEB_PORT}"
else
  bad "web not serving http://${WEB_HOST}:${WEB_PORT}/ — start dev:web"
fi

if curl -sf "http://${WEB_HOST}:${PROXY_PORT}/health" -o /tmp/mudgate-pre-smoke-health.json; then
  ok "proxy /health $(cat /tmp/mudgate-pre-smoke-health.json 2>/dev/null || true)"
else
  bad "proxy not healthy on :${PROXY_PORT}"
fi

# ── 4. Vite must serve CURRENT source (not stale HMR graph) ───────────
# Regression: ConnectGate referenced ProfileEditor after rename → runtime crash
# while disk was already fixed. Agent must curl the served module.
if curl -sf "http://${WEB_HOST}:${WEB_PORT}/src/components/ConnectGate.tsx" -o /tmp/mudgate-pre-smoke-cg.js; then
  if grep -q 'ProfileManager' /tmp/mudgate-pre-smoke-cg.js; then
    ok "ConnectGate serves ProfileManager"
  else
    bad "ConnectGate transform missing ProfileManager — restart Vite / clear .vite"
  fi
  # bare ProfileEditor identifier (not ProfileEditor.tsx path in ProfileManager)
  if grep -E 'ProfileEditor[^./a-zA-Z]' /tmp/mudgate-pre-smoke-cg.js | grep -v ProfileManager >/dev/null 2>&1; then
    # only fail if ConnectGate still constructs ProfileEditor without import
    if grep -q 'ProfileEditor,' /tmp/mudgate-pre-smoke-cg.js || grep -q 'jsxDEV(ProfileEditor' /tmp/mudgate-pre-smoke-cg.js; then
      bad "ConnectGate still references ProfileEditor component (stale Vite?)"
    else
      ok "ConnectGate no stale ProfileEditor JSX"
    fi
  else
    ok "ConnectGate no bare ProfileEditor"
  fi
else
  bad "cannot fetch ConnectGate.tsx from Vite"
fi

for path in \
  src/components/ProfileManager.tsx \
  src/components/VaultPanel.tsx \
  src/components/ProfileEditor.tsx
do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "http://${WEB_HOST}:${WEB_PORT}/${path}" || echo 000)
  if [[ "$code" == "200" ]]; then
    ok "HTTP 200 ${path}"
  else
    bad "HTTP ${code} ${path}"
  fi
done

# ── 5. disk ↔ serve: key imports exist ────────────────────────────────
if [[ -f apps/web/src/components/ProfileManager.tsx ]]; then
  ok "disk ProfileManager.tsx"
else
  bad "missing apps/web/src/components/ProfileManager.tsx"
fi

# ── summary ───────────────────────────────────────────────────────────
if [[ "$FAIL" -ne 0 ]]; then
  log "RESULT=FAIL — do NOT ask user to smoke until fixed"
  exit 1
fi
log "RESULT=PASS — agent self-check green; user smoke optional"
exit 0
