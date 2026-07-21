# Hetero — selfhost proxy trust + one-click deploy

**Date**: 2026-07-21  
**Plan**: [`docs/plans/2026-07-21-selfhost-proxy-trust.md`](../plans/2026-07-21-selfhost-proxy-trust.md)

## Matrix

| Round | Codex | MiniMax | GLM-5.2 |
|-------|-------|---------|---------|
| R0 | **BLOCK** (5 MUST_FIX) | APPROVE_WITH_NITS | APPROVE_WITH_NITS |
| R1 fold | — | — | — |
| R2 | **APPROVE** | **APPROVE** | APPROVE_WITH_NITS |
| R3 | **APPROVE** | **APPROVE** | **APPROVE** |

**Ship claim**: R3 三家 **APPROVE**，MUST_FIX [] NITS []，**ALL_CLEAR: yes** → plan 可 expand/ship。

## R0 Codex MUST_FIX → plan

1. Installer SHA-256 → image digest pin chain  
2. Default bind **127.0.0.1:7788** only; TLS terminator / tunnel in front  
3. Token: no URL/cloud-init log; 0600 file; safe retrieve  
4. Origin empty fail-closed; Origin ≠ auth  
5. T1 public path needs domain TLS; not raw IP as default  

## Also folded

- T0a daily local vs T0b localhost-dev naming  
- **T1b home + Cloudflare Tunnel / Zero Trust**（入口 CF、出口家用 IP）  
- U2 token not in export = ship required  
- WSS ≠ E2E password privacy in T3 copy  

## Session add-on (user)

家用配合 Cloudflare Zero Trust：**建議**作為 T1b；解決「安全暴露家裡 proxy」，**不**改變 MUD 出口 IP。

## R2 residual nits（已 fold 進 plan，不擋 ship）

- 互動 install `set +o history` 改 MUST  
- Release checklist：`digest pin verified`  
- CF Access：禁止 world Bypass 寫進 acceptance  

## Next

`/ship selfhost-proxy-trust` → expand **D1–D3 + D2b + U1 + U2 + R1**.
