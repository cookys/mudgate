import {
  Attrs,
  defaultAttrs,
  sgrDelta,
  tokenizeAnsi,
} from "@assmud/vt";

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

  /** Visible screen, plain text (no ANSI). Wide-char trail cells skipped. */
  snapshotText(): string {
    return this.exportRegionPlain(0, 0, this.rows - 1, this.cols - 1);
  }

  /** Visible screen with reconstructed SGR color codes. */
  snapshotAnsi(): string {
    return this.exportRegionAnsi(0, 0, this.rows - 1, this.cols - 1);
  }

  /** Scrollback + current screen, plain (session-friendly). */
  snapshotScrollbackPlain(): string {
    const screen = this.snapshotText();
    if (!this.scrollback.length) return screen;
    return [...this.scrollback, screen].join("\n");
  }

  /**
   * Linear selection (terminal-style): from (r0,c0) through (r1,c1) in reading order.
   * Emits plain text; wide-char trail cells skipped.
   */
  exportSelectionPlain(
    r0: number,
    c0: number,
    r1: number,
    c1: number,
  ): string {
    return this.walkSelection(r0, c0, r1, c1, false);
  }

  /** Same range with reconstructed SGR. */
  exportSelectionAnsi(
    r0: number,
    c0: number,
    r1: number,
    c1: number,
  ): string {
    return this.walkSelection(r0, c0, r1, c1, true);
  }

  /** Full screen rectangle plain (all columns). */
  exportRegionPlain(
    r0: number,
    c0: number,
    r1: number,
    c1: number,
  ): string {
    // treat as linear corners of a box: top-left → bottom-right
    const ra = Math.max(0, Math.min(r0, r1));
    const rb = Math.min(this.rows - 1, Math.max(r0, r1));
    const ca = Math.max(0, Math.min(c0, c1));
    const cb = Math.min(this.cols - 1, Math.max(c0, c1));
    return this.walkSelection(ra, ca, rb, cb, false);
  }

  exportRegionAnsi(
    r0: number,
    c0: number,
    r1: number,
    c1: number,
  ): string {
    const ra = Math.max(0, Math.min(r0, r1));
    const rb = Math.min(this.rows - 1, Math.max(r0, r1));
    const ca = Math.max(0, Math.min(c0, c1));
    const cb = Math.min(this.cols - 1, Math.max(c0, c1));
    return this.walkSelection(ra, ca, rb, cb, true);
  }

  private walkSelection(
    r0: number,
    c0: number,
    r1: number,
    c1: number,
    ansi: boolean,
  ): string {
    // normalize reading order
    let sr = r0;
    let sc = c0;
    let er = r1;
    let ec = c1;
    if (sr > er || (sr === er && sc > ec)) {
      sr = r1;
      sc = c1;
      er = r0;
      ec = c0;
    }
    sr = Math.max(0, Math.min(this.rows - 1, sr));
    er = Math.max(0, Math.min(this.rows - 1, er));
    sc = Math.max(0, Math.min(this.cols - 1, sc));
    ec = Math.max(0, Math.min(this.cols - 1, ec));

    const lines: string[] = [];
    let prev: Attrs | null = null;
    for (let r = sr; r <= er; r++) {
      const ca = r === sr ? sc : 0;
      const cb = r === er ? ec : this.cols - 1;
      let s = "";
      if (ansi) prev = null;
      for (let c = ca; c <= cb; c++) {
        const cell = this.cells[r]![c]!;
        if (cell.ch === "") continue;
        if (ansi) {
          s += sgrDelta(prev, cell.attrs);
          prev = cell.attrs;
        }
        s += cell.ch;
      }
      if (ansi) s += "\x1b[0m";
      else s = s.replace(/\s+$/, "");
      lines.push(s);
    }
    return lines.join("\n");
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
