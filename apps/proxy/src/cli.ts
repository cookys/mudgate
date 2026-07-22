#!/usr/bin/env node
import { loadDotEnv } from "./loadEnv.js";
import { createProxyServer } from "./server.js";
import { assertProdConfig, defaultConfig } from "./policy.js";

const envFiles = loadDotEnv();
if (envFiles.length) {
  console.log(`mudgate-proxy: loaded env from ${envFiles.join(", ")}`);
}

const mode = (process.env.MUDGATE_PROXY_MODE ?? "localhost-dev") as
  | "remote-prod"
  | "localhost-dev";
const cfg = defaultConfig(mode);
if (process.env.MUDGATE_BIND_HOST) cfg.bindHost = process.env.MUDGATE_BIND_HOST;
if (process.env.PORT) cfg.bindPort = Number(process.env.PORT);
if (process.env.MUDGATE_ORIGIN_ALLOWLIST) {
  cfg.originAllowlist = process.env.MUDGATE_ORIGIN_ALLOWLIST.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
const prodErr = assertProdConfig(cfg);
if (prodErr) {
  console.error(prodErr);
  process.exit(1);
}

const server = createProxyServer(cfg);
server.listen(cfg.bindPort, cfg.bindHost, () => {
  const site = cfg.siteMode ? " siteMode=1" : "";
  console.log(
    `mudgate-proxy mode=${cfg.mode}${site} listening ws://${cfg.bindHost}:${cfg.bindPort}/ws`,
  );
});
