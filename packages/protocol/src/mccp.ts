/**
 * MCCP2 helpers — stream inflate lives in proxy bridge (zlib.createInflate).
 * No silent per-chunk inflate (removed tryInflateMccp anti-pattern).
 */

/** IAC SB MCCP2 IAC SE — server starts compression after this. */
export const MCCP2_START_SB = Uint8Array.of(255, 250, 86, 255, 240);
