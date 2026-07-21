import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";
import { MudSocket, type HelloMsg } from "./lib/mudSocket";

export type { HelloMsg };

type Props = {
  wsUrl: string | null;
  hello: HelloMsg;
  onStatus?: (s: string) => void;
  injectCommand?: string;
  onInjectConsumed?: () => void;
  expandInput?: (line: string) => string[];
  onServerLine?: (line: string) => void;
};

// Force Vite to full-remount this module (stale HMR was replaying old WS loops).
// @refresh reset

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
  const lineAcc = useRef("");
  const socketRef = useRef<MudSocket | null>(null);

  const helloRef = useRef(hello);
  helloRef.current = hello;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onServerLineRef = useRef(onServerLine);
  onServerLineRef.current = onServerLine;
  const expandInputRef = useRef(expandInput);
  expandInputRef.current = expandInput;
  const onInjectConsumedRef = useRef(onInjectConsumed);
  onInjectConsumedRef.current = onInjectConsumed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    rendererRef.current.draw(bufRef.current);
    return () => rendererRef.current.dispose();
  }, []);

  // Connect exactly once per wsUrl. Handlers live in refs — never effect deps.
  useEffect(() => {
    if (!wsUrl) return;

    const sock = new MudSocket(wsUrl, () => helloRef.current);
    socketRef.current = sock;

    sock.setHandlers({
      onBinary: (bytes) => {
        const text = decoderRef.current.push(bytes);
        if (!text) return;
        bufRef.current.writeDecoded(text);
        rendererRef.current.draw(bufRef.current);
        lineAcc.current += text;
        const parts = lineAcc.current.split(/\r?\n/);
        lineAcc.current = parts.pop() ?? "";
        for (const ln of parts) {
          if (ln) onServerLineRef.current?.(ln);
        }
      },
    });

    const unsub = sock.subscribeStatus(() => {
      onStatusRef.current?.(sock.getStatus());
    });

    sock.start();

    return () => {
      unsub();
      sock.stop();
      if (socketRef.current === sock) socketRef.current = null;
      decoderRef.current.reset();
      lineAcc.current = "";
    };
  }, [wsUrl]);

  useEffect(() => {
    if (!injectCommand) return;
    const expand = expandInputRef.current;
    const lines = expand ? expand(injectCommand) : [injectCommand];
    for (const line of lines) socketRef.current?.send(line);
    onInjectConsumedRef.current?.();
  }, [injectCommand]);

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
