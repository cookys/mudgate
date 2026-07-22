import { describe, it, expect } from "vitest";
import {
  exportProfilesJson,
  importProfilesJson,
  type MudProfile,
} from "../src/index.js";

describe("exportProfilesJson sanitizes secrets", () => {
  it("strips proxyToken on export and import", () => {
    const dirty = [
      {
        id: "x",
        name: "X",
        host: "mud.example",
        port: 4000,
        charset: "big5hkscs",
        proxyToken: "secret",
        mudgate_token: "also",
      },
    ] as unknown as MudProfile[];
    const out = exportProfilesJson(dirty);
    expect(out).not.toContain("secret");
    expect(out).not.toContain("proxyToken");
    expect(out).not.toContain("mudgate_token");

    const round = importProfilesJson(
      JSON.stringify([
        {
          id: "y",
          name: "Y",
          host: "h",
          port: 1,
          charset: "utf8",
          proxyToken: "leak",
        },
      ]),
    );
    expect(JSON.stringify(round)).not.toContain("leak");
    expect(exportProfilesJson(round)).not.toContain("leak");
  });
});
