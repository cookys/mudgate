/**
 * Production-path MCCP goldens: real bridgeWsToMud + multi/same-chunk + Big5 decode + VT.
 * Runs under apps/proxy tests (production bridge path).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import zlib from "node:zlib";
import { EventEmitter } from "node:events";
import { IAC, WILL, SB, SE, OPT, DO } from "@mudgate/protocol";
import { Big5StreamDecoder } from "@mudgate/codec-big5";
import { ScreenBuffer } from "@mudgate/terminal";

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

const waitMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  sockets.length = 0;
});

describe("MCCP e2e via production bridge", () => {
  it("same-chunk SE+zlib → bridge inflate → Big5 decoder → ScreenBuffer", async () => {
    // Big5 for 重生 = ada b a5 cd
    const big5 = Buffer.from([0xad, 0xab, 0xa5, 0xcd]);
    const plain = Buffer.concat([Buffer.from("MAP:"), big5, Buffer.from("\r\n")]);
    const compressed = zlib.deflateSync(plain);
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    sock.emit("data", Buffer.from([IAC, WILL, OPT.MCCP2]));
    await waitMs(15);
    expect(
      sock.written.some(
        (b) => b[0] === IAC && b[1] === DO && b[2] === OPT.MCCP2,
      ),
    ).toBe(true);
    sock.emit(
      "data",
      Buffer.concat([Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]), compressed]),
    );
    await waitMs(50);
    const out = Buffer.concat(binarySends(ws));
    const text = new Big5StreamDecoder("big5hkscs").push(new Uint8Array(out));
    expect(text).toContain("MAP:");
    expect(text).toContain("重生");
    const buf = new ScreenBuffer(40, 5, "cjk");
    buf.writeDecoded(text);
    expect(buf.snapshotText()).toContain("MAP:");
    expect(buf.cells[0]!.some((c) => c.ch === "重" || c.ch === "生")).toBe(true);
  });

  it("multi-chunk zlib after SE via production bridge", async () => {
    const plain = Buffer.from("MultiChunkVT\x1b[1;31mX\x1b[0m");
    const compressed = zlib.deflateSync(plain);
    const ws = fakeWs();
    bridgeWsToMud(ws as never, { host: "127.0.0.1", port: 4000, mccp: true });
    const sock = sockets[0]!;
    sock.emit("data", Buffer.from([IAC, WILL, OPT.MCCP2]));
    await waitMs(10);
    sock.emit("data", Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]));
    await waitMs(10);
    const mid = Math.floor(compressed.length / 2);
    sock.emit("data", compressed.subarray(0, mid));
    sock.emit("data", compressed.subarray(mid));
    await waitMs(50);
    const out = Buffer.concat(binarySends(ws));
    const buf = new ScreenBuffer(40, 5, "western");
    buf.writeDecoded(out.toString("utf8"));
    expect(buf.snapshotText()).toContain("MultiChunkVT");
    expect(buf.cells[0]![0]!.attrs.fg === 1 || buf.snapshotText().includes("X")).toBe(
      true,
    );
  });
});
