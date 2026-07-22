/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_WS?: string;
  readonly VITE_HOST?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
}

interface MudgateSiteConfig {
  defaultLocale?: string;
}

interface Window {
  __MUDGATE_SITE__?: MudgateSiteConfig;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
