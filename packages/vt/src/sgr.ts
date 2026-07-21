export type Attrs = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  reverse: boolean;
  fg: number | null; // 0-7 or 8-15 if bold
  bg: number | null;
};

export const defaultAttrs = (): Attrs => ({
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  blink: false,
  reverse: false,
  fg: null,
  bg: null,
});

export function applySgr(attrs: Attrs, params: number[]): Attrs {
  const next = { ...attrs };
  if (params.length === 0) params = [0];
  for (const p of params) {
    if (p === 0) Object.assign(next, defaultAttrs());
    else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4) next.underline = true;
    else if (p === 5 || p === 6) next.blink = true;
    else if (p === 7) next.reverse = true;
    else if (p === 22) {
      next.bold = false;
      next.dim = false;
    } else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p === 25) next.blink = false;
    else if (p === 27) next.reverse = false;
    else if (p >= 30 && p <= 37) next.fg = p - 30;
    else if (p === 39) next.fg = null;
    else if (p >= 40 && p <= 47) next.bg = p - 40;
    else if (p === 49) next.bg = null;
    else if (p >= 90 && p <= 97) next.fg = p - 90 + 8;
    else if (p >= 100 && p <= 107) next.bg = p - 100 + 8;
  }
  return next;
}

export type Token =
  | { kind: "text"; text: string; attrs: Attrs }
  | { kind: "csi"; raw: string; params: number[]; final: string }
  | { kind: "control"; code: number };

/**
 * VT tokenizer: full SGR handling; other CSI recorded as tokens.
 * Input is Unicode string (already decoded from Big5).
 *
 * **Streaming**: if a CSI/ESC is incomplete at end of input, it is returned in
 * `residual` (NOT flushed as visible text). Caller must prepend residual to the
 * next chunk. Dumping incomplete `\x1b[1;34` as text makes ESC invisible and
 * leaves literal `[1;34m…` on screen (RW who list dual-color names).
 */
export function tokenizeAnsi(
  input: string,
  startAttrs: Attrs = defaultAttrs(),
): {
  tokens: Token[];
  attrs: Attrs;
  /** Incomplete ESC/CSI to prepend on the next writeDecoded call */
  residual: string;
} {
  const tokens: Token[] = [];
  let attrs = { ...startAttrs };
  let i = 0;
  let textBuf = "";
  let residual = "";

  const flush = () => {
    if (textBuf) {
      tokens.push({ kind: "text", text: textBuf, attrs: { ...attrs } });
      textBuf = "";
    }
  };

  while (i < input.length) {
    const ch = input[i]!;
    const code = ch.charCodeAt(0);
    if (code === 0x1b) {
      // Lone ESC at end of chunk — wait for more
      if (i + 1 >= input.length) {
        flush();
        residual = input.slice(i);
        break;
      }
      if (input[i + 1] === "[") {
        flush();
        let j = i + 2;
        while (j < input.length) {
          const c = input[j]!;
          if (
            (c >= "0" && c <= "9") ||
            c === ";" ||
            c === "?" ||
            c === ":" ||
            c === " "
          ) {
            j += 1;
            continue;
          }
          break;
        }
        if (j >= input.length) {
          // incomplete CSI — hold, do NOT paint as text
          residual = input.slice(i);
          break;
        }
        const final = input[j]!;
        // CSI final byte is @ through ~ (0x40-0x7E)
        if (final < "@" || final > "~") {
          // not a valid CSI end — skip ESC and continue (avoid stuck)
          textBuf += ch;
          i += 1;
          continue;
        }
        const body = input.slice(i + 2, j);
        const params = body
          .split(";")
          .filter((x) => x.length && !x.startsWith("?"))
          .map((x) => parseInt(x, 10) || 0);
        const raw = input.slice(i, j + 1);
        if (final === "m") {
          attrs = applySgr(attrs, params.length ? params : [0]);
          tokens.push({ kind: "csi", raw, params, final });
        } else {
          tokens.push({ kind: "csi", raw, params, final });
        }
        i = j + 1;
        continue;
      }
      // ESC + non-[ : treat as control and continue
      flush();
      tokens.push({ kind: "control", code: 0x1b });
      i += 1;
      continue;
    }
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      flush();
      tokens.push({ kind: "control", code });
      i += 1;
      continue;
    }
    textBuf += ch;
    i += 1;
  }
  flush();
  return { tokens, attrs, residual };
}

/** Strip SGR for length/compare; leave other CSI as empty for visible text. */
export function visibleText(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function attrsEqual(a: Attrs, b: Attrs): boolean {
  return (
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.blink === b.blink &&
    a.reverse === b.reverse &&
    a.fg === b.fg &&
    a.bg === b.bg
  );
}

/** Encode Attrs as a full SGR reset+set sequence (self-contained). */
export function attrsToSgr(attrs: Attrs): string {
  const p: number[] = [0];
  if (attrs.bold) p.push(1);
  if (attrs.dim) p.push(2);
  if (attrs.italic) p.push(3);
  if (attrs.underline) p.push(4);
  if (attrs.blink) p.push(5);
  if (attrs.reverse) p.push(7);
  if (attrs.fg != null) {
    if (attrs.fg >= 8) p.push(90 + (attrs.fg - 8));
    else p.push(30 + attrs.fg);
  }
  if (attrs.bg != null) {
    if (attrs.bg >= 8) p.push(100 + (attrs.bg - 8));
    else p.push(40 + attrs.bg);
  }
  if (p.length === 1) return "\x1b[0m";
  return `\x1b[${p.join(";")}m`;
}

/**
 * Minimal SGR delta from previous attrs (or full set if prev is null).
 * Always safe to paste into another ANSI-aware terminal.
 */
export function sgrDelta(prev: Attrs | null, next: Attrs): string {
  if (prev && attrsEqual(prev, next)) return "";
  // simplest correctness: full reset+set (avoids partial-off bugs)
  return attrsToSgr(next);
}

export { attrsEqual };
