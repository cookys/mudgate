/**
 * E2E golden streams (Q1–Q3): mock TCP fixtures → protocol / MCCP inflate path.
 * Mandatory via `npm run test:e2e` — not skipped in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import {
  TelnetParser,
  pushUntilMccpStart,
  IAC,
  WILL,
  OPT,
  DO,
  replyToNegotiation,
} from "@assmud/protocol";
import { Big5StreamDecoder } from "@assmud/codec-big5";
import { startMockMud } from "./mock-mud-server.js";
import net from "node:net";

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

describe("e2e golden streams", () => {
  it("Q2a: uncompressed banner fixture yields Big5-decodable data via TelnetParser", async () => {
    const fixture = readFileSync(
      join(root, "tests/fixtures/streams/rw-banner-4000.bin"),
    );
    const mud = await startMockMud({ fixture });
    const sock = net.connect({ host: "127.0.0.1", port: mud.port });
    const raw = await readAll(sock, 400);
    await mud.close();

    const parser = new TelnetParser();
    const events = parser.push(new Uint8Array(raw));
    const data = events.filter((e) => e.type === "data");
    expect(data.length).toBeGreaterThan(0);
    const bytes = Buffer.concat(data.map((e) => Buffer.from(e.bytes)));
    const text = new Big5StreamDecoder("big5hkscs").push(new Uint8Array(bytes));
    expect(text.length).toBeGreaterThan(10);
    // IAC stripped — no 0xFF WILL as raw text stream after parse
    expect(events.some((e) => e.type === "will" || e.type === "do")).toBe(true);
  });

  it("Q2b: MCCP2 WILL→DO→SB SE→zlib residual inflates to plain", async () => {
    const plain = Buffer.from("HelloMccpE2E-MapPayload");
    const compressed = zlib.deflateSync(plain);
    // Build single chunk: WILL + SB SE + residual zlib (fixture path without live mud)
    const will = Buffer.from([IAC, WILL, OPT.MCCP2]);
    const se = Buffer.from([IAC, 250, OPT.MCCP2, IAC, 240]); // SB SE
    const wire = Buffer.concat([will, Buffer.from("Pre"), se, compressed]);

    const parser = new TelnetParser();
    // reply negotiation
    expect([...replyToNegotiation("will", OPT.MCCP2, { mccp: true })!]).toEqual([
      IAC,
      DO,
      OPT.MCCP2,
    ]);

    const r = parser.pushUntilMccpStart(new Uint8Array(wire));
    expect(r.mccpStarted).toBe(true);
    expect(r.residual.length).toBeGreaterThan(2);
    const inflated = zlib.inflateSync(Buffer.from(r.residual));
    expect(inflated.toString("utf8")).toContain("HelloMccpE2E-MapPayload");
    const pre = r.events.filter((e) => e.type === "data");
    expect(
      Buffer.concat(pre.map((e) => Buffer.from(e.bytes))).toString("utf8"),
    ).toContain("Pre");
  });

  it("Q1: mock mud TCP listens and serves fixture on 127.0.0.1", async () => {
    const fixture = Buffer.from("MockMudPing\r\n");
    const mud = await startMockMud({ fixture });
    expect(mud.port).toBeGreaterThan(0);
    const sock = net.connect({ host: "127.0.0.1", port: mud.port });
    const raw = await readAll(sock, 300);
    await mud.close();
    expect(raw.toString("utf8")).toContain("MockMudPing");
  });
});
