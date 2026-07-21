# Hetero multi-LLM review — roadmap queue (2026-07-21)

## Definition (locked)

> **heto / hetero / 異質 = 多家不同 LLM 產品族各自獨立審核**  
> 不是單引擎多角色。單引擎 Architect/Ops/Skeptic **不得**稱為 hetero。

Recorded: `.claude/knowledge/architecture.md` · `~/.grok/skills/ship/SKILL.md` · project ship overlay.

## Engines dispatched

| Family | How | Result file | Status |
|--------|-----|-------------|--------|
| **Grok 4.5** | independent reviewer subagent | (this doc + session) | **OK returned** |
| **OpenAI Codex / GPT-5** | `codex exec` | `2026-07-21-hetero-codex.out` | **OK returned** |
| **Claude (Anthropic)** | `claude -p` | `2026-07-21-hetero-claude.out` | **FAIL — not logged in** (`Please run /login`) |
| Qwen / GLM / MiniMax | CLI not on PATH this host | — | **unavailable** |

**Minimum 2 families satisfied** (Grok + Codex). Claude re-run when authenticated.

## Per-engine overall

| Engine | VERDICT_OVERALL |
|--------|-----------------|
| Grok 4.5 | **BLOCK** |
| Codex GPT-5 | **BLOCK** |
| Claude | n/a (auth) |

## Per-plan matrix (consensus)

| Plan | Grok | Codex | Consensus |
|------|------|-------|-----------|
| roadmap-priority | BLOCK | BLOCK | **BLOCK** — reorder MCCP→CI→fonts→OSS… |
| mccp2-stream | BLOCK | BLOCK | **BLOCK** — parser residual API; M0+M1 atomic; no silent inflate |
| terminal-fonts-f2 | APPROVE_WITH_NITS | APPROVE_WITH_NITS | **APPROVE*** |
| open-source-readiness | APPROVE_WITH_NITS | BLOCK | **BLOCK** until LICENSE+CI secret gate explicit |
| ci-e2e-quality | APPROVE_WITH_NITS | BLOCK | **BLOCK** until MCCP goldens + no skip CI |
| proxy-abuse-limits | APPROVE_WITH_NITS | BLOCK | **BLOCK** until numeric caps/algorithms |
| profile-library | APPROVE_WITH_NITS | BLOCK | **BLOCK** until auto-login secret model |
| research-spikes | APPROVE | APPROVE_WITH_NITS | **APPROVE*** |

## Shared MUST_FIX (both engines)

1. **Roadmap order**: mccp2 → ci-e2e → fonts-f2 → oss → abuse → profiles → research  
2. **MCCP**: public residual/drain after SE; never parser on zlib; M0+M1 atomic if default MCCP=1  
3. **MCCP**: precise inflate caps/lifecycle/tests (bridge-level fixtures)  
4. **CI**: mandatory; include MCCP goldens after MCCP lands  
5. **OSS / abuse / profile**: tighten acceptance so “approved” ≠ false-ship  

## SAFE_IMPLEMENT_ORDER (both engines agree)

`mccp2-stream → ci-e2e-quality → terminal-fonts-f2 → open-source-readiness → proxy-abuse-limits → profile-library → research-spikes`

## Project expand policy (after this hetero)

| Plan | Bootstrap project? | Implement now? |
|------|--------------------|----------------|
| mccp2-stream | yes (exists) | **only after plan re-fold + re-hetero or fold must-fix then re-check** |
| others marked BLOCK by Codex | yes | **fold must-fix into plan first** |
| fonts-f2, research | yes | OK to implement after fold nits |

**Do not claim queue “hetero OK” until Grok+Codex (and preferably Claude) all non-BLOCK on ship-critical plans.**

## Raw outputs

- `docs/reviews/2026-07-21-hetero-codex.out`  
- Grok: session subagent (verbatim in synthesis above)  
- `docs/reviews/2026-07-21-hetero-brief.md` + `hetero-pack.txt`  
