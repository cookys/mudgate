import { createHmac } from "node:crypto";
import { appendFileSync } from "node:fs";

export type AuditEvent =
  | {
      event: "ws_open";
      time: string;
      transportPeer: string;
      effectiveClientAddr: string;
      tokenHmac: string | null;
      siteMode: boolean;
      headerSource?: string;
    }
  | {
      event: "hello";
      time: string;
      transportPeer: string;
      effectiveClientAddr: string;
      host: string;
      port: number;
      ok: boolean;
      reason?: string;
      siteMode: boolean;
    }
  | {
      event: "close";
      time: string;
      transportPeer: string;
      effectiveClientAddr: string;
      code?: number | string;
      reason?: string;
      siteMode: boolean;
    }
  | {
      event: "warn";
      time: string;
      message: string;
      transportPeer?: string;
      effectiveClientAddr?: string;
    };

/** Truncated HMAC-SHA256 of token (never log raw token). */
export function tokenHmac(
  token: string | null | undefined,
  secret: string | null | undefined,
): string | null {
  if (!token || !secret) return null;
  return createHmac("sha256", secret).update(token, "utf8").digest("hex").slice(0, 16);
}

/**
 * Structured one-line JSON audit. Never includes passwords/payloads.
 * Default sink: stderr. Optional ASSMUD_AUDIT_LOG=path for append file.
 */
export function writeAudit(
  evt: AuditEvent,
  sink: (line: string) => void = defaultSink,
): void {
  // Guard: refuse accidental payload-ish keys if callers cast loosely
  const line = JSON.stringify(evt);
  if (
    /"password"\s*:/i.test(line) ||
    /"payload"\s*:/i.test(line) ||
    /"token"\s*:\s*"/i.test(line)
  ) {
    sink(
      JSON.stringify({
        event: "warn",
        time: new Date().toISOString(),
        message: "audit_blocked_sensitive_fields",
      }),
    );
    return;
  }
  sink(line);
}

function defaultSink(line: string): void {
  const path = process.env.ASSMUD_AUDIT_LOG?.trim();
  if (path) {
    try {
      appendFileSync(path, line + "\n", { mode: 0o640 });
      return;
    } catch {
      /* fall through to stderr */
    }
  }
  console.error(line);
}

export function nowIso(): string {
  return new Date().toISOString();
}
