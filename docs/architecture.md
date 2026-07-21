# Architecture (draft)

> Living sketch. Stack decisions: [ADR-001](adr/ADR-001-stack.md). Product plan: [plans/2026-07-21-web-zmud-rw.md](plans/2026-07-21-web-zmud-rw.md).

## Goals

- PC + mobile **browser** → **HTTPS/WSS** public path → TCP Telnet to **any** MUD.
- Depth benchmark: Revival World (Big5, full VT/map_d).
- Open source, fail-closed proxy defaults.

## Runtime topology

```text
┌─────────────┐   WSS (TLS in prod)   ┌──────────────┐   TCP+Telnet   ┌──────────┐
│  apps/web   │ ───────────────────► │ apps/proxy   │ ─────────────► │ MUD host │
│  React SPA  │ ◄─────────────────── │ (byte bridge)│ ◄───────────── │ (RW etc) │
└──────┬──────┘                       └──────────────┘                └──────────┘
       │
       │  plain TS APIs (no React inside)
       ▼
┌──────────────────────────────────────────────────────────┐
│ packages/protocol  →  codec-big5  →  vt  →  terminal      │
│   IAC/MCCP/…            DBCS           CSI     buffer    │
│                                              + Renderer  │
│                                         Canvas2D | WebGPU│
└──────────────────────────────────────────────────────────┘
```

- **Default deploy**: proxy binds **localhost**; browser on same machine.
- **Phone / remote**: self-hosted or hosted proxy with **WSS + auth/allowlist** (never open-relay).
- Browser never opens raw TCP.

## Package responsibilities

| Package | Role | Replaceable backend |
|---------|------|---------------------|
| `protocol` | Telnet IAC, options, framing, reconnect policy | — |
| `codec-big5` | Big5/DBCS tokenize; charset switch hooks | JS default → **WASM** later |
| `vt` | CSI/C0 state machine (CUP, ED, DECSTBM, SGR, …) | — |
| `terminal` | Screen buffer, scrollback, input echo policy | Renderer: Canvas2D → **WebGPU** |
| `script-engine` | triggers/aliases/vars (declarative first) | matcher → WASM later |
| `apps/web` | React shell, profiles UI, Tailwind chrome | — |
| `apps/proxy` | WSS↔TCP, origin checks, allowlist | — |

## Render / compute plug-ins

```text
interface Renderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(cols: number, rows: number, cssWidth: number, cssHeight: number): void;
  draw(snapshot: ScreenSnapshot): void;
  dispose(): void;
}

interface CharsetCodec {
  push(bytes: Uint8Array): CellOrControl[]; // streaming
}
```

- **v1**: `Canvas2DRenderer`, `TsBig5Codec`.
- **Later**: `WebGpuRenderer` if `navigator.gpu` and profile says paint-bound; `WasmBig5Codec` if CPU-bound.
- Feature detect once at session start; no React re-render per frame.

## Security surfaces

See `SECURITY.md` and plan §2.5. Critical: proxy anti-open-relay, terminal sanitizer (no raw HTML from MUD/MXP), no secrets in git.

## Testing shape

| Layer | Where |
|-------|--------|
| Unit (majority) | `packages/*` via vitest — fixtures under `tests/fixtures/streams/` |
| Integration | proxy + mock TCP |
| UI thin | React Testing Library on shell only |
| E2E | Playwright + mock mud |
| Human | live RW map walk |
