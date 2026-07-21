import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import {
  envProxyProtocolEnabled,
  formatProxyV1Header,
} from "../src/proxyProtocol.js";

const sockets: FakeSock[] = [];

class FakeSock extends EventEmitter {
  destroyed = false;
  written: Buffer[] = [];
  write(buf: Buffer | Uint8Array | string, encoding?: string) {
    void encoding;
    this.written.push(
      typeof buf === "string" ? Buffer.from(buf, "ascii") : Buffer.from(buf),
    );
    return true;
  }
  destroy() {
    this.destroyed = true;
    this.emit("close");
  }
}

vi.mock("node:net", () => ({
  default: {
    connect: () => {
      const s = new FakeSock();
      sockets.push(s);
      queueMicrotask(() => s.emit("connect"));
      return s;
    },
  },
}));

import { bridgeWsToMud } from "../src/bridge.js";

function fakeWs() {
  const ee = new EventEmitter() as EventEmitter & {
    OPEN: number;
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  ee.OPEN = 1;
  ee.readyState = 1;
  ee.send = vi.fn();
  ee.close = vi.fn();
  return ee;
}

function waitMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeEach(() => {
  sockets.length = 0;
  delete process.env.ASSMUD_PROXY_PROTOCOL;
});

describe("formatProxyV1Header", () => {
  it("formats TCP4 line", () => {
    expect(
      formatProxyV1Header({
        srcIp: "203.0.113.9",
        srcPort: 54321,
        dstIp: "127.0.0.1",
        dstPort: 4000,
      }),
    ).toBe("PROXY TCP4 203.0.113.9 127.0.0.1 54321 4000\r\n");
  });

  it("UNKNOWN for non-IPv4 src", () => {
    expect(
      formatProxyV1Header({
        srcIp: "2001:db8::1",
        dstIp: "127.0.0.1",
        dstPort: 4000,
      }),
    ).toBe("PROXY UNKNOWN\r\n");
  });

  it("UNKNOWN for injection-like garbage", () => {
    expect(
      formatProxyV1Header({
        srcIp: "1.2.3.4\r\nPROXY TCP4 evil",
        dstIp: "127.0.0.1",
        dstPort: 4000,
      }),
    ).toBe("PROXY UNKNOWN\r\n");
  });

  it("envProxyProtocolEnabled defaults off", () => {
    expect(envProxyProtocolEnabled(undefined)).toBe(false);
    expect(envProxyProtocolEnabled("0")).toBe(false);
    expect(envProxyProtocolEnabled("1")).toBe(true);
  });
});

describe("bridge PROXY protocol", () => {
  it("PROXY=0: first bytes are not PROXY prefix", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, {
      host: "127.0.0.1",
      port: 4000,
      mccp: false,
      proxyProtocol: false,
      proxySrcIp: "203.0.113.1",
    });
    const sock = sockets[0]!;
    await waitMs(20);
    // send a mud line after connect
    ws.emit("message", "look\n", false);
    await waitMs(20);
    const joined = Buffer.concat(sock.written).toString("latin1");
    expect(joined.startsWith("PROXY ")).toBe(false);
    expect(joined.includes("look")).toBe(true);
  });

  it("PROXY=1: first wire bytes are PROXY TCP4 line", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, {
      host: "127.0.0.1",
      port: 4000,
      mccp: false,
      proxyProtocol: true,
      proxySrcIp: "203.0.113.9",
      proxySrcPort: 0,
    });
    const sock = sockets[0]!;
    await waitMs(20);
    ws.emit("message", "look\n", false);
    await waitMs(20);
    expect(sock.written.length).toBeGreaterThanOrEqual(1);
    const first = sock.written[0]!.toString("ascii");
    expect(first).toBe("PROXY TCP4 203.0.113.9 127.0.0.1 0 4000\r\n");
    const rest = Buffer.concat(sock.written.slice(1)).toString("latin1");
    expect(rest.includes("look")).toBe(true);
  });

  it("PROXY=1 first buffer is header before app data", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, {
      host: "10.0.0.5",
      port: 2323,
      mccp: false,
      proxyProtocol: true,
      proxySrcIp: "198.51.100.7",
    });
    const sock = sockets[0]!;
    await waitMs(5);
    ws.emit("message", "n\n", false);
    await waitMs(20);
    expect(sock.written[0]!.toString("ascii")).toMatch(/^PROXY TCP4 /);
    expect(sock.written[0]!.toString("ascii")).toContain("198.51.100.7");
    expect(sock.written[0]!.toString("ascii")).toContain("10.0.0.5");
  });
});
