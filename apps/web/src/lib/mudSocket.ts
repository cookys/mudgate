/**
 * WebSocket session outside React render — avoids setState/effect reconnect loops.
 */

export type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

export type MudSocketHandlers = {
  /** Raw binary frame from MUD (Big5 bytes). */
  onBinary?: (bytes: Uint8Array) => void;
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

export class MudSocket {
  private ws: WebSocket | null = null;
  private disposed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private session = 0;
  private status = "idle";
  private statusListeners = new Set<() => void>();
  private handlers: MudSocketHandlers = {};
  private lastOpenAt = 0;
  private opening = false;

  constructor(
    private readonly url: string,
    private readonly getHello: () => HelloMsg,
  ) {}

  getStatus(): string {
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

  private setStatus(s: string): void {
    if (this.status === s) return;
    this.status = s;
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
    this.killSocket();
    this.setStatus("disconnected");
  }

  send(line: string): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (line.length > 4096) return;
    ws.send(line);
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
      this.setStatus("disconnected (max retries — use Connect again)");
      return;
    }
    const delayMs = backoffDelayMs(this.attempt);
    const secs = Math.max(1, Math.round(delayMs / 1000));
    this.setStatus(
      `reconnect in ${secs}s… (${this.attempt}/${MAX_ATTEMPTS})`,
    );
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
    this.setStatus(
      this.attempt === 0 ? "connecting…" : `reconnecting… (${this.attempt})`,
    );

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
      this.setStatus("handshaking…");
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
        this.setStatus("disconnected");
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
            const j = JSON.parse(s) as { type?: string; message?: string };
            if (j.type === "error") {
              const msg = (j.message ?? "error")
                .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
                .slice(0, 200);
              this.setStatus(msg || "error");
            } else if (j.type === "ready") {
              // full session ready — clear backoff counter
              this.attempt = 0;
              this.setStatus("connected");
            }
          } catch {
            this.setStatus("bad control frame");
          }
        }
        return;
      }
      this.handlers.onBinary?.(new Uint8Array(ev.data as ArrayBuffer));
    };
  }
}
