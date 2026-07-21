export type AccentId = "mint" | "blue";

const KEY = "assmud.accent";

export function loadAccent(): AccentId {
  const v = localStorage.getItem(KEY);
  return v === "blue" ? "blue" : "mint";
}

export function applyAccent(id: AccentId): void {
  document.documentElement.dataset.accent = id;
  localStorage.setItem(KEY, id);
}

export const TAGLINES = [
  "Ass-embly required. Mud optional. Regret included.",
  "WebAssembly jokes. Telnet tears. Same energy.",
  "Not your grandma’s zMUD — she had better fonts.",
  "Because typing north in a browser was a personality trait.",
  "assmud: where Big5 meets midlife crisis.",
  "Half Ass, half MUD, 100% intentional branding.",
  "We put Ass in the name so you wouldn’t take us seriously. Then we shipped VT100.",
  "If this client crashes, the Ass is yours.",
  "No WASM TCP. Just Ass, WSS, and a dream.",
  "Ass first. Questions later. map_d always.",
];

export function pickTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)]!;
}
