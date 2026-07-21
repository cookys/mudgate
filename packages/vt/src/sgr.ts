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
 * Phase 1a VT tokenizer: full SGR handling; other CSI recorded as tokens.
 * Input is Unicode string (already decoded from Big5).
 */
export function tokenizeAnsi(input: string, startAttrs: Attrs = defaultAttrs()): {
  tokens: Token[];
  attrs: Attrs;
} {
  const tokens: Token[] = [];
  let attrs = { ...startAttrs };
  let i = 0;
  let textBuf = "";

  const flush = () => {
    if (textBuf) {
      tokens.push({ kind: "text", text: textBuf, attrs: { ...attrs } });
      textBuf = "";
    }
  };

  while (i < input.length) {
    const ch = input[i]!;
    const code = ch.charCodeAt(0);
    if (code === 0x1b && input[i + 1] === "[") {
      flush();
      let j = i + 2;
      while (j < input.length) {
        const c = input[j]!;
        if ((c >= "0" && c <= "9") || c === ";" || c === "?" || c === ":" || c === " ") {
          j += 1;
          continue;
        }
        break;
      }
      if (j >= input.length) {
        // incomplete — keep as text
        textBuf += input.slice(i);
        break;
      }
      const final = input[j]!;
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
  return { tokens, attrs };
}

/** Strip SGR for length/compare; leave other CSI as empty for visible text. */
export function visibleText(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}
