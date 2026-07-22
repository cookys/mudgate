import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../src/i18n";
import {
  LocaleModalSwitch,
  LocalePickerDialog,
} from "../src/components/LocaleSwitch";
import { SessionTabs } from "../src/components/SessionTabs";
import { StatusPill } from "../src/components/StatusPill";
import {
  ViewportModalPanel,
  ViewportSurface,
} from "../src/components/ViewportSurface";

function renderLocalized(child: ReactElement): string {
  return renderToStaticMarkup(
    createElement(LocaleProvider, { initial: "zh-TW" }, child),
  );
}

describe("portrait shell controls", () => {
  it("uses a compact language button whose choices live in a modal", () => {
    const trigger = renderLocalized(createElement(LocaleModalSwitch));
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).not.toContain('role="dialog"');

    const dialog = renderLocalized(
      createElement(LocalePickerDialog, {
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog.match(/aria-pressed=/g)).toHaveLength(3);
  });

  it("renders connection copy as an accessible indicator in compact mode", () => {
    const html = renderLocalized(
      createElement(StatusPill, {
        status: { code: "connected" },
        compact: true,
      }),
    );
    expect(html).toContain('data-status-display="indicator"');
    expect(html).toContain('role="status"');
    expect(html).toContain("aria-label=");
    expect(html).not.toContain("data-status-label");
  });

  it("moves the shared session navigation from header to content on portrait", () => {
    const common = {
      tabs: [{ id: "one", label: "Revival World", connected: true }],
      activeId: "one",
      profileManagerOpen: false,
      sessionLabel: "Session",
      manageLabel: "Manage",
      closeLabel: "Close",
      newLabel: "New",
      onSelect: () => undefined,
      onManage: () => undefined,
      onClose: () => undefined,
      onNew: () => undefined,
    };
    const header = renderToStaticMarkup(
      createElement(SessionTabs, { ...common, placement: "header" }),
    );
    const content = renderToStaticMarkup(
      createElement(SessionTabs, { ...common, placement: "content" }),
    );

    expect(header).toContain('data-session-tabs-placement="header"');
    expect(header).toContain("mobile-portrait-hide flex flex-1");
    expect(content).toContain('data-session-tabs-placement="content"');
    expect(content).toContain("mobile-portrait-only");
    expect(content).toContain('aria-pressed="true"');

    const css = readFileSync(
      new URL("../src/styles/tokens.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain(
      "@media (orientation: portrait) and (max-width: 767px)",
    );
  });

  it("bounds full-screen surfaces to visual viewport geometry and scrolls overflow", () => {
    const page = renderToStaticMarkup(
      createElement(
        ViewportSurface,
        { scrollY: true },
        createElement("div", null, "long content"),
      ),
    );
    expect(page).toContain('data-viewport-surface="scroll"');
    expect(page).toContain("overflow-y-auto");
    expect(page).toContain("var(--app-vh, 100dvh)");

    const modal = renderToStaticMarkup(
      createElement(
        ViewportSurface,
        null,
        createElement(ViewportModalPanel, null, "long modal"),
      ),
    );
    expect(modal).toContain('data-viewport-surface="fixed"');
    expect(modal).toContain("data-viewport-modal-panel");
    expect(modal).toContain("max-h-full overflow-y-auto");
  });
});
