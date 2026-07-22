/**
 * Text-driven room / exit parsing for Chinese LPMud + English MUDs.
 * Input must already be Unicode (Big5 decoded). Strip SGR before match.
 */

import { parseDirection, type CompassDir } from "./dirs.js";

/** Strip CSI / OSC / simple ESC sequences for text matching. */
export function stripAnsi(s: string): string {
  return s
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b./g, "");
}

export function normalizeTitle(title: string): string {
  return stripAnsi(title)
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines that should never be room titles. */
const TITLE_IGNORE =
  /^(?:你覺得|你感到|突然|只聽|看起來|戰鬥|hp|HP|【|---|===|\s*$|你的|系統|頻道|說道|喊道|告訴|私聊)/;

export function looksLikeTitle(line: string): boolean {
  const t = normalizeTitle(line);
  if (t.length < 1 || t.length > 40) return false;
  if (TITLE_IGNORE.test(t)) return false;
  if (/^[\d\s/|]+$/.test(t)) return false;
  // prompt-ish
  if (/[>％%]\s*$/.test(t) && t.length < 8) return false;
  return true;
}

export type ParsedExits = {
  dirs: CompassDir[];
  /** raw tokens for special exits not in compass table */
  special: string[];
  raw: string;
};

const EXIT_LINE_RE = [
  /出口\s*[:：]\s*(.+)$/,
  /【出口】\s*(.+)$/,
  /這裡明顯的出口是\s*[:：]?\s*(.+)$/,
  /这里明显的出口是\s*[:：]?\s*(.+)$/,
  /這裏明顯的出口是\s*[:：]?\s*(.+)$/, // 裏 vs 裡
  /明顯的出口有\s*[:：]?\s*(.+)$/,
  /明显的出口有\s*[:：]?\s*(.+)$/,
  /可通往\s*[:：]?\s*(.+)$/,
  /方向\s*[:：]\s*(.+)$/,
  /exits?\s*[:：]\s*(.+)$/i,
  /obvious exits?\s*[:：]?\s*(.+)$/i,
];

export function parseExitsLine(line: string): ParsedExits | null {
  const plain = stripAnsi(line).trim();
  if (!plain) return null;
  let rest: string | null = null;
  for (const re of EXIT_LINE_RE) {
    const m = plain.match(re);
    if (m?.[1]) {
      rest = m[1].trim();
      break;
    }
  }
  if (!rest) return null;
  // strip trailing punctuation / "and" style
  rest = rest.replace(/[。．.！!]+$/, "").trim();
  if (/^(none|沒有|无)$/i.test(rest)) {
    return { dirs: [], special: [], raw: plain };
  }
  const tokens = rest
    .split(/[、，,\/\|]|\s+and\s+|\s+or\s+|\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const dirs: CompassDir[] = [];
  const special: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    // door annotations 東(門) / east (open)
    const core = tok.replace(/[（(].*?[）)]/g, "").trim();
    const d = parseDirection(core);
    if (d) {
      if (!seen.has(d)) {
        seen.add(d);
        dirs.push(d);
      }
    } else if (core.length > 0 && core.length < 24) {
      special.push(core);
    }
  }
  return { dirs, special, raw: plain };
}

/** Move-fail / blocked patterns — pause dig, don't place room. */
export function isMoveFail(line: string): boolean {
  const t = stripAnsi(line);
  return (
    /你不能/.test(t) ||
    /那裡沒有出口|那里没有出口/.test(t) ||
    /這個方向沒有|这个方向没有/.test(t) ||
    /似乎沒有這條路|似乎没有这条路/.test(t) ||
    /門是關|门是关|上了鎖|上了锁/.test(t) ||
    // RW-style humorous wall bumps (e.g. 明明知道南邊是牆…撞了下去)
    /明明知道/.test(t) ||
    /依然從正面撞|依然从正面撞|從正面撞|从正面撞/.test(t) ||
    /撞了下去|撞了上去|撞上去|撞下去/.test(t) ||
    /把嘴唇撞|撞的跟香腸|撞得跟香腸|撞的跟香肠|撞得跟香肠/.test(t) ||
    /(是牆|是墙).{0,24}(撞|依然)/.test(t) ||
    /(撞).{0,12}(牆|墙)/.test(t) ||
    /you can't go/i.test(t) ||
    /no (?:obvious )?exit/i.test(t) ||
    /alas, you cannot/i.test(t)
  );
}

export function isVisionFail(line: string): boolean {
  const t = stripAnsi(line);
  return (
    /太暗|一片漆黑|伸手不見五指|伸手不见五指/.test(t) ||
    /pitch black|too dark|it is dark/i.test(t)
  );
}

export function fingerprint(title: string, dirs: CompassDir[]): string {
  const t = normalizeTitle(title) || "?";
  const e = [...dirs].sort().join(",");
  return `${t}|${e}`;
}
