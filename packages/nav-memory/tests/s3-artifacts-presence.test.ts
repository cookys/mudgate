import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");

/** Structural proof for docs-only S3 ship (ADR + Session Protocol). */
describe("S3 docs presence", () => {
  it("ADR-003 player mode daemon exists with Accepted status", () => {
    const p = join(root, "docs/adr/ADR-003-player-mode-daemon.md");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(text).toMatch(/Status.*Accepted/i);
    expect(text).toMatch(/player daemon/i);
    expect(text).toMatch(/site mode/i);
  });

  it("session-protocol-v0 draft exists with negotiate + resume", () => {
    const p = join(root, "docs/design/session-protocol-v0.md");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(text).toMatch(/protocolMax/);
    expect(text).toMatch(/resume/i);
    expect(text).toMatch(/echo/);
  });

  it("open-work inventory tags ship-now residuals closed intent", () => {
    const p = join(root, "docs/OPEN-WORK-INVENTORY.md");
    expect(existsSync(p)).toBe(true);
    const text = readFileSync(p, "utf8");
    expect(text).toMatch(/Companion C1/);
    expect(text).toMatch(/T1-S3/);
  });
});
