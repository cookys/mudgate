import type { HTMLAttributes } from "react";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  /** Full-page surfaces scroll here; modal overlays keep scrolling in their panel. */
  scrollY?: boolean;
};

/**
 * The single owner for visual-viewport positioning. It deliberately uses the
 * geometry published by useVisualViewport instead of layout-viewport `inset-0`.
 */
export function ViewportSurface({
  scrollY = false,
  className = "",
  style,
  ...props
}: SurfaceProps) {
  return (
    <div
      {...props}
      className={`min-h-0 min-w-0 ${
        scrollY
          ? "overflow-y-auto overflow-x-hidden overscroll-contain"
          : "overflow-hidden"
      } ${className}`}
      style={{
        ...style,
        position: "fixed",
        top: "var(--app-vtop, 0px)",
        left: "var(--app-vleft, 0px)",
        width: "var(--app-vw, 100dvw)",
        height: "var(--app-vh, 100dvh)",
        maxWidth: "var(--app-vw, 100dvw)",
        maxHeight: "var(--app-vh, 100dvh)",
      }}
      data-viewport-surface={scrollY ? "scroll" : "fixed"}
    />
  );
}

/** A modal panel may fill, but never exceed, its padded ViewportSurface. */
export function ViewportModalPanel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`min-h-0 max-h-full overflow-y-auto overscroll-contain ${className}`}
      data-viewport-modal-panel
    />
  );
}
