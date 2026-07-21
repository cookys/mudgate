import { Buffer } from "buffer";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyAccent, loadAccent } from "./lib/theme";
import { LocaleProvider, resolveLocale } from "./i18n";
import "./index.css";

// iconv-lite (Big5/HKSCS) needs Buffer + a Node-like global in the browser
const g = globalThis as unknown as {
  Buffer: typeof Buffer;
  global?: typeof globalThis;
  process?: { env: Record<string, string> };
};
g.Buffer = Buffer;
g.global ??= globalThis;
g.process ??= { env: {} };

// restore accent before first paint of themed chrome
applyAccent(loadAccent());

// locale + html lang before React paint
const bootLocale = resolveLocale();
try {
  document.documentElement.lang = bootLocale;
} catch {
  /* ignore */
}

// StrictMode double-mounts effects (hostile to live WebSockets in dev) — off for now.
createRoot(document.getElementById("root")!).render(
  <LocaleProvider initial={bootLocale}>
    <App />
  </LocaleProvider>,
);
