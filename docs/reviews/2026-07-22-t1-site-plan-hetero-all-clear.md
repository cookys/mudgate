# Plan hetero ALL_CLEAR — T1-site + daemon architecture

> Plan: `docs/plans/2026-07-22-t1-site-proxy-and-core-daemon.md`  
> **ALL_CLEAR = true** after R1 fold + R2 fold of residual MUST_FIX  
> Date: 2026-07-22

## Panel

| Engine | R1 | R2 |
|--------|----|----|
| gpt-5.6-sol | CHANGES_REQUIRED | REQUEST_CHANGES (2 nits→fold) |
| GLM-5.2 | APPROVE_WITH_NITS | SHIP_OK + 3 MUST_FIX→fold |
| Qwen3.8-Max | APPROVE_WITH_NITS | CONDITIONAL 2 MUST_FIX→fold |
| MiniMax-M2.7 | APPROVE_WITH_NITS | 條件性 + MUST_FIX→fold |
| **gemini-3.6-flash-high** | APPROVE_WITH_NITS | **APPROVED**（agy `-p` 順序已修） |

## Architecture consensus

**ARCH_VERDICT: accept** across panel:

- **W0 now** (Node proxy + T1-site deploy/policy)
- **D1 mid** (Display / Session split; **G-daemon vs P-daemon**)
- **R2 later** (Rust only past measurable gates; same protocol)

## Key folds

- `SITE_MODE` ≠ `PROXY_MODE`; empty allowlist fail-fast  
- S1 identity honesty: shared token + per-**effectiveClientAddr** only  
- Trusted hop CIDR/unix; no XFF chain; 403 pre-upgrade / 1008 post  
- Thin-display vision **P-daemon only**  
- Ban gaps bidirectional; CDN ban-IP caveats  

## Ship next

**S0–S1** implementable; S2 PROXY experimental; S3 ADR.

Raw: `docs/reviews/2026-07-22-t1-site-plan-r{1,2}-*.out`
