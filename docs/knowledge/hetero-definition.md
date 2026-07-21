<!-- last-verified: 2026-07-21 -->

## Hetero / heto = multi-LLM families (not multi-role)

**Date**: 2026-07-21 | **Context**: cookys correction after roadmap review  
**Problem**: Orchestrator treated "hetero review" as one agent with Architect/Ops/Skeptic hats.  
**Solution**: **hetero / heto / 異質 = 多家不同 LLM 引擎各自獨立審核** (e.g. Grok + Claude + Codex + historically Qwen/GLM/MiniMax). Multi-role single-model is **not** hetero.  
**Related**: `/ship` skill (global + assmud overlay); `docs/reviews/*`; never claim "hetero OK" with only one family.

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

Pinned in `~/.grok/skills/ship/SKILL.md` §1b and assmud `.grok/skills/ship/SKILL.md`.
