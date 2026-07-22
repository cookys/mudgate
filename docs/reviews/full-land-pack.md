# FULL LAND pack (key sources)

===== packages/terminal/src/buffer.ts =====
import { Attrs, defaultAttrs, tokenizeAnsi } from "@mudgate/vt";

export type Cell = { ch: string; attrs: Attrs };

/**
 * Full VT screen buffer for map_d-class redraws (Phase 1b+).
 * Supports CUP, ED/EL, DECSTBM, save/restore cursor — not SGR-only.
 */
export class ScreenBuffer {
  cols: number;
  rows: number;
  cells: Cell[][];
  cursor = { r: 0, c: 0 };
  savedCursor: { r: number; c: number; attrs: Attrs } | null = null;
  attrs: Attrs = defaultAttrs();
  /** 0-based inclusive scroll region */
  scrollTop = 0;
  scrollBottom: number;
  scrollback: string[] = [];
  maxScrollback = 5000;
  /** session log (plain text lines) */
  sessionLog: string[] = [];
  maxSessionLog = 20_000;

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.scrollBottom = rows - 1;
    this.cells = this.blank();
  }

  private blankRow(): Cell[] {
    return Array.from({ length: this.cols }, () => ({
      ch: " ",
      attrs: defaultAttrs(),
    }));
  }

  private blank(): Cell[][] {
    return Array.from({ length: this.rows }, () => this.blankRow());
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.scrollTop = 0;
    this.scrollBottom = rows - 1;
    this.cells = this.blank();
    this.cursor = { r: 0, c: 0 };
    this.savedCursor = null;
  }

  writeDecoded(text: string): void {
    const { tokens, attrs } = tokenizeAnsi(text, this.attrs);
    this.attrs = attrs;
    for (const t of tokens) {
      if (t.kind === "text") this.writePlain(t.text, t.attrs);
      else if (t.kind === "control" && t.code === 10) this.lineFeed();
      else if (t.kind === "control" && t.code === 13) this.cursor.c = 0;
      else if (t.kind === "control" && t.code === 8) {
        if (this.cursor.c > 0) this.cursor.c -= 1;
      } else if (t.kind === "control" && t.code === 7) {
        /* BEL — ignore visually */
      } else if (t.kind === "csi") {
        this.applyCsi(t.params, t.final);
      }
    }
  }

  private applyCsi(params: number[], final: string): void {
    const p = (i: number, d = 1) => {
      const v = params[i];
      return v === undefined || v === 0 ? d : v;
    };
    switch (final) {
      case "H":
      case "f": {
        // CUP — 1-based row;col
        const row = Math.min(this.rows, Math.max(1, p(0, 1))) - 1;
        const col = Math.min(this.cols, Math.max(1, p(1, 1))) - 1;
        this.cursor.r = row;
        this.cursor.c = col;
        break;
      }
      case "A": // CUU
        this.cursor.r = Math.max(0, this.cursor.r - p(0, 1));
        break;
      case "B": // CUD
        this.cursor.r = Math.min(this.rows - 1, this.cursor.r + p(0, 1));
        break;
      case "C": // CUF
        this.cursor.c = Math.min(this.cols - 1, this.cursor.c + p(0, 1));
        break;
      case "D": // CUB
        this.cursor.c = Math.max(0, this.cursor.c - p(0, 1));
        break;
      case "J": {
        // ED
        const mode = params[0] ?? 0;
        if (mode === 0) this.eraseFromCursorToEnd();
        else if (mode === 1) this.eraseFromStartToCursor();
        else if (mode === 2 || mode === 3) this.eraseAll();
        break;
      }
      case "K": {
        // EL
        const mode = params[0] ?? 0;
        const r = this.cursor.r;
        if (mode === 0) {
          for (let c = this.cursor.c; c < this.cols; c++) {
            this.cells[r]![c] = { ch: " ", attrs: defaultAttrs() };
          }
        } else if (mode === 1) {
          for (let c = 0; c <= this.cursor.c; c++) {
            this.cells[r]![c] = { ch: " ", attrs: defaultAttrs() };
          }
        } else if (mode === 2) {
          this.cells[r] = this.blankRow();
        }
        break;
      }
      case "r": {
        // DECSTBM — 1-based
        const top = Math.min(this.rows, Math.max(1, p(0, 1))) - 1;
        const bot = Math.min(this.rows, Math.max(1, params[1] ?? this.rows)) - 1;
        this.scrollTop = Math.min(top, bot);
        this.scrollBottom = Math.max(top, bot);
        this.cursor = { r: this.scrollTop, c: 0 };
        break;
      }
      case "s": // save cursor (DECSC-ish)
        this.savedCursor = {
          r: this.cursor.r,
          c: this.cursor.c,
          attrs: { ...this.attrs },
        };
        break;
      case "u": // restore
        if (this.savedCursor) {
          this.cursor.r = this.savedCursor.r;
          this.cursor.c = this.savedCursor.c;
          this.attrs = { ...this.savedCursor.attrs };
        }
        break;
      case "m":
        // already applied in tokenizer for SGR on attrs; no extra work
        break;
      default:
        break;
    }
  }

  private eraseAll(): void {
    this.cells = this.blank();
  }

  private eraseFromCursorToEnd(): void {
    const { r, c } = this.cursor;
    for (let col = c; col < this.cols; col++) {
      this.cells[r]![col] = { ch: " ", attrs: defaultAttrs() };
    }
    for (let row = r + 1; row < this.rows; row++) {
      this.cells[row] = this.blankRow();
    }
  }

  private eraseFromStartToCursor(): void {
    const { r, c } = this.cursor;
    for (let row = 0; row < r; row++) {
      this.cells[row] = this.blankRow();
    }
    for (let col = 0; col <= c; col++) {
      this.cells[r]![col] = { ch: " ", attrs: defaultAttrs() };
    }
  }

  private writePlain(text: string, attrs: Attrs): void {
    for (const ch of text) {
      if (ch === "\n") {
        this.lineFeed();
        continue;
      }
      if (ch === "\r") {
        this.cursor.c = 0;
        continue;
      }
      if (this.cursor.c >= this.cols) {
        this.lineFeed();
      }
      // Fullwidth: occupy two cells when codepoint is wide (rough CJK)
      const wide = isWide(ch);
      this.cells[this.cursor.r]![this.cursor.c] = { ch, attrs: { ...attrs } };
      this.cursor.c += 1;
      if (wide && this.cursor.c < this.cols) {
        // placeholder second cell for dual-color: same ch marker empty continuation
        this.cells[this.cursor.r]![this.cursor.c] = {
          ch: "",
          attrs: { ...attrs },
        };
        this.cursor.c += 1;
      }
    }
  }

  /**
   * Dual-color support: set left and right half attrs of a fullwidth cell at (r,c).
   * Used by synthetic fixtures and map paint paths.
   */
  setDualColorCell(
    r: number,
    c: number,
    ch: string,
    left: Attrs,
    right: Attrs,
  ): void {
    if (r < 0 || r >= this.rows || c < 0 || c + 1 >= this.cols) return;
    this.cells[r]![c] = { ch, attrs: { ...left } };
    this.cells[r]![c + 1] = { ch: "", attrs: { ...right } };
  }

  private lineFeed(): void {
    const line = this.cells[this.cursor.r]!.map((c) => c.ch).join("").replace(/\s+$/, "");
    if (line.length) {
      this.scrollback.push(line);
      this.sessionLog.push(line);
      if (this.scrollback.length > this.maxScrollback) this.scrollback.shift();
      if (this.sessionLog.length > this.maxSessionLog) this.sessionLog.shift();
    }

    if (this.cursor.r < this.scrollBottom) {
      this.cursor.r += 1;
    } else {
      // scroll within region
      for (let r = this.scrollTop; r < this.scrollBottom; r++) {
        this.cells[r] = this.cells[r + 1]!;
      }
      this.cells[this.scrollBottom] = this.blankRow();
    }
    this.cursor.c = 0;
  }

  snapshotText(): string {
    return this.cells
      .map((row) => row.map((c) => c.ch).join("").replace(/\s+$/, ""))
      .join("\n");
  }

  /** Cell attr snapshot for dual-color tests */
  cellAt(r: number, c: number): Cell | undefined {
    return this.cells[r]?.[c];
  }
}

function isWide(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  // rough CJK + fullwidth ranges
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x2fffd)
  );
}

===== packages/script-engine/src/index.ts =====
/**
 * Declarative script engine (Phase 2) — no arbitrary JS, no cookie/fetch access.
 */

export type Alias = { name: string; expand: string; enabled?: boolean };
export type Trigger = {
  id: string;
  pattern: string; // regex source
  flags?: string;
  action: "send" | "highlight" | "gag" | "setvar";
  payload?: string; // command or var name=value template
  enabled?: boolean;
  cooldownMs?: number;
};
export type Package = {
  id: string;
  name: string;
  enabled: boolean;
  aliases: Alias[];
  triggers: Trigger[];
  variables?: Record<string, string>;
};

export type EngineEvent =
  | { type: "send"; line: string }
  | { type: "highlight"; line: string }
  | { type: "gag" }
  | { type: "setvar"; key: string; value: string };

export class ScriptEngine {
  packages: Package[] = [];
  variables: Record<string, string> = {};
  private lastFire = new Map<string, number>();
  private queue: string[] = [];

  importPackage(json: string): Package {
    const p = JSON.parse(json) as Package;
    if (!p.id || !p.name) throw new Error("invalid package");
    // strip anything that looks like JS code execution hooks
    if ("code" in (p as object) || "eval" in (p as object)) {
      throw new Error("executable packages forbidden");
    }
    p.aliases = p.aliases ?? [];
    p.triggers = p.triggers ?? [];
    p.variables = p.variables ?? {};
    this.packages = this.packages.filter((x) => x.id !== p.id);
    this.packages.push(p);
    Object.assign(this.variables, p.variables);
    return p;
  }

  exportPackage(id: string): string {
    const p = this.packages.find((x) => x.id === id);
    if (!p) throw new Error("not found");
    return JSON.stringify(p, null, 2);
  }

  setEnabled(id: string, enabled: boolean): void {
    const p = this.packages.find((x) => x.id === id);
    if (p) p.enabled = enabled;
  }

  /** Expand alias; supports multi-command with `;` */
  expandInput(line: string): string[] {
    const trimmed = line.trim();
    const word = trimmed.split(/\s+/)[0] ?? "";
    const rest = trimmed.slice(word.length).trim();
    for (const pkg of this.packages) {
      if (!pkg.enabled) continue;
      for (const a of pkg.aliases) {
        if (a.enabled === false) continue;
        if (a.name === word) {
          let exp = a.expand;
          exp = exp.replace(/\$args/g, rest);
          exp = this.substVars(exp);
          return exp.split(";").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    return [this.substVars(line)];
  }

  enqueue(lines: string[]): void {
    this.queue.push(...lines);
  }

  drainQueue(max = 10): string[] {
    return this.queue.splice(0, max);
  }

  /** Process one server line (visible text). Returns events; may gag. */
  onServerLine(line: string, now = Date.now()): EngineEvent[] {
    const events: EngineEvent[] = [];
    let gag = false;
    for (const pkg of this.packages) {
      if (!pkg.enabled) continue;
      for (const t of pkg.triggers) {
        if (t.enabled === false) continue;
        let re: RegExp;
        try {
          re = new RegExp(t.pattern, t.flags ?? "");
        } catch {
          continue;
        }
        const m = re.exec(line);
        if (!m) continue;
        const cd = t.cooldownMs ?? 0;
        const last = this.lastFire.get(t.id) ?? 0;
        if (cd && now - last < cd) continue;
        this.lastFire.set(t.id, now);

        // capture groups $1.. into temps
        const locals: Record<string, string> = { ...this.variables };
        for (let i = 1; i < m.length; i++) {
          locals[String(i)] = m[i] ?? "";
        }

        switch (t.action) {
          case "gag":
            gag = true;
            events.push({ type: "gag" });
            break;
          case "highlight":
            events.push({ type: "highlight", line });
            break;
          case "send": {
            const cmd = this.substVars(t.payload ?? "", locals);
            events.push({ type: "send", line: cmd });
            this.enqueue([cmd]);
            break;
          }
          case "setvar": {
            const payload = t.payload ?? "";
            const eq = payload.indexOf("=");
            if (eq > 0) {
              const key = payload.slice(0, eq).trim();
              const val = this.substVars(payload.slice(eq + 1), locals);
              // forbid secret-looking keys
              if (/cookie|password|token|localStorage|document/i.test(key)) break;
              this.variables[key] = val;
              events.push({ type: "setvar", key, value: val });
            }
            break;
          }
        }
      }
    }
    if (gag) return events.filter((e) => e.type === "gag" || e.type === "send");
    return events;
  }

  /** Hard deny network / DOM access surface */
  forbiddenApiAccess(name: string): never {
    throw new Error(`script-engine denies access to ${name}`);
  }

  get cookie(): never {
    return this.forbiddenApiAccess("cookie");
  }

  get localStorage(): never {
    return this.forbiddenApiAccess("localStorage");
  }

  fetch(): never {
    return this.forbiddenApiAccess("fetch");
  }

  private substVars(s: string, extra: Record<string, string> = {}): string {
    const map = { ...this.variables, ...extra };
    return s.replace(/\$(\w+)/g, (_, k: string) => map[k] ?? "");
  }
}

===== packages/mapper/src/index.ts =====
/**
 * Client-side automap spike (Phase 5) — not server map_d.
 * Graph of rooms visited via movement commands.
 */

export type RoomId = string;
export type ExitDir =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "u"
  | "d";

export type Room = {
  id: RoomId;
  title: string;
  exits: Partial<Record<ExitDir, RoomId>>;
  x: number;
  y: number;
};

const DELTA: Record<ExitDir, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
  u: [0, 0],
  d: [0, 0],
};

export class ClientMap {
  rooms = new Map<RoomId, Room>();
  current: RoomId | null = null;

  ensure(id: RoomId, title = id): Room {
    let r = this.rooms.get(id);
    if (!r) {
      r = { id, title, exits: {}, x: 0, y: 0 };
      this.rooms.set(id, r);
    }
    if (title) r.title = title;
    return r;
  }

  move(dir: ExitDir, nextTitle: string): Room {
    if (!this.current) {
      const start = this.ensure("0,0", "start");
      start.x = 0;
      start.y = 0;
      this.current = start.id;
    }
    const cur = this.rooms.get(this.current)!;
    const [dx, dy] = DELTA[dir];
    const nid = `${cur.x + dx},${cur.y + dy}`;
    const next = this.ensure(nid, nextTitle);
    next.x = cur.x + dx;
    next.y = cur.y + dy;
    cur.exits[dir] = next.id;
    const rev = reverse(dir);
    if (rev) next.exits[rev] = cur.id;
    this.current = next.id;
    return next;
  }

  /** ASCII dump of visited coords */
  ascii(radius = 5): string {
    if (!this.current) return "(empty)";
    const cur = this.rooms.get(this.current)!;
    const lines: string[] = [];
    for (let y = cur.y - radius; y <= cur.y + radius; y++) {
      let row = "";
      for (let x = cur.x - radius; x <= cur.x + radius; x++) {
        const id = `${x},${y}`;
        if (id === this.current) row += "@";
        else if (this.rooms.has(id)) row += "o";
        else row += ".";
      }
      lines.push(row);
    }
    return lines.join("\n");
  }
}

function reverse(d: ExitDir): ExitDir | null {
  const m: Partial<Record<ExitDir, ExitDir>> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
    ne: "sw",
    sw: "ne",
    nw: "se",
    se: "nw",
    u: "d",
    d: "u",
  };
  return m[d] ?? null;
}

===== packages/profiles/src/index.ts =====
/** Connection profiles (Phase 4) — no secrets required; token optional. */

export type MudProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  charset: "big5hkscs" | "big5" | "utf8" | "gbk";
  tlsToMud?: boolean;
  notes?: string;
};

const KEY = "mudgate.profiles.v1";

export const DEFAULT_PROFILES: MudProfile[] = [
  {
    id: "rw-4000",
    name: "Revival World",
    host: "mud.revivalworld.org",
    port: 4000,
    charset: "big5hkscs",
  },
  {
    id: "rw-5000",
    name: "Revival World (5000)",
    host: "mud.revivalworld.org",
    port: 5000,
    charset: "big5hkscs",
  },
];

export function loadProfiles(): MudProfile[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_PROFILES];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_PROFILES];
    const parsed = JSON.parse(raw) as MudProfile[];
    return parsed.length ? parsed : [...DEFAULT_PROFILES];
  } catch {
    return [...DEFAULT_PROFILES];
  }
}

export function saveProfiles(list: MudProfile[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function exportProfilesJson(list: MudProfile[]): string {
  return JSON.stringify(list, null, 2);
}

export function importProfilesJson(json: string): MudProfile[] {
  const list = JSON.parse(json) as MudProfile[];
  if (!Array.isArray(list)) throw new Error("invalid profiles");
  return list.filter((p) => p.id && p.host && p.port);
}

===== packages/rw-pack/src/index.ts =====
import type { Package } from "@mudgate/script-engine";

/** Declarative RW convenience pack — human-validated later; safe defaults. */
export const RW_STARTER_PACK: Package = {
  id: "rw-starter",
  name: "RW Starter",
  enabled: true,
  aliases: [
    { name: "l", expand: "look" },
    { name: "i", expand: "inventory" },
    { name: "sc", expand: "score" },
  ],
  triggers: [
    {
      id: "rw-channel-chat",
      pattern: "^\\[聊天\\]",
      action: "highlight",
    },
    {
      id: "rw-hp-low",
      pattern: "生命[^0-9]*([0-9]{1,2})%",
      action: "setvar",
      payload: "hp=$1",
      cooldownMs: 2000,
    },
  ],
  variables: {},
};

export function charsetLabel(c: string): string {
  switch (c) {
    case "big5hkscs":
    case "big5":
      return "BIG5";
    case "gbk":
      return "GB";
    default:
      return "UTF-8";
  }
}

===== packages/protocol/src/telnet.ts =====
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
const MAX_BUF = 65_536;
const MAX_SB = 4_096;

export class TelnetParser {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): TelnetEvent[] {
    if (this.buf.length + chunk.length > MAX_BUF) {
      // reset on abuse / runaway SB
      this.buf = new Uint8Array(0);
      return [];
    }
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
          if (j - i > MAX_SB) {
            // drop runaway subnegotiation
            this.buf = this.buf.slice(j);
            i = 0;
            data.length = 0;
            break;
          }
        }
        if (j + 1 >= this.buf.length) break;
        if (!(this.buf[j] === IAC && this.buf[j + 1] === SE)) continue;
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

===== packages/protocol/src/mccp.ts =====
/**
 * Optional MCCP2 inflate (Phase 3). Off by default — Phase 1a DONT MCCP2.
 */
import { inflateRawSync, inflateSync } from "node:zlib";

export function tryInflateMccp(chunk: Uint8Array): Uint8Array {
  try {
    return new Uint8Array(inflateSync(Buffer.from(chunk)));
  } catch {
    try {
      return new Uint8Array(inflateRawSync(Buffer.from(chunk)));
    } catch {
      return chunk;
    }
  }
}

===== apps/proxy/src/server.ts =====
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  ProxyConfig,
  checkAuth,
  checkOrigin,
  assertDestinationAllowed,
  safeEqual,
} from "./policy.js";
import { bridgeWsToMud } from "./bridge.js";

type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

function clamp(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export function createProxyServer(cfg: ProxyConfig): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, {
        "content-type": "application/json",
        "x-content-type-options": "nosniff",
      });
      res.end(JSON.stringify({ ok: true, mode: cfg.mode }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    try {
      const hostHdr = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? "/", `http://${hostHdr}`);
      if (url.pathname !== "/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const origin = req.headers.origin;
      if (!checkOrigin(origin, cfg)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // Optional pre-auth via Bearer / cookie / (dev-only) query — still re-checked on hello
      const preAuth = checkAuth(url, cfg, req.headers.cookie, req.headers.authorization);

      wss.handleUpgrade(req, socket, head, (ws) => {
        const timer = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1008, "hello timeout");
          }
        }, 5_000);

        ws.once("message", async (data) => {
          clearTimeout(timer);
          try {
            const text = typeof data === "string" ? data : data.toString("utf8");
            const msg = JSON.parse(text) as HelloMsg;
            if (msg.type !== "hello") {
              ws.close(1008, "expected hello");
              return;
            }

            // Auth: Bearer/cookie pre-auth OR hello.token (never rely on query in remote-prod)
            let authed = preAuth;
            if (!authed && msg.token && cfg.authToken) {
              authed = safeEqual(msg.token, cfg.authToken);
            }
            if (cfg.mode === "localhost-dev" && !cfg.authToken) {
              authed = true;
            }
            if (!authed) {
              ws.close(1008, "unauthorized");
              return;
            }

            const mudHost = msg.host ?? "mud.revivalworld.org";
            const mudPort = clamp(Number(msg.port ?? 4000), 1, 65535, 4000);
            const dest = await assertDestinationAllowed(mudHost, mudPort, cfg);
            if (!dest.ok) {
              ws.send(JSON.stringify({ type: "error", message: dest.reason }));
              ws.close(1008, "destination denied");
              return;
            }

            const cols = clamp(Number(msg.cols ?? 80), 1, 511, 80);
            const rows = clamp(Number(msg.rows ?? 24), 1, 511, 24);

            ws.send(JSON.stringify({ type: "ready", host: mudHost, port: mudPort }));
            bridgeWsToMud(ws, {
              host: dest.address,
              port: mudPort,
              cols,
              rows,
            });
          } catch {
            ws.close(1008, "bad hello");
          }
        });
      });
    } catch {
      socket.destroy();
    }
  });

  return server;
}

===== apps/proxy/src/policy.ts =====
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type ProxyConfig = {
  mode: "remote-prod" | "localhost-dev";
  bindHost: string;
  bindPort: number;
  /** Required in remote-prod */
  authToken: string | null;
  allowlist: Array<{ host: string; ports: number[] }>;
  /** If true (dev), allow any non-private host:port when not on allowlist */
  relaxAllowlist: boolean;
  originAllowlist: string[];
};

export function defaultConfig(mode: "remote-prod" | "localhost-dev"): ProxyConfig {
  if (mode === "localhost-dev") {
    return {
      mode,
      bindHost: "127.0.0.1",
      bindPort: 7788,
      authToken: process.env.MUDGATE_AUTH_TOKEN ?? null,
      allowlist: [
        { host: "mud.revivalworld.org", ports: [4000, 5000, 6000] },
        { host: "127.0.0.1", ports: [4000, 2323] }, // local mock mud in tests only — still validated
      ],
      relaxAllowlist: true,
      originAllowlist: ["http://127.0.0.1:5173", "http://localhost:5173"],
    };
  }
  return {
    mode,
    bindHost: "0.0.0.0",
    bindPort: Number(process.env.PORT ?? 7788),
    authToken: process.env.MUDGATE_AUTH_TOKEN ?? null,
    allowlist: [{ host: "mud.revivalworld.org", ports: [4000, 5000, 6000] }],
    relaxAllowlist: false,
    originAllowlist: (process.env.MUDGATE_ORIGIN_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function isPrivateOrBlockedIp(ip: string): boolean {
  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    return isPrivateOrBlockedIp(ip.slice(7));
  }
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "0.0.0.0" ||
    ip === "::" ||
    ip === "::0" ||
    ip === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }
  // IPv6 ULA / link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
    return true;
  }
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  // CGNAT 100.64.0.0/10
  const cgn = /^100\.(\d+)\./.exec(ip);
  if (cgn) {
    const n = Number(cgn[1]);
    if (n >= 64 && n <= 127) return true;
  }
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  } catch {
    return false;
  }
}

export function checkOrigin(origin: string | undefined, cfg: ProxyConfig): boolean {
  if (!origin) {
    return cfg.mode === "localhost-dev";
  }
  if (cfg.mode === "localhost-dev") {
    return cfg.originAllowlist.includes(origin) || isLocalDevOrigin(origin);
  }
  if (!cfg.originAllowlist.length) return false;
  return cfg.originAllowlist.includes(origin);
}

/** Constant-time string compare for tokens (equal length after pad). */
export function safeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function checkAuth(
  url: URL,
  cfg: ProxyConfig,
  cookieHeader?: string,
  authorization?: string,
): boolean {
  if (cfg.mode === "localhost-dev" && !cfg.authToken) return true;
  const token = cfg.authToken;
  if (!token) return false;

  // Prefer Authorization: Bearer (not logged in query string)
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const t = authorization.slice(7).trim();
    if (safeEqual(t, token)) return true;
  }

  if (cookieHeader) {
    const m = /(?:^|;\s*)mudgate_session=([^;]+)/.exec(cookieHeader);
    if (m) {
      try {
        if (safeEqual(decodeURIComponent(m[1]!), token)) return true;
      } catch {
        /* ignore */
      }
    }
  }

  // Query token: localhost-dev only (avoids access-log leakage in prod)
  if (cfg.mode === "localhost-dev") {
    const q = url.searchParams.get("token") ?? url.searchParams.get("auth");
    if (q && safeEqual(q, token)) return true;
  }
  return false;
}

export async function assertDestinationAllowed(
  host: string,
  port: number,
  cfg: ProxyConfig,
): Promise<{ ok: true; address: string } | { ok: false; reason: string }> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, reason: "invalid port" };
  }

  const onList = cfg.allowlist.some(
    (e) => e.host.toLowerCase() === host.toLowerCase() && e.ports.includes(port),
  );

  if (!onList && !cfg.relaxAllowlist) {
    return { ok: false, reason: "host not on allowlist" };
  }

  let address: string;
  if (isIP(host)) {
    address = host;
  } else {
    try {
      const r = await lookup(host, { family: 4 });
      address = r.address;
    } catch {
      return { ok: false, reason: "dns failed" };
    }
  }

  // Always block cloud metadata
  if (address === "169.254.169.254") {
    return { ok: false, reason: "blocked metadata ip" };
  }

  const loopbackAllow =
    onList && (host === "127.0.0.1" || host === "localhost") && cfg.mode === "localhost-dev";

  if (isPrivateOrBlockedIp(address) && !loopbackAllow) {
    return { ok: false, reason: "private or blocked ip" };
  }

  // re-check allowlist for non-relaxed
  if (!onList && cfg.relaxAllowlist) {
    // public hosts OK in dev relax mode
    if (isPrivateOrBlockedIp(address)) {
      return { ok: false, reason: "private or blocked ip" };
    }
  }

  return { ok: true, address };
}

===== apps/proxy/src/bridge.ts =====
import net from "node:net";
import type WebSocket from "ws";
import {
  TelnetParser,
  replyToNegotiation,
  ttypeIs,
  naws,
  OPT,
} from "@mudgate/protocol";

export type BridgeOptions = {
  host: string;
  port: number;
  cols?: number;
  rows?: number;
};

function escapeIac(buf: Uint8Array): Uint8Array {
  let extra = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0xff) extra += 1;
  if (!extra) return buf;
  const out = new Uint8Array(buf.length + extra);
  let j = 0;
  for (let i = 0; i < buf.length; i++) {
    out[j++] = buf[i]!;
    if (buf[i] === 0xff) out[j++] = 0xff;
  }
  return out;
}

/**
 * Bridge one WebSocket client to one TCP MUD connection.
 * Phase 1a: handle IAC in proxy; forward application data as binary to browser.
 */
export function bridgeWsToMud(ws: WebSocket, opts: BridgeOptions): void {
  const parser = new TelnetParser();
  const cols = opts.cols ?? 80;
  const rows = opts.rows ?? 24;
  const sock = net.connect({ host: opts.host, port: opts.port });

  const sendTcp = (buf: Uint8Array) => {
    if (!sock.destroyed) sock.write(Buffer.from(buf));
  };

  sock.on("data", (chunk: Buffer) => {
    const events = parser.push(new Uint8Array(chunk));
    for (const ev of events) {
      if (ev.type === "data") {
        if (ws.readyState === ws.OPEN) ws.send(ev.bytes);
      } else if (ev.type === "will" || ev.type === "do") {
        const reply = replyToNegotiation(ev.type, ev.option);
        if (reply) sendTcp(reply);
      } else if (ev.type === "sb" && ev.option === OPT.TTYPE) {
        if (ev.payload.length > 0 && ev.payload[0] === 1) {
          sendTcp(ttypeIs("ANSI"));
        }
      } else if (ev.type === "do" && ev.option === OPT.NAWS) {
        sendTcp(naws(cols, rows));
      }
    }
  });

  sock.on("error", (err) => {
    if (ws.readyState === ws.OPEN) {
      const msg = String(err.message)
        .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
        .slice(0, 200);
      ws.send(JSON.stringify({ type: "error", message: msg || "tcp error" }));
      ws.close(1011, "tcp error");
    }
  });

  sock.on("close", () => {
    if (ws.readyState === ws.OPEN) ws.close(1000, "mud closed");
  });

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const s = String(data);
      if (s.length > 16_384) return;
      const cleaned = s.replace(/\xff/g, "");
      const line =
        cleaned.endsWith("\n") || cleaned.endsWith("\r") ? cleaned : cleaned + "\r\n";
      sendTcp(new TextEncoder().encode(line));
      return;
    }
    const buf = new Uint8Array(data as Buffer);
    if (buf.length > 16_384) return;
    sendTcp(escapeIac(buf));
  });

  ws.on("close", () => {
    sock.destroy();
  });
}

===== apps/web/src/App.tsx =====
import { useCallback, useMemo, useState } from "react";
import { TerminalHost, type HelloMsg } from "./TerminalHost";
import {
  DEFAULT_PROFILES,
  loadProfiles,
  saveProfiles,
  type MudProfile,
  exportProfilesJson,
  importProfilesJson,
} from "@mudgate/profiles";
import { ScriptEngine } from "@mudgate/script-engine";
import { RW_STARTER_PACK } from "@mudgate/rw-pack";
import { ClientMap } from "@mudgate/mapper";

const DEFAULT_WS =
  import.meta.env.VITE_PROXY_WS ?? "ws://127.0.0.1:7788/ws";

type Tab = {
  id: string;
  profileId: string;
  connected: boolean;
  status: string;
  log: string[];
};

const engine = new ScriptEngine();
try {
  engine.importPackage(JSON.stringify(RW_STARTER_PACK));
} catch {
  /* ignore */
}
const clientMap = new ClientMap();

export function App() {
  const [profiles, setProfiles] = useState<MudProfile[]>(() => loadProfiles());
  const [token, setToken] = useState(
    () => localStorage.getItem("mudgate_token") ?? "",
  );
  const [activeProfile, setActiveProfile] = useState(profiles[0]?.id ?? "rw-4000");
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "t1",
      profileId: profiles[0]?.id ?? "rw-4000",
      connected: false,
      status: "idle",
      log: [],
    },
  ]);
  const [tabId, setTabId] = useState("t1");
  const [cmd, setCmd] = useState("");
  const [mapAscii, setMapAscii] = useState("(move n/s/e/w to map)");
  const [showLog, setShowLog] = useState(false);

  const tab = tabs.find((t) => t.id === tabId)!;
  const profile =
    profiles.find((p) => p.id === (tab?.profileId ?? activeProfile)) ??
    profiles[0]!;

  const setTabStatus = useCallback((id: string, status: string) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const wsUrl = useMemo(() => {
    if (!tab?.connected) return null;
    return DEFAULT_WS;
  }, [tab?.connected]);

  const hello: HelloMsg = useMemo(
    () => ({
      type: "hello",
      token: token || undefined,
      host: profile.host,
      port: profile.port,
      cols: 80,
      rows: 28,
    }),
    [token, profile],
  );

  const onSendThroughEngine = (line: string) => {
    const expanded = engine.expandInput(line);
    for (const l of expanded) {
      const dir = l.trim().toLowerCase();
      if (["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"].includes(dir)) {
        clientMap.move(dir as "n", dir);
        setMapAscii(clientMap.ascii(4));
      }
    }
    return expanded;
  };

  const downloadLog = () => {
    const blob = new Blob([tab.log.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mudgate-session-${tab.id}.log`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 h-full flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">mudgate</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            multi-MUD · {profile.name} · {tab.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded px-2 py-1 text-xs border ${
                t.id === tabId
                  ? "bg-sky-800 border-sky-600"
                  : "bg-zinc-900 border-zinc-700"
              }`}
              onClick={() => setTabId(t.id)}
            >
              {t.id}
            </button>
          ))}
          <button
            type="button"
            className="rounded px-2 py-1 text-xs border border-zinc-700 bg-zinc-900"
            onClick={() => {
              const id = `t${tabs.length + 1}`;
              setTabs((ts) => [
                ...ts,
                {
                  id,
                  profileId: activeProfile,
                  connected: false,
                  status: "idle",
                  log: [],
                },
              ]);
              setTabId(id);
            }}
          >
            + tab
          </button>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
        <label className="text-xs flex flex-col gap-1">
          Profile
          <select
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm"
            value={tab.profileId}
            disabled={tab.connected}
            onChange={(e) => {
              const pid = e.target.value;
              setActiveProfile(pid);
              setTabs((ts) =>
                ts.map((t) => (t.id === tabId ? { ...t, profileId: pid } : t)),
              );
            }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.host}:{p.port})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs flex flex-col gap-1">
          Auth token
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={token}
            disabled={tab.connected}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem("mudgate_token", e.target.value);
            }}
          />
        </label>
        <div className="flex items-end gap-2 flex-wrap">
          <button
            type="button"
            className="rounded bg-sky-700 hover:bg-sky-600 px-3 py-2 text-sm disabled:opacity-40"
            disabled={tab.connected}
            onClick={() =>
              setTabs((ts) =>
                ts.map((t) =>
                  t.id === tabId ? { ...t, connected: true } : t,
                ),
              )
            }
          >
            連線
          </button>
          <button
            type="button"
            className="rounded bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm"
            onClick={() =>
              setTabs((ts) =>
                ts.map((t) =>
                  t.id === tabId
                    ? { ...t, connected: false, status: "idle" }
                    : t,
                ),
              )
            }
          >
            斷線
          </button>
        </div>
        <div className="flex items-end gap-1 flex-wrap">
          {["n", "s", "e", "w", "look", "score"].map((b) => (
            <button
              key={b}
              type="button"
              className="rounded bg-emerald-900/80 border border-emerald-800 px-2 py-1.5 text-xs font-mono active:scale-95"
              onClick={() => setCmd(b)}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={() => setShowLog((v) => !v)}
          >
            log
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={downloadLog}
          >
            save log
          </button>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={() => {
              const blob = new Blob([exportProfilesJson(profiles)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "mudgate-profiles.json";
              a.click();
            }}
          >
            export profiles
          </button>
          <label className="rounded border border-zinc-700 px-2 py-1.5 text-xs cursor-pointer">
            import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                const list = importProfilesJson(text);
                setProfiles(list);
                saveProfiles(list);
              }}
            />
          </label>
        </div>
      </section>

      <div className="flex-1 min-h-[280px] grid lg:grid-cols-[1fr_160px] gap-2">
        <TerminalHost
          key={tabId + String(tab.connected)}
          wsUrl={wsUrl}
          hello={hello}
          injectCommand={cmd}
          onInjectConsumed={() => setCmd("")}
          expandInput={onSendThroughEngine}
          onServerLine={(line) => {
            engine.onServerLine(line);
            setTabs((ts) =>
              ts.map((t) =>
                t.id === tabId
                  ? { ...t, log: [...t.log.slice(-5000), line] }
                  : t,
              ),
            );
          }}
          onStatus={(s) => setTabStatus(tabId, s)}
        />
        <aside className="hidden lg:block rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-tight whitespace-pre text-zinc-400 overflow-auto">
          <div className="text-zinc-500 mb-1">client map</div>
          {mapAscii}
        </aside>
      </div>

      {showLog && (
        <pre className="max-h-40 overflow-auto text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-400">
          {tab.log.slice(-100).join("\n") || "(empty log)"}
        </pre>
      )}

      <footer className="text-[10px] text-zinc-600 pb-2">
        profiles: {profiles.length || DEFAULT_PROFILES.length} · pack:{" "}
        {RW_STARTER_PACK.name} · desktop+mobile · develop
      </footer>
    </div>
  );
}

===== apps/web/src/TerminalHost.tsx =====
import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@mudgate/terminal";
import { Big5StreamDecoder } from "@mudgate/codec-big5";

export type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

type Props = {
  wsUrl: string | null;
  hello: HelloMsg;
  onStatus?: (s: string) => void;
  injectCommand?: string;
  onInjectConsumed?: () => void;
  expandInput?: (line: string) => string[];
  onServerLine?: (line: string) => void;
};

export function TerminalHost({
  wsUrl,
  hello,
  onStatus,
  injectCommand,
  onInjectConsumed,
  expandInput,
  onServerLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  helloRef.current = hello;
  const lineAcc = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!injectCommand) return;
    const lines = expandInput ? expandInput(injectCommand) : [injectCommand];
    for (const line of lines) sendLine(line);
    onInjectConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectCommand]);

  useEffect(() => {
    if (!wsUrl) return;
    onStatus?.("connecting…");
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket;

    const connect = () => {
      if (closed) return;
      onStatus?.(attempt ? `reconnecting… (${attempt})` : "connecting…");
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const paint = () => rendererRef.current.draw(bufRef.current);

      ws.onopen = () => {
        attempt = 0;
        onStatus?.("handshaking…");
        ws.send(JSON.stringify(helloRef.current));
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (closed) {
          onStatus?.("disconnected");
          return;
        }
        attempt += 1;
        if (attempt > 5) {
          onStatus?.("disconnected");
          return;
        }
        onStatus?.(`reconnect in ${attempt}s`);
        timer = setTimeout(connect, attempt * 1000);
      };
      ws.onerror = () => onStatus?.("error");
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          const s = ev.data;
          if (s.startsWith("{")) {
            try {
              const j = JSON.parse(s) as { type?: string; message?: string };
              if (j.type === "error") {
                const msg = (j.message ?? "error")
                  .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
                  .slice(0, 200);
                onStatus?.(msg || "error");
              } else if (j.type === "ready") {
                onStatus?.("connected");
              }
            } catch {
              onStatus?.("bad control frame");
            }
          }
          return;
        }
        const bytes = new Uint8Array(ev.data as ArrayBuffer);
        const text = decoderRef.current.push(bytes);
        if (text) {
          bufRef.current.writeDecoded(text);
          paint();
          // line split for script engine
          lineAcc.current += text;
          const parts = lineAcc.current.split(/\r?\n/);
          lineAcc.current = parts.pop() ?? "";
          for (const ln of parts) {
            if (ln) onServerLine?.(ln);
          }
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
      decoderRef.current.reset();
    };
  }, [wsUrl, onStatus, onServerLine]);

  const sendLine = (line: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (line.length > 4096) return;
      const lines = expandInput ? expandInput(line) : [line];
      for (const l of lines) ws.send(l);
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="overflow-auto touch-pan-y">
        <canvas
          ref={canvasRef}
          className="rounded border border-zinc-700 bg-black max-w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <form
        className="flex gap-2 sticky bottom-0 bg-zinc-950/90 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const line = String(fd.get("line") ?? "");
          sendLine(line);
          e.currentTarget.reset();
        }}
      >
        <input
          name="line"
          autoComplete="off"
          enterKeyHint="send"
          className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="指令 / alias…"
        />
        <button
          type="submit"
          className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm min-w-[4rem]"
        >
          送出
        </button>
      </form>
    </div>
  );
}
