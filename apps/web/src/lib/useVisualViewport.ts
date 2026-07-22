import { useEffect, useState } from "react";

export const VV_EVENT = "mudgate:viewport";

export type ViewportDetail = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  keyboardOpen: boolean;
};

const KEYBOARD_MIN_OCCLUSION_PX = 80;
const KEYBOARD_MIN_OCCLUSION_RATIO = 0.2;
const KEYBOARD_OPENING_MS = 500;
const KEYBOARD_CLOSING_MS = 250;

export type KeyboardPhase = "closed" | "opening" | "open" | "closing";

export function resolveKeyboardPhase(opts: {
  phase: KeyboardPhase;
  confirmedOpen: boolean;
  geometryChanged: boolean;
  transitionExpired: boolean;
  typing: boolean;
  heightDecreased: boolean;
  layoutChanged?: boolean;
  orientationChanged?: boolean;
}): { phase: KeyboardPhase; restartTimer: boolean } {
  if (opts.confirmedOpen) return { phase: "open", restartTimer: false };
  if (
    opts.layoutChanged &&
    !opts.orientationChanged &&
    opts.phase === "opening"
  ) {
    // Under resizes-visual the keyboard cannot change the layout viewport.
    // A layout-height change is therefore real geometry, not an IME opening.
    return { phase: "closed", restartTimer: false };
  }
  if (opts.phase === "open") {
    return { phase: "closing", restartTimer: true };
  }
  if (opts.phase === "opening" || opts.phase === "closing") {
    // A fresh geometry sample wins over a timer firing in the same frame.
    // Keep freezing rows until the animation has actually settled.
    if (opts.geometryChanged) {
      return { phase: opts.phase, restartTimer: true };
    }
    if (opts.transitionExpired) {
      return { phase: "closed", restartTimer: false };
    }
    return { phase: opts.phase, restartTimer: false };
  }
  if (opts.typing && opts.heightDecreased) {
    return { phase: "opening", restartTimer: true };
  }
  return { phase: "closed", restartTimer: false };
}

function isTypingElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
}

export function detectKeyboardOpen(opts: {
  typing: boolean;
  viewportHeight: number;
  layoutHeight: number;
  baselineHeight: number;
  previouslyOpen?: boolean;
  threshold?: number;
}): boolean {
  const availableBaseline = Math.max(opts.layoutHeight, opts.baselineHeight);
  const threshold =
    opts.threshold ??
    Math.max(
      KEYBOARD_MIN_OCCLUSION_PX,
      availableBaseline * KEYBOARD_MIN_OCCLUSION_RATIO,
    );
  const substantiallyShrunk =
    availableBaseline - opts.viewportHeight > threshold;
  return opts.typing
    ? substantiallyShrunk
    : Boolean(opts.previouslyOpen && substantiallyShrunk);
}

export function updateViewportBaseline(opts: {
  baselineHeight: number;
  baselineWidth: number;
  layoutWidth: number;
  viewportHeight: number;
  layoutHeight: number;
  typing: boolean;
  previouslyOpen?: boolean;
}): { height: number; width: number } {
  const orientationChanged =
    opts.baselineWidth > 0 &&
    Math.abs(opts.layoutWidth - opts.baselineWidth) > 100;
  const layoutHeightChanged =
    Math.abs(opts.layoutHeight - opts.baselineHeight) > 2;
  return {
    height:
      // index.html selects interactive-widget=resizes-visual, so layoutHeight
      // remains the authoritative full height while the keyboard only shrinks
      // the visual viewport. Rotation can reset without guessing from the old
      // orientation's width.
      orientationChanged ||
      layoutHeightChanged ||
      (!opts.typing && !opts.previouslyOpen)
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
    let keyboardPhase: KeyboardPhase = "closed";
    let transitionExpired = false;
    let transitionTimer = 0;
    let scheduleApply = () => {};

    const clearTransitionTimer = () => {
      window.clearTimeout(transitionTimer);
      transitionTimer = 0;
      transitionExpired = false;
    };

    const armKeyboardTransition = (phase: "opening" | "closing") => {
      keyboardPhase = phase;
      transitionExpired = false;
      window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => {
        transitionTimer = 0;
        transitionExpired = true;
        scheduleApply();
      }, phase === "opening" ? KEYBOARD_OPENING_MS : KEYBOARD_CLOSING_MS);
    };

    const apply = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      const left = vv?.offsetLeft ?? 0;
      const top = vv?.offsetTop ?? 0;
      const layoutH = window.innerHeight;
      const typing = isTypingElement(document.activeElement);
      const orientationChanged =
        baselineW > 0 && Math.abs(window.innerWidth - baselineW) > 100;
      const layoutHeightChanged = Math.abs(layoutH - baselineH) > 2;
      const hadKeyboardContext = keyboardPhase !== "closed";
      const baseline = updateViewportBaseline({
        baselineHeight: baselineH,
        baselineWidth: baselineW,
        layoutWidth: window.innerWidth,
        viewportHeight: h,
        layoutHeight: layoutH,
        typing,
        previouslyOpen: hadKeyboardContext,
      });
      baselineH = baseline.height;
      baselineW = baseline.width;
      const confirmedOpen = detectKeyboardOpen({
        typing,
        viewportHeight: h,
        layoutHeight: layoutH,
        baselineHeight: baselineH,
        previouslyOpen: hadKeyboardContext,
      });
      const geometryChanged =
        lastH > 0 &&
        (Math.abs(h - lastH) > 2 || Math.abs(w - lastW) > 2);
      const phase = resolveKeyboardPhase({
        phase: keyboardPhase,
        confirmedOpen,
        geometryChanged,
        transitionExpired,
        typing,
        heightDecreased:
          !orientationChanged &&
          !layoutHeightChanged &&
          lastH > 0 &&
          h < lastH - 2,
        layoutChanged: layoutHeightChanged,
        orientationChanged,
      });
      keyboardPhase = phase.phase;
      if (phase.restartTimer) {
        armKeyboardTransition(
          phase.phase === "closing" ? "closing" : "opening",
        );
      } else if (phase.phase === "open" || phase.phase === "closed") {
        clearTransitionTimer();
      }
      const shrunk = keyboardPhase !== "closed";
      if (!shrunk && !typing) baselineH = Math.max(layoutH, h);

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
    scheduleApply = onChange;
    const onFocusIn = () => {
      if (isTypingElement(document.activeElement) && keyboardPhase !== "open") {
        // Freeze rows before the first IME resize; release after a short settle
        // if this was a desktop/hardware-keyboard focus with no real occlusion.
        armKeyboardTransition("opening");
      }
      onChange();
    };
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
      clearTransitionTimer();
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
