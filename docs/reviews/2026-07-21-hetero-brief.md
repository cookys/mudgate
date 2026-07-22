# Hetero review brief — roadmap queue (multi-LLM)

You are a **plan reviewer** (not implementer). Review the **mudgate** roadmap plans for a web zMUD client (RW = Revival World: Big5 + VT map_d; WSS auth proxy).

## Product facts (do not invent opposite)

- Desktop + phone browsers; remote WSS+auth proxy; no raw TCP from browser.
- RW: Big5, full VT; server WILL MCCP2, DO MXP (client may WONT MXP).
- Stack: React/Vite/TS; proxy Node; MIT open source.
- StatusEvent + i18n baseline already shipped; font stack baseline shipped.
- **Next implement queue**: MCCP2 stream → CI e2e → fonts F2 → OSS readiness → proxy abuse → profile library → research spikes.

## Plans to verdict (each row)

1. `docs/plans/2026-07-21-roadmap-priority.md`
2. `docs/plans/2026-07-21-mccp2-stream.md` — **critical**: frozen wire path pre/post MCCP2 SE
3. `docs/plans/2026-07-21-terminal-fonts-f2.md`
4. `docs/plans/2026-07-21-open-source-readiness.md`
5. `docs/plans/2026-07-21-ci-e2e-quality.md`
6. `docs/plans/2026-07-21-proxy-abuse-limits.md`
7. `docs/plans/2026-07-21-profile-library.md`
8. `docs/plans/2026-07-21-research-spikes.md`

Read files under `/home/cookys/projects/mudgate/` as needed. Ground MCCP against `apps/proxy/src/bridge.ts` and `packages/protocol`.

## Output format (required)

```text
ENGINE: <name/model>
VERDICT_OVERALL: APPROVE | APPROVE_WITH_NITS | BLOCK

PER_PLAN:
- roadmap-priority: APPROVE|APPROVE_WITH_NITS|BLOCK — <one line>
- mccp2-stream: ...
- terminal-fonts-f2: ...
- open-source-readiness: ...
- ci-e2e-quality: ...
- proxy-abuse-limits: ...
- profile-library: ...
- research-spikes: ...

MUST_FIX: (bullets; empty if none)
NITS: (bullets)
SAFE_IMPLEMENT_ORDER: (comma list of plan slugs)
```

Be strict on MCCP stream boundary and false-ship.  
