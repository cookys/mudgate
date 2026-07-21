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
| Resource exhaustion | Per-user concurrency, connect rate, idle timeout; deploy runbook: global max connections |
| DNS rebinding | Resolve → validate IP → connect; deny if rebinding class; re-validate per connect |
| Insider / support tools | No default full-stream capture; explicit time-boxed consent only |
| Malicious trigger package | Declarative engine **cannot** read document cookies, `localStorage` secrets, or arbitrary `fetch` to exfiltrate session |

## Modes

| Mode | Audience | Auth | Destinations | Bind |
|------|----------|------|--------------|------|
| **Official / self-host prod** | Desktop + phone browsers | Required | Allowlist (or approved custom) | Public WSS |
| **Dev localhost** | Developers | Optional (token/dev header OK) | May skip public allowlist **only** for non-private destinations; **always** block private/metadata IPs | `127.0.0.1` |
| **User-run remote** | Power users | Their choice | Their policy | Their VPS |

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

## Explicit non-goals

- Guaranteeing E2E encryption when the target MUD is cleartext telnet.
- Expecting phone users to run a local proxy app.
- Browser/WASM raw TCP.
- Claiming phone UX equals desktop for dense map_d / power-user scripting (we improve mobile; we stay honest).
