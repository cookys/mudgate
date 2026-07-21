/**
 * zMUD-style numeric keypad → MUD directions.
 * NumLock on: Numpad1–9. NumLock off: arrows / Home / Pg* with location=numpad.
 */
export const NUMPAD_CODE_DIR: Record<string, string> = {
  Numpad8: "n",
  Numpad2: "s",
  Numpad4: "w",
  Numpad6: "e",
  Numpad7: "nw",
  Numpad9: "ne",
  Numpad1: "sw",
  Numpad3: "se",
  Numpad5: "look",
};

/** DOM_KEY_LOCATION_NUMPAD = 3 — arrows when NumLock off */
export const NUMPAD_ARROW_DIR: Record<string, string> = {
  ArrowUp: "n",
  ArrowDown: "s",
  ArrowLeft: "w",
  ArrowRight: "e",
  Home: "nw",
  PageUp: "ne",
  End: "sw",
  PageDown: "se",
  Clear: "look", // Numpad5 without NumLock on some OSes
};

/**
 * Resolve movement command from a keyboard event, or null if not a numpad dir.
 */
export function numpadDirection(e: {
  code: string;
  key: string;
  location: number;
}): string | null {
  const byCode = NUMPAD_CODE_DIR[e.code];
  if (byCode) return byCode;
  // NumLock off: same physical keys report as arrows / navigation
  if (e.location === 3) {
    return NUMPAD_ARROW_DIR[e.code] ?? NUMPAD_ARROW_DIR[e.key] ?? null;
  }
  return null;
}
