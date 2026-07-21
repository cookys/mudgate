import { describe, it, expect } from "vitest";
import {
  TelnetParser,
  IAC,
  WILL,
  DO,
  OPT,
  replyToNegotiation,
  DONT,
  WILL as WILL_C,
  WONT,
} from "../src/telnet.js";

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
    expect(ev.some((e) => e.type === "will" && e.option === OPT.MCCP2)).toBe(true);
    expect(ev.some((e) => e.type === "do" && e.option === OPT.TTYPE)).toBe(true);
    const data = ev.filter((e) => e.type === "data");
    expect(data).toHaveLength(1);
    expect(Buffer.from(data[0]!.bytes).toString("latin1")).toBe("Hi");
  });

  it("Phase 1a replies DONT MCCP2 and WILL TTYPE", () => {
    expect([...replyToNegotiation("will", OPT.MCCP2)!]).toEqual([IAC, DONT, OPT.MCCP2]);
    expect([...replyToNegotiation("do", OPT.TTYPE)!]).toEqual([IAC, WILL_C, OPT.TTYPE]);
    expect([...replyToNegotiation("do", OPT.MXP)!]).toEqual([IAC, WONT, OPT.MXP]);
  });
});
