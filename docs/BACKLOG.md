# Backlog

> 尚未成案、或刻意延後的項目。成案時移入 `docs/plans/` 並 bootstrap 到 `docs/projects/`。

## Product / client

- [ ] Connection profile library (各家 mud presets + custom host:port/charset)
- [ ] zMUD-compatible trigger / alias import (`.mud` / package format research)
- [ ] Offline log viewer / session replay
- [ ] Multi-character / multi-session split view
- [ ] Optional RW 2D live map embed (`https://www.revivalworld.org/online/rw/map.html`)
- [ ] Mobile / PWA installability (north-star surface)
- [ ] Browser E2E for short-height mobile viewport and scroll-reachable modal actions
  - Trigger: when a Playwright or equivalent real-browser test harness is added
  - Context: mobile viewport surface review; assert Connect CTA and modal footers scroll into view with the keyboard open
- [ ] Shared trigger package registry (community packs, sandboxed)

## Platform / security

- [ ] Production HTTPS + WSS deploy recipe (Caddy/nginx/platform)
- [ ] Self-host local proxy vs hosted relay threat model write-up
- [ ] Optional TLS-to-MUD (telnets) when remote supports it
- [ ] Open-relay abuse tests + rate limits for any hosted mode
- [ ] CI: unit + terminal golden streams + e2e against mock MudOS
- [ ] CI secret scan (gitleaks/trufflehog) before first public push
- [ ] GitHub remote: branch protection + security advisories enabled

## Research spikes (not yet planned)

- [ ] Capture real RW login banner + captcha flow for fixtures (user-gated, no credentials in repo)
- [ ] Compare Mudlet / BeipMU / web clients (webmud, mudportal) feature matrix
