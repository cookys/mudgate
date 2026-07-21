/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_WS?: string;
  readonly VITE_HOST?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
}

interface AssmudSiteConfig {
  defaultLocale?: string;
}

interface Window {
  __ASSMUD_SITE__?: AssmudSiteConfig;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
