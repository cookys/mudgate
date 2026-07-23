import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const HISTORICAL_REVIEW_PREFIX = "docs/reviews/";
const EXTERNAL_MUD_CATALOG =
  "docs/plans/2026-07-21-cjk-cell-width-taiwanmud.md";

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

describe("proxy port consistency", () => {
  it("keeps the retired proxy port out of active tracked files", () => {
    const retiredPort = ["77", "88"].join("");
    const retiredPortPattern = new RegExp(
      `(?<!\\d)${retiredPort}(?!\\d)`,
    );
    const stale: string[] = [];
    let externalMudReferences = 0;

    for (const file of trackedFiles()) {
      if (file.startsWith(HISTORICAL_REVIEW_PREFIX)) continue;

      const bytes = readFileSync(resolve(REPO_ROOT, file));
      if (bytes.includes(0)) continue;

      const lines = bytes.toString("utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!retiredPortPattern.test(line)) return;

        if (
          file === EXTERNAL_MUD_CATALOG &&
          line.includes(`210.59.236.38:${retiredPort}`)
        ) {
          externalMudReferences += 1;
          return;
        }

        stale.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(stale, `stale proxy port references:\n${stale.join("\n")}`).toEqual(
      [],
    );
    expect(
      externalMudReferences,
      "the only active retired-port reference must remain the external MUD catalog entry",
    ).toBe(1);
  });
});
