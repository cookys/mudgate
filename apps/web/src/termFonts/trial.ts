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

/**
 * Detect whether `fontFamily` actually paints CJK (not just "font is installed").
 *
 * `document.fonts.check` only means the family is available — a Latin-only face
 * still returns true while CJK is taken from fallback. We therefore never treat
 * fonts.check alone as proof of glyph coverage.
 *
 * Method: compare canvas width of `ch` under the requested stack vs an invented
 * missing family (browser default fallback only). Same width ⇒ glyph came from
 * the same fallback ⇒ requested face does not cover CJK.
 */
export function probeCjkGlyph(
  fontFamily: string,
  ch = "中",
  sizePx = 16,
): { ok: boolean; width: number } {
  if (typeof document === "undefined") return { ok: false, width: 0 };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, width: 0 };
  const stack = fontFamily;
  ctx.font = `500 ${sizePx}px ${stack}`;
  const w = ctx.measureText(ch).width;
  // Control: invented family only → browser default fallback for CJK
  ctx.font = `500 ${sizePx}px "__AssmudMissingFont__"`;
  const wMissing = ctx.measureText(ch).width;
  // Optional soft fail: fonts.check false means family not even loadable
  let fontsMissing = false;
  try {
    const bare = fontFamily.replace(/^"|"$/g, "").split(",")[0]?.trim() ?? "";
    if (bare && document.fonts?.check) {
      fontsMissing = document.fonts.check(`${sizePx}px "${bare}"`) === false;
    }
  } catch {
    fontsMissing = false;
  }
  // Require canvas evidence of coverage; never accept fonts.check===true alone
  const widthOk = w > 0 && Math.abs(w - wMissing) > 0.25;
  const ok = widthOk && !fontsMissing;
  return { ok, width: w };
}
