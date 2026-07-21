# Session Protocol v0 — display ↔ player daemon

> **Status**: draft accepted for S3.2 spike (2026-07-22)  
> **Transport today**: WebSocket JSON control + binary telnet (existing assmud web↔proxy).  
> **Target**: same shape between **thin web** and **player daemon (P)**; site gateway (G) keeps current hello/ready bridge.

## Goals

1. Version negotiation before mud traffic.
2. Clear **ownership** of the mud TCP socket (daemon wins).
3. **Resume** after web tab close (best-effort): reattach display without re-login when daemon held the session.
4. Carry **echo_mask** (password field) as first-class control — TBD wire format stable.

## Non-goals

- Full TinTin script parity in v0.
- Multi-user daemon tenancy.
- Binary protobuf (JSON first).

## Message envelope

```ts
type SpMsg =
  | { v: 0; type: "hello"; role: "display"; token?: string; protocolMax: 0 }
  | { v: 0; type: "hello_ok"; role: "daemon"; protocol: 0; sessionId: string; resume?: boolean }
  | { v: 0; type: "hello_err"; reason: string }
  | { v: 0; type: "attach"; sessionId?: string } // resume
  | { v: 0; type: "ready"; host: string; port: number; sessionId: string }
  | { v: 0; type: "echo"; mask: boolean } // password mode — maps today's echo_mask
  | { v: 0; type: "naws"; cols: number; rows: number }
  | { v: 0; type: "error"; message: string }
  | { v: 0; type: "bye"; reason?: string };
// Binary WS frames: raw telnet octets after ready (same as today).
```

## Version negotiation

1. Display sends `hello` with `protocolMax: 0`.
2. Daemon replies `hello_ok` with chosen `protocol: 0` or `hello_err`.
3. Unknown `v` → close with reason `protocol`.

## Ownership

| Resource | Owner |
|----------|-------|
| TCP to mud | **daemon** |
| VT buffer (optional) | daemon may keep mirror; display may keep local paint buffer |
| Vault / secrets | **daemon only** (never upload to site gateway) |
| Scripts | daemon (player mode); browser (site/fat-web mode) |

## Resume (v0 target)

1. Daemon keeps `sessionId` + mud socket after display disconnect (idle timeout TBD, e.g. 30–120 min).
2. New display sends `attach` + token.
3. Daemon `ready` with `resume: true` and may push recent scrollback (optional later).
4. If session gone → `hello_err` / `error`; display falls back to fresh connect.

## Mapping to today's fat web ↔ proxy

| Today | Session Protocol v0 |
|-------|---------------------|
| JSON `hello` host/port/token | `hello` + daemon dial policy |
| `ready` | `ready` |
| `echo` mask | `echo` |
| `naws` / resize | `naws` |
| binary telnet | binary frames |
| proxy closes → session dead | daemon may retain session |

## echo_mask TBD

- Wire: keep `{ type: "echo", mask: boolean }` as in current client.
- Semantics: telnet ECHO WILL/WONT from mud → daemon → display.
- Password never logged (site audit rules still apply on G).

## Security

- Player daemon binds loopback or private LAN by default; token required on non-loopback.
- SSRF: same private-IP blocks as proxy when dialing arbitrary muds.
- Site gateway **must not** speak full Session Protocol for vault-bearing sessions.

## Boundary diagram (S3.3)

```text
[Thin web display]
      │  Session Protocol v0 (WSS)
      ▼
[Player daemon P] ──TCP──► [any mud]
  vault · scripts · resume

[Fat web] ──WSS hello──► [Site gateway G] ──TCP──► [site mud]
  (no player vault on G)
```

## Test strategy (when implemented)

- Unit: negotiate v0; reject bad version; attach unknown session fails.
- Integration: mock daemon holds TCP while display reconnects.
