import { Attrs, defaultAttrs, tokenizeAnsi } from "@assmud/vt";

export type Cell = { ch: string; attrs: Attrs };

export class ScreenBuffer {
  cols: number;
  rows: number;
  cells: Cell[][];
  cursor = { r: 0, c: 0 };
  attrs: Attrs = defaultAttrs();
  /** scrollback lines as plain strings for Phase 1a */
  scrollback: string[] = [];
  maxScrollback = 2000;

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.cells = this.blank();
  }

  private blank(): Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ ch: " ", attrs: defaultAttrs() })),
    );
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.cells = this.blank();
    this.cursor = { r: 0, c: 0 };
  }

  writeDecoded(text: string): void {
    const { tokens, attrs } = tokenizeAnsi(text, this.attrs);
    this.attrs = attrs;
    for (const t of tokens) {
      if (t.kind === "text") this.writePlain(t.text, t.attrs);
      else if (t.kind === "control" && t.code === 10) this.lineFeed();
      else if (t.kind === "control" && t.code === 13) this.cursor.c = 0;
      // other CSI (CUP etc.) ignored in Phase 1a partial terminal — Phase 1b
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
      this.cells[this.cursor.r]![this.cursor.c] = { ch, attrs: { ...attrs } };
      this.cursor.c += 1;
    }
  }

  private lineFeed(): void {
    // push current line to scrollback
    const line = this.cells[this.cursor.r]!.map((c) => c.ch).join("").replace(/\s+$/, "");
    this.scrollback.push(line);
    if (this.scrollback.length > this.maxScrollback) this.scrollback.shift();

    if (this.cursor.r < this.rows - 1) {
      this.cursor.r += 1;
    } else {
      // scroll up
      this.cells.shift();
      this.cells.push(
        Array.from({ length: this.cols }, () => ({ ch: " ", attrs: defaultAttrs() })),
      );
    }
    this.cursor.c = 0;
  }

  snapshotText(): string {
    return this.cells.map((row) => row.map((c) => c.ch).join("").replace(/\s+$/, "")).join("\n");
  }
}
