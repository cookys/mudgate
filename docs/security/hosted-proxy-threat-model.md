# Hosted proxy threat model

> Product path: **browser (desktop or phone) → authenticated WSS → official/self-hosted proxy → TCP MUD**.  
> Localhost proxy is **dev / advanced desktop** only — not how phone users connect.

## Assets

| Asset | Why it matters |
|-------|----------------|
| User account identity | Attribution, ban, abuse response |
| Session tokens | Hijack = play as user |
| Egress TCP from proxy IP | Open-relay / scanning / legal exposure |
| Game passwords on mud hop | Often cleartext telnet — must not log |
| Audit metadata | Who connected where/when |

## Threats → controls

| Threat | Control (required for official host) |
|--------|--------------------------------------|
| Anonymous open-relay | **Auth required** before any upstream TCP |
| Port scan / attack third parties | **Destination allowlist** (v1) or request+approve; rate limits; fail-closed |
| SSRF (localhost, metadata, RFC1918) | Block private/link-local/metadata IPs; re-check after DNS on **every** new upstream connect |
| Credential logging | **Never** log telnet payloads by default; metadata-only audit |
| Session theft | Short-lived tokens; **httpOnly + Secure + SameSite=Strict** session cookie (or equivalent); revoke on logout |
| Cross-site WebSocket hijack | Validate **`Origin`** (and Host) on WSS upgrade against allowlist; reject missing/mismatched Origin in prod |
| Resource exhaustion | Per-IP/token concurrency + upgrade/hello rate limits (`apps/proxy/src/limits.ts`); MCCP inflate caps; deploy runbook |
| DNS rebinding | Resolve → validate IP → connect; deny if rebinding class; re-validate per connect |
| Insider / support tools | No default full-stream capture; explicit time-boxed consent only |
| Malicious trigger package | Declarative engine **cannot** read document cookies, `localStorage` secrets, or arbitrary `fetch` to exfiltrate session |

## Modes

| Mode | Audience | Auth | Destinations | Bind |
|------|----------|------|--------------|------|
| **Official / self-host prod** | Desktop + phone browsers | Required | Allowlist (or approved custom) | Public WSS |
| **Site mode (T1-site)** | MUD 站方 gateway；多玩家共用 | **Shared site token**（非 per-player） | **僅** `MUDGATE_ALLOWLIST`；空則 startup fail | 建議 loopback + reverse-proxy |
| **Dev localhost** | Developers | Optional (token/dev header OK) | May skip public allowlist **only** for non-private destinations; **always** block private/metadata IPs | `127.0.0.1` |
| **User-run remote / player mode** | Power users（自跑 daemon） | Their choice | Their policy | Their VPS |

### Site mode（T1-site）threat notes

| Threat | Control |
|--------|---------|
| 誤開 open relay | `MUDGATE_SITE_MODE=1` 要求 `remote-prod` + **非空** allowlist；hello dest ∉ list → 拒 |
| 站方見密碼 | **接受**（= 遊戲營運）；文件禁止「E2E 站方也看不到」 |
| mud 只見 127.0.0.1 | 預期；限流／audit 用 **effectiveClientAddr**（trusted hop + CF/X-Real-IP，**不解析 XFF**） |
| 偽造 X-Real-IP | peer 不在 `MUDGATE_TRUSTED_HOP` → 忽略 header；trusted 缺 header → **403** |
| CDN edge ban | effective IP 可能是 edge — **禁止**當唯一 ban；S1 無 SSO 時只能關 token／降 concurrent／人工 |
| Audit 洩密 | JSON 行：token **HMAC 截斷**、addr、dest、ok/fail；**禁** payload／密碼／完整 token |

### Auth / session (pinned for Phase 1a)

| Decision | Choice (v1) |
|----------|-------------|
| Browser session | **HTTP-only Secure cookie** after login (magic-link or OAuth TBD in impl) |
| WSS auth | Cookie sent on same-site upgrade **or** short-lived ticket in first WS control frame (pick one in impl; document in proxy README) |
| Duration | Access session ≥30 min with sliding idle refresh; hard logout revoke |
| CSRF / WS | Origin allowlist + SameSite=Strict; no third-party embedding of authenticated WSS without explicit allow |

## Minimum ship checklist (official)

1. Unauthenticated WSS cannot open TCP.
2. Automated denies: `127.0.0.1`, `10/8`, `169.254.169.254`, non-allowlisted host.
3. Concurrent session limits enforced.
4. Audit log has user_id + dest + timestamps + byte counts — **no password strings** in samples.
5. TLS (WSS) only on public endpoints.
6. ToS + kill-switch (ban user_id / revoke sessions).

## Self-host / malicious proxy

| Threat | Control |
|--------|---------|
| Stranger-operated `wss://` steals MUD passwords | Product trust UI (T3 hell warning); no public node directory |
| Self-host publish 7788 open | Default bind **127.0.0.1**; TLS/tunnel only on 443 |
| Token in URL/logs | remote-prod: Bearer/cookie only; install writes **0600** file |
| Empty Origin allowlist | remote-prod **fail-closed** |
| Cloudflare Tunnel misuse | Ingress only; Access no world Bypass; egress remains home/VPS IP |

**WSS ≠ E2E password privacy.** Cleartext telnet to MUD is always visible to the process that holds the upstream TCP socket.

## Explicit non-goals

- Guaranteeing E2E encryption when the target MUD is cleartext telnet.
- Expecting phone users to run a local proxy app.
- Browser/WASM raw TCP.
- Claiming phone UX equals desktop for dense map_d / power-user scripting (we improve mobile; we stay honest).
