# Hetero — Plan review: Vault「記住解鎖」

**Plan**: [`docs/plans/2026-07-22-vault-remember-unlock.md`](../plans/2026-07-22-vault-remember-unlock.md)  
**Date**: 2026-07-22  
**Verdict**: **ALL_CLEAR** (owner full matrix R9)

## Owner heto matrix (pin 2026-07-22)

| Seat | Model | Invoke | R9 |
|------|-------|--------|-----|
| Codex | gpt-5.6-sol | `codex exec -m gpt-5.6-sol` | **APPROVED** MUST_FIX=[] |
| MiniMax | **MiniMax-M3** | `dispatch-anthropic-review.js --model MiniMax-M3` + `AUTOPILOT_ENDPOINT_MINIMAX_*` | **APPROVED** MUST_FIX=[] |
| GLM | GLM-5.2 | `qoderclicn -m GLM-5.2` | **APPROVED** MUST_FIX=[] |
| Qwen | Qwen3.8-Max-Preview | `qoderclicn -m Qwen3.8-Max-Preview` | **APPROVED** MUST_FIX=[] |
| Gemini | gemini-3.6-flash-high | `agy --model gemini-3.6-flash-high -p "…"` | **APPROVED** MUST_FIX=[] |
| Claude | opus-4.8 | `claude -p --model opus` | **FAIL/skip** — weekly limit until 2026-07-23 12:00 Asia/Taipei |

**Forbidden (enforced):** MiniMax-M2.7 substitute · `gemini` / `@google/gemini-cli` binary · silent seat drop.

## ALL_CLEAR criteria

| Check | Result |
|-------|--------|
| ≥2 families APPROVE* latest round | **yes** — **5/5 live seats** APPROVED (R9) |
| MUST_FIX latest (live seats) | **[]** all five |
| Missing seat | Claude **documented FAIL/skip** (not substituted) |
| NITS | deferred below — not folded (fold would force re-hetero) |
| Prior weak R7 | **superseded** — was codex+agy only |

## R9 artifacts

- `2026-07-22-vault-remember-unlock-r9-codex.out`
- `2026-07-22-vault-remember-unlock-r9-minimax-m3.out` (**M3**, not M2.7)
- `2026-07-22-vault-remember-unlock-r9-glm52.out`
- `2026-07-22-vault-remember-unlock-r9-qwen38.out`
- `2026-07-22-vault-remember-unlock-r9-gemini36.out`
- `2026-07-22-vault-remember-unlock-r9-claude-opus.out` (quota message only)

## R8 → fold → R9

| R8 seat | Verdict | Folded |
|---------|---------|--------|
| codex | CHANGES | `setRememberUnlock(false)`: restoreAllowed=0 first + independent best-effort |
| MiniMax-M3 | APPROVED | — |
| glm | CHANGES | `mintOpToken` getRandomValues fallback (no hard `randomUUID`) |
| qwen | APPROVED | — |
| gemini | APPROVED | — |
| claude | quota | skip |

Also folded from R8 nits (cheap, no new risk): probe id `__probe__`.

## Deferred NITS (impl, not plan re-loop)

| # | Source | Nit |
|---|--------|-----|
| D1 | R9 minimax/qwen | `mintOpToken` document full string equality for atomic delete; optional drop redundant `Date.now()` |
| D2 | R9 minimax | Probe cleanup: pick **only** `atomicDeleteIfOpToken` **or** id=`__probe__`, not both narratives |
| D3 | R9 glm | Guard `crypto` undefined before `getRandomValues` → explicit "no CSPRNG" |
| D4 | R9 glm | IDB open timeout/onblocked in design § not only risks |
| D5 | R9 qwen | Comment: Web Locks often secure-context; HTTP LAN = tab-local only |

## History (abbreviated)

| Round | Matrix | Result |
|-------|--------|--------|
| R1–R6 | partial / evolving | design folds (threat, durable restore, Web Lock, opToken, bodyStarted, best-effort lock) |
| R7 | codex+agy only | **weak** ALL_CLEAR — superseded |
| R8 | full owner matrix | CHANGES (codex+glm) → fold |
| **R9** | full owner matrix | **ALL_CLEAR** |

## Next

- Plan status → **approved** (owner-matrix)
- Impl P1–P5 only on owner `/ship` or explicit go
- Optional: re-seat Claude opus after quota reset (advisory; not blocking)
