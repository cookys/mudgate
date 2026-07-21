<!-- last-verified: 2026-07-21 -->

## Hetero / heto = multi-LLM families (not multi-role)

**Date**: 2026-07-21 | **Context**: cookys correction after roadmap review  
**Problem**: Orchestrator treated "hetero review" as one agent with Architect/Ops/Skeptic hats.  
**Solution**: **hetero / heto / 異質 = 多家不同 LLM 引擎各自獨立審核** (e.g. Grok + Claude + Codex + historically Qwen/GLM/MiniMax). Multi-role single-model is **not** hetero.  
**Related**: `/ship` skill; `docs/reviews/*`; never claim "hetero OK" with only one family.

## Failed attempt
- Single `autopilot:reviewer` multi-role pass labeled as hetero — rejected by user.
