# assmud

**目標（手機優先）**：用 **手機或電腦瀏覽器** 打開這個網頁專案，在 **登入 + 加密（HTTPS/WSS）** 下，經 **官方/自架 TCP proxy** 連上 **各家 MUD** 遊玩——**不必在手機上再跑一個 proxy App**。

深度適配標竿：[重生的世界 / Revival World](https://www.revivalworld.org)（Big5、完整 ANSI/VT、map_d）。

| | |
|--|--|
| 裝置 | **Mobile browser / PWA first**；桌面同一套 |
| 連線 | 瀏覽器 **WSS + 登入** → proxy → MUD **TCP/Telnet** |
| 非路徑 | 瀏覽器/WASM raw TCP；要求用戶在手機跑本機 proxy |
| Stack | **React + Vite + TS + Tailwind**；terminal 無框架 package |
| Hot path | Canvas2D 預設；**WebGPU / WASM** 可插拔（算力，不是網路） |
| 狀態 | Bootstrap — 文件與計劃；應用尚未 scaffold |
| 授權 | **MIT**（[LICENSE](LICENSE)）— 打算開源 |

## 為什麼需要 proxy？

瀏覽器（含頁內 WASM）**不能**對 MUD 開任意 TCP。  
手機情境下合理做法是 **遠端（官方或自架）已登入的 proxy** 代握 TCP，並用白名單/配額/稽核防 open-relay。  
詳見 [ADR-002](docs/adr/ADR-002-mobile-first-proxy.md)、[threat model](docs/security/hosted-proxy-threat-model.md)。

## 安全邊界

| 區段 | 說明 |
|------|------|
| 你 ↔ 官服/自架 | **HTTPS + WSS**；要登入 |
| Proxy ↔ MUD | 多為明文 telnet（現實）；能 TLS 再 TLS；**不預設記錄遊戲內容/密碼** |
| 官服政策 | 白名單、禁內網、配額、metadata 稽核、可封號 |

## Project tracking

| Path | Role |
|------|------|
| [docs/projects/INDEX.md](docs/projects/INDEX.md) | 專案索引 |
| [docs/plans/2026-07-21-web-zmud-rw.md](docs/plans/2026-07-21-web-zmud-rw.md) | 計劃 R5 |
| [docs/architecture.md](docs/architecture.md) | 架構 |
| [docs/adr/](docs/adr/) | ADR-001 stack · ADR-002 mobile proxy |
| [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md) | 開源衛生 |
| [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) | 安全與貢獻 |

## Open source hygiene

- 勿提交密碼、token、登入後 live capture → `SECURITY.md`
- 本地傾倒：`local/` `private/` `captures/` `sessions/`（已 gitignore）
- 設定樣板：`.env.example`

## License

[MIT](LICENSE) © 2026 Cookys Lin
