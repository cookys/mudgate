import { describe, it, expect, beforeEach, afterEach } from "vitest";
// Import pure modules only (avoid LocaleContext.tsx / React under node vitest).
import {
  detectLocale,
  isLocale,
  LOCALES,
  loadStoredLocale,
  resolveLocale,
} from "../src/i18n/localeStore";
import { t, messageCatalog } from "../src/i18n/t";
import { statusCopy, tone } from "../src/i18n/statusCopy";
import type { MessageKey } from "../src/i18n/types";
import type { StatusCode, StatusEvent } from "../src/lib/mudSocket";
import { statusEventsEqual } from "../src/lib/mudSocket";

describe("detectLocale", () => {
  it("maps Traditional Chinese tags to zh-TW", () => {
    expect(detectLocale("zh-TW")).toBe("zh-TW");
    expect(detectLocale("zh-HK")).toBe("zh-TW");
    expect(detectLocale("zh-Hant")).toBe("zh-TW");
    expect(detectLocale("zh-Hant-TW")).toBe("zh-TW");
  });

  it("maps Simplified Chinese tags to zh-CN", () => {
    expect(detectLocale("zh-CN")).toBe("zh-CN");
    expect(detectLocale("zh-SG")).toBe("zh-CN");
    expect(detectLocale("zh-Hans")).toBe("zh-CN");
    expect(detectLocale("zh-Hans-CN")).toBe("zh-CN");
  });

  it("maps bare zh to zh-TW (product warehouse)", () => {
    expect(detectLocale("zh")).toBe("zh-TW");
  });

  it("maps other languages to en", () => {
    expect(detectLocale("en")).toBe("en");
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale("ja")).toBe("en");
    expect(detectLocale("")).toBe("en");
    expect(detectLocale(null)).toBe("en");
  });

  it("handles underscore and case", () => {
    expect(detectLocale("zh_TW")).toBe("zh-TW");
    expect(detectLocale("ZH-CN")).toBe("zh-CN");
  });
});

describe("isLocale allowlist", () => {
  it("accepts only product locales", () => {
    expect(isLocale("zh-TW")).toBe(true);
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-Hant")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("t()", () => {
  it("interpolates vars", () => {
    expect(t("en", "connect.cta", { name: "RW" })).toContain("RW");
    expect(
      t("en", "status.reconnect_wait", { seconds: 4, attempt: 2, max: 12 }),
    ).toBe("reconnect in 4s… (2/12)");
  });

  it("returns Traditional for zh-TW", () => {
    expect(t("zh-TW", "status.connected")).toBe("已連線");
    expect(t("zh-TW", "shell.send")).toBe("送出");
  });

  it("returns Simplified for zh-CN", () => {
    expect(t("zh-CN", "status.connected")).toBe("已连接");
    expect(t("zh-CN", "shell.send")).toBe("发送");
  });

  it("falls back to raw key when missing everywhere", () => {
    expect(t("en", "app.name")).toBe("assmud");
    expect(t("zh-TW", "app.name")).toBe("assmud");
    // unknown key → key string (never blank)
    expect(t("en", "not.a.real.key" as MessageKey)).toBe("not.a.real.key");
    expect(t("zh-CN", "not.a.real.key" as MessageKey)).toBe("not.a.real.key");
  });
});

describe("message key parity", () => {
  it("all locales share the same MessageKey set", () => {
    const enKeys = Object.keys(messageCatalog("en")).sort();
    for (const loc of LOCALES) {
      const keys = Object.keys(messageCatalog(loc)).sort();
      expect(keys).toEqual(enKeys);
    }
  });

  it("no empty strings in catalogs", () => {
    for (const loc of LOCALES) {
      const cat = messageCatalog(loc);
      for (const [k, v] of Object.entries(cat)) {
        expect(v, `${loc}.${k}`).toBeTruthy();
      }
    }
  });

  it("zh-TW uses traditional forms where distinct", () => {
    const tw = messageCatalog("zh-TW");
    const cn = messageCatalog("zh-CN");
    // 連線 vs 连接
    expect(tw["status.connected"]).toContain("連");
    expect(cn["status.connected"]).toContain("连");
  });
});

describe("statusCopy + tone", () => {
  const codes: StatusCode[] = [
    "idle",
    "connecting",
    "handshaking",
    "connected",
    "disconnected",
    "reconnect_wait",
    "max_retries",
    "proxy_error",
    "bad_frame",
    "error",
  ];

  it("maps every StatusCode to a status.* MessageKey", () => {
    for (const code of codes) {
      const event: StatusEvent =
        code === "reconnect_wait"
          ? { code, params: { seconds: 3, attempt: 1, max: 12 } }
          : code === "proxy_error"
            ? { code, params: { detail: "denied" } }
            : { code };
      const copy = statusCopy(event);
      expect(copy.key.startsWith("status.")).toBe(true);
      // key is a real MessageKey present in catalog
      const en = messageCatalog("en")[copy.key as MessageKey];
      expect(en).toBeTruthy();
      const label = t("en", copy.key, copy.vars);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("reconnect_wait interpolates", () => {
    const copy = statusCopy({
      code: "reconnect_wait",
      params: { seconds: 4, attempt: 2, max: 12 },
    });
    expect(t("zh-TW", copy.key, copy.vars)).toContain("4");
    expect(t("zh-TW", copy.key, copy.vars)).toContain("2/12");
  });

  it("tone from code only", () => {
    expect(tone("connected")).toBe("ok");
    expect(tone("connecting")).toBe("warn");
    expect(tone("handshaking")).toBe("warn");
    expect(tone("reconnect_wait")).toBe("warn");
    expect(tone("proxy_error")).toBe("danger");
    expect(tone("bad_frame")).toBe("danger");
    expect(tone("error")).toBe("danger");
    expect(tone("max_retries")).toBe("danger");
    expect(tone("idle")).toBe("idle");
    expect(tone("disconnected")).toBe("idle");
  });
});

describe("statusEventsEqual", () => {
  it("dedupes by code + params", () => {
    expect(
      statusEventsEqual({ code: "connected" }, { code: "connected" }),
    ).toBe(true);
    expect(
      statusEventsEqual(
        { code: "reconnect_wait", params: { seconds: 2, attempt: 1, max: 12 } },
        { code: "reconnect_wait", params: { seconds: 2, attempt: 1, max: 12 } },
      ),
    ).toBe(true);
    expect(
      statusEventsEqual(
        { code: "reconnect_wait", params: { seconds: 2, attempt: 1, max: 12 } },
        { code: "reconnect_wait", params: { seconds: 4, attempt: 1, max: 12 } },
      ),
    ).toBe(false);
  });
});

describe("locale storage garbage", () => {
  const KEY = "assmud.locale";
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    // minimal localStorage mock
    // @ts-expect-error test mock
    globalThis.localStorage = {
      getItem: (k: string) => (k in store ? store[k]! : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: () => null,
      length: 0,
    };
  });

  afterEach(() => {
    // @ts-expect-error cleanup
    delete globalThis.localStorage;
  });

  it("ignores garbage storage values", () => {
    store[KEY] = "zh-Hant";
    expect(loadStoredLocale()).toBeNull();
    // without navigator.language reliability in node — resolve may be site/detect/fallback
    const r = resolveLocale();
    expect(isLocale(r)).toBe(true);
  });

  it("accepts allowlisted storage", () => {
    store[KEY] = "en";
    expect(loadStoredLocale()).toBe("en");
  });
});
