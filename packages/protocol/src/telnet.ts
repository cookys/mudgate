/** Telnet IAC constants and stream filter for Phase 1a. */

export const IAC = 255;
export const WILL = 251;
export const WONT = 252;
export const DO = 253;
export const DONT = 254;
export const SB = 250;
export const SE = 240;

export const OPT = {
  ECHO: 1,
  SGA: 3,
  TTYPE: 24,
  NAWS: 31,
  MSSP: 70,
  MCCP2: 86,
  MXP: 91,
} as const;

export type TelnetEvent =
  | { type: "data"; bytes: Uint8Array }
  | { type: "will"; option: number }
  | { type: "wont"; option: number }
  | { type: "do"; option: number }
  | { type: "dont"; option: number }
  | { type: "sb"; option: number; payload: Uint8Array };

/**
 * Incremental Telnet parser. Emits application data and negotiation events.
 */
export class TelnetParser {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): TelnetEvent[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const events: TelnetEvent[] = [];
    const data: number[] = [];
    let i = 0;

    while (i < this.buf.length) {
      if (this.buf[i] !== IAC) {
        data.push(this.buf[i]!);
        i += 1;
        continue;
      }
      if (i + 1 >= this.buf.length) break;
      const cmd = this.buf[i + 1]!;
      if (cmd === IAC) {
        data.push(IAC);
        i += 2;
        continue;
      }
      if (cmd === WILL || cmd === WONT || cmd === DO || cmd === DONT) {
        if (i + 2 >= this.buf.length) break;
        if (data.length) {
          events.push({ type: "data", bytes: Uint8Array.from(data) });
          data.length = 0;
        }
        const option = this.buf[i + 2]!;
        const type =
          cmd === WILL ? "will" : cmd === WONT ? "wont" : cmd === DO ? "do" : "dont";
        events.push({ type, option });
        i += 3;
        continue;
      }
      if (cmd === SB) {
        let j = i + 2;
        while (j + 1 < this.buf.length && !(this.buf[j] === IAC && this.buf[j + 1] === SE)) {
          j += 1;
        }
        if (j + 1 >= this.buf.length) break;
        if (data.length) {
          events.push({ type: "data", bytes: Uint8Array.from(data) });
          data.length = 0;
        }
        const option = this.buf[i + 2]!;
        const payload = this.buf.slice(i + 3, j);
        events.push({ type: "sb", option, payload });
        i = j + 2;
        continue;
      }
      // other IAC cmds — skip one
      i += 2;
    }

    if (data.length) {
      events.push({ type: "data", bytes: Uint8Array.from(data) });
    }
    this.buf = this.buf.slice(i);
    return events;
  }
}

export function cmd(cmdByte: number, option: number): Uint8Array {
  return Uint8Array.of(IAC, cmdByte, option);
}

/** Phase 1a negotiation replies per plan: refuse MCCP2/MXP, accept TTYPE/NAWS. */
export function replyToNegotiation(
  kind: "will" | "do",
  option: number,
): Uint8Array | null {
  if (kind === "will") {
    if (option === OPT.MCCP2) return cmd(DONT, OPT.MCCP2);
    if (option === OPT.MSSP) return cmd(DONT, OPT.MSSP);
    return cmd(DONT, option);
  }
  // DO
  if (option === OPT.TTYPE) return cmd(WILL, OPT.TTYPE);
  if (option === OPT.NAWS) return cmd(WILL, OPT.NAWS);
  if (option === OPT.MXP) return cmd(WONT, OPT.MXP);
  return cmd(WONT, option);
}

/** IAC SB TTYPE IS "ANSI" IAC SE */
export function ttypeIs(name = "ANSI"): Uint8Array {
  const enc = new TextEncoder().encode(name);
  const out = new Uint8Array(5 + enc.length + 2);
  out[0] = IAC;
  out[1] = SB;
  out[2] = OPT.TTYPE;
  out[3] = 0; // IS
  out.set(enc, 4);
  out[4 + enc.length] = IAC;
  out[5 + enc.length] = SE;
  return out;
}

/** IAC SB NAWS width height IAC SE (16-bit big-endian each) */
export function naws(cols: number, rows: number): Uint8Array {
  return Uint8Array.of(
    IAC,
    SB,
    OPT.NAWS,
    (cols >> 8) & 0xff,
    cols & 0xff,
    (rows >> 8) & 0xff,
    rows & 0xff,
    IAC,
    SE,
  );
}
