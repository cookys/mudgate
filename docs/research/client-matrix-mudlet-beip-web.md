# Client matrix: Mudlet / BeipMU / webmud / mudportal vs zMUD / mudgate

> Research spike R2 — public info only. Feeds future plans; not a product ship.

| Capability | zMUD | Mudlet | BeipMU | Web clients (mudportal-class) | mudgate (2026-07) |
|------------|------|--------|--------|-------------------------------|------------------|
| Big5 / CJK | ✅ | ✅ (encoding) | partial | varies | ✅ HKSCS |
| MCCP2 | ✅ | ✅ | varies | rare | ✅ proxy stream |
| Telnet ECHO mask | ✅ | ✅ | ✅ | rare | ✅ |
| Dual-width cell | ✅ | partial | partial | weak | ✅ charset mode |
| Triggers / aliases | ✅ | ✅ Lua | ✅ | limited | ✅ script-engine |
| GMCP | late | ✅ | partial | some | todo |
| MXP render | ✅ | partial | partial | XSS risk | WONT (safe) |
| Browser WSS | ❌ | ❌ | ❌ | ✅ | ✅ |
| Self-host proxy | n/a | n/a | n/a | sometimes | ✅ T0–T1 |

## Takeaways

1. mudgate’s differentiator is **browser + auth proxy + CJK cell width**, not full zMUD script parity.
2. Mudlet remains gold standard for **Lua / GMCP** power users.
3. Web portals often skip ECHO/MCCP — parity with desktop Chinese clients is the gap we close first.
