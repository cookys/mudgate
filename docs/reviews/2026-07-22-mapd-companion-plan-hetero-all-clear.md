# Plan hetero ALL_CLEAR — map_d Nav Companion

> Plan: `docs/plans/2026-07-22-mapd-nav-companion.md`  
> **PLAN_HETERO_ALL_CLEAR = true** (R4)  
> Date: 2026-07-22

## Definition used

**ALL_CLEAR** = every **successful** review engine returns non-`BLOCK` with **empty MUST_FIX**.  
Gemini-3.6-flash-high repeatedly failed harness (no review content) → **excluded as n/a**, not counted as BLOCK.

## Round matrix

| Round | gpt-5.6-sol | GLM-5.2 | Qwen3.8-Max | MiniMax-M2.7 | gemini-3.6-flash-high |
|-------|-------------|---------|-------------|--------------|------------------------|
| R1 | BLOCK | APPROVE_WITH_NITS | APPROVE_WITH_NITS | APPROVE_WITH_NITS | FAIL |
| R2 | BLOCK | BLOCK | APPROVE_WITH_NITS | APPROVE_WITH_NITS | FAIL |
| R3 | BLOCK | APPROVE_WITH_NITS* | APPROVE_WITH_NITS | APPROVE | FAIL |
| **R4** | **APPROVE_WITH_NITS** | **APPROVE_WITH_NITS** | **APPROVE_WITH_NITS** | **APPROVE** | FAIL |

\*R3 GLM had MUST_FIX on P2 gate / persist failure branch → folded before R4.

## R4 verdicts (authoritative)

| Engine | Verdict | MUST_FIX | C0_SHIP_OK |
|--------|---------|----------|------------|
| gpt-5.6-sol | APPROVE_WITH_NITS | none | yes |
| GLM-5.2 | APPROVE_WITH_NITS | none | yes |
| Qwen3.8-Max-Preview | APPROVE_WITH_NITS | none | yes |
| MiniMax-M2.7 | APPROVE | none | yes |

Post-R4 nits (non-blocking) folded lightly into plan (retry fire path, setMapCaptureArmed, eviction=1, soft multi-tab cap, P3 in unit list).

## Raw artifacts

- R1: `2026-07-22-mapd-companion-plan-{gpt56sol,glm52,qwen38,minimax,gemini36}.out` + `…-hetero-r1.md`
- R2: `…-plan-r2-*.out`
- R3: `…-plan-r3-*.out`
- R4: `…-plan-r4-*.out`

## Next

**Implement C0** per plan; no further plan-hetero required unless C0 scope expands.

## Gemini flash postmortem (2026-07-22 later)

R1–R4 gemini seats were **false FAIL**: `agy -p --model … "prompt"` makes `-p` swallow `--model` as the prompt (`promptLength=7`). See `2026-07-22-agy-flash-fail-diagnosis.md`.

**Fixed invocation**: `agy --model gemini-3.6-flash-high --print-timeout 3m0s -p "$PROMPT"`

**Re-run** (`mapd-companion-plan-gemini36-fixed.out`): **APPROVE_WITH_NITS**, MUST_FIX none, C0_SHIP_OK yes — consistent with R4 panel.
