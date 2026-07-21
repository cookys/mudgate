# Plan hetero R1 — map_d Nav Companion

> Plan: `docs/plans/2026-07-22-mapd-nav-companion.md`  
> Brief: `docs/reviews/2026-07-22-mapd-companion-plan-review-brief.md`  
> Date: 2026-07-22

## Roster

| Engine | How | Verdict | C0_SHIP_OK |
|--------|-----|---------|------------|
| **gpt-5.6-sol** | `codex exec` | **BLOCK** | no |
| **GLM-5.2** | `qoderclicn` | **APPROVE_WITH_NITS** | no (until C0.3+) |
| **Qwen3.8-Max-Preview** | `qoderclicn` | **APPROVE_WITH_NITS** | yes (w/ nits) |
| **MiniMax-M2.7** | `qoderclicn` | **APPROVE_WITH_NITS** | yes |
| **gemini-3.6-flash-high** | `agy` | **FAIL** | n/a — only model-id chatter (attachments too) |

**ALL_CLEAR? → NO** (one BLOCK + Gemini unavailable).

Raw: `docs/reviews/2026-07-22-mapd-companion-plan-{gpt56sol,glm52,qwen38,minimax,gemini36}.out`

## Consensus MUST_FIX themes (folded into plan R1)

1. BurstDetector **numeric** contract + **positive** fixture for C0.3  
2. Storage **choose** IndexedDB; MAX frames; protected vs LRU  
3. Multi-tab / lastMapFrame ownership  
4. Manual capture ≠ “official map” labeling  
5. Snapshot fidelity (wideCont, inverse, …)  
6. Privacy / clear / confirm  
7. Remove journey from C0 manual smoke  
8. “Live” = last snapshot, not continuous mirror  
9. profileKey = profile.id  
10. Zoom 1×/2× defined  

## Per-engine one-liner

| Engine | Summary |
|--------|---------|
| gpt-5.6-sol | Stance OK; C0 still implementer-guess until detector/IDB/multi-tab/fidelity/privacy locked |
| GLM | C0.3 only non-regression → false-ship; fix positive detect |
| Qwen | Need burst threshold, N frames, zoom scope |
| MiniMax | C0 shippable; nits on attrs list / fixtures |
| Gemini 3.6 flash high | **No review content** |

## After R1 fold

Plan body updated with §2.2–2.3 contracts + C0 table + §10 closed.  

**Next**: R2 re-review (same panel + retry Gemini) → expect ALL_CLEAR or residual nits → then `approved` + impl C0.

## Not passed yet

```text
PLAN_HETERO_ALL_CLEAR = false
```
