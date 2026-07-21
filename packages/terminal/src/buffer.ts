import {
  Attrs,
  defaultAttrs,
  sgrDelta,
  tokenizeAnsi,
} from "@assmud/vt";
import { isWide, type WidthMode } from "./width.js";

export type Cell = { ch: string; attrs: Attrs };
export type { WidthMode };

/** Flat cell for map_d companion frames (C0). Deep-cloned from live buffer. */
export type MapFrameCell = {
  ch: string;
  /** null = default/unspecified; preserve what ScreenBuffer stores */
  fg: number | null;
  bg: number | null;
  bold: boolean;
  /** SGR 7 reverse — map_d borders often use this */
  inverse: boolean;
  /** wide glyph: lead has ch; trail has ch === "" and wideCont=true */
  wideCont: boolean;
};

export type MapFrameCells = {
  cols: number;
  rows: number;
  widthMode: WidthMode;
  cells: MapFrameCell[];
};

/** Capture hooks for BurstDetector (nav companion). */
export type VtCaptureEvent =
  | { type: "cup-abs"; row: number; at: number }
  | { type: "buf-mut"; at: number };

/**
 * Full VT screen buffer for map_d-class redraws (Phase 1b+).
 * Supports CUP, ED/EL, DECSTBM, save/restore cursor — not SGR-only.
 * Cell width is charset-aware via widthMode (cjk | western).
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
  /** Effective width mode — never "auto". Default western (safe for utf8). */
  widthMode: WidthMode = "western";
  /** Incomplete ESC/CSI carried across writeDecoded chunks. */
  private ansiResidual = "";
  /** Optional sink for cup-abs / buf-mut (nav companion BurstDetector). */
  private captureSink: ((e: VtCaptureEvent) => void) | null = null;
  /** When true, cell-mutating ops emit buf-mut. Web arms this during CUP burst. */
  private mapCaptureArmed = false;
  /** Clock for capture events (injectable in tests). */
  private nowFn: () => number = () => Date.now();

  constructor(cols = 80, rows = 24, widthMode: WidthMode = "western") {
    this.cols = cols;
    this.rows = rows;
    this.widthMode = widthMode;
    this.scrollBottom = rows - 1;
    this.cells = this.blank();
  }

  setCaptureSink(sink: ((e: VtCaptureEvent) => void) | null): void {
    this.captureSink = sink;
  }

  setMapCaptureArmed(armed: boolean): void {
    this.mapCaptureArmed = armed;
  }

  isMapCaptureArmed(): boolean {
    return this.mapCaptureArmed;
  }

  /** Test/host clock override for deterministic capture timestamps. */
  setNowFn(fn: () => number): void {
    this.nowFn = fn;
  }

  private emitCapture(e: VtCaptureEvent): void {
    this.captureSink?.(e);
  }

  private noteBufMut(): void {
    if (this.mapCaptureArmed) {
      this.emitCapture({ type: "buf-mut", at: this.nowFn() });
    }
  }

  /**
   * Deep-clone visible cells for map companion frames (C0.1).
   * Subsequent writeDecoded must not mutate the returned object.
   */
  snapshotCells(): MapFrameCells {
    const cells: MapFrameCell[] = new Array(this.cols * this.rows);
    let i = 0;
    for (let r = 0; r < this.rows; r++) {
      const row = this.cells[r]!;
      for (let c = 0; c < this.cols; c++) {
        const cell = row[c]!;
        const attrs = cell.attrs;
        cells[i++] = {
          ch: cell.ch,
          fg: attrs.fg,
          bg: attrs.bg,
          bold: attrs.bold,
          inverse: attrs.reverse,
          wideCont: cell.ch === "",
        };
      }
    }
    return {
      cols: this.cols,
      rows: this.rows,
      widthMode: this.widthMode,
      cells,
    };
  }

  /**
   * Change width mode. Clears the screen so cells never mix two width semantics.
   */
  setWidthMode(mode: WidthMode): void {
    if (this.widthMode === mode) return;
    this.widthMode = mode;
    this.cells = this.blank();
    this.cursor = { r: 0, c: 0 };
    this.savedCursor = null;
    this.attrs = defaultAttrs();
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
    this.ansiResidual = "";
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
    this.ansiResidual = "";
  }

  writeDecoded(text: string): void {
    const combined = this.ansiResidual + text;
    const { tokens, attrs, residual } = tokenizeAnsi(combined, this.attrs);
    this.attrs = attrs;
    this.ansiResidual = residual;
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
        // CUP — 1-based row;col (absolute positioning)
        const row = Math.min(this.rows, Math.max(1, p(0, 1))) - 1;
        const col = Math.min(this.cols, Math.max(1, p(1, 1))) - 1;
        this.cursor.r = row;
        this.cursor.c = col;
        this.emitCapture({ type: "cup-abs", row, at: this.nowFn() });
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
          this.noteBufMut();
        } else if (mode === 1) {
          for (let c = 0; c <= this.cursor.c; c++) {
            this.cells[r]![c] = { ch: " ", attrs: defaultAttrs() };
          }
          this.noteBufMut();
        } else if (mode === 2) {
          this.cells[r] = this.blankRow();
          this.noteBufMut();
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
    this.noteBufMut();
  }

  private eraseFromCursorToEnd(): void {
    const { r, c } = this.cursor;
    for (let col = c; col < this.cols; col++) {
      this.cells[r]![col] = { ch: " ", attrs: defaultAttrs() };
    }
    for (let row = r + 1; row < this.rows; row++) {
      this.cells[row] = this.blankRow();
    }
    this.noteBufMut();
  }

  private eraseFromStartToCursor(): void {
    const { r, c } = this.cursor;
    for (let row = 0; row < r; row++) {
      this.cells[row] = this.blankRow();
    }
    for (let col = 0; col <= c; col++) {
      this.cells[r]![col] = { ch: " ", attrs: defaultAttrs() };
    }
    this.noteBufMut();
  }

  private writePlain(text: string, attrs: Attrs): void {
    let mutated = false;
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
      // Fullwidth: two cells when isWide under current widthMode
      const wide = isWide(ch, this.widthMode);
      this.cells[this.cursor.r]![this.cursor.c] = { ch, attrs: { ...attrs } };
      this.cursor.c += 1;
      mutated = true;
      if (wide && this.cursor.c < this.cols) {
        // placeholder second cell for dual-color: empty continuation
        this.cells[this.cursor.r]![this.cursor.c] = {
          ch: "",
          attrs: { ...attrs },
        };
        this.cursor.c += 1;
      }
    }
    if (mutated) this.noteBufMut();
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

  private rowPlain(r: number): string {
    return this.cells[r]!.map((c) => c.ch).join("").replace(/\s+$/, "");
  }

  private pushScrollbackLine(line: string): void {
    this.scrollback.push(line);
    if (this.scrollback.length > this.maxScrollback) this.scrollback.shift();
  }

  private pushSessionLine(line: string): void {
    if (!line.length) return;
    this.sessionLog.push(line);
    if (this.sessionLog.length > this.maxSessionLog) this.sessionLog.shift();
  }

  private lineFeed(): void {
    // Session log: every completed line (LF), even if still on-screen.
    this.pushSessionLine(this.rowPlain(this.cursor.r));

    if (this.cursor.r < this.scrollBottom) {
      this.cursor.r += 1;
    } else {
      // True terminal scrollback: line scrolled off the top of the region.
      this.pushScrollbackLine(this.rowPlain(this.scrollTop));
      for (let r = this.scrollTop; r < this.scrollBottom; r++) {
        this.cells[r] = this.cells[r + 1]!;
      }
      this.cells[this.scrollBottom] = this.blankRow();
      this.noteBufMut();
    }
    this.cursor.c = 0;
  }

  /** How many lines above the live screen can be scrolled. */
  scrollbackDepth(): number {
    return this.scrollback.length;
  }

  /**
   * Plain text for one viewport row when scrolled up `offset` lines (0 = live).
   * Returns null when the row should come from live `cells[r]`.
   */
  scrollbackViewLine(offset: number, viewRow: number): string | null {
    const off = Math.max(0, Math.min(offset, this.scrollback.length));
    if (off === 0) return null;
    const idx = this.scrollback.length - off + viewRow;
    if (idx < 0) return "";
    if (idx >= this.scrollback.length) return null; // live cell row
    return this.scrollback[idx] ?? "";
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
