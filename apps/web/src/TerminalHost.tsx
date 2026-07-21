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
  const lineAcc = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!injectCommand) return;
    // expand once here; sendLine must not re-expand injected pieces
    const lines = expandInput ? expandInput(injectCommand) : [injectCommand];
    for (const line of lines) sendRaw(line);
    onInjectConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectCommand]);

  useEffect(() => {
    if (!wsUrl) return;
    onStatus?.("connecting…");
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket;

    const connect = () => {
      if (closed) return;
      onStatus?.(attempt ? `reconnecting… (${attempt})` : "connecting…");
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const paint = () => rendererRef.current.draw(bufRef.current);

      ws.onopen = () => {
        attempt = 0;
        onStatus?.("handshaking…");
        ws.send(JSON.stringify(helloRef.current));
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (closed) {
          onStatus?.("disconnected");
          return;
        }
        attempt += 1;
        if (attempt > 5) {
          onStatus?.("disconnected");
          return;
        }
        onStatus?.(`reconnect in ${attempt}s`);
        timer = setTimeout(connect, attempt * 1000);
      };
      ws.onerror = () => onStatus?.("error");
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          const s = ev.data;
          if (s.startsWith("{")) {
            try {
              const j = JSON.parse(s) as { type?: string; message?: string };
              if (j.type === "error") {
                const msg = (j.message ?? "error")
                  .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "")
                  .slice(0, 200);
                onStatus?.(msg || "error");
              } else if (j.type === "ready") {
                onStatus?.("connected");
              }
            } catch {
              onStatus?.("bad control frame");
            }
          }
          return;
        }
        const bytes = new Uint8Array(ev.data as ArrayBuffer);
        const text = decoderRef.current.push(bytes);
        if (text) {
          bufRef.current.writeDecoded(text);
          paint();
          // line split for script engine
          lineAcc.current += text;
          const parts = lineAcc.current.split(/\r?\n/);
          lineAcc.current = parts.pop() ?? "";
          for (const ln of parts) {
            if (ln) onServerLine?.(ln);
          }
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
      decoderRef.current.reset();
      lineAcc.current = "";
    };
  }, [wsUrl, onStatus, onServerLine]);

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
