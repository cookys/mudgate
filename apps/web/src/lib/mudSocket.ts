/**
 * WebSocket session outside React render — avoids setState/effect reconnect loops.
 * Status is structured StatusEvent only (no English display strings as identity).
 */

export type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

export type StatusCode =
  | "idle"
  | "connecting"
  | "handshaking"
  | "connected"
  | "disconnected"
  | "reconnect_wait"
  | "max_retries"
  | "proxy_error"
  | "bad_frame"
  | "error";

export type StatusEvent = {
  code: StatusCode;
  params?: Record<string, string | number>;
};

export type MudSocketHandlers = {
  /** Raw binary frame from MUD (Big5 bytes). */
  onBinary?: (bytes: Uint8Array) => void;
  /**
   * Telnet ECHO password-mode: true while server WILL ECHO (mask input);
   * false on WONT ECHO. Separate from StatusEvent connection lifecycle.
   */
  onEchoMask?: (mask: boolean) => void;
};

/** Reconnect backoff: base * 2^(n-1), capped, with jitter. */
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_FACTOR = 2;
const BACKOFF_MAX_MS = 60_000;
/** Stop auto-retry after this many failures (user can reconnect via UI). */
const MAX_ATTEMPTS = 12;
/** Hard floor between open() calls even if something double-fires. */
const MIN_OPEN_GAP_MS = 1_500;

function backoffDelayMs(attempt: number): number {
  // attempt 1 → 2s, 2 → 4s, 3 → 8s, … → cap 60s
  const exp = Math.min(
    BACKOFF_BASE_MS * BACKOFF_FACTOR ** Math.max(0, attempt - 1),
    BACKOFF_MAX_MS,
  );
  // full jitter in [50%, 100%] of nominal — spreads thundering herd
  const jittered = exp * (0.5 + Math.random() * 0.5);
  return Math.round(Math.max(MIN_OPEN_GAP_MS, jittered));
}

function statusSignature(ev: StatusEvent): string {
  return ev.params
    ? `${ev.code}:${JSON.stringify(ev.params)}`
    : ev.code;
}

export function statusEventsEqual(a: StatusEvent, b: StatusEvent): boolean {
  return statusSignature(a) === statusSignature(b);
}

function sanitizeDetail(raw: string): string {
  return raw.replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "").slice(0, 200);
}

export class MudSocket {
  private ws: WebSocket | null = null;
  private disposed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private session = 0;
  private status: StatusEvent = { code: "idle" };
  private statusSig = "idle";
  private statusListeners = new Set<() => void>();
  private handlers: MudSocketHandlers = {};
  private lastOpenAt = 0;
  private opening = false;
  /** Lines typed before WS is OPEN / ready — flushed on connected. */
  private outbox: string[] = [];

  constructor(
    private readonly url: string,
    private readonly getHello: () => HelloMsg,
  ) {}

  getStatus(): StatusEvent {
    return this.status;
  }

  subscribeStatus(cb: () => void): () => void {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  setHandlers(h: MudSocketHandlers): void {
    this.handlers = h;
  }

  private setStatus(ev: StatusEvent): void {
    const sig = statusSignature(ev);
    if (this.statusSig === sig) return;
    this.status = ev;
    this.statusSig = sig;
    for (const cb of [...this.statusListeners]) {
      try {
        cb();
      } catch {
        /* listener errors must not kill socket */
      }
    }
  }

  start(): void {
    this.disposed = false;
    this.attempt = 0;
    this.open();
  }

  stop(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.outbox = [];
    this.killSocket();
    this.setStatus({ code: "disconnected" });
  }

  /**
   * Send a MUD command line. If the socket is not open yet, queue until
   * proxy `ready` (connected) — never silently drop Enter sends.
   * @returns true if sent immediately, false if queued
   */
  send(line: string): boolean {
    if (line.length > 4096) return false;
    const ws = this.ws;
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      this.status.code !== "connected"
    ) {
      this.outbox.push(line);
      // cap queue
      if (this.outbox.length > 64) this.outbox.shift();
      return false;
    }
    try {
      ws.send(line);
      return true;
    } catch {
      this.outbox.push(line);
      return false;
    }
  }

  private flushOutbox(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (this.status.code !== "connected") return;
    const batch = this.outbox.splice(0, this.outbox.length);
    for (const line of batch) {
      try {
        ws.send(line);
      } catch {
        this.outbox.unshift(line);
        break;
      }
    }
  }

  /** Send a JSON control frame (e.g. mid-session NAWS resize). */
  sendJson(obj: Record<string, unknown>): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }

  private killSocket(): void {
    const prev = this.ws;
    this.ws = null;
    // bump session so any late events from prev are ignored
    this.session += 1;
    if (!prev) return;
    prev.onopen = null;
    prev.onclose = null;
    prev.onerror = null;
    prev.onmessage = null;
    try {
      if (
        prev.readyState === WebSocket.OPEN ||
        prev.readyState === WebSocket.CONNECTING
      ) {
        prev.close();
      }
    } catch {
      /* ignore */
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.timer) return; // already waiting — never stack timers
    this.opening = false;
    this.attempt += 1;
    if (this.attempt > MAX_ATTEMPTS) {
      this.setStatus({ code: "max_retries" });
      return;
    }
    const delayMs = backoffDelayMs(this.attempt);
    const seconds = Math.max(1, Math.round(delayMs / 1000));
    this.setStatus({
      code: "reconnect_wait",
      params: { seconds, attempt: this.attempt, max: MAX_ATTEMPTS },
    });
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.disposed) this.open();
    }, delayMs);
  }

  private open(): void {
    if (this.disposed) return;
    if (this.timer) return; // honour pending backoff; never open early
    if (this.opening) return;

    const now = Date.now();
    const since = now - this.lastOpenAt;
    if (this.lastOpenAt > 0 && since < MIN_OPEN_GAP_MS) {
      // force gap even on first-failure storms
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          if (!this.disposed) this.open();
        }, MIN_OPEN_GAP_MS - since);
      }
      return;
    }

    this.opening = true;
    this.lastOpenAt = now;
    this.killSocket();
    // killSocket bumped session; assign id for this attempt after kill
    const sid = this.session;
    this.setStatus({ code: "connecting" });

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      if (this.disposed || this.session !== sid || this.ws !== ws) return;
      this.opening = false;
      // only reset backoff after TCP is actually up
      this.setStatus({ code: "handshaking" });
      try {
        ws.send(JSON.stringify(this.getHello()));
      } catch {
        /* onclose retries */
      }
    };

    ws.onerror = () => {
      /* browser always follows with onclose — do not touch React here */
    };

    ws.onclose = () => {
      if (this.session !== sid) return;
      if (this.ws === ws) this.ws = null;
      this.opening = false;
      if (this.disposed) {
        this.setStatus({ code: "disconnected" });
        return;
      }
      this.scheduleReconnect();
    };

    ws.onmessage = (ev) => {
      if (this.disposed || this.session !== sid || this.ws !== ws) return;
      if (typeof ev.data === "string") {
        const s = ev.data;
        if (s.startsWith("{")) {
          try {
            const j = JSON.parse(s) as {
              type?: string;
              message?: string;
              mask?: boolean;
            };
            if (j.type === "error") {
              const detail = sanitizeDetail(j.message ?? "");
              this.setStatus(
                detail
                  ? { code: "proxy_error", params: { detail } }
                  : { code: "proxy_error" },
              );
            } else if (j.type === "ready") {
              // full session ready — clear backoff counter
              this.attempt = 0;
              this.setStatus({ code: "connected" });
              // new mud hop — never leave password mask sticky
              this.handlers.onEchoMask?.(false);
              // flush commands typed during handshake
              this.flushOutbox();
            } else if (j.type === "echo") {
              this.handlers.onEchoMask?.(j.mask === true);
            }
          } catch {
            this.setStatus({ code: "bad_frame" });
          }
        }
        return;
      }
      this.handlers.onBinary?.(new Uint8Array(ev.data as ArrayBuffer));
    };
  }
}
