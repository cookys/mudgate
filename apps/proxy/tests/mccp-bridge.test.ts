import { describe, it, expect, vi, beforeEach } from "vitest";
import zlib from "node:zlib";
import { EventEmitter } from "node:events";
import { IAC, WILL, SB, SE, OPT, DO, DONT } from "@assmud/protocol";

const sockets: FakeSock[] = [];

class FakeSock extends EventEmitter {
  destroyed = false;
  written: Buffer[] = [];
  write(buf: Buffer | Uint8Array) {
    this.written.push(Buffer.from(buf));
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

function binarySends(ws: ReturnType<typeof fakeWs>): Buffer[] {
  return ws.send.mock.calls
    .map((c) => {
      const a = c[0];
      if (typeof a === "string") return null;
      return Buffer.isBuffer(a) ? a : Buffer.from(a as Uint8Array);
    })
    .filter((b): b is Buffer => !!b && b[0] !== 0x7b);
}

function waitMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeEach(() => {
  sockets.length = 0;
});

describe("bridge MCCP2", () => {
  it("DO MCCP2 when enabled", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    sock.emit("data", Buffer.from([IAC, WILL, OPT.MCCP2]));
    await waitMs(15);
    expect(
      sock.written.some(
        (b) => b.length >= 3 && b[0] === IAC && b[1] === DO && b[2] === OPT.MCCP2,
      ),
    ).toBe(true);
  });

  it("DONT MCCP2 when mccp false", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: false });
    const sock = sockets[0]!;
    sock.emit("data", Buffer.from([IAC, WILL, OPT.MCCP2]));
    await waitMs(15);
    expect(
      sock.written.some(
        (b) =>
          b.length >= 3 && b[0] === IAC && b[1] === DONT && b[2] === OPT.MCCP2,
      ),
    ).toBe(true);
  });

  it("forwards plaintext before SE", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    sock.emit("data", Buffer.from("PreText"));
    await waitMs(15);
    const joined = Buffer.concat(binarySends(ws)).toString("utf8");
    expect(joined).toContain("PreText");
  });

  it("inflates same-chunk SE + residual (no zlib on WS)", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    const plain = Buffer.from("HelloMap");
    const compressed = zlib.deflateSync(plain);
    const chunk = Buffer.concat([
      Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]),
      compressed,
    ]);
    sock.emit("data", chunk);
    await waitMs(40);
    const joined = Buffer.concat(binarySends(ws));
    expect(joined.toString("utf8")).toContain("HelloMap");
    // not raw zlib header alone as entire payload
    expect(joined[0] === 0x78 && joined[1] === 0x9c && joined.length === compressed.length).toBe(
      false,
    );
  });

  it("inflates multi-chunk zlib after SE", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    const plain = Buffer.from("MultiChunkPayloadXYZ");
    const compressed = zlib.deflateSync(plain);
    sock.emit("data", Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]));
    await waitMs(10);
    const mid = Math.floor(compressed.length / 2);
    sock.emit("data", compressed.subarray(0, mid));
    sock.emit("data", compressed.subarray(mid));
    await waitMs(40);
    expect(Buffer.concat(binarySends(ws)).toString("utf8")).toContain(
      "MultiChunkPayloadXYZ",
    );
  });

  it("SE split across TCP chunks then inflate", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    const plain = Buffer.from("SplitSE");
    const compressed = zlib.deflateSync(plain);
    sock.emit("data", Buffer.from([IAC, SB, OPT.MCCP2, IAC]));
    await waitMs(10);
    sock.emit("data", Buffer.concat([Buffer.from([SE]), compressed]));
    await waitMs(40);
    expect(Buffer.concat(binarySends(ws)).toString("utf8")).toContain("SplitSE");
  });

  it("destroys if SB MCCP2 while mccp disabled", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: false });
    const sock = sockets[0]!;
    sock.emit(
      "data",
      Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE, 0x78, 0x9c]),
    );
    await waitMs(20);
    expect(ws.close).toHaveBeenCalled();
    expect(sock.destroyed).toBe(true);
  });

  it("destroys on inflate cap exceed", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, {
      host: "127.0.0.1",
      port: 4000,
      mccp: true,
      maxInflatedSession: 32,
    });
    const sock = sockets[0]!;
    const plain = Buffer.alloc(200, 0x41);
    const compressed = zlib.deflateSync(plain);
    sock.emit(
      "data",
      Buffer.concat([Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]), compressed]),
    );
    await waitMs(40);
    expect(ws.close).toHaveBeenCalled();
  });

  it("destroys on truncated zlib after end", async () => {
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    const compressed = zlib.deflateSync(Buffer.from("TruncMe"));
    sock.emit("data", Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]));
    await waitMs(10);
    // only half the stream
    sock.emit("data", compressed.subarray(0, Math.max(2, compressed.length / 3)));
    await waitMs(10);
    sock.emit("end");
    await waitMs(50);
    // either close from destroy or from finish path
    expect(ws.close).toHaveBeenCalled();
  });
});
