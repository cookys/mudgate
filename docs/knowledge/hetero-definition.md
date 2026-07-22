<!-- last-verified: 2026-07-22 -->

## Hetero / heto = multi-LLM families (not multi-role)

**Date**: 2026-07-21 | **Context**: cookys correction after roadmap review  
**Problem**: Orchestrator treated "hetero review" as one agent with Architect/Ops/Skeptic hats.  
**Solution**: **hetero / heto / 異質 = 多家不同 LLM 引擎各自獨立審核**. Multi-role single-model is **not** hetero.  
**Related**: `/ship` skill (global + mudgate overlay); `docs/reviews/*`; never claim "hetero OK" with only one family.

## mudgate heto engine matrix（owner pin 2026-07-22）

| Seat | Model id | Invoke |
|------|----------|--------|
| Codex | `gpt-5.6-sol` | `codex exec -m gpt-5.6-sol` |
| MiniMax | **`MiniMax-M3`**（**minimax 3**） | MiniMax-M3 path（direct API / configured harness）— **never M2.7** |
| GLM | `GLM-5.2` | `qoderclicn -m GLM-5.2` |
| Qwen | `Qwen3.8-Max` / `Qwen3.8-Max-Preview` | `qoderclicn -m Qwen3.8-Max-Preview` |
| Gemini | `gemini-3.6-flash-high` | `agy --model gemini-3.6-flash-high -p "…"`（**not** gemini-cli） |
| Claude | `opus-4.8` | `claude -p` with opus-4.8 |

**Do not:**

- Substitute MiniMax-**M2.7** for minimax 3（user catch 2026-07-22）  
- Invoke Google via `@google/gemini-cli` / `gemini` binary — use **agy**  
- Claim ALL_CLEAR with silent seat drop; missing seat = documented FAIL/skip

## Failed attempt
- Single `autopilot:reviewer` multi-role pass labeled as hetero — rejected by user.

## Fold → re-review until ALL_CLEAR (2026-07-21)

**Problem**: After fold of MUST_FIX/nits, orchestrator stamped plan APPROVED without re-running hetero (selfhost-proxy-trust R2→nits).  
**Solution**:

```
hetero → fold MUST_FIX/adopted NITS into plan/code → hetero again
直到 ALL_CLEAR
```

| Term | Meaning |
|------|---------|
| **fold** | Write findings into plan/code on disk (not chat-only) |
| **ALL_CLEAR** | ≥2 families APPROVE*; no BLOCK; MUST_FIX []; NITS [] or explicitly deferred |
| **Forbidden** | Fold then APPROVED/expand/ship without a new multi-family round |

Pinned in `~/.grok/skills/ship/SKILL.md` §1b and mudgate `.grok/skills/ship/SKILL.md`.
