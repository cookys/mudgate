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
      const h = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      const layoutH = window.innerHeight;
      // Heuristic: soft keyboard or browser chrome shrunk the visual viewport
      const shrunk = layoutH - h > 120;
      root.style.setProperty("--app-vh", `${Math.round(h)}px`);
      root.style.setProperty("--app-vtop", `${Math.round(top)}px`);
      root.style.setProperty("--kb-open", shrunk ? "1" : "0");
      if (shrunk) root.classList.add("kb-open");
      else root.classList.remove("kb-open");
      setHeight(h);
      setKeyboardOpen(shrunk);
    };

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
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
