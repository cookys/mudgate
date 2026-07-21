import { describe, it, expect } from "vitest";
import {
  assertExportOmitsToken,
  canConnect,
  resolveWsUrl,
} from "../src/lib/trustMode";

describe("trustMode", () => {
  it("custom requires ack and valid wss", () => {
    expect(canConnect("custom", false, "wss://x.example/ws")).toBe(false);
    expect(canConnect("custom", true, "wss://x.example/ws")).toBe(true);
    expect(canConnect("custom", true, "")).toBe(false);
    expect(canConnect("custom", true, "ws://evil.example/ws")).toBe(false);
    expect(canConnect("local", false)).toBe(true);
    expect(canConnect("selfhost", true, "wss://mine.example/ws")).toBe(true);
  });

  it("resolveWsUrl by mode", () => {
    expect(
      resolveWsUrl("local", {
        envDefault: "ws://127.0.0.1:7788/ws",
        customWs: "",
      }),
    ).toBe("ws://127.0.0.1:7788/ws");
    expect(
      resolveWsUrl("selfhost", {
        envDefault: "ws://x",
        customWs: "wss://mine.example/ws",
      }),
    ).toBe("wss://mine.example/ws");
    expect(
      resolveWsUrl("official", {
        envDefault: "ws://x",
        customWs: "",
        officialUrl: "wss://official.example/ws",
      }),
    ).toBe("wss://official.example/ws");
    expect(
      resolveWsUrl("official", {
        envDefault: "ws://x",
        customWs: "",
      }),
    ).toBeNull();
  });

  it("export must omit proxy token fields", () => {
    const clean = JSON.stringify([{ id: "a", host: "h", port: 1 }]);
    expect(assertExportOmitsToken(clean)).toBe(true);
    expect(
      assertExportOmitsToken(JSON.stringify({ proxyToken: "secret" })),
    ).toBe(false);
  });
});
