import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale, MessageKey, MessageVars } from "./types";
import { isLocale, resolveLocale, saveLocale } from "./localeStore";
import { t as translate } from "./t";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: MessageVars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyHtmlLang(locale: Locale): void {
  try {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  } catch {
    /* ignore */
  }
}

type ProviderProps = {
  children: ReactNode;
  /** Boot-resolved locale (main.tsx); defaults to resolveLocale(). */
  initial?: Locale;
};

export function LocaleProvider({ children, initial }: ProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initial ?? resolveLocale(),
  );

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    saveLocale(next);
    applyHtmlLang(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: MessageVars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useT(): (key: MessageKey, vars?: MessageVars) => string {
  return useLocale().t;
}
