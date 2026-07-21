import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";

export type HelloMsg = {
  type: "hello";
  token?: string;
  host?: string;
  port?: number;
  cols?: number;
  rows?: number;
};

type Props = {
  wsUrl: string | null;
  hello: HelloMsg;
  onStatus?: (s: string) => void;
  injectCommand?: string;
  onInjectConsumed?: () => void;
  expandInput?: (line: string) => string[];
  onServerLine?: (line: string) => void;
};

const MAX_ATTEMPTS = 5;

export function TerminalHost({
  wsUrl,
  hello,
  onStatus,
  injectCommand,
  onInjectConsumed,
  expandInput,
  onServerLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  helloRef.current = hello;

  // Parent re-renders pass new function identities every time — never put these in effect deps.
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onServerLineRef = useRef(onServerLine);
  onServerLineRef.current = onServerLine;
  const expandInputRef = useRef(expandInput);
  expandInputRef.current = expandInput;
  const onInjectConsumedRef = useRef(onInjectConsumed);
  onInjectConsumedRef.current = onInjectConsumed;

  const lineAcc = useRef("");
  const lastStatusRef = useRef("");

  /** Dedupe + defer status so onerror/onclose cannot nest setState in one turn. */
  const reportStatus = (s: string) => {
    if (s === lastStatusRef.current) return;
    lastStatusRef.current = s;
    queueMicrotask(() => {
      if (lastStatusRef.current === s) onStatusRef.current?.(s);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!injectCommand) return;
    const expand = expandInputRef.current;
    const lines = expand ? expand(injectCommand) : [injectCommand];
    for (const line of lines) sendRaw(line);
    onInjectConsumedRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectCommand]);

  useEffect(() => {
    if (!wsUrl) return;

    let disposed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let intentionalClose = false;

    const tearDownSocket = () => {
      const prev = wsRef.current;
      wsRef.current = null;
      if (!prev) return;
      intentionalClose = true;
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
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      attempt += 1;
      if (attempt > MAX_ATTEMPTS) {
        reportStatus("disconnected (max retries)");
        return;
      }
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 16_000);
      reportStatus(`reconnect in ${Math.round(delayMs / 1000)}s… (${attempt}/${MAX_ATTEMPTS})`);
      timer = setTimeout(() => {
        timer = undefined;
        if (!disposed) open();
      }, delayMs);
    };

    const open = () => {
      if (disposed) return;
      tearDownSocket();
      intentionalClose = false;
      reportStatus(attempt === 0 ? "connecting…" : `reconnecting… (${attempt})`);

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const paint = () => rendererRef.current.draw(bufRef.current);

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) return;
        attempt = 0;
        reportStatus("handshaking…");
        try {
          ws.send(JSON.stringify(helloRef.current));
        } catch {
          /* onclose will retry */
        }
      };

      ws.onerror = () => {
        // Browser fires onerror then onclose; only annotate, reconnect in onclose.
        if (disposed || wsRef.current !== ws) return;
        // Don't call reportStatus("error") here — avoids double setState with onclose.
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed || intentionalClose) {
          if (disposed) reportStatus("disconnected");
          return;
        }
        scheduleReconnect();
      };

      ws.onmessage = (ev) => {
        if (disposed || wsRef.current !== ws) return;
        if (typeof ev.data === "string") {
          const s = ev.data;
          if (s.startsWith("{")) {
            try {
              const j = JSON.parse(s) as { type?: string; message?: string };
              if (j.type === "error") {
                const msg = (j.message ?? "error")
                  .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
                  .slice(0, 200);
                reportStatus(msg || "error");
              } else if (j.type === "ready") {
                reportStatus("connected");
              }
            } catch {
              reportStatus("bad control frame");
            }
          }
          return;
        }
        const bytes = new Uint8Array(ev.data as ArrayBuffer);
        const text = decoderRef.current.push(bytes);
        if (text) {
          bufRef.current.writeDecoded(text);
          paint();
          lineAcc.current += text;
          const parts = lineAcc.current.split(/\r?\n/);
          lineAcc.current = parts.pop() ?? "";
          for (const ln of parts) {
            if (ln) onServerLineRef.current?.(ln);
          }
        }
      };
    };

    open();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      tearDownSocket();
      decoderRef.current.reset();
      lineAcc.current = "";
      lastStatusRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reconnect when URL changes
  }, [wsUrl]);

  const sendRaw = (line: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (line.length > 4096) return;
      ws.send(line);
    }
  };

  return (
    <div className="h-full min-h-0 w-full overflow-auto touch-pan-y">
      <canvas
        ref={canvasRef}
        className="block max-w-full"
        style={{
          imageRendering: "pixelated",
          background: "#0a0b0e",
        }}
      />
    </div>
  );
}
