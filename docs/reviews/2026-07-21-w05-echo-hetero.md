# Hetero + loop — W05 ECHO password mask

**Date**: 2026-07-21  
**Scope**: `docs/plans/2026-07-21-echo-password-mask.md` + impl on `feat/echo-password-mask`  
**hetero** = multi-LLM families (not multi-role)

## Plan review

| Engine | Family | Verdict | MUST_FIX |
|--------|--------|---------|----------|
| Grok (session) | xAI | APPROVE | [] |
| Codex | OpenAI | BLOCK → folded | plan wording `type=password or CSS mask` → forced `type=password` only while mask |
| MiniMax-M2.7 | MiniMax | APPROVE_WITH_NITS | [] |

Codex plan BLOCK folded into plan acceptance + implementation before loop.

## Impl loop R1

| Engine | Verdict | MUST_FIX |
|--------|---------|----------|
| Grok (session) | APPROVE | [] |
| Codex | APPROVE_WITH_NITS | [] |
| MiniMax-M2.7 | APPROVE | [] |

**NITS deferred**: web unit for `onEchoMask` input type transition (protocol+bridge covered).

## Ship gate

- Loop green (≥2 families APPROVE*, no open MUST_FIX)
- depth-0: `npm test` 64 pass; `npm run build -w @assmud/web` ok
