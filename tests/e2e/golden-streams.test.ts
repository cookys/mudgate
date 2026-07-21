/**
 * E2E golden streams (Q1–Q3): mock TCP + MCCP2 stream inflate (same algorithm as proxy bridge).
 * Mandatory via `npm run test:e2e`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import net from "node:net";
import {
  TelnetParser,
  IAC,
  WILL,
  OPT,
  DO,
  SB,
  SE,
  replyToNegotiation,
} from "@assmud/protocol";
import { Big5StreamDecoder } from "@assmud/codec-big5";
import { ScreenBuffer } from "@assmud/terminal";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readAll(sock: net.Socket, ms = 500): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const t = setTimeout(() => {
      sock.destroy();
      resolve(Buffer.concat(chunks));
    }, ms);
    sock.on("data", (c) => chunks.push(c));
    sock.on("end", () => {
      clearTimeout(t);
      resolve(Buffer.concat(chunks));
    });
  });
}

/** Same stream path as proxy bridge: boundary parse then createInflate. */
async function inflateAfterMccpStart(
  wireChunks: Uint8Array[],
): Promise<{ preEvents: ReturnType<TelnetParser["push"]>; inflated: Buffer }> {
  const parser = new TelnetParser();
  const inflatedChunks: Buffer[] = [];
  let inflate: zlib.Inflate | null = null;
  let preEvents: ReturnType<TelnetParser["push"]> = [];

  for (const chunk of wireChunks) {
    if (!inflate) {
      const r = parser.pushUntilMccpStart(chunk);
      preEvents = preEvents.concat(r.events);
      if (r.mccpStarted) {
        inflate = zlib.createInflate();
        inflate.on("data", (d: Buffer) => inflatedChunks.push(d));
        if (r.residual.length) inflate.write(Buffer.from(r.residual));
      }
    } else {
      inflate.write(Buffer.from(chunk));
    }
  }
  await new Promise<void>((resolve, reject) => {
    if (!inflate) {
      resolve();
      return;
    }
    inflate.end();
    inflate.once("end", () => resolve());
    inflate.once("error", reject);
    setTimeout(() => resolve(), 100);
  });
  return { preEvents, inflated: Buffer.concat(inflatedChunks) };
}

describe("e2e golden streams", () => {
  it("Q1: mock mud TCP on 127.0.0.1 serves fixture", async () => {
    const fixture = Buffer.from("MockMudPing\r\n");
    const server = net.createServer((sock) => {
      sock.write(fixture);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as net.AddressInfo).port;
    const sock = net.connect({ host: "127.0.0.1", port });
    const raw = await readAll(sock, 300);
    await new Promise<void>((r) => server.close(() => r()));
    expect(raw.toString("utf8")).toContain("MockMudPing");
  });

  it("Q2a: RW banner fixture → TelnetParser data → Big5 text", async () => {
    const fixture = readFileSync(
      join(root, "tests/fixtures/streams/rw-banner-4000.bin"),
    );
    const server = net.createServer((sock) => {
      sock.write(fixture);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as net.AddressInfo).port;
    const sock = net.connect({ host: "127.0.0.1", port });
    const raw = await readAll(sock, 400);
    await new Promise<void>((r) => server.close(() => r()));

    const parser = new TelnetParser();
    const events = parser.push(new Uint8Array(raw));
    const data = events.filter((e) => e.type === "data");
    expect(data.length).toBeGreaterThan(0);
    const bytes = Buffer.concat(data.map((e) => Buffer.from(e.bytes)));
    const text = new Big5StreamDecoder("big5hkscs").push(new Uint8Array(bytes));
    expect(text.length).toBeGreaterThan(10);
    expect(events.some((e) => e.type === "will" || e.type === "do")).toBe(true);
  });

  it("Q2b same-chunk: WILL→DO, SB SE+zlib residual → inflate → VT ScreenBuffer", async () => {
    expect([...replyToNegotiation("will", OPT.MCCP2, { mccp: true })!]).toEqual([
      IAC,
      DO,
      OPT.MCCP2,
    ]);
    const plain = Buffer.from("\x1b[1;32mMCCP_SAME\x1b[0m city");
    const compressed = zlib.deflateSync(plain);
    const wire = Buffer.concat([
      Buffer.from([IAC, WILL, OPT.MCCP2]),
      Buffer.from("PreText"),
      Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]),
      compressed,
    ]);
    const { preEvents, inflated } = await inflateAfterMccpStart([
      new Uint8Array(wire),
    ]);
    const pre = Buffer.concat(
      preEvents
        .filter((e) => e.type === "data")
        .map((e) => Buffer.from(e.bytes)),
    );
    expect(pre.toString("utf8")).toContain("PreText");
    expect(inflated.toString("utf8")).toContain("MCCP_SAME");

    const parser = new TelnetParser();
    const events = parser.push(new Uint8Array(inflated));
    const dataBytes = Buffer.concat(
      events.filter((e) => e.type === "data").map((e) => Buffer.from(e.bytes)),
    );
    const buf = new ScreenBuffer(40, 5, "western");
    buf.writeDecoded(dataBytes.toString("utf8"));
    expect(buf.snapshotText()).toContain("MCCP_SAME");
  });

  it("Q2b multi-chunk: SE then zlib halves → stream inflate → CJK cells", async () => {
    const plain = Buffer.from("MultiChunk\x1b[0m重生");
    const compressed = zlib.deflateSync(plain);
    const mid = Math.max(1, Math.floor(compressed.length / 2));
    const chunks = [
      new Uint8Array([IAC, WILL, OPT.MCCP2]),
      new Uint8Array([IAC, SB, OPT.MCCP2, IAC, SE]),
      new Uint8Array(compressed.subarray(0, mid)),
      new Uint8Array(compressed.subarray(mid)),
    ];
    const { inflated } = await inflateAfterMccpStart(chunks);
    expect(inflated.toString("utf8")).toContain("MultiChunk");
    expect(inflated.toString("utf8")).toContain("重生");

    const parser = new TelnetParser();
    const events = parser.push(new Uint8Array(inflated));
    expect(events.some((e) => e.type === "data")).toBe(true);
    const dataBytes = Buffer.concat(
      events.filter((e) => e.type === "data").map((e) => Buffer.from(e.bytes)),
    );
    const buf = new ScreenBuffer(40, 5, "cjk");
    buf.writeDecoded(dataBytes.toString("utf8"));
    const snap = buf.snapshotText();
    expect(snap).toContain("MultiChunk");
    expect(buf.cells[0]!.some((c) => c.ch === "重" || c.ch === "生")).toBe(
      true,
    );
  });
});
