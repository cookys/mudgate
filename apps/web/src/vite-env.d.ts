/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_WS?: string;
  readonly VITE_HOST?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  /** "1" = co-located site SPA (mud.revivalworld.org): no T1/T3 trust modes */
  readonly VITE_SITE_MODE?: string;
}

interface MudgateSiteConfig {
  defaultLocale?: string;
  officialProxyUrl?: string;
  siteMode?: boolean;
}

interface Window {
  __MUDGATE_SITE__?: MudgateSiteConfig;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
