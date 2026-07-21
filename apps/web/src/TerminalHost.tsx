import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScreenBuffer,
  Canvas2DRenderer,
  type SelectionRange,
} from "@assmud/terminal";
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

type CopyMenu = {
  x: number;
  y: number;
  mode: "selection" | "screen";
};

// @refresh reset

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef(new ScreenBuffer(80, 28));
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const lineAcc = useRef("");
  const socketRef = useRef<MudSocket | null>(null);
  const selecting = useRef(false);
  const selRef = useRef<SelectionRange | null>(null);

  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [menu, setMenu] = useState<CopyMenu | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  const redraw = useCallback(() => {
    rendererRef.current.draw(bufRef.current, selRef.current);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const copyText = async (kind: "plain" | "ansi", scope: "selection" | "screen") => {
    const buf = bufRef.current;
    const sel = selRef.current;
    let text: string;
    if (scope === "selection" && sel) {
      text =
        kind === "ansi"
          ? buf.exportSelectionAnsi(sel.r0, sel.c0, sel.r1, sel.c1)
          : buf.exportSelectionPlain(sel.r0, sel.c0, sel.r1, sel.c1);
    } else {
      text = kind === "ansi" ? buf.snapshotAnsi() : buf.snapshotText();
    }
    const ok = await writeClipboard(text);
    setMenu(null);
    flash(
      ok
        ? kind === "ansi"
          ? "已複製（含色碼）"
          : "已複製（純文字）"
        : "複製失敗",
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    redraw();
    return () => rendererRef.current.dispose();
  }, [redraw]);

  useEffect(() => {
    if (!wsUrl) return;

    const sock = new MudSocket(wsUrl, () => helloRef.current);
    socketRef.current = sock;

    sock.setHandlers({
      onBinary: (bytes) => {
        const text = decoderRef.current.push(bytes);
        if (!text) return;
        bufRef.current.writeDecoded(text);
        redraw();
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
  }, [wsUrl, redraw]);

  useEffect(() => {
    if (!injectCommand) return;
    const expand = expandInputRef.current;
    const lines = expand ? expand(injectCommand) : [injectCommand];
    for (const line of lines) socketRef.current?.send(line);
    onInjectConsumedRef.current?.();
  }, [injectCommand]);

  // Keyboard: Ctrl/Cmd+C copies plain (or opens choice if shift)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c") return;
      // if page has other selection, don't steal
      const native = window.getSelection()?.toString();
      if (native && native.length > 0) return;
      if (!selRef.current && !e.shiftKey) return;
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Ctrl+C → ANSI
        void copyText("ansi", selRef.current ? "selection" : "screen");
      } else {
        void copyText("plain", selRef.current ? "selection" : "screen");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const hit = rendererRef.current.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    setMenu(null);
    selecting.current = true;
    const next = { r0: hit.r, c0: hit.c, r1: hit.r, c1: hit.c };
    selRef.current = next;
    setSelection(next);
    redraw();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!selecting.current) return;
    const hit = rendererRef.current.hitTest(e.clientX, e.clientY);
    if (!hit || !selRef.current) return;
    const next = { ...selRef.current, r1: hit.r, c1: hit.c };
    selRef.current = next;
    setSelection(next);
    redraw();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!selecting.current) return;
    selecting.current = false;
    const sel = selRef.current;
    if (!sel) return;
    // click without drag → clear selection
    if (sel.r0 === sel.r1 && sel.c0 === sel.c1) {
      selRef.current = null;
      setSelection(null);
      redraw();
      return;
    }
    // show copy menu near pointer
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (wrap) {
      setMenu({
        x: Math.min(e.clientX - wrap.left + 8, wrap.width - 180),
        y: Math.min(e.clientY - wrap.top + 8, wrap.height - 100),
        mode: "selection",
      });
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setMenu({
      x: Math.min(e.clientX - wrap.left, wrap.width - 180),
      y: Math.min(e.clientY - wrap.top, wrap.height - 120),
      mode: selRef.current ? "selection" : "screen",
    });
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full overflow-auto touch-pan-y"
      onContextMenu={onContextMenu}
    >
      {/* toolbar */}
      <div
        className="absolute top-1 right-1 z-10 flex flex-wrap gap-1 justify-end max-w-[min(100%,20rem)]"
        style={{ pointerEvents: "auto" }}
      >
        <button
          type="button"
          className="rounded border px-2 py-1 text-[11px] font-mono"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text-dim)",
          }}
          title="Copy screen without ANSI"
          onClick={() => void copyText("plain", "screen")}
        >
          複製純文字
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 text-[11px] font-mono"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text-dim)",
          }}
          title="Copy screen with ANSI color codes"
          onClick={() => void copyText("ansi", "screen")}
        >
          複製含色碼
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="block cursor-text"
        style={{
          // never use pixelated — it freckles glyph edges when CSS-scaled
          imageRendering: "auto",
          background: "#0a0b0e",
          maxWidth: "100%",
          height: "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          selecting.current = false;
        }}
      />

      {menu && (
        <div
          className="absolute z-20 min-w-[10.5rem] rounded-[var(--radius-sm)] border py-1 shadow-[var(--shadow)] text-xs"
          style={{
            left: menu.x,
            top: menu.y,
            background: "var(--bg-panel)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          role="menu"
        >
          <div
            className="px-3 py-1 text-[10px] uppercase tracking-wide"
            style={{ color: "var(--text-faint)" }}
          >
            {menu.mode === "selection" ? "選取範圍" : "整屏"}
          </div>
          <button
            type="button"
            role="menuitem"
            className="block w-full text-left px-3 py-2 hover:opacity-90"
            style={{ background: "transparent", color: "var(--text)" }}
            onClick={() => void copyText("plain", menu.mode)}
          >
            複製純文字
            <span className="block text-[10px]" style={{ color: "var(--text-faint)" }}>
              移除色碼 · Ctrl+C
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full text-left px-3 py-2 hover:opacity-90"
            style={{ background: "transparent", color: "var(--text)" }}
            onClick={() => void copyText("ansi", menu.mode)}
          >
            複製含色碼
            <span className="block text-[10px]" style={{ color: "var(--text-faint)" }}>
              ANSI / SGR · Shift+Ctrl+C
            </span>
          </button>
          {selection && (
            <button
              type="button"
              role="menuitem"
              className="block w-full text-left px-3 py-2 border-t"
              style={{
                background: "transparent",
                color: "var(--text-dim)",
                borderColor: "var(--border)",
              }}
              onClick={() => {
                selRef.current = null;
                setSelection(null);
                setMenu(null);
                redraw();
              }}
            >
              清除選取
            </button>
          )}
        </div>
      )}

      {toast && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
            border: "1px solid var(--border)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
