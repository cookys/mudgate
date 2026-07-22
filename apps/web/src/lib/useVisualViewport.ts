import { useEffect, useState } from "react";

export const VV_EVENT = "mudgate:viewport";

export type ViewportDetail = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  keyboardOpen: boolean;
};

export function detectKeyboardOpen(opts: {
  typing: boolean;
  viewportHeight: number;
  layoutHeight: number;
  baselineHeight: number;
  threshold?: number;
}): boolean {
  if (!opts.typing) return false;
  const availableBaseline = Math.max(opts.layoutHeight, opts.baselineHeight);
  return availableBaseline - opts.viewportHeight > (opts.threshold ?? 100);
}

export function updateViewportBaseline(opts: {
  baselineHeight: number;
  baselineWidth: number;
  layoutWidth: number;
  viewportHeight: number;
  layoutHeight: number;
  typing: boolean;
}): { height: number; width: number } {
  const orientationChanged =
    opts.baselineWidth > 0 &&
    Math.abs(opts.layoutWidth - opts.baselineWidth) > 100;
  return {
    height:
      orientationChanged || !opts.typing
        ? Math.max(opts.layoutHeight, opts.viewportHeight)
        : opts.baselineHeight,
    width: opts.layoutWidth,
  };
}

/**
 * Bind shell height to the *visual* viewport (soft keyboard / mobile chrome).
 * Always updates --app-vh. Dispatches `mudgate:viewport` so TerminalHost can refit
 * when the keyboard opens/closes (ResizeObserver alone often misses this).
 */
export function useVisualViewport(): {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  keyboardOpen: boolean;
} {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? (window.visualViewport?.width ?? window.innerWidth) : 1280,
    height: typeof window !== "undefined" ? (window.visualViewport?.height ?? window.innerHeight) : 800,
    offsetLeft: typeof window !== "undefined" ? (window.visualViewport?.offsetLeft ?? 0) : 0,
    offsetTop: typeof window !== "undefined" ? (window.visualViewport?.offsetTop ?? 0) : 0,
    keyboardOpen: false,
  }));

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let baselineH = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);
    let baselineW = window.innerWidth;
    const settleTimers = new Set<number>();
    let lastW = 0;
    let lastH = 0;
    let lastLeft = 0;
    let lastTop = 0;
    let lastKb = false;

    const apply = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      const left = vv?.offsetLeft ?? 0;
      const top = vv?.offsetTop ?? 0;
      const layoutH = window.innerHeight;
      const ae = document.activeElement as HTMLElement | null;
      const typing =
        !!ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable);
      const baseline = updateViewportBaseline({
        baselineHeight: baselineH,
        baselineWidth: baselineW,
        layoutWidth: window.innerWidth,
        viewportHeight: h,
        layoutHeight: layoutH,
        typing,
      });
      baselineH = baseline.height;
      baselineW = baseline.width;
      const shrunk = detectKeyboardOpen({
        typing,
        viewportHeight: h,
        layoutHeight: layoutH,
        baselineHeight: baselineH,
      });

      root.style.setProperty("--app-vw", `${Math.round(w)}px`);
      root.style.setProperty("--app-vh", `${Math.round(h)}px`);
      root.style.setProperty("--app-vleft", `${Math.round(left)}px`);
      root.style.setProperty("--app-vtop", `${Math.round(top)}px`);
      root.style.setProperty("--app-offset-top", `${Math.round(top)}px`);
      root.style.setProperty("--kb-open", shrunk ? "1" : "0");
      if (shrunk) root.classList.add("kb-open");
      else root.classList.remove("kb-open");

      const wChanged = Math.abs(w - lastW) > 2;
      const hChanged = Math.abs(h - lastH) > 2;
      const leftChanged = Math.abs(left - lastLeft) > 1;
      const topChanged = Math.abs(top - lastTop) > 1;
      const kbChanged = shrunk !== lastKb;
      if (wChanged || hChanged || leftChanged || topChanged || kbChanged) {
        setViewport({
          width: w,
          height: h,
          offsetLeft: left,
          offsetTop: top,
          keyboardOpen: shrunk,
        });
      }
      lastW = w;
      lastH = h;
      lastLeft = left;
      lastTop = top;
      lastKb = shrunk;
      if (wChanged || hChanged || leftChanged || topChanged || kbChanged) {
        window.dispatchEvent(
          new CustomEvent<ViewportDetail>(VV_EVENT, {
            detail: { width: w, height: h, offsetLeft: left, offsetTop: top, keyboardOpen: shrunk },
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
      for (const ms of [50, 150, 350, 600]) {
        const timer = window.setTimeout(() => {
          settleTimers.delete(timer);
          onChange();
        }, ms);
        settleTimers.add(timer);
      }
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    vv?.addEventListener("scrollend", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      for (const timer of settleTimers) window.clearTimeout(timer);
      settleTimers.clear();
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      vv?.removeEventListener("scrollend", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return viewport;
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
