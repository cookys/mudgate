/** Terminal font catalog — dual-width / TC-aware (see docs/design/terminal-fonts.md) */

export type FontSource = "bundled" | "system" | "webfont" | "custom";

export type CatalogEntry = {
  id: string;
  label: string;
  /** Primary CSS family name(s) for this preset */
  families: string[];
  region: "tw" | "hk" | "cn" | "any";
  source: FontSource;
  /** Hint for trial UI */
  tags: string[];
  recommended?: boolean;
  /** If true, Latin-only — needs TC chain */
  latinOnly?: boolean;
};

/** Default Traditional Chinese dual-width fallback chain (after primary + user extras). */
export const TC_FALLBACK_CHAIN = [
  "Sarasa Term TC",
  "Sarasa Mono TC",
  "MingLiU",
  "細明體",
  "PMingLiU",
  "新細明體",
  "MingLiU_HKSCS",
  "Source Han Mono TW",
  "Noto Sans Mono CJK TC",
  "Noto Sans Mono CJK",
  "Noto Sans CJK TC",
] as const;

export const SC_FALLBACK_CHAIN = [
  "Sarasa Term SC",
  "Sarasa Mono SC",
  "Source Han Mono CN",
  "Noto Sans Mono CJK SC",
  "Noto Sans Mono CJK",
  ...TC_FALLBACK_CHAIN,
] as const;

export const STATIC_CATALOG: CatalogEntry[] = [
  {
    id: "sarasa-term-tc",
    label: "★ Sarasa Term TC",
    families: ["Sarasa Term TC"],
    region: "tw",
    source: "webfont",
    tags: ["dual-width", "term", "OFL"],
    recommended: true,
  },
  {
    id: "sarasa-mono-tc",
    label: "★ Sarasa Mono TC",
    families: ["Sarasa Mono TC"],
    region: "tw",
    source: "webfont",
    tags: ["dual-width", "OFL"],
    recommended: true,
  },
  {
    id: "sarasa-term-hc",
    label: "Sarasa Term HC",
    families: ["Sarasa Term HC"],
    region: "hk",
    source: "webfont",
    tags: ["dual-width", "OFL"],
  },
  {
    id: "source-han-mono-tw",
    label: "Source Han Mono TW",
    families: ["Source Han Mono TW"],
    region: "tw",
    source: "webfont",
    tags: ["dual-width", "OFL"],
  },
  {
    id: "noto-sans-mono-cjk-tc",
    label: "Noto Sans Mono CJK TC",
    families: ["Noto Sans Mono CJK TC"],
    region: "tw",
    source: "webfont",
    tags: ["OFL", "cdn"],
  },
  {
    id: "maple-mono-nl",
    label: "Maple Mono NL",
    families: ["Maple Mono NL", "Maple Mono"],
    region: "any",
    source: "webfont",
    tags: ["dual-width*", "no-liga", "OFL"],
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono (+ TC chain)",
    families: ["JetBrains Mono"],
    region: "any",
    source: "webfont",
    tags: ["latin", "needs-tc-chain"],
    latinOnly: true,
  },
  {
    id: "mingliu",
    label: "細明體 MingLiU",
    families: ["MingLiU", "細明體"],
    region: "tw",
    source: "system",
    tags: ["bbs", "system"],
  },
  {
    id: "pmingliu",
    label: "新細明體 PMingLiU",
    families: ["PMingLiU", "新細明體"],
    region: "tw",
    source: "system",
    tags: ["bbs", "system"],
  },
  {
    id: "custom",
    label: "Custom…",
    families: [],
    region: "any",
    source: "custom",
    tags: ["user"],
  },
];

export type TermFontConfig = {
  presetId: string;
  primary: string;
  extras: string[];
  useDefaultTcChain: boolean;
  fontSizePx: number;
  cellWidthScale: number;
  lineHeightScale: number;
  letterSpacingPx: number;
  ligatures: boolean;
};

export const DEFAULT_TERM_FONT: TermFontConfig = {
  presetId: "sarasa-term-tc",
  primary: "Sarasa Term TC",
  extras: [],
  useDefaultTcChain: true,
  fontSizePx: 15,
  cellWidthScale: 1,
  lineHeightScale: 1.2,
  letterSpacingPx: 0,
  ligatures: false,
};

const STORAGE_KEY = "assmud.termFont";

export function loadTermFont(): TermFontConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TERM_FONT };
    const j = JSON.parse(raw) as Partial<TermFontConfig>;
    return { ...DEFAULT_TERM_FONT, ...j };
  } catch {
    return { ...DEFAULT_TERM_FONT };
  }
}

export function saveTermFont(cfg: TermFontConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* private mode */
  }
}

/** Resolve CSS font-family stack: primary → extras → TC chain → monospace */
export function resolveFontStack(
  cfg: TermFontConfig,
  localeHint: "zh-TW" | "zh-CN" | "en" = "zh-TW",
): string {
  const chain =
    cfg.useDefaultTcChain === false
      ? []
      : localeHint === "zh-CN"
        ? [...SC_FALLBACK_CHAIN]
        : [...TC_FALLBACK_CHAIN];
  const parts = [cfg.primary, ...cfg.extras, ...chain, "ui-monospace", "monospace"]
    .map((s) => s.trim())
    .filter(Boolean);
  // quote multi-word families
  const quoted = parts.map((f) =>
    f.includes(" ") && !f.startsWith('"') ? `"${f}"` : f,
  );
  // dedupe preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of quoted) {
    const k = f.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.join(", ");
}

export function applyPreset(id: string): TermFontConfig {
  const e = STATIC_CATALOG.find((x) => x.id === id);
  if (!e || id === "custom") {
    return { ...loadTermFont(), presetId: "custom" };
  }
  return {
    ...DEFAULT_TERM_FONT,
    ...loadTermFont(),
    presetId: id,
    primary: e.families[0] ?? DEFAULT_TERM_FONT.primary,
    useDefaultTcChain: e.latinOnly ? true : loadTermFont().useDefaultTcChain,
  };
}
