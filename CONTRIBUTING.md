# Contributing

Thanks for helping. This client is intended to be open source; please keep the repo **safe and lean**.

## Before you open a PR

1. Read `SECURITY.md` and `docs/OPEN-SOURCE.md`.
2. Do **not** commit secrets, live password-bearing captures, or unrelated vendor trees.
3. Prefer small, reviewable PRs with tests for terminal/protocol behavior.
4. Match existing docs layout: plans in `docs/plans/`, execution tracking in `docs/projects/`.

## Local setup (once stack lands)

```bash
cp .env.example .env
# install + dev commands will be documented after scaffold
```

## What belongs in git

| OK | Not OK |
|----|--------|
| Source, tests, docs, CI | `.env`, keys, tokens |
| Anonymized fixtures under `tests/fixtures/` | `captures/`, `sessions/`, live `*.log` with input |
| Research notes citing public sources | Full third-party mudlib without license review |
| `.claude/*-config.md` project calibration | Autopilot runtime state under `.claude/tasks/` etc. |

## Code of collaboration

- Be precise about protocol claims (TCP vs WSS vs TLS-to-MUD).
- RW is a **depth benchmark**; multi-MUD is the product — avoid hard-coding a single host in core paths.
- Security-sensitive changes (proxy, sanitize, auth) need extra review.

## License

By contributing, you agree your contributions are licensed under the MIT License (`LICENSE`).
