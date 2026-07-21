import { describe, it, expect } from "vitest";
import {
  TelnetParser,
  IAC,
  WILL,
  DO,
  SB,
  SE,
  OPT,
  replyToNegotiation,
  DONT,
  WILL as WILL_C,
  WONT,
  MCCP2_START_SB,
} from "../src/index.js";

describe("TelnetParser", () => {
  it("strips IAC WILL/DO and yields data", () => {
    const p = new TelnetParser();
    const raw = Uint8Array.of(
      IAC,
      WILL,
      OPT.MCCP2,
      IAC,
      DO,
      OPT.TTYPE,
      0x48,
      0x69, // Hi
    );
    const ev = p.push(raw);
    expect(ev.some((e) => e.type === "will" && e.option === OPT.MCCP2)).toBe(
      true,
    );
    expect(ev.some((e) => e.type === "do" && e.option === OPT.TTYPE)).toBe(
      true,
    );
    const data = ev.filter((e) => e.type === "data");
    expect(data).toHaveLength(1);
    expect(Buffer.from(data[0]!.bytes).toString("latin1")).toBe("Hi");
  });

  it("replies DO MCCP2 when mccp true, DONT when false", () => {
    expect([...replyToNegotiation("will", OPT.MCCP2, { mccp: false })!]).toEqual(
      [IAC, DONT, OPT.MCCP2],
    );
    expect([...replyToNegotiation("will", OPT.MCCP2, { mccp: true })!]).toEqual(
      [IAC, DO, OPT.MCCP2],
    );
    expect([...replyToNegotiation("will", OPT.MCCP2)!]).toEqual([
      IAC,
      DONT,
      OPT.MCCP2,
    ]);
    expect([...replyToNegotiation("do", OPT.TTYPE)!]).toEqual([
      IAC,
      WILL_C,
      OPT.TTYPE,
    ]);
    expect([...replyToNegotiation("do", OPT.MXP)!]).toEqual([
      IAC,
      WONT,
      OPT.MXP,
    ]);
  });

  it("ECHO password mask: WILL→DO, WONT→DONT, reversed DO→WILL", () => {
    expect([...replyToNegotiation("will", OPT.ECHO)!]).toEqual([
      IAC,
      DO,
      OPT.ECHO,
    ]);
    expect([...replyToNegotiation("wont", OPT.ECHO)!]).toEqual([
      IAC,
      DONT,
      OPT.ECHO,
    ]);
    expect([...replyToNegotiation("do", OPT.ECHO)!]).toEqual([
      IAC,
      WILL_C,
      OPT.ECHO,
    ]);
    expect([...replyToNegotiation("dont", OPT.ECHO)!]).toEqual([
      IAC,
      WONT,
      OPT.ECHO,
    ]);
  });

  it("pushUntilMccpStart stops after SE and returns residual", () => {
    const p = new TelnetParser();
    // plaintext Hi + IAC SB MCCP2 IAC SE + residual bytes 0x78 0x9c (zlib header-ish)
    const chunk = Uint8Array.of(
      0x48,
      0x69,
      IAC,
      SB,
      OPT.MCCP2,
      IAC,
      SE,
      0x78,
      0x9c,
      0x01,
    );
    const r = p.pushUntilMccpStart(chunk);
    expect(r.mccpStarted).toBe(true);
    expect(r.residual).toEqual(Uint8Array.of(0x78, 0x9c, 0x01));
    const data = r.events.filter((e) => e.type === "data");
    expect(Buffer.from(data[0]!.bytes).toString("latin1")).toBe("Hi");
    expect(r.events.some((e) => e.type === "sb" && e.option === OPT.MCCP2)).toBe(
      true,
    );
  });

  it("pushUntilMccpStart preserves incomplete SE across chunks", () => {
    const p = new TelnetParser();
    const a = p.pushUntilMccpStart(
      Uint8Array.of(0x41, IAC, SB, OPT.MCCP2, IAC),
    );
    expect(a.mccpStarted).toBe(false);
    expect(Buffer.from(a.events.find((e) => e.type === "data")!.bytes).toString(
      "latin1",
    )).toBe("A");
    const b = p.pushUntilMccpStart(Uint8Array.of(SE, 0xab, 0xcd));
    expect(b.mccpStarted).toBe(true);
    expect(b.residual).toEqual(Uint8Array.of(0xab, 0xcd));
  });

  it("MCCP2_START_SB constant matches IAC SB 86 IAC SE", () => {
    expect(MCCP2_START_SB).toEqual(Uint8Array.of(IAC, SB, OPT.MCCP2, IAC, SE));
  });
});
