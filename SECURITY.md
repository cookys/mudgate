# Security Policy

## Supported versions

This project is pre-1.0. Security fixes land on `main` only until a release train exists.

## What we protect

| Surface | Expectation |
|---------|-------------|
| Public web / API | HTTPS only in production |
| Browser ↔ bridge | WSS (TLS) off localhost |
| Bridge ↔ MUD | TCP; often cleartext telnet at the game host — do not log secrets |
| Hosted relay | Must not be an open TCP proxy; auth / allowlist / rate limits required |
| Repo contents | No passwords, tokens, private keys, live session dumps with credentials |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for exploitable vulnerabilities.

1. Contact the maintainer privately (GitHub security advisory on the eventual public repo, or maintainer contact once published).
2. Include: impact, reproduction steps, affected component, and whether a fix is already known.
3. Allow reasonable time for a fix before public disclosure.

## Please never commit

- Player passwords, session cookies, captcha solutions, API tokens
- Private keys / `.pem` / cloud credentials
- Full live recordings that include post-login input
- Real user connection profiles with secrets
- Vendor mudlib dumps unless license explicitly allows redistribution (RWlib research notes are OK; wholesale vendoring needs review)

Use ignored paths: `.env`, `local/`, `private/`, `captures/`, `sessions/`.

## Design rules (high level)

1. **MUD server output is untrusted** — treat as hostile HTML/ANSI for XSS purposes.
2. **User scripts are untrusted** — sandbox; no ambient credential access.
3. **Open-relay is a ship blocker** — hosted bridges fail closed.
4. **Fixtures are reviewed** — only anonymized pre-auth banners or synthetic streams under `tests/fixtures/`.

See also: `docs/OPEN-SOURCE.md`, `docs/research/rw-ansi-and-map-controls.md`.
