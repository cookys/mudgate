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
| SSRF (localhost, metadata, RFC1918) | Block private/link-local/metadata IPs; re-check after DNS |
| Credential logging | **Never** log telnet payloads by default; metadata-only audit |
| Session theft | Short-lived tokens, HTTPS-only cookies, revoke on logout |
| Resource exhaustion | Per-user concurrency, connect rate, idle timeout |
| DNS rebinding | Resolve → validate IP → connect; deny if rebinding class |
| Insider / support tools | No default full-stream capture; explicit time-boxed consent only |

## Modes

| Mode | Audience | Auth | Destinations | Bind |
|------|----------|------|--------------|------|
| **Official / self-host prod** | Desktop + phone browsers | Required | Allowlist (or approved custom) | Public WSS |
| **Dev localhost** | Developers | Optional | Public MUDs; still block private IPs | `127.0.0.1` |
| **User-run remote** | Power users | Their choice | Their policy | Their VPS |

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
