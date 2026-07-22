/** Connection trust modes (selfhost-proxy-trust plan). */

export type TrustMode = "local" | "selfhost" | "official" | "custom";

const MODE_KEY = "mudgate_trust_mode";
const CUSTOM_WS_KEY = "mudgate_custom_ws";
const TOKEN_KEY = "mudgate_token";
const CUSTOM_ACK_KEY = "mudgate_trust_custom_ack";

export type SiteConfig = {
  officialProxyUrl?: string;
};

export function loadTrustMode(): TrustMode {
  const m = localStorage.getItem(MODE_KEY);
  if (m === "local" || m === "selfhost" || m === "official" || m === "custom")
    return m;
  return "local";
}

export function saveTrustMode(m: TrustMode): void {
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
  switch (mode) {
    case "local":
      return opts.envDefault || "ws://127.0.0.1:7788/ws";
    case "selfhost":
    case "custom":
      return opts.customWs.trim() || null;
    case "official":
      return opts.officialUrl?.trim() || null;
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
 */
export function canConnect(
  mode: TrustMode,
  customAck: boolean,
  wsUrl?: string | null,
): boolean {
  if (mode === "local") return true;
  if (mode === "custom" && !customAck) return false;
  if (mode === "selfhost" || mode === "custom" || mode === "official") {
    return isValidProxyWsUrl(wsUrl ?? "");
  }
  return true;
}

export function readOfficialProxyUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { __MUDGATE_SITE__?: SiteConfig };
  return w.__MUDGATE_SITE__?.officialProxyUrl;
}
