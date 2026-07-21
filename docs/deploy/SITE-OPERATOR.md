# Site mode — 站方 gateway 操作手冊

**site mode** = 站方 multi-WSS → telnet 閘道（玩家經瀏覽器連本站 mud）。  
**不是** player mode（玩家自跑 daemon）、也不是官方公共 proxy。

## 契約（誠實）

| 項 | 說明 |
|----|------|
| 密碼 | 站方 gateway **能見** 登入流（= 營運者本來就能處理登入） |
| mud 出口 IP | 常為 `127.0.0.1`（gateway 與 mud 同機） |
| 身份 S1 | **shared site token** + **per effective-client-IP** 限流；**不**假 per-player identity |
| Ban | mud ban peer IP **打不中** web 玩家；proxy ban effective IP 在 CDN 下可能是 edge — **勿當唯一 ban** |

## 最小 env

```bash
export ASSMUD_PROXY_MODE=remote-prod
export ASSMUD_SITE_MODE=1
export ASSMUD_AUTH_TOKEN="$(openssl rand -hex 24)"   # shared site token
export ASSMUD_ORIGIN_ALLOWLIST="https://mud.example.com"
# 僅本站 mud — 空 allowlist 會 startup exit(1)
export ASSMUD_ALLOWLIST="127.0.0.1:4000"
export ASSMUD_BIND_HOST=127.0.0.1
export PORT=7788
# 可選：Caddy 以 loopback TCP 連 proxy 時信任 client IP header
export ASSMUD_TRUSTED_HOP="127.0.0.1/32"
# 可選：結構化 audit 追加檔（預設 stderr JSON 行）
# export ASSMUD_AUDIT_LOG=/var/log/assmud/proxy-audit.jsonl
```

Fail-fast：

| 條件 | 結果 |
|------|------|
| `SITE_MODE=1` + 非 `remote-prod` | exit ≠ 0 |
| `SITE_MODE=1` + 空 `ASSMUD_ALLOWLIST` | exit ≠ 0 |
| `remote-prod` 無 token / origin | exit ≠ 0 |

## docker-compose 例（proxy + 可選 caddy）

```yaml
# 示意 — 站方自行接 mud 映像 / 本機 binary
services:
  assmud-proxy:
    image: node:22-bookworm-slim
    working_dir: /app
    volumes:
      - ../..:/app
    environment:
      ASSMUD_PROXY_MODE: remote-prod
      ASSMUD_SITE_MODE: "1"
      ASSMUD_AUTH_TOKEN: ${ASSMUD_AUTH_TOKEN}
      ASSMUD_ORIGIN_ALLOWLIST: https://mud.example.com
      ASSMUD_ALLOWLIST: "127.0.0.1:4000"
      ASSMUD_BIND_HOST: "0.0.0.0"   # 僅容器網；主機防火牆仍應擋公網直連
      ASSMUD_TRUSTED_HOP: "172.16.0.0/12"  # caddy 網段示意
      PORT: "7788"
    command: ["npx", "tsx", "apps/proxy/src/cli.ts"]
    # network_mode: host   # 若 mud 只聽 127.0.0.1 常需 host 或 sidecar
```

Caddy（TLS 終止 + 轉 `/ws`）應：

1. 設 `X-Real-IP`（或 CF 前的 `CF-Connecting-IP`）為**真實客戶端**  
2. **不要**把未剝離的客戶端可控 header 原樣轉給 proxy  
3. 僅 peer 在 `ASSMUD_TRUSTED_HOP` 時 proxy 才信 header；缺 header → **403**

## Token 輪替

1. 產生新 token：`openssl rand -hex 24`  
2. 更新 env / secret 管理，**滾動重啟** proxy  
3. 通知玩家更新 web 設定檔中的 token（shared site token）  
4. 舊 token 立即失效（單值，無 overlap 窗口除非你做雙 token — S1 不做）

## CDN / ban 注意

- effective IP 在 CDN 後可能是 **edge**，勿當作唯一 ban 維度  
- S1 無 SSO 時：關 token / 降 concurrent / 站方人工處理濫用  

## Web 設定

- `VITE_PROXY_WS=wss://mud.example.com/ws`  
- 玩家填 **shared site token**（與 `ASSMUD_AUTH_TOKEN` 相同）  
- UI 應使用 site mode 文案（本站 Web 閘道；禁止「站方也看不到密碼」）

## PROXY protocol v1（S2 · experimental）

```bash
# 預設 0 — 不寫前綴（byte-for-byte 無 PROXY）
export ASSMUD_PROXY_PROTOCOL=0

# 僅當 mud / tcp shim **支援** HAProxy PROXY v1 時再開：
export ASSMUD_PROXY_PROTOCOL=1
```

| 項 | 契約 |
|----|------|
| 何時寫 | allowlisted dest **TCP connect 成功之後**、任何 telnet 位元組**之前**；每連線一次 |
| 內容 | `PROXY TCP4 <effectiveClientAddr> <mudIp> <srcPort> <dstPort>\r\n` |
| 非 IPv4 client | `PROXY UNKNOWN\r\n` |
| RW / 未驗證 mud | **勿開** — 會把首行當垃圾字元；標 experimental |

## 驗證

```bash
# 空 allowlist 必須失敗
ASSMUD_PROXY_MODE=remote-prod ASSMUD_SITE_MODE=1 \
  ASSMUD_AUTH_TOKEN=x ASSMUD_ORIGIN_ALLOWLIST=https://x.example \
  npx tsx apps/proxy/src/cli.ts
# → exit 1, ASSMUD_ALLOWLIST required

# health
curl -s http://127.0.0.1:7788/health
# {"ok":true,"mode":"remote-prod","siteMode":true}
```

更多威脅模型：`docs/security/hosted-proxy-threat-model.md` § Site mode。
