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

const MAX_ATTEMPTS = 5;

export class MudSocket {
  private ws: WebSocket | null = null;
  private disposed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private session = 0;
  private status = "idle";
  private statusListeners = new Set<() => void>();
  private handlers: MudSocketHandlers = {};

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
    this.attempt += 1;
    if (this.attempt > MAX_ATTEMPTS) {
      this.setStatus("disconnected (max retries)");
      return;
    }
    const delayMs = Math.min(1000 * 2 ** (this.attempt - 1), 16_000);
    this.setStatus(
      `reconnect in ${Math.round(delayMs / 1000)}s… (${this.attempt}/${MAX_ATTEMPTS})`,
    );
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.disposed) this.open();
    }, delayMs);
  }

  private open(): void {
    if (this.disposed) return;
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
      this.attempt = 0;
      this.setStatus("handshaking…");
      try {
        ws.send(JSON.stringify(this.getHello()));
      } catch {
        /* onclose retries */
      }
    };

    ws.onerror = () => {
      /* browser always follows with onclose — do not setState here */
    };

    ws.onclose = () => {
      if (this.session !== sid) return;
      if (this.ws === ws) this.ws = null;
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
