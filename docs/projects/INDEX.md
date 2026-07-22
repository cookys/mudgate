# mudgate — Projects Index

> 專案執行追蹤索引。每個 L-size 工作建立 `docs/projects/YYYY-MM-DD-<name>/`，
> 搭配 `docs/plans/` 的計劃文件。本索引是 `/next` 與 session 接續的 SSOT。

## 進行中 (In Progress) — implement queue

| Seq | Project | Plan | Branch | Status |
|-----|---------|------|--------|--------|
| 1 | [mccp2-stream](2026-07-21-mccp2-stream/README.md) | [mccp2-stream](../plans/2026-07-21-mccp2-stream.md) | `feat/mccp2-stream` | ✅ **SHIP** develop |
| 1b | [echo-password-mask](2026-07-21-echo-password-mask/README.md) | [echo-password-mask](../plans/2026-07-21-echo-password-mask.md) | `feat/echo-password-mask` | ✅ **SHIP** develop |
| 1c | [cjk-cell-width](2026-07-21-cjk-cell-width/README.md) | [cjk-cell-width-taiwanmud](../plans/2026-07-21-cjk-cell-width-taiwanmud.md) | `feat/cjk-cell-width` | ✅ **SHIP** develop |
| 1d | [selfhost-proxy-trust](2026-07-21-selfhost-proxy-trust/README.md) | [selfhost-proxy-trust](../plans/2026-07-21-selfhost-proxy-trust.md) | `feat/selfhost-proxy-trust` | ✅ **SHIP** develop |
| 2 | [ci-e2e-quality](2026-07-21-ci-e2e-quality/README.md) | [ci-e2e-quality](../plans/2026-07-21-ci-e2e-quality.md) | `feat/ci-e2e-quality` | ✅ **SHIP** develop |
| 3 | [terminal-fonts-f2](2026-07-21-terminal-fonts-f2/README.md) | [fonts-f2](../plans/2026-07-21-terminal-fonts-f2.md) | `feat/terminal-fonts-f2` | ✅ **SHIP** develop |
| 4 | [open-source-readiness](2026-07-21-open-source-readiness/README.md) | [oss](../plans/2026-07-21-open-source-readiness.md) | `feat/open-source-readiness` | ✅ **SHIP** develop |
| 5 | [proxy-abuse-limits](2026-07-21-proxy-abuse-limits/README.md) | [abuse](../plans/2026-07-21-proxy-abuse-limits.md) | `feat/proxy-abuse-limits` | ✅ **SHIP** develop |
| 6 | [profile-library](2026-07-21-profile-library/README.md) | [profiles](../plans/2026-07-21-profile-library.md) | `feat/profile-library-real` | ✅ **SHIP** develop |
| 7 | [research-spikes](2026-07-21-research-spikes/README.md) | [spikes](../plans/2026-07-21-research-spikes.md) | docs | ✅ **SHIP** docs-only |

**Roadmap**: [`docs/plans/2026-07-21-roadmap-priority.md`](../plans/2026-07-21-roadmap-priority.md)  
**Impl ALL_CLEAR**: [`docs/reviews/2026-07-21-queue-impl-hetero-all-clear.md`](../reviews/2026-07-21-queue-impl-hetero-all-clear.md) (Codex+MiniMax r3 · commit `99b8d3a`)

## 已完成 (Completed)

| Date | Project | Version | Merge | Plan |
|------|---------|---------|-------|------|
| 2026-07-22 | map_d companion C0+C1 | 0.1 | develop | [mapd-nav-companion](../plans/2026-07-22-mapd-nav-companion.md) |
| 2026-07-22 | site mode S0–S2 + S3 ADR | 0.1 | develop | [t1-site-proxy](../plans/2026-07-22-t1-site-proxy-and-core-daemon.md) |
| 2026-07-21 | [web-zmud-bootstrap](2026-07-21-web-zmud-bootstrap/README.md) | 0.1 | develop | [web-zmud-rw](../plans/2026-07-21-web-zmud-rw.md) |
| 2026-07-21 | UI shell + terminal copy UX | 0.1 | develop | [ui-shell-ship](../plans/2026-07-21-ui-shell-ship.md) |
| 2026-07-21 | i18n + StatusEvent + font stack baseline | 0.1 | develop | [i18n-locale](../plans/2026-07-21-i18n-locale.md) + fonts baseline |
| 2026-07-21 | W05 ECHO password mask | 0.1 | develop | [echo-password-mask](../plans/2026-07-21-echo-password-mask.md) |
| 2026-07-21 | CJK cell width + self-host IP docs | 0.1 | develop | [cjk-cell-width-taiwanmud](../plans/2026-07-21-cjk-cell-width-taiwanmud.md) |
| 2026-07-21 | Self-host proxy trust + deploy | 0.1 | develop | [selfhost-proxy-trust](../plans/2026-07-21-selfhost-proxy-trust.md) |
| 2026-07-21 | CI e2e golden streams | 0.1 | develop | [ci-e2e-quality](../plans/2026-07-21-ci-e2e-quality.md) |
| 2026-07-21 | Terminal fonts F2 trial | 0.1 | develop | [terminal-fonts-f2](../plans/2026-07-21-terminal-fonts-f2.md) |
| 2026-07-21 | Open-source readiness | 0.1 | develop | [open-source-readiness](../plans/2026-07-21-open-source-readiness.md) |
| 2026-07-21 | Proxy abuse limits | 0.1 | develop | [proxy-abuse-limits](../plans/2026-07-21-proxy-abuse-limits.md) |
| 2026-07-21 | Profile library | 0.1 | develop | [profile-library](../plans/2026-07-21-profile-library.md) |
| 2026-07-21 | Research spikes | docs | develop | [research-spikes](../plans/2026-07-21-research-spikes.md) |

## 已封存 (Archived)

| Date | Project | Reason |
|------|---------|--------|
| — | — | 尚無封存的專案 |

## 命名與路徑慣例

| 類型 | 路徑 | 說明 |
|------|------|------|
| Plan | `docs/plans/YYYY-MM-DD-<slug>.md` | 可執行計劃 |
| Project | `docs/projects/YYYY-MM-DD-<slug>/` | L-size 執行追蹤 |
| Archive | `docs/projects/_archive/` | 完成後封存 |
| Backlog | `docs/BACKLOG.md` | 尚未成案想法 |
