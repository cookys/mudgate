# ADR-003 — Player mode daemon vs site gateway (D1)

- **Status**: Accepted (docs spike S3.1 · 2026-07-22)
- **Deciders**: cookys / mudgate board
- **Extends**: ADR-002 remote-auth-proxy; plan `2026-07-22-t1-site-proxy-and-core-daemon.md`

## Context

mudgate today is **fat web + thin Node proxy** (site / self-host / localhost). Owner product split:

| Mode | Runner | Web role |
|------|--------|----------|
| **site mode** | MUD operator gateway | SPA connects to site WSS |
| **player mode** | Player VPS / home daemon | **display only**; execution on daemon |

Mud always sees the TCP hop that holds the upstream socket (gateway or player daemon), never the browser.

## Decision

1. **W0 (now)**: Keep Node **site gateway** as shipped S0–S2; fat web remains the default player UX.
2. **D1 (next architecture, not rewrite-now)**: Introduce a **player daemon** process for player mode:
   - Owns telnet/MCCP, scripts, vault secrets, session resume.
   - Speaks **Session Protocol v0** to thin web display (see `docs/design/session-protocol-v0.md`).
3. **G-daemon vs P-daemon**:
   - **G (site gateway)** = multi-tenant WSS→telnet, allowlist, shared site token, audit — **no** player vault, no cross-tenant scripts.
   - **P (player daemon)** = single-tenant (or few sessions for one operator), open dest policy with SSRF guards, local vault.
4. **Rust (R2)**: Optional later **only if** measured thresholds (CPU/memory/latency or multi-platform packaging) demand it. **Node is enough indefinitely** for G; P may share a binary later. No forced rewrite in S3.
5. **TinTin analogy**: P-daemon ≈ always-on session host; web ≈ mobile/desktop terminal UI that can disconnect without killing the mud hop (resume goal).

## Consequences

| Positive | Negative |
|----------|----------|
| Honest site vs player IP/auth story | Two products to document and test |
| Thin web for phone when P-daemon runs | Players must run/maintain daemon for true player-mode IP |
| Site gateway stays simple | Session Protocol must version carefully |

## Non-goals (this ADR)

- Implementing the daemon binary in this change set.
- Claiming E2E password privacy on cleartext telnet hops.
- Replacing site mode with player mode for RW-hosted sites.

## Implementation follow-ups

| ID | Work |
|----|------|
| S3.2 | Session Protocol v0 draft (done alongside this ADR) |
| S3.3 | Optional boundary diagram in design doc |
| Later | P-daemon MVP behind feature flag; thin web adapter |

## References

- `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md` §0, §4, §5 Phase S3  
- `docs/deploy/SITE-OPERATOR.md` (site mode)  
- `docs/design/session-protocol-v0.md`
