#!/usr/bin/env bash
# Lightweight secret scan — blocking for CI. Prefer gitleaks when available.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . --no-git -v
  exit $?
fi

# Fallback: ripgrep-style patterns on tracked-ish paths (no node_modules)
PATTERN='(AKIA[0-9A-Z]{16}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----|api[_-]?key\s*[:=]\s*['\''"][^'\''"]{16,}|MUDGATE_AUTH_TOKEN\s*=\s*["'\''][a-f0-9]{20,})'
if command -v rg >/dev/null 2>&1; then
  # Scan tracked sources; still skip node_modules / .git / lockfile
  if rg -n --hidden -g '!node_modules' -g '!.git' -g '!package-lock.json' "$PATTERN" . ; then
    echo "secret-scan: potential secrets found (see matches above)" >&2
    exit 1
  fi
else
  if grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude='*.out' --exclude='package-lock.json' "$PATTERN" . 2>/dev/null; then
    echo "secret-scan: potential secrets found" >&2
    exit 1
  fi
fi
echo "secret-scan: ok (fallback patterns; install gitleaks for full coverage)"
