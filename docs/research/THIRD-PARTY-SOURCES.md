# Third-party sources (research attribution)

This file tracks **external materials** we study for interop. It is not a license grant to re-ship those trees.

| Material | Origin | Use in assmud | Redistribution |
|----------|--------|---------------|----------------|
| RW live TCP banner | `mud.revivalworld.org:4000` (pre-auth) | `tests/fixtures/streams/rw-banner-4000.*` | Small interop fixture; no account data |
| RWlib 1.0.2 / Undine | https://www.revivalworld.org/rw/opensource | Cited in `rw-ansi-and-map-controls.md` | **Do not vendor** full archives here without separate license review |
| RW project site | https://www.revivalworld.org | Product context | Link only |
| ANSI / VT literature | Public standards + RWlib `doc/help/ansicode` | Control plane design | Quote sparingly; link/source |

### Policy

- Prefer **reimplementation** from observed wire behavior + published notes.
- If a dependency is required at runtime, add it via the package manager and retain upstream licenses.
- Game content (room text, quest text) from live play is **not** to be bulk-committed as assets.
