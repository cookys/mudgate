# mudgate

**目標**：用 **電腦或手機瀏覽器** 打開這個網頁專案，在 **登入 + 加密（HTTPS/WSS）** 下，經 **官方/自架 TCP proxy** 連上 **各家 MUD** 遊玩。

兩種表面都要顧到；**MUD 天生偏桌面**（鍵盤、大畫面、map_d），手機以「能連、能玩、介面可用」為目標——若之後能把 map 體驗也做好是加分，不當成假承諾。

深度適配標竿：[重生的世界 / Revival World](https://www.revivalworld.org)（Big5、完整 ANSI/VT、map_d）。

| | |
|--|--|
| 裝置 | **Desktop + mobile** 瀏覽器（同一套 app；可選 PWA） |
| 連線 | 瀏覽器 **WSS + 登入** → proxy → MUD **TCP/Telnet** |
| 非路徑 | 瀏覽器/WASM raw TCP；要求用戶在手機跑本機 proxy |
| Stack | **React + Vite + TS + Tailwind**；terminal 無框架 package |
| Hot path | Canvas2D 預設；**WebGPU / WASM** 可插拔（算力，不是網路） |
| 狀態 | **Phase 1a in progress** (`feat/phase-1a-connect`) — monorepo scaffold + tests green |
| 授權 | **MIT**（[LICENSE](LICENSE)）— 打算開源 |

## 為什麼需要 proxy？

瀏覽器（含頁內 WASM）**不能**對 MUD 開任意 TCP。  
遠端/手機情境用 **已登入的遠端 proxy** 代握 TCP；本機 proxy 留給開發與進階桌面。  
詳見 [ADR-002](docs/adr/ADR-002-remote-auth-proxy.md)、[threat model](docs/security/hosted-proxy-threat-model.md)。

## 安全邊界

| 區段 | 說明 |
|------|------|
| 你 ↔ 官服/自架 | **HTTPS + WSS**；公開部署要登入 |
| Proxy ↔ MUD | 多為明文 telnet；能 TLS 再 TLS；**不預設記錄遊戲內容/密碼** |
| 官服政策 | 白名單、禁內網、配額、metadata 稽核、可封號 |

## Project tracking

| Path | Role |
|------|------|
| [docs/projects/INDEX.md](docs/projects/INDEX.md) | 專案索引 |
| [docs/plans/2026-07-21-web-zmud-rw.md](docs/plans/2026-07-21-web-zmud-rw.md) | 計劃 R6 |
| [docs/architecture.md](docs/architecture.md) | 架構 |
| [docs/adr/](docs/adr/) | ADR-001 stack · ADR-002 remote auth proxy |
| [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md) | 開源衛生 |
| [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) | 安全與貢獻 |

## Dev (Phase 1a)

```bash
npm install
npm test
# terminal 1
MUDGATE_PROXY_MODE=localhost-dev npm run dev:proxy
# terminal 2
npm run dev:web
# open http://127.0.0.1:5173 — Connect to mud.revivalworld.org:4000
```

## License

[MIT](LICENSE) © 2026 Cookys Lin
