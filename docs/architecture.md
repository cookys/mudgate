# Architecture (draft)

> Living sketch.  
> Stack: [ADR-001](adr/ADR-001-stack.md) · Networking: [ADR-002](adr/ADR-002-mobile-first-proxy.md)  
> Plan: [plans/2026-07-21-web-zmud-rw.md](plans/2026-07-21-web-zmud-rw.md) · Threat model: [security/hosted-proxy-threat-model.md](security/hosted-proxy-threat-model.md)

## Goals

- **Mobile-first**: phone browser/PWA plays MUDs without installing a proxy app on the phone.
- Desktop browser uses the **same** remote path (or optional local bridge for power users/dev).
- Public path **HTTPS + WSS**; MUD hop **TCP + Telnet** (TLS-to-MUD when available).
- Depth benchmark: Revival World (Big5, full VT/map_d).
- Open source; official/self-host deploy **fail-closed** (never an open relay).

## What the browser cannot do

- Raw TCP to `host:4000` (not available to web pages).
- WebAssembly does **not** unlock TCP in the browser sandbox.
- Therefore networking is always: **browser ↔ (WSS) ↔ process that owns TCP**.

## Runtime topology (product default)

```text
┌──────────────────┐  WSS + auth (TLS)  ┌─────────────────────────┐  TCP+Telnet  ┌──────────┐
│ apps/web         │ ─────────────────► │ apps/proxy (remote)     │ ───────────► │ MUD host │
│ React SPA / PWA  │ ◄───────────────── │ login, allowlist, quota │ ◄─────────── │ (RW …)   │
│ phone or desktop │                    │ audit metadata          │              └──────────┘
└────────┬─────────┘                    └─────────────────────────┘
         │ plain TS APIs (no React inside packages)
         ▼
┌──────────────────────────────────────────────────────────┐
│ packages/protocol → codec-big5 → vt → terminal + Renderer│
│                              Canvas2D | WebGPU (later)   │
└──────────────────────────────────────────────────────────┘
```

### Secondary topologies

| Mode | When |
|------|------|
| **Dev localhost proxy** | Developer laptop; same WSS protocol; bind `127.0.0.1` |
| **User self-host proxy** | Power user runs official image on their VPS with their auth/allowlist |
| **Desktop native shell** (optional later) | Tauri/etc. may own TCP directly — not required for mobile north star |

**Not a product path:** expecting end users to run a proxy process on iOS/Android.

## Package responsibilities

| Package | Role | Replaceable backend |
|---------|------|---------------------|
| `protocol` | Telnet IAC, options, framing, reconnect | — |
| `codec-big5` | Big5/DBCS streaming | JS → **WASM** later |
| `vt` | CSI/C0 (CUP, ED, DECSTBM, SGR, …) | — |
| `terminal` | Screen buffer, scrollback | Renderer: Canvas2D → **WebGPU** |
| `script-engine` | Declarative triggers/aliases/vars | matcher → WASM later |
| `apps/web` | React + Tailwind; auth UI; profiles; `TerminalHost` | — |
| `apps/proxy` | WSS↔TCP; **authn/z**; allowlist; quotas; audit | config: remote vs localhost |

## Render / compute plug-ins

```text
interface Renderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(cols: number, rows: number, cssWidth: number, cssHeight: number): void;
  draw(snapshot: ScreenSnapshot): void;
  dispose(): void;
}

interface CharsetCodec {
  push(bytes: Uint8Array): CellOrControl[];
}
```

- v1: `Canvas2DRenderer`, `TsBig5Codec`.
- Later: WebGPU / WASM behind interfaces; feature-detect; no React state-per-frame.

## Security (official remote proxy)

See [hosted-proxy-threat-model.md](security/hosted-proxy-threat-model.md).

Minimum: auth before TCP, destination allowlist, SSRF blocks, quotas, metadata-only audit, WSS-only public endpoints.

## Testing shape

| Layer | Where |
|-------|--------|
| Unit | `packages/*` vitest + fixtures |
| Integration | proxy policy tests (deny private IP, deny unauth, allowlist) |
| UI thin | React Testing Library |
| E2E | Playwright + mock mud + mock auth |
| Human | phone browser against staging WSS + live RW |
