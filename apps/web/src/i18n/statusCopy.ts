import type { MessageKey, MessageVars } from "./types";
import type { StatusCode, StatusEvent } from "../lib/mudSocket";

export type StatusTone = "idle" | "ok" | "warn" | "danger";

export type StatusCopy = {
  key: MessageKey;
  vars?: MessageVars;
};

const CODE_KEY: Record<StatusCode, MessageKey> = {
  idle: "status.idle",
  connecting: "status.connecting",
  handshaking: "status.handshaking",
  connected: "status.connected",
  disconnected: "status.disconnected",
  reconnect_wait: "status.reconnect_wait",
  max_retries: "status.max_retries",
  proxy_error: "status.proxy_error",
  bad_frame: "status.bad_frame",
  error: "status.error",
};

/** Map StatusEvent → message key + interpolation vars for `t()`. */
export function statusCopy(event: StatusEvent): StatusCopy {
  const key = CODE_KEY[event.code] ?? "status.error";
  const params = event.params;
  if (!params) {
    if (event.code === "proxy_error") {
      return { key, vars: { detail: "" } };
    }
    return { key };
  }
  return { key, vars: { ...params } };
}

/** Tone for StatusPill — derived from code only (never from display strings). */
export function tone(code: StatusCode): StatusTone {
  switch (code) {
    case "connected":
      return "ok";
    case "connecting":
    case "handshaking":
    case "reconnect_wait":
      return "warn";
    case "proxy_error":
    case "bad_frame":
    case "error":
    case "max_retries":
      return "danger";
    case "idle":
    case "disconnected":
    default:
      return "idle";
  }
}
