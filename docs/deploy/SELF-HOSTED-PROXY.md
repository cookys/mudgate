# Self-hosted proxy — 一等公民（IP / 多開）

> 與 [`docs/plans/2026-07-21-cjk-cell-width-taiwanmud.md`](../plans/2026-07-21-cjk-cell-width-taiwanmud.md) §4 連動。

## 為什麼要自架

多數台灣中文 MUD 用 **來源 IP** 做連線數／多開限制。  
瀏覽器經 **共用 hosted proxy** 出口時，所有人變成 **同一個 IP** → 容易被踢或限連。

**TCP 來源 IP = 連到 MUD 的那台機器**。客端無法偽造。

| 部署 | MUD 看到的 IP | 多開風險 |
|------|---------------|----------|
| **本機 dev proxy** | 你的家用／公司出口 | 與 zMUD 相同（低，除非同 NAT 很多人） |
| **你自己的 VPS proxy** | 該 VPS IP | 僅你的帳號共用該 IP |
| **官方共用 hosted** | 單一／少數出口 | **高** — 熱門站易撞 |

## 建議

1. **預設心智**：自架／本機 proxy = **一等公民**；hosted = 便利層。  
2. Hosted 必須有 token、per-user 連線上限、目的地 allowlist（見 threat model / abuse plan）。  
3. **不要**用住宅代理池當預設解法。  
4. 站方白名單官方 proxy IP 只能 **放寬容量**，不能還原「每個瀏覽器真人」身分。  

## 信任分級（摘要）

| 模式 | 出口 IP | 文件 |
|------|---------|------|
| T0 本機 | 家用 ISP | 下方 localhost-dev |
| T1a VPS | VPS IP | [ORACLE-ALWAYS-FREE.md](./ORACLE-ALWAYS-FREE.md) |
| T1b 家用+CF Tunnel | 家用 ISP | [HOME-CLOUDFLARE-TUNNEL.md](./HOME-CLOUDFLARE-TUNNEL.md) |
| T2 官方 | 共用 | ToS；密碼會經過官方 |
| T3 自訂 wss | 未知 | **管理員可見密碼**；web 強制警告 |

**WSS 只保護瀏覽器↔proxy**，不是端到端藏 MUD 密碼。  
完整 plan：[`docs/plans/2026-07-21-selfhost-proxy-trust.md`](../plans/2026-07-21-selfhost-proxy-trust.md)。

## 本機（localhost-dev）

```bash
MUDGATE_PROXY_MODE=localhost-dev \
MUDGATE_BIND_HOST=0.0.0.0 \
MUDGATE_ORIGIN_ALLOWLIST="http://127.0.0.1:5173,http://localhost:5173" \
npm run dev:proxy

VITE_HOST=0.0.0.0 \
VITE_PROXY_WS="ws://127.0.0.1:7788/ws" \
npm run dev:web
```

出口 IP = 你跑 proxy 的機器 → 與桌面客戶端同模型。

## 自架 VPS（概要）

1. 在 VPS 跑 `@mudgate/proxy`（prod 模式 + auth + Origin allowlist）。  
2. 瀏覽器 `VITE_PROXY_WS=wss://your.domain/ws`。  
3. MUD 看到 **VPS IP**（只有你的使用者走這台時，多開=你的帳號策略）。  
4. 目的地仍受 allowlist／政策約束 — **不是** open relay。

## 與台灣泥巴列表

列表站多為 Big5 中文 MUD；**字寬**用 profile `charset=big5*` → cjk mode。  
**IP** 問題與編碼無關 — 同一套自架策略適用全表。
