/** Font trial helpers (F2). */

/** Sample for dual-width visual trial (no MUD reconnect). */
export const TRIAL_FIXTURE = `M中M中M中
──│┌┐
Hello 你好 重 生`;

/** Ideal dual-width: fullwidth ~2× halfwidth. */
export function isAlignScoreGood(score: number, tol = 0.3): boolean {
  if (!Number.isFinite(score) || score <= 0) return false;
  return Math.abs(score - 2) <= tol;
}

/** Detect missing CJK glyph via canvas (not document.fonts.check alone). */
export function probeCjkGlyph(
  fontFamily: string,
  ch = "中",
  sizePx = 16,
): { ok: boolean; width: number } {
  if (typeof document === "undefined") return { ok: false, width: 0 };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, width: 0 };
  ctx.font = `500 ${sizePx}px ${fontFamily}`;
  const w = ctx.measureText(ch).width;
  // tofu / missing often near 0 or matches .notdef narrow
  ctx.font = `500 ${sizePx}px monospace`;
  const wMono = ctx.measureText(ch).width;
  const ok = w > 0 && Math.abs(w - wMono) > 0.5;
  return { ok, width: w };
}
