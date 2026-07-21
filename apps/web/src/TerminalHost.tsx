import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";

type Props = {
  wsUrl: string | null;
  onStatus?: (s: string) => void;
};

/**
 * Thin React host: owns canvas + WS lifecycle; paint loop outside React state.
 */
export function TerminalHost({ wsUrl, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const wsRef = useRef<WebSocket | null>(null);

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

    ws.onopen = () => onStatus?.("connected");
    ws.onclose = () => onStatus?.("disconnected");
    ws.onerror = () => onStatus?.("error");
    ws.onmessage = (ev) => {
      // Proxy sends mud as binary; JSON control only as text starting with '{'
      if (typeof ev.data === "string") {
        const s = ev.data;
        if (s.startsWith("{")) {
          try {
            const j = JSON.parse(s) as { type?: string; message?: string };
            if (j.type === "error") {
              const msg = (j.message ?? "error").replace(/[^\x20-\x7E\u4e00-\u9fff]/g, "").slice(0, 200);
              onStatus?.(msg || "error");
            }
          } catch {
            onStatus?.("bad control frame");
          }
        }
        // ignore non-JSON text from proxy (mud must be binary)
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
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(line);
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
