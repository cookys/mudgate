import { describe, expect, it } from "vitest";
import {
  detectKeyboardOpen,
  updateViewportBaseline,
} from "../src/lib/useVisualViewport";

describe("detectKeyboardOpen", () => {
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
});
