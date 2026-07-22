/** Connection trust modes (selfhost-proxy-trust plan). */

export type TrustMode = "local" | "selfhost" | "official" | "custom";

const MODE_KEY = "mudgate_trust_mode";
const CUSTOM_WS_KEY = "mudgate_custom_ws";
const TOKEN_KEY = "mudgate_token";
const CUSTOM_ACK_KEY = "mudgate_trust_custom_ack";

export type SiteConfig = {
  /** Official / site gateway WebSocket URL */
  officialProxyUrl?: string;
  /** When true, this SPA is the co-located site shell (no T1/T3) */
  siteMode?: boolean;
};

function envTruthy(v: string | boolean | undefined): boolean {
  if (v === true) return true;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * Site shell = SPA baked with VITE_SITE_MODE, or runtime flag, or known official host.
 * In this mode players only use this host's gateway (no self-host T1 / other-server T3).
 */
export function isSiteShell(): boolean {
  try {
    if (envTruthy(import.meta.env.VITE_SITE_MODE as string | undefined)) {
      return true;
    }
  } catch {
    /* non-vite */
  }
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __MUDGATE_SITE__?: SiteConfig };
  if (w.__MUDGATE_SITE__?.siteMode) return true;
  const h = window.location.hostname;
  return h === "mud.revivalworld.org";
}

/** Same-origin / env WS URL for the official site gateway. */
export function siteWsUrl(): string {
  try {
    const fromEnv = (import.meta.env.VITE_PROXY_WS as string | undefined)?.trim();
    if (fromEnv) return fromEnv;
  } catch {
    /* non-vite */
  }
  if (typeof window !== "undefined") {
    const w = window as unknown as { __MUDGATE_SITE__?: SiteConfig };
    const fromWin = w.__MUDGATE_SITE__?.officialProxyUrl?.trim();
    if (fromWin) return fromWin;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }
  return "wss://mud.revivalworld.org/ws";
}

export function loadTrustMode(): TrustMode {
  if (isSiteShell()) return "official";
  const m = localStorage.getItem(MODE_KEY);
  if (m === "local" || m === "selfhost" || m === "official" || m === "custom")
    return m;
  return "local";
}

export function saveTrustMode(m: TrustMode): void {
  if (isSiteShell()) return; // locked to official
  localStorage.setItem(MODE_KEY, m);
}

export function loadCustomWs(): string {
  return localStorage.getItem(CUSTOM_WS_KEY) ?? "";
}

export function saveCustomWs(url: string): void {
  const prev = localStorage.getItem(CUSTOM_WS_KEY) ?? "";
  localStorage.setItem(CUSTOM_WS_KEY, url);
  // Changing endpoint invalidates T3 acknowledgment
  if (prev.trim() !== url.trim()) {
    localStorage.removeItem(CUSTOM_ACK_KEY);
  }
}

export function loadProxyToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function saveProxyToken(t: string): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Token must never appear in profile export JSON. */
export function assertExportOmitsToken(exportedJson: string): boolean {
  try {
    const data = JSON.parse(exportedJson) as unknown;
    const s = JSON.stringify(data);
    // exported profiles should not embed mudgate_token field
    return !/"mudgate_token"\s*:/.test(s) && !/"proxyToken"\s*:/.test(s);
  } catch {
    return false;
  }
}

export function loadCustomAck(): boolean {
  return localStorage.getItem(CUSTOM_ACK_KEY) === "1";
}

export function saveCustomAck(ok: boolean): void {
  if (ok) localStorage.setItem(CUSTOM_ACK_KEY, "1");
  else localStorage.removeItem(CUSTOM_ACK_KEY);
}

export function resolveWsUrl(
  mode: TrustMode,
  opts: {
    envDefault: string;
    customWs: string;
    officialUrl?: string;
  },
): string | null {
  if (isSiteShell()) {
    return siteWsUrl();
  }
  switch (mode) {
    case "local":
      return opts.envDefault || "ws://127.0.0.1:7788/ws";
    case "selfhost":
    case "custom":
      return opts.customWs.trim() || null;
    case "official":
      return opts.officialUrl?.trim() || siteWsUrl();
    default:
      return null;
  }
}

/** Valid WS endpoint for selfhost/custom/official. */
export function isValidProxyWsUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
      const host = parsed.hostname;
      const loopback = host === "127.0.0.1" || host === "localhost";
      if (!loopback && parsed.protocol !== "wss:") return false;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Connect gate: custom requires ack; selfhost/custom/official need valid URL.
 * Site shell always OK (gateway is fixed).
 */
export function canConnect(
  mode: TrustMode,
  customAck: boolean,
  wsUrl?: string | null,
): boolean {
  if (isSiteShell()) return isValidProxyWsUrl(siteWsUrl());
  if (mode === "local") return true;
  if (mode === "custom" && !customAck) return false;
  if (mode === "selfhost" || mode === "custom" || mode === "official") {
    return isValidProxyWsUrl(wsUrl ?? "");
  }
  return true;
}

export function readOfficialProxyUrl(): string | undefined {
  if (isSiteShell()) return siteWsUrl();
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { __MUDGATE_SITE__?: SiteConfig };
  return w.__MUDGATE_SITE__?.officialProxyUrl;
}
