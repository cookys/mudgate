# Open-source readiness

> Goal: publish this repo without leaking secrets or shipping unnecessary bulk/legal risk.

## Status checklist

| Item | Status |
|------|--------|
| SPDX license file (`LICENSE` = MIT) | done |
| Strong `.gitignore` (secrets, captures, deps, OS junk) | done |
| `.gitattributes` (LF + binary fixtures) | done |
| `.env.example` (no secrets) | done |
| `SECURITY.md` reporting + never-commit rules | done |
| `CONTRIBUTING.md` | done |
| Third-party / research attribution | done (below) |
| Secret scanning in CI | planned (pre-publish) |
| CODEOWNERS / branch protection | when GitHub remote exists |
| SBOM / dependency review | after package stack lands |

## Never put in the repo

1. **Credentials** — MUD passwords, tokens, cookies, captcha answers, cloud keys.
2. **Live sessions** — full logs after the name/password prompt.
3. **Personal profiles** — zMUD/Mudlet packages that embed accounts.
4. **Unlicensed bulk third-party** — e.g. entire RWlib/Undine trees (public download exists; redistribution needs license check). Prefer **short quotes + links** in `docs/research/`.
5. **Generated noise** — `node_modules/`, `dist/`, coverage HTML, editor caches.
6. **Local-only deploy** — override compose files with host secrets.

Use these **gitignored** dump grounds instead:

```text
local/          # personal experiments
private/        # anything sensitive
captures/       # raw live pcaps / session bins
sessions/       # client session state
.profiles/      # connection profiles with secrets
.env            # runtime config
```

## What *is* OK as fixtures

| Fixture type | Rule |
|--------------|------|
| Pre-auth public banners | OK if no account data (e.g. `tests/fixtures/streams/rw-banner-4000.bin`) |
| Synthetic ANSI/map frames | **Preferred — clean-room**: construct bytes from *observed* wire + research notes (`docs/research/rw-ansi-and-map-controls.md`), **not** by copying RWlib sources into the repo |
| Dual-color / mid-DBCS SGR cells | Hand-built synthetic sequences OK; document construction |
| Post-login gameplay | Only with **redaction**; never include typed passwords |

**Licensing determination (RWlib/Undine):** public downloads are for learning; full-tree redistribution is out of scope. Fixtures must be clean-room control/wire sequences. Short path citations in research docs are fine; if a fixture would copy substantial copyrighted source text, stop for license review.

Review every new `tests/fixtures/**` in PR description: source, charset, clean-room?, why safe.

## Third-party & research

| Source | How we use it | In repo? |
|--------|----------------|----------|
| Revival World site / live banner | Interop probe, fixture | Small binary fixture + notes |
| RWlib / Undine public downloads | Research for ANSI/map_d | **Notes only** in `docs/research/` — do not vendor full trees |
| zMUD / cMUD concepts | Feature inspiration | No proprietary binaries or docs dumps |
| xterm.js / zlib / etc. | Dependencies (later) | Via package manager + LICENSE notices |

If we later need to ship substantial third-party code, add `NOTICE` / `THIRD_PARTY_LICENSES` and keep originals intact.

## Pre-publish gate (maintainer)

Before first public push:

```bash
# 1) Nothing ignored-but-forced
git status
git check-ignore -v .env local/ captures/ 2>/dev/null || true

# 2) History scan for secrets (install once)
# gitleaks detect --source . --verbose
# or: trufflehog git file://. --since-commit HEAD~50

# 3) No large accidents
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '/^blob/ { if ($3 > 500000) print $3, $4 }'

# 4) Confirm LICENSE + SECURITY present
test -f LICENSE && test -f SECURITY.md
```

## Open-relay / abuse (product + legal hygiene)

A public unauthenticated “connect to any host:port” bridge can be abused for scanning and attacks. Open source **code** is fine; default **deployments** must fail closed. Document safe defaults in deploy docs when they exist.

## License

MIT — see `/LICENSE`. Contributors agree via `CONTRIBUTING.md`.
