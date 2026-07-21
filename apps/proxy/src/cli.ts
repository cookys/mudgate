#!/usr/bin/env node
import { createProxyServer } from "./server.js";
import { defaultConfig } from "./policy.js";

const mode = (process.env.ASSMUD_PROXY_MODE ?? "localhost-dev") as
  | "remote-prod"
  | "localhost-dev";
const cfg = defaultConfig(mode);
if (mode === "remote-prod" && !cfg.authToken) {
  console.error("ASSMUD_AUTH_TOKEN required for remote-prod");
  process.exit(1);
}
if (mode === "remote-prod" && !cfg.originAllowlist.length) {
  console.error("ASSMUD_ORIGIN_ALLOWLIST required for remote-prod");
  process.exit(1);
}

const server = createProxyServer(cfg);
server.listen(cfg.bindPort, cfg.bindHost, () => {
  console.log(
    `assmud-proxy mode=${cfg.mode} listening ws://${cfg.bindHost}:${cfg.bindPort}/ws`,
  );
});
