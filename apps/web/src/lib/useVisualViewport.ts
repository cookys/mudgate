import { useEffect, useState } from "react";

export const VV_EVENT = "mudgate:viewport";

export type ViewportDetail = {
  height: number;
  offsetTop: number;
  keyboardOpen: boolean;
};

/**
 * Bind shell height to the *visual* viewport (soft keyboard / mobile chrome).
 * Always updates --app-vh. Dispatches `mudgate:viewport` so TerminalHost can refit
 * when the keyboard opens/closes (ResizeObserver alone often misses this).
 */
export function useVisualViewport(): {
  height: number;
  keyboardOpen: boolean;
} {
  const [height, setHeight] = useState(() =>
    typeof window !== "undefined"
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 800,
  );
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let lastH = 0;
    let lastKb = false;

    const apply = () => {
      const vv = window.visualViewport;
      const h = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      const layoutH = window.innerHeight;
      const ae = document.activeElement as HTMLElement | null;
      const typing =
        !!ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable);
      // Only keyboard when focused + substantially shrunk (not URL bar alone)
      const shrunk = typing && layoutH - h > 100;

      root.style.setProperty("--app-vh", `${Math.round(h)}px`);
      root.style.setProperty("--app-vtop", `${Math.round(top)}px`);
      root.style.setProperty("--app-offset-top", `${Math.round(top)}px`);
      root.style.setProperty("--kb-open", shrunk ? "1" : "0");
      if (shrunk) root.classList.add("kb-open");
      else root.classList.remove("kb-open");

      setHeight(h);
      setKeyboardOpen(shrunk);

      const hChanged = Math.abs(h - lastH) > 2;
      const kbChanged = shrunk !== lastKb;
      lastH = h;
      lastKb = shrunk;
      if (hChanged || kbChanged) {
        window.dispatchEvent(
          new CustomEvent<ViewportDetail>(VV_EVENT, {
            detail: { height: h, offsetTop: top, keyboardOpen: shrunk },
          }),
        );
      }
    };

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    const onFocusIn = () => onChange();
    const onFocusOut = () => {
      // Keyboard animates closed after blur — burst refits
      onChange();
      window.setTimeout(onChange, 50);
      window.setTimeout(onChange, 150);
      window.setTimeout(onChange, 350);
      window.setTimeout(onChange, 600);
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return { height, keyboardOpen };
}

export async function requestLandscapePlay(): Promise<
  "locked" | "need-rotate" | "unsupported"
> {
  try {
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    if (el.requestFullscreen && !document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch {
        /* optional */
      }
    }
    const so = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    if (typeof so?.lock === "function") {
      await so.lock("landscape");
      return "locked";
    }
    return "unsupported";
  } catch {
    return "need-rotate";
  }
}
