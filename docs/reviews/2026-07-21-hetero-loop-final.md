# Hetero multi-LLM loop — final synthesis (2026-07-21)

## Definition

**heto = 異質 = 多家不同 LLM**（Grok / Codex / GLM / MiniMax；Claude 7/23 中午前 quota）。

## Rounds

| Round | Engines | Overall |
|-------|---------|---------|
| R2 first multi-LLM | Grok **BLOCK**, Codex **BLOCK**, GLM **APPROVE_WITH_NITS**, MiniMax **APPROVE_WITH_NITS** | fold all MUST_FIX |
| R3 re-review after fold | Grok **APPROVE_WITH_NITS**, GLM **APPROVE_WITH_NITS**, MiniMax **APPROVE**, Codex **BLOCK** (3 MCCP nits) | fold TCP EOF / pushUntilMccpStart / residual wire count |
| R4 | Grok **APPROVE_WITH_NITS** (symbol name nit fixed) | Codex R4 in flight / residual only |

## Consensus after fold (no outstanding MUST_FIX for plan-text)

| Plan | Status for implement |
|------|----------------------|
| roadmap-priority | **APPROVE** order |
| mccp2-stream | **APPROVE_WITH_NITS** → **implement OK** |
| ci-e2e-quality | **APPROVE** / APPROVE_WITH_NITS |
| terminal-fonts-f2 | **APPROVE_WITH_NITS** |
| open-source-readiness | **APPROVE** |
| proxy-abuse-limits | **APPROVE_WITH_NITS** |
| profile-library | **APPROVE** |
| research-spikes | **APPROVE** |

## SAFE_IMPLEMENT_ORDER (all engines)

1. mccp2-stream  
2. ci-e2e-quality  
3. terminal-fonts-f2  
4. open-source-readiness  
5. proxy-abuse-limits  
6. profile-library  
7. research-spikes  

## Artifacts

- `hetero-glm.out` / `hetero-minimax.out` (R2)  
- `hetero-r3-glm.out` / `hetero-r3-minimax.out` / `hetero-r3-codex.out`  
- `hetero-codex.out` / multi-llm.md (R2)  
- Claude: deferred quota  

## Note

Loop stops at **plan-text APPROVE*** across Grok+GLM+MiniMax and Codex remaining issues folded. **Code implementation** still needs its own loop review after land.  
