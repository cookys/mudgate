# Home proxy + Cloudflare Tunnel / Zero Trust (T1b)

Expose **your** home assmud-proxy without opening router ports.  
**Egress to the MUD stays your home ISP IP** (good for multi-login). Tunnel is **ingress only**.

```
Phone ──WSS──► Cloudflare Access ──Tunnel──► cloudflared ──► 127.0.0.1:7788
                                                      │
                                                      └── Telnet ──► MUD (home IP)
```

## Steps

1. Run proxy on loopback (`ASSMUD_BIND_HOST=127.0.0.1`, token + Origin set).
2. Install `cloudflared`; create a Tunnel with Public Hostname → `http://127.0.0.1:7788` (path `/ws` as needed).
3. **Zero Trust Access** policy: allow **only your email / IdP**.  
   **Forbidden:** world **Bypass** on the app.
4. Set `ASSMUD_ORIGIN_ALLOWLIST=https://your-cf-hostname`.
5. Web trust mode **T1** / home CF; paste `wss://your-cf-hostname/ws` + token.

## Not this

- “Tunnel changes MUD exit IP” — **false**.
- Public free node for strangers — **no**.
