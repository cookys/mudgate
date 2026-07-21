import { isMoveFail, isVisionFail } from "./parse.js";

/**
 * Journey step-confirm replay gate (Companion C1.2).
 * Advances only after settle without move-fail; stops on known fail text
 * or when room title does not change after a step (when a pre-title existed).
 */

export type JourneyReplayStopReason = "move_fail" | "title_stuck";

export type JourneyReplayVerdict =
  | { kind: "advance" }
  | { kind: "stop"; reason: JourneyReplayStopReason };

/** Immediate stop if server line matches move/vision fail. */
export function verdictOnServerLine(line: string): JourneyReplayVerdict | null {
  if (isMoveFail(line) || isVisionFail(line)) {
    return { kind: "stop", reason: "move_fail" };
  }
  return null;
}

/**
 * After quiet settle following a sent step:
 * - if we had a pre-title and it did not change → stop (title_stuck)
 * - otherwise → advance to next step
 */
export function verdictOnSettle(
  preTitle: string | null | undefined,
  postTitle: string | null | undefined,
): JourneyReplayVerdict {
  const pre = (preTitle ?? "").trim();
  const post = (postTitle ?? "").trim();
  if (pre.length > 0 && pre === post) {
    return { kind: "stop", reason: "title_stuck" };
  }
  return { kind: "advance" };
}
