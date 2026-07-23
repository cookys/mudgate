# Oracle Always Free — self-host mudgate proxy

> Honest: you need an Oracle Cloud account (payment method verification may be required). Always Free has shape/region quotas. **Not** fully automatic registration.

## After the VM exists

1. Set user-data / `/etc/mudgate/bootstrap.env`:
   - `MUDGATE_PROXY_IMAGE=ghcr.io/OWNER/mudgate-proxy@sha256:…` (**digest pin**)
   - `MUDGATE_ORIGIN_ALLOWLIST=https://your-domain.example`
2. Or SSH and run `scripts/deploy/install-proxy.sh` after verifying installer SHA-256 from the release.
3. Front with **Caddy** (see `deploy/Caddyfile.proxy.example`) on **443** → `127.0.0.1:17788`.
4. Retrieve token: `sudo cat /etc/mudgate/auth_token` (never logged by cloud-init).
5. In mudgate web: trust mode **T1**, `wss://your-domain.example/ws` + token.

## Do not

- Publish port 17788 publicly.
- Use `wss://raw-ip/ws` as the normal path (need real TLS hostname).
- Share the VPS or token (operator can read cleartext MUD passwords).
