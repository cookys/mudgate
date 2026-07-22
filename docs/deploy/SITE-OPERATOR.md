# Site mode — 站方 gateway 操作手冊

**site mode** = 站方 multi-WSS → telnet 閘道（玩家用瀏覽器連**本站** mud）。  
**不是** player mode（玩家自跑 proxy）、也不是開放任意 mud 的公共跳板。

Reference deployment: **https://mud.revivalworld.org/** (FreeBSD + nginx 443-only + Node 20 home install).

## 契約（誠實）

| 項 | 說明 |
|----|------|
| 密碼 | 站方 gateway **能見** 登入流（與桌面客端連站相同信任模型） |
| mud 出口 | 常為 `127.0.0.1`（gateway 與 mud 同機） |
| 身份 S1 | **shared site token** + **per effective-client-IP** 限流；**不**假 per-player SSO |
| 玩家 UI | **site shell**：無 T1/T3 信任模式、無手動填 token 欄（cookie 帶 token） |
| Ban | mud ban peer IP **打不中** web 玩家；proxy ban effective IP 在 CDN 下可能是 edge |

## 最小 env（repo 根 `.env`，gitignored）

```bash
# copy from .env.site.example
MUDGATE_PROXY_MODE=remote-prod
MUDGATE_SITE_MODE=1
MUDGATE_AUTH_TOKEN="$(openssl rand -hex 24)"
MUDGATE_ORIGIN_ALLOWLIST=https://mud.revivalworld.org
# RW driver ports on this host (telnet banner = 重生的世界 on all four)
MUDGATE_ALLOWLIST=127.0.0.1:4000,127.0.0.1:4001,127.0.0.1:5000,127.0.0.1:6000,mud.revivalworld.org:4000,mud.revivalworld.org:4001,mud.revivalworld.org:5000,mud.revivalworld.org:6000
MUDGATE_BIND_HOST=127.0.0.1
PORT=7788
MUDGATE_TRUSTED_HOP=127.0.0.1/32
# optional:
# MUDGATE_AUDIT_LOG=/home/…/var/log/mudgate-proxy-audit.jsonl
```

Fail-fast:

| 條件 | 結果 |
|------|------|
| `SITE_MODE=1` + 非 `remote-prod` | exit ≠ 0 |
| `SITE_MODE=1` + 空 `MUDGATE_ALLOWLIST` | exit ≠ 0 |
| `remote-prod` 無 token / origin | exit ≠ 0 |

Start (private Node 20 on FreeBSD cookys host):

```bash
export PATH="$HOME/opt/node-20/bin:$PATH"
cd ~/projects/mudgate
npm ci
npm run build -w @mudgate/protocol
npm run build -w @mudgate/proxy
# or: ./scripts/site-start-proxy.sh
nohup node apps/proxy/dist/cli.js >> ~/var/log/mudgate-proxy.log 2>&1 &
curl -sS http://127.0.0.1:7788/health
# {"ok":true,"mode":"remote-prod","siteMode":true}
```

`@reboot` helper example: `~/bin/mudgate-proxy-start.sh` (see host setup notes).

## SPA (site shell)

Build flags (baked into the bundle):

```bash
VITE_SITE_MODE=1 \
VITE_PROXY_WS=wss://mud.revivalworld.org/ws \
VITE_DEFAULT_LOCALE=zh-TW \
  npm run build -w @mudgate/web
```

Or one-shot from a laptop with SSH:

```bash
./deploy/site-deploy.sh
```

Effects of `VITE_SITE_MODE=1` / host `mud.revivalworld.org`:

- Trust mode radios **hidden** (no T1 self-host / T3 other server)
- Auth token input **hidden**
- WebSocket fixed to same-origin / `VITE_PROXY_WS`
- Profiles: RW ports on this host (not a multi-mud open relay UI)

Install static files e.g. `/usr/local/www/mudgate` (nginx `root`).

## Auth: HttpOnly session cookie

`remote-prod` still requires `MUDGATE_AUTH_TOKEN`. For the **official site SPA**, do **not** ask players to paste it.

1. Generate token once in `.env`.
2. On the host, materialize nginx include (never commit):

```bash
# TOKEN = value of MUDGATE_AUTH_TOKEN
echo "add_header Set-Cookie \"mudgate_session=${TOKEN}; Path=/; Secure; HttpOnly; SameSite=Strict\" always;" \
  | sudo tee /usr/local/etc/nginx/mudgate-session.inc
sudo chmod 640 /usr/local/etc/nginx/mudgate-session.inc
```

3. vhost `include mudgate-session.inc;` (see `deploy/nginx-mud.revivalworld.org.conf`).
4. Proxy `checkAuth` accepts `Cookie: mudgate_session=…` on the WSS upgrade (and optional Bearer).

### Token 輪替

1. `openssl rand -hex 24` → update `.env`  
2. Rewrite `mudgate-session.inc` with the new token  
3. Restart proxy + `nginx -s reload`  
4. Players need a **refresh** (new Set-Cookie). Old token dies immediately (single value; no dual-token window in S1).

## TLS (acme.sh, 443-only)

- Issue/renew ECC cert for `mud.revivalworld.org` (standalone needs free **:80** briefly; nginx can stay 443-only day-to-day).  
- Install paths: `/usr/local/etc/ssl/mudgate/{fullchain,privkey}.pem`  
- `acme.sh --install-cert … --reloadcmd "sudo nginx -t && sudo nginx -s reload"`  
- Cron: `acme.sh --cron`  
- Manual: `~/bin/renew-mud-cert.sh` (host-specific)

## nginx sketch

See [`deploy/nginx-mud.revivalworld.org.conf`](../../deploy/nginx-mud.revivalworld.org.conf):

- `listen 443 ssl http2` only (no default :80 welcome)
- `root` → SPA
- `location = /ws` → `http://127.0.0.1:7788` with Upgrade + `X-Real-IP` + Cookie
- `include mudgate-session.inc`

## PROXY protocol v1（S2 · experimental）

```bash
export MUDGATE_PROXY_PROTOCOL=0   # default — off
# export MUDGATE_PROXY_PROTOCOL=1  # only if mud supports HAProxy PROXY v1
```

RW / unverified muds: **leave off** (first line becomes garbage to the driver).

## 驗證

```bash
curl -sS http://127.0.0.1:7788/health
# {"ok":true,"mode":"remote-prod","siteMode":true}

curl -sS -o /dev/null -w '%{http_code}\n' https://mud.revivalworld.org/
# 200

# WSS upgrade + hello (cookie or token) → {"type":"ready",…}
```

Allowlist smoke: only listed `host:port` pairs accept `hello`; others → `host not on allowlist`.

## CDN / ban

- Prefer `X-Real-IP` from a **trusted** hop only (`MUDGATE_TRUSTED_HOP`)  
- Do not treat CDN edge IPs as the only ban key  
- S1 without SSO: rotate token, lower concurrency, human ops

## Related

- Threat model: `docs/security/hosted-proxy-threat-model.md`  
- Mode matrix: `docs/deploy/README.md`  
- Open-source publish: `docs/OPEN-SOURCE.md`
