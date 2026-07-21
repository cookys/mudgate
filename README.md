# assmud

**目標**：在 **電腦或手機** 上，用這個 **網頁專案**，在 **加密、安全** 的條件下連上 **各家 MUD** 遊玩（zMUD 級能力的現代 web client）。

第一個深度適配標竿是 **[重生的世界 / Revival World](https://www.revivalworld.org)**（Big5、完整 ANSI/VT、map_d 等）；通用層則服務任意 Telnet/TCP MUD。

| | |
|--|--|
| 裝置 | Desktop browser + mobile browser（PWA 方向） |
| 連線 | 瀏覽器側 **TLS（HTTPS / WSS）**；MUD 側 **TCP + Telnet**（各家 mud 的真實協定） |
| 能力 | 終端 / 觸發器 / 別名 / 腳本（zMUD 心智）+ 安全預設 |
| 深度標竿 | RW：`mud.revivalworld.org:4000/5000/6000` |
| Stack | **React + Vite + TS + Tailwind**；terminal 無框架 package（[ADR-001](docs/adr/ADR-001-stack.md)） |
| Hot path | Canvas2D 預設；**WebGPU / WASM** 可插拔（非 day-1 必做） |
| 狀態 | Bootstrap — 追蹤與計劃；應用 stack 尚未 scaffold |
| 授權 | **MIT**（[`LICENSE`](LICENSE)）— 打算開源 |
| 開源準備 | [`docs/OPEN-SOURCE.md`](docs/OPEN-SOURCE.md) · [`SECURITY.md`](SECURITY.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## 安全邊界（產品語言）

| 區段 | 加密？ | 說明 |
|------|--------|------|
| 你 ↔ 本專案（網頁 / relay） | **必須 TLS** | `https://` + `wss://`，不可明文 WebSocket 上公網 |
| 本專案 proxy ↔ 目標 MUD | 依各家 mud | 多數傳統 MUD 仍是 **明文 TCP:telnet**；若 mud 提供 TLS/telnets 則優先走加密；proxy 不可變成開放大陸 open-relay |
| 憑證 / 腳本 | 本地優先 | 密碼不上 git；使用者腳本沙箱；MUD 輸出當 untrusted（防 XSS） |

「加密安全回去玩」= **公網路徑加密 + 防濫用 + 客戶端安全**，不是假裝所有 mud 伺服器本身都已 TLS。

## Project tracking (autopilot)

| Path | Role |
|------|------|
| [docs/projects/INDEX.md](docs/projects/INDEX.md) | Active / completed / archived |
| [docs/plans/](docs/plans/) | Executable plans |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Not-yet-planned |
| [.claude/](.claude/) | Autopilot DI configs |

Current project: [web-zmud-bootstrap](docs/projects/2026-07-21-web-zmud-bootstrap/README.md)  
Current plan: [web-zmud-rw](docs/plans/2026-07-21-web-zmud-rw.md) (draft R4)  
Architecture: [docs/architecture.md](docs/architecture.md) · [ADR-001 stack](docs/adr/ADR-001-stack.md)

## Open source hygiene

- **Never commit**: passwords, tokens, keys, live post-login captures → see `SECURITY.md`
- **Local dumps**: use gitignored `local/`, `private/`, `captures/`, `sessions/`
- **Env**: copy `.env.example` → `.env` (ignored)
- **Fixtures**: only reviewed anonymized streams under `tests/fixtures/`
- **Third-party research**: cite in `docs/research/`; do not vendor full mudlibs without license review

## Next

1. 關閉 plan §8 選型問題  
2. Approve plan → Phase 1：TLS 可部署的 connect path + 完整 VT 終端 MVP（先 RW 過關）  
3. 公開前跑 `docs/OPEN-SOURCE.md` pre-publish gate（gitleaks 等）

## License

[MIT](LICENSE) © 2026 Cookys Lin
