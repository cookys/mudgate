import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  detectKeyboardOpen,
  resolveKeyboardPhase,
  updateViewportBaseline,
} from "../src/lib/useVisualViewport";

describe("detectKeyboardOpen", () => {
  it("does not classify an early animation or browser-chrome frame as a confirmed keyboard", () => {
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 720,
        layoutHeight: 720,
        baselineHeight: 780,
      }),
    ).toBe(false);
  });

  it("detects resizes-content keyboards", () => {
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 420,
        layoutHeight: 420,
        baselineHeight: 780,
      }),
    ).toBe(true);
  });

  it("closes while the input remains focused when height recovers", () => {
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 780,
        layoutHeight: 780,
        baselineHeight: 780,
      }),
    ).toBe(false);
  });

  it("stays open after blur until the visual viewport actually recovers", () => {
    expect(
      detectKeyboardOpen({
        typing: false,
        viewportHeight: 420,
        layoutHeight: 420,
        baselineHeight: 780,
        previouslyOpen: true,
      }),
    ).toBe(true);
    expect(
      detectKeyboardOpen({
        typing: false,
        viewportHeight: 780,
        layoutHeight: 780,
        baselineHeight: 780,
        previouslyOpen: true,
      }),
    ).toBe(false);
  });

  it("releases the latch when only browser chrome remains after keyboard close", () => {
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 720,
        layoutHeight: 720,
        baselineHeight: 780,
        previouslyOpen: true,
      }),
    ).toBe(false);
  });

  it("ignores browser chrome changes when no editor is focused", () => {
    expect(
      detectKeyboardOpen({
        typing: false,
        viewportHeight: 620,
        layoutHeight: 780,
        baselineHeight: 780,
      }),
    ).toBe(false);
  });
});

describe("updateViewportBaseline", () => {
  it("does not overwrite the full-height baseline during keyboard-close blur", () => {
    expect(
      updateViewportBaseline({
        baselineHeight: 780,
        baselineWidth: 390,
        layoutWidth: 390,
        viewportHeight: 420,
        layoutHeight: 780,
        typing: false,
        previouslyOpen: true,
      }),
    ).toEqual({ height: 780, width: 390 });
  });

  it("resets portrait baseline after rotation while input remains focused", () => {
    const landscape = updateViewportBaseline({
      baselineHeight: 780,
      baselineWidth: 390,
      layoutWidth: 780,
      viewportHeight: 390,
      layoutHeight: 390,
      typing: true,
    });
    expect(landscape).toEqual({ height: 390, width: 780 });
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 390,
        layoutHeight: 390,
        baselineHeight: landscape.height,
      }),
    ).toBe(false);
  });

  it("does not use the old width as a height estimate for focus-only rotation", () => {
    const landscape = updateViewportBaseline({
      baselineHeight: 780,
      baselineWidth: 390,
      layoutWidth: 780,
      viewportHeight: 360,
      layoutHeight: 360,
      typing: true,
      previouslyOpen: false,
    });
    expect(landscape).toEqual({ height: 360, width: 780 });
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 360,
        layoutHeight: 360,
        baselineHeight: landscape.height,
      }),
    ).toBe(false);
  });

  it("adopts a real height-only layout resize while input remains focused", () => {
    const resized = updateViewportBaseline({
      baselineHeight: 800,
      baselineWidth: 390,
      layoutWidth: 390,
      viewportHeight: 600,
      layoutHeight: 600,
      typing: true,
      previouslyOpen: true,
    });
    expect(resized).toEqual({ height: 600, width: 390 });
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 600,
        layoutHeight: 600,
        baselineHeight: resized.height,
        previouslyOpen: true,
      }),
    ).toBe(false);
  });

  it("retains a full-height baseline when rotating with keyboard still open", () => {
    const landscape = updateViewportBaseline({
      baselineHeight: 780,
      baselineWidth: 390,
      layoutWidth: 780,
      viewportHeight: 190,
      layoutHeight: 390,
      typing: true,
      previouslyOpen: true,
    });
    expect(landscape).toEqual({ height: 390, width: 780 });
    expect(
      detectKeyboardOpen({
        typing: true,
        viewportHeight: 190,
        layoutHeight: 390,
        baselineHeight: landscape.height,
      }),
    ).toBe(true);
  });
});

describe("resolveKeyboardPhase", () => {
  it("keeps opening geometry frozen across rotation and confirms an occluded sample", () => {
    const landscape = updateViewportBaseline({
      baselineHeight: 780,
      baselineWidth: 390,
      layoutWidth: 780,
      viewportHeight: 190,
      layoutHeight: 390,
      typing: true,
      previouslyOpen: true,
    });
    const confirmedOpen = detectKeyboardOpen({
      typing: true,
      viewportHeight: 190,
      layoutHeight: 390,
      baselineHeight: landscape.height,
      previouslyOpen: true,
    });

    expect(landscape.height).toBe(390);
    expect(
      resolveKeyboardPhase({
        phase: "opening",
        confirmedOpen,
        geometryChanged: true,
        transitionExpired: false,
        typing: true,
        heightDecreased: false,
      }),
    ).toEqual({ phase: "open", restartTimer: false });
  });

  it("releases focus-only rotation after the opening settle timer", () => {
    const stillOpening = resolveKeyboardPhase({
      phase: "opening",
      confirmedOpen: false,
      geometryChanged: true,
      transitionExpired: false,
      typing: true,
      heightDecreased: false,
    });
    expect(stillOpening).toEqual({ phase: "opening", restartTimer: true });
    expect(
      resolveKeyboardPhase({
        phase: stillOpening.phase,
        confirmedOpen: false,
        geometryChanged: false,
        transitionExpired: true,
        typing: true,
        heightDecreased: false,
      }),
    ).toEqual({ phase: "closed", restartTimer: false });
  });

  it("keeps opening frozen through an early unconfirmed rotation frame", () => {
    expect(
      resolveKeyboardPhase({
        phase: "opening",
        confirmedOpen: false,
        geometryChanged: true,
        transitionExpired: false,
        typing: true,
        heightDecreased: false,
        layoutChanged: true,
        orientationChanged: true,
      }),
    ).toEqual({ phase: "opening", restartTimer: true });
  });

  it("cancels an opening guess for a real layout-height change", () => {
    expect(
      resolveKeyboardPhase({
        phase: "opening",
        confirmedOpen: false,
        geometryChanged: true,
        transitionExpired: false,
        typing: true,
        heightDecreased: false,
        layoutChanged: true,
      }),
    ).toEqual({ phase: "closed", restartTimer: false });
  });

  it("keeps rows frozen through every keyboard-closing geometry frame", () => {
    const firstRecovery = resolveKeyboardPhase({
      phase: "open",
      confirmedOpen: false,
      geometryChanged: true,
      transitionExpired: false,
      typing: false,
      heightDecreased: false,
    });
    expect(firstRecovery).toEqual({ phase: "closing", restartTimer: true });

    const fullHeightFrame = resolveKeyboardPhase({
      phase: firstRecovery.phase,
      confirmedOpen: false,
      geometryChanged: true,
      transitionExpired: false,
      typing: false,
      heightDecreased: false,
    });
    expect(fullHeightFrame).toEqual({ phase: "closing", restartTimer: true });
    expect(
      resolveKeyboardPhase({
        phase: fullHeightFrame.phase,
        confirmedOpen: false,
        geometryChanged: false,
        transitionExpired: true,
        typing: false,
        heightDecreased: false,
      }),
    ).toEqual({ phase: "closed", restartTimer: false });
  });
});

describe("viewport keyboard policy", () => {
  it("keeps the layout viewport as the full-height keyboard baseline", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(html).toContain("interactive-widget=resizes-visual");
    expect(html).not.toContain("interactive-widget=resizes-content");
  });
});
