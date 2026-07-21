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
};

/**
 * Thin React host: owns canvas + WS lifecycle; paint loop outside React state.
 * Auth/destination via first-frame hello (no secrets in URL).
 */
export function TerminalHost({ wsUrl, hello, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);
  const helloRef = useRef(hello);
  helloRef.current = hello;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    onStatus?.("connecting…");
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const paint = () => rendererRef.current.draw(bufRef.current);

    ws.onopen = () => {
      onStatus?.("handshaking…");
      ws.send(JSON.stringify(helloRef.current));
    };
    ws.onclose = () => onStatus?.("disconnected");
    ws.onerror = () => onStatus?.("error");
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        const s = ev.data;
        if (s.startsWith("{")) {
          try {
            const j = JSON.parse(s) as {
              type?: string;
              message?: string;
            };
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
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      decoderRef.current.reset();
    };
  }, [wsUrl, onStatus]);

  const sendLine = (line: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (line.length > 4096) return;
      ws.send(line);
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <canvas
        ref={canvasRef}
        className="rounded border border-zinc-700 bg-black max-w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const line = String(fd.get("line") ?? "");
          sendLine(line);
          e.currentTarget.reset();
        }}
      >
        <input
          name="line"
          autoComplete="off"
          className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="輸入指令…"
        />
        <button
          type="submit"
          className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm"
        >
          送出
        </button>
      </form>
    </div>
  );
}
