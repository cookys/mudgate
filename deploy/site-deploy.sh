#!/usr/bin/env sh
# Deploy mudgate SPA + refresh nginx/acme install paths on mud host.
# Usage (from laptop with ssh cookys@mud.revivalworld.org):
#   ./deploy/site-deploy.sh
#   HOST=cookys@mud.revivalworld.org ./deploy/site-deploy.sh
set -e
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"
HOST=${HOST:-cookys@mud.revivalworld.org}
VITE_PROXY_WS=${VITE_PROXY_WS:-wss://mud.revivalworld.org/ws}
VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE:-zh-TW}
VITE_SITE_MODE=${VITE_SITE_MODE:-1}

echo "==> build web (VITE_SITE_MODE=$VITE_SITE_MODE VITE_PROXY_WS=$VITE_PROXY_WS)"
export VITE_PROXY_WS VITE_DEFAULT_LOCALE VITE_SITE_MODE
npm run build -w @mudgate/web

echo "==> rsync dist + nginx conf → $HOST"
rsync -az --delete apps/web/dist/ "$HOST:tmp/mudgate-www/"
rsync -az deploy/nginx-mud.revivalworld.org.conf "$HOST:tmp/mudgate-nginx.conf"

echo "==> remote install"
ssh -o BatchMode=yes "$HOST" /bin/sh <<'REMOTE'
set -e
sudo mkdir -p /usr/local/www/mudgate /usr/local/etc/ssl/mudgate
sudo rsync -a --delete "$HOME/tmp/mudgate-www/" /usr/local/www/mudgate/
sudo chown -R www:www /usr/local/www/mudgate
sudo find /usr/local/www/mudgate -type d -exec chmod 755 {} \;
sudo find /usr/local/www/mudgate -type f -exec chmod 644 {} \;

sudo cp "$HOME/tmp/mudgate-nginx.conf" /usr/local/etc/nginx/mudgate.conf
if ! grep -q 'include mudgate.conf' /usr/local/etc/nginx/nginx.conf; then
  echo "WARN: nginx.conf missing include mudgate.conf — add manually" >&2
fi
sudo nginx -t
sudo nginx -s reload

# re-assert acme install paths (idempotent)
if [ -x "$HOME/.acme.sh/acme.sh" ]; then
  sudo chown -R cookys:wheel /usr/local/etc/ssl/mudgate 2>/dev/null || true
  "$HOME/.acme.sh/acme.sh" --install-cert -d mud.revivalworld.org --ecc \
    --fullchain-file /usr/local/etc/ssl/mudgate/fullchain.pem \
    --key-file /usr/local/etc/ssl/mudgate/privkey.pem \
    --reloadcmd "sudo /usr/local/sbin/nginx -t && sudo /usr/local/sbin/nginx -s reload" \
    >/dev/null
  chmod 640 /usr/local/etc/ssl/mudgate/privkey.pem 2>/dev/null || true
  chmod 644 /usr/local/etc/ssl/mudgate/fullchain.pem 2>/dev/null || true
fi

curl -sS -m 3 http://127.0.0.1:7788/health || echo "proxy health fail"
echo
curl -sS -m 5 -o /dev/null -w "https:%{http_code}\n" https://mud.revivalworld.org/
REMOTE

echo "==> done"
