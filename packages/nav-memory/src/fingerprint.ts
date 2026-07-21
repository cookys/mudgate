import type { MapFrameCell } from "@assmud/terminal";
import type { MapFrame, MapPin } from "./types.js";

/**
 * Visual fingerprint for map frames (C1.5) — no OCR.
 * Sample fixed grid of ch + coarse fg + geometry.
 */
export function computeFingerprint(input: {
  cols: number;
  rows: number;
  widthMode: string;
  cells: MapFrameCell[];
}): string {
  const { cols, rows, widthMode, cells } = input;
  if (!cols || !rows || cells.length !== cols * rows) return "";
  const strideR = Math.max(1, Math.floor(rows / 8));
  const strideC = Math.max(1, Math.floor(cols / 12));
  const parts: string[] = [`${cols}x${rows}:${widthMode}`];
  for (let r = 0; r < rows; r += strideR) {
    for (let c = 0; c < cols; c += strideC) {
      const cell = cells[r * cols + c]!;
      const ch = cell.wideCont ? "" : (cell.ch || " ").slice(0, 1);
      const fg = cell.fg == null ? "n" : String(cell.fg);
      parts.push(`${ch}${fg}`);
    }
  }
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export type FingerprintMatch = {
  frameId: string;
  score: number; // 1 = exact fingerprint
  fingerprint: string;
};

/** Exact fingerprint match first; else Hamming-like prefix compare on hex. */
export function rankFingerprintMatches(
  liveFp: string,
  frames: Array<Pick<MapFrame, "id" | "fingerprint">>,
  limit = 3,
): FingerprintMatch[] {
  if (!liveFp) return [];
  const scored: FingerprintMatch[] = [];
  for (const f of frames) {
    if (!f.fingerprint) continue;
    if (f.fingerprint === liveFp) {
      scored.push({ frameId: f.id, score: 1, fingerprint: f.fingerprint });
      continue;
    }
    // nibble mismatch ratio
    const n = Math.min(liveFp.length, f.fingerprint.length);
    let same = 0;
    for (let i = 0; i < n; i++) if (liveFp[i] === f.fingerprint[i]) same++;
    const score = n ? same / Math.max(liveFp.length, f.fingerprint.length) : 0;
    if (score >= 0.5) {
      scored.push({ frameId: f.id, score, fingerprint: f.fingerprint });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export type SearchHit =
  | { kind: "pin"; pin: MapPin; frameId: string }
  | { kind: "frame"; frameId: string; label?: string }
  | { kind: "journey-step"; journeyId: string; stepIndex: number; titleHint: string };

/** Simple contains search over pins / frame labels / journey titleHints. */
export function searchNavMemory(
  q: string,
  data: {
    frames: MapFrame[];
    pins: MapPin[];
    journeys?: Array<{ id: string; steps: Array<{ titleHint?: string }> }>;
  },
): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const p of data.pins) {
    if (p.text.toLowerCase().includes(needle)) {
      hits.push({ kind: "pin", pin: p, frameId: p.frameId });
    }
  }
  for (const f of data.frames) {
    if (f.label?.toLowerCase().includes(needle)) {
      hits.push({ kind: "frame", frameId: f.id, label: f.label });
    }
  }
  if (data.journeys) {
    for (const j of data.journeys) {
      j.steps.forEach((s, i) => {
        if (s.titleHint?.toLowerCase().includes(needle)) {
          hits.push({
            kind: "journey-step",
            journeyId: j.id,
            stepIndex: i,
            titleHint: s.titleHint!,
          });
        }
      });
    }
  }
  return hits;
}
