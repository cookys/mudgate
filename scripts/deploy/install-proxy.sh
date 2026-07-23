#!/usr/bin/env bash
# mudgate self-host proxy installer (interactive).
# Pin chain: verify this script SHA-256 from release notes, then it pulls a digest-pinned image.
set -euo pipefail

INSTALLER_VERSION="${MUDGATE_INSTALLER_VERSION:-0.1.0-dev}"
# Override for real releases: MUDGATE_PROXY_IMAGE=ghcr.io/OWNER/mudgate-proxy@sha256:...
IMAGE="${MUDGATE_PROXY_IMAGE:-}"
ORIGIN="${MUDGATE_ORIGIN_ALLOWLIST:-}"
TOKEN_FILE="${MUDGATE_TOKEN_FILE:-/etc/mudgate/auth_token}"
COMPOSE_DIR="${MUDGATE_COMPOSE_DIR:-/opt/mudgate}"

echo "mudgate-proxy installer ${INSTALLER_VERSION}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if [[ -z "$IMAGE" ]]; then
  echo "Set MUDGATE_PROXY_IMAGE to a digest-pinned image, e.g.:" >&2
  echo "  export MUDGATE_PROXY_IMAGE=ghcr.io/OWNER/mudgate-proxy@sha256:…" >&2
  exit 1
fi

if ! [[ "$IMAGE" =~ @sha256:[0-9a-fA-F]{64}$ ]]; then
  echo "Refusing mutable tags — require image@sha256:<64 hex digest>." >&2
  exit 1
fi

if [[ -z "$ORIGIN" ]]; then
  echo "Set MUDGATE_ORIGIN_ALLOWLIST (comma-separated https origins). Empty is fail-closed." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker required" >&2
  exit 1
fi

mkdir -p "$(dirname "$TOKEN_FILE")" "$COMPOSE_DIR"
# MUST: do not leave token in shell history
set +o history 2>/dev/null || true
TOKEN="$(openssl rand -hex 24)"
umask 077
printf '%s' "$TOKEN" >"$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
chown root:root "$TOKEN_FILE" 2>/dev/null || true

cat >"$COMPOSE_DIR/.env" <<EOF
MUDGATE_PROXY_IMAGE=${IMAGE}
MUDGATE_AUTH_TOKEN=${TOKEN}
MUDGATE_ORIGIN_ALLOWLIST=${ORIGIN}
EOF
chmod 600 "$COMPOSE_DIR/.env"

# Minimal compose (loopback via host network)
cat >"$COMPOSE_DIR/docker-compose.yml" <<EOF
services:
  proxy:
    image: \${MUDGATE_PROXY_IMAGE}
    restart: unless-stopped
    env_file: .env
    environment:
      MUDGATE_PROXY_MODE: remote-prod
      MUDGATE_BIND_HOST: "127.0.0.1"
      PORT: "17788"
    network_mode: host
EOF

docker pull "$IMAGE"
(cd "$COMPOSE_DIR" && docker compose up -d)

echo ""
echo "=== INSTALL COMPLETE ==="
echo "Token (shown once — treat as password; do not paste in chat):"
echo "$TOKEN"
echo "Also stored 0600 at: $TOKEN_FILE"
echo "Retrieve later: sudo cat $TOKEN_FILE"
echo "Front with Caddy or cloudflared → 127.0.0.1:17788 (do not publish 17788)."
echo "Origin allowlist only limits browser Origin; it does not replace the token."
echo "Proxy operators can read cleartext MUD passwords — only run on machines you control."
