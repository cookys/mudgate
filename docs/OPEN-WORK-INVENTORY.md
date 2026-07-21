# Open-work inventory SSOT

> **Date**: 2026-07-22  
> **Purpose**: Single table of open residuals from BACKLOG, plans, projects, bugs.  
> Tags: `ship-now` | `promote-to-plan` | `deferred`  
> Goal drain: formal ship-now set = **T1 S3** + **Companion C1**; wishlist stays deferred unless promoted.

## Formal plan residuals

| ID | Source | Tag | Reason |
|----|--------|-----|--------|
| T1-S3 | `plans/2026-07-22-t1-site-proxy-and-core-daemon.md` Phase S3 | **SHIP** | ADR-003 + session-protocol-v0 (daemon binary deferred) |
| T1-S0–S2 | same plan | **SHIP** | already landed |
| Companion C0 | `plans/2026-07-22-mapd-nav-companion.md` | **SHIP** | landed + pre-smoke |
| Companion C1 | same plan Phase C1 | **SHIP** | journey/search/fingerprint/stitch (commit b585e8a) |
| Companion C2 | same plan Phase C2 | **deferred** | expedition/moonshot; capacity after C1; not required this goal |
| Vault plan | `plans/2026-07-22-profile-secrets-vault.md` | **SHIP** | vault already on develop (INDEX/queue stale row fixed in hygiene) |
| Automap nav shell | `plans/2026-07-22-automap-nav-shell.md` | **SHIP** | P1 done |
| Queue 1–7 | mccp2…research-spikes | **SHIP** | projects INDEX |

## BACKLOG.md (unchecked)

| Item | Tag | Reason |
|------|-----|--------|
| Connection profile library | **deferred** | already SHIP as profile-library plan; backlog checkbox stale → close on hygiene |
| zMUD trigger/alias import | **deferred** | research-only; no formal plan this goal |
| Offline log viewer / session replay | **deferred** | wishlist; not plan |
| Multi-character split view | **deferred** | wishlist |
| RW 2D live map embed | **deferred** | external URL; not plan |
| Mobile / PWA | **deferred** | north-star; not plan |
| Shared trigger package registry | **deferred** | community; not plan |
| Production HTTPS + WSS recipe | **deferred** | partial docs exist (HTTPS-WSS, SITE-OPERATOR); full prod not this goal |
| Self-host threat model write-up | **SHIP-ish / deferred residual** | hosted-proxy-threat-model + SITE-OPERATOR exist; backlog stale |
| TLS-to-MUD (telnets) | **deferred** | mud support unknown |
| Open-relay abuse tests | **SHIP residual** | proxy-abuse-limits SHIP; backlog stale |
| CI unit + golden + e2e | **SHIP** | ci-e2e-quality SHIP; backlog stale |
| CI secret-scan | **deferred** | script exists `scripts/secret-scan.sh`; GH Actions not assumed |
| GitHub branch protection | **deferred** | admin/credentials out of scope |
| RW captcha fixture capture | **deferred** | user-gated research |
| Client matrix compare | **deferred** | research |

## Projects INDEX drift

| Issue | Tag | Action |
|-------|-----|--------|
| No rows for companion / t1-site | **ship-now hygiene** | add completed rows after S3/C1 land |
| "In Progress" table is all SHIP | **hygiene** | rename mental model to completed queue |

## Bugs

| Item | Tag | Reason |
|------|-----|--------|
| Tracked product bugs in repo | none open as formal issues | no `docs/**/BUG*` open; regression covered by QC suite |
| Hetero `docs/reviews/*.err` | **deferred** | harness noise; do not commit |

## Counts (snapshot)

| Bucket | Count |
|--------|-------|
| ship-now formal (closed this goal) | 2 (S3, C1) → both **SHIP** |
| already SHIP formal | rest of 2026-07-21/22 queue + C0 + S0–S2 |
| deferred BACKLOG/wishlist | 12+ unchecked rows (no promote this goal) |
| C2 deferred | 1 phase |

## Pipeline notes

- Parent plan hetero: companion **ALL_CLEAR R4**, t1-site **ALL_CLEAR R2** — residual phases expand under approved plan without re-litigating product dual-mode/companion ANTI.
- Impl engine: session grok-4.5 medium.
- QC: `npm test` ×2, web build, `pre-smoke-check.sh`, LAN health.
