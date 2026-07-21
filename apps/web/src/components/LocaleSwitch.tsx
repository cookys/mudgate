import { LOCALES, useLocale } from "../i18n";
import type { Locale, MessageKey } from "../i18n";

type Props = {
  /** Compact labels for topbar (desktop). */
  compact?: boolean;
  className?: string;
};

const COMPACT: Record<Locale, string> = {
  "zh-TW": "正",
  "zh-CN": "简",
  en: "EN",
};

const FULL_KEY: Record<Locale, MessageKey> = {
  "zh-TW": "locale.zh-TW",
  "zh-CN": "locale.zh-CN",
  en: "locale.en",
};

export function LocaleSwitch({ compact = false, className = "" }: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role="group"
      aria-label={t("locale.label")}
    >
      {LOCALES.map((id) => {
        const active = locale === id;
        const label = compact ? COMPACT[id] : t(FULL_KEY[id]);
        return (
          <button
            key={id}
            type="button"
            onClick={() => setLocale(id)}
            aria-pressed={active}
            className="rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-medium min-h-[32px] transition"
            style={{
              borderColor: active ? "var(--accent)" : "var(--border)",
              background: active ? "var(--accent-dim)" : "var(--bg-elevated)",
              color: active ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
