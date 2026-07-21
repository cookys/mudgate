# Hetero plan review — Round 1 (2026-07-21)

**Artifact**: `docs/reviews/2026-07-21-plan-pack-r6.md` (R6 docs pack)  
**Brief**: `docs/reviews/2026-07-21-plan-review-brief.md`

| Engine | Channel | Verdict |
|--------|---------|---------|
| MiniMax-M3 | `dispatch-review` anthropic-compatible `@minimax` | **FIX-THEN-SHIP** |
| GLM-5.2 | `dispatch-review` anthropic-compatible `@glm` | **SHIP-AS-IS** (findings: none — weak signal) |
| Qwen3.8-Max-Preview | `qoderclicn -p` | **FIX-THEN-SHIP** |

**Aggregation** (union-on-actionable findings; GLM empty does not veto): **FIX-THEN-SHIP → fold into R7**.

## Must-fix (ordered, from MiniMax ∪ Qwen)

1. Pin auth/session mechanism (cookie vs token, WS handshake, ≥30 min refresh, SameSite).
2. Threat model: Origin validation + CSRF-via-WebSocket.
3. Phase 1a MCCP2 posture: **DONT MCCP2** until Phase 3 optional DO+inflate.
4. Big5 vs Big5-HKSCS: prefer **Big5-HKSCS superset** as codec default for RW.
5. Phase 1b: synthetic **dual-color / mid-DBCS SGR** fixture (not only full map frame).
6. Reconnect acceptance owner (Phase 1a or 1b).
7. OPEN-SOURCE: RWlib-derived fixture licensing (clean-room preferred).
8. Clarify Phase 1a is **partial** terminal (Big5+SGR); full VT gate is **1b** — no conflict with §2.5.
9. XSS sanitizer milestone bound to a phase.
10. Dev localhost: still block private IPs; allowlist may be relaxed only for public MUD hosts.
11. Fix `apps/proxy` wording (not “localhost default” as product).
12. Declarative scripts: no ambient fetch of cookies/credentials.

## Raw outputs

- `docs/reviews/round1-minimax.json.raw`
- `docs/reviews/round1-glm.json.raw`
- `docs/reviews/round1-qwen.out`
