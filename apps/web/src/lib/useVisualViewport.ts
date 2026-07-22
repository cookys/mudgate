import { useEffect, useState } from "react";

/**
 * Bind shell height to the *visual* viewport (soft keyboard / mobile chrome).
 * Sets CSS vars on documentElement:
 *   --app-vh   full visual height in px
 *   --app-vtop visualViewport.offsetTop (iOS pinch/keyboard shift)
 *   --kb-open  1 when keyboard-ish (viewport shrunk while input may be focused)
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

    const apply = () => {
      const vv = window.visualViewport;
      // Prefer visualViewport height (excludes browser UI); never use a larger
      // layout height that would let the shell draw under the URL bar.
      const h = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      const layoutH = window.innerHeight;
      // iOS: layoutH - vv.height is often >120 from the URL bar alone — NOT keyboard.
      // Only treat as keyboard when an editable field is focused AND viewport shrunk.
      const ae = document.activeElement as HTMLElement | null;
      const typing =
        !!ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable);
      const shrunk = typing && layoutH - h > 100;
      root.style.setProperty("--app-vh", `${Math.round(h)}px`);
      root.style.setProperty("--app-vtop", `${Math.round(top)}px`);
      root.style.setProperty("--kb-open", shrunk ? "1" : "0");
      if (shrunk) root.classList.add("kb-open");
      else root.classList.remove("kb-open");
      // iOS: pin shell to visual viewport offset when page is scrolled under chrome
      root.style.setProperty(
        "--app-offset-top",
        `${Math.round(top)}px`,
      );
      setHeight(h);
      setKeyboardOpen(shrunk);
    };

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    // Re-evaluate keyboard heuristic when focus moves in/out of the cmd input
    const onFocusIn = () => onChange();
    const onFocusOut = () => {
      // blur fires before keyboard fully closes — recheck shortly
      window.setTimeout(onChange, 50);
      window.setTimeout(onChange, 300);
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

/** Try landscape lock from a user gesture; returns ok / need-rotate / unsupported. */
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
        /* fullscreen optional */
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
