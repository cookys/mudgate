import { useCallback, useEffect, useRef, useState } from "react";
import { LOCALES, useLocale } from "../i18n";
import type { Locale, MessageKey } from "../i18n";
import { ViewportModalPanel, ViewportSurface } from "./ViewportSurface";

type Props = {
  /** Compact labels for topbar (desktop). */
  compact?: boolean;
  className?: string;
  onSelect?: () => void;
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

export function LocaleSwitch({
  compact = false,
  className = "",
  onSelect,
}: Props) {
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
            onClick={() => {
              setLocale(id);
              onSelect?.();
            }}
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

type DialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LocalePickerDialog({ open, onClose }: DialogProps) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ViewportSurface
      className="z-[60] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={t("modal.dismiss")}
        onClick={onClose}
      />
      <ViewportModalPanel
        role="dialog"
        aria-modal="true"
        aria-labelledby="mudgate-locale-dialog-title"
        className="relative w-full max-w-xs rounded-[var(--radius)] border p-4 shadow-[var(--shadow)]"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="mudgate-locale-dialog-title"
            className="text-sm font-semibold"
            style={{ color: "var(--text)" }}
          >
            {t("locale.label")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="min-h-[36px] min-w-[36px] rounded-[var(--radius-sm)] border text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-dim)",
            }}
            aria-label={t("modal.dismiss")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <LocaleSwitch
          className="flex w-full flex-wrap justify-center"
          onSelect={onClose}
        />
      </ViewportModalPanel>
    </ViewportSurface>
  );
}

/** Portrait topbar entry: one compact button, choices in a modal. */
export function LocaleModalSwitch({ className = "" }: { className?: string }) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`min-h-[32px] min-w-[36px] items-center justify-center rounded-[var(--radius-sm)] border px-2 py-1 text-xs font-semibold ${className}`}
        style={{
          borderColor: open ? "var(--accent)" : "var(--border)",
          background: open ? "var(--accent-dim)" : "var(--bg-elevated)",
          color: open ? "var(--accent)" : "var(--text-dim)",
        }}
        aria-label={t("locale.label")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("locale.label")}
        onClick={() => setOpen(true)}
      >
        {COMPACT[locale]}
      </button>
      <LocalePickerDialog open={open} onClose={close} />
    </>
  );
}
