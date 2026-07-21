import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScreenBuffer,
  Canvas2DRenderer,
  type SelectionRange,
  type WidthMode,
} from "@assmud/terminal";
import { Big5StreamDecoder } from "@assmud/codec-big5";
import { MudSocket, type HelloMsg, type StatusEvent } from "./lib/mudSocket";
import { numpadDirection } from "./lib/numpadDirs";
import { fitTermSize, TERM_FIT } from "./lib/termFit";

export type { HelloMsg, StatusEvent };

type Props = {
  wsUrl: string | null;
  hello: HelloMsg;
  onStatus?: (e: StatusEvent) => void;
  /** Telnet ECHO password-mode (transient; not connection status). */
  onEchoMask?: (mask: boolean) => void;
  /**
   * Reliable inject: always include a unique `id` so repeating the same line
   * (e.g. Enter `n` twice) still fires. Plain string was a React state no-op bug.
   */
  injectCommand?: { id: number; line: string } | null;
  onInjectConsumed?: () => void;
  expandInput?: (line: string) => string[];
  onServerLine?: (line: string) => void;
  /**
   * zMUD-style user command path (history + echo + inject).
   * Numpad / hotkeys should use this so echo/history stay consistent.
   */
  onUserCommand?: (line: string) => void;
  /** Click terminal → focus command line (zMUD). */
  onRequestFocusCmd?: () => void;
  /** Local echo of a sent command (never passwords). */
  localEcho?: string;
  onLocalEchoConsumed?: () => void;
  /** Full CSS font-family stack (primary + TC fallbacks) */
  terminalFontStack?: string;
  fontSizePx?: number;
  cellWidthScale?: number;
  lineHeightScale?: number;
  /** Effective cell width mode (resolved from profile charset). */
  widthMode?: WidthMode;
};

type CopyMenuMode = "selection" | "screen";

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
  onEchoMask,
  injectCommand,
  onInjectConsumed,
  expandInput,
  onServerLine,
  onUserCommand,
  onRequestFocusCmd,
  localEcho,
  onLocalEchoConsumed,
  terminalFontStack,
  fontSizePx = 15,
  cellWidthScale = 1,
  lineHeightScale = 1.2,
  widthMode = "western",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef(
    new ScreenBuffer(TERM_FIT.defaultCols, TERM_FIT.defaultRows, widthMode),
  );
  const rendererRef = useRef(new Canvas2DRenderer());
  const decoderRef = useRef(new Big5StreamDecoder("big5hkscs"));
  const widthModeRef = useRef(widthMode);
  widthModeRef.current = widthMode;
  const lineAcc = useRef("");
  const socketRef = useRef<MudSocket | null>(null);
  const selecting = useRef(false);
  const selRef = useRef<SelectionRange | null>(null);
  /** Lines above live bottom; 0 = follow live. */
  const scrollOffsetRef = useRef(0);
  const echoMaskRef = useRef(false);
  /** Live grid size reported in hello + mid-session NAWS. */
  const termSizeRef = useRef<{ cols: number; rows: number }>({
    cols: TERM_FIT.defaultCols,
    rows: TERM_FIT.defaultRows,
  });

  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [menuMode, setMenuMode] = useState<CopyMenuMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [termSizeLabel, setTermSizeLabel] = useState(
    `${TERM_FIT.defaultCols}×${TERM_FIT.defaultRows}`,
  );

  const helloRef = useRef(hello);
  helloRef.current = hello;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onEchoMaskRef = useRef(onEchoMask);
  onEchoMaskRef.current = onEchoMask;
  const onServerLineRef = useRef(onServerLine);
  onServerLineRef.current = onServerLine;
  const expandInputRef = useRef(expandInput);
  expandInputRef.current = expandInput;
  const onInjectConsumedRef = useRef(onInjectConsumed);
  onInjectConsumedRef.current = onInjectConsumed;
  const onUserCommandRef = useRef(onUserCommand);
  onUserCommandRef.current = onUserCommand;
  const onRequestFocusCmdRef = useRef(onRequestFocusCmd);
  onRequestFocusCmdRef.current = onRequestFocusCmd;
  const onLocalEchoConsumedRef = useRef(onLocalEchoConsumed);
  onLocalEchoConsumedRef.current = onLocalEchoConsumed;

  const redraw = useCallback(() => {
    rendererRef.current.draw(
      bufRef.current,
      selRef.current,
      scrollOffsetRef.current,
    );
  }, []);

  const setViewOffset = useCallback(
    (next: number) => {
      const max = bufRef.current.scrollbackDepth();
      const o = Math.max(0, Math.min(Math.floor(next), max));
      scrollOffsetRef.current = o;
      setScrollOffset(o);
      redraw();
    },
    [redraw],
  );

  /** Fit buffer + canvas to wrap; notify MUD via hello (initial) or JSON naws. */
  const applyFit = useCallback(
    (opts?: { notifyMud?: boolean }) => {
      const wrap = wrapRef.current;
      const r = rendererRef.current;
      if (!wrap) return termSizeRef.current;
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      if (cssW < 20 || cssH < 20) return termSizeRef.current;
      const next = fitTermSize(cssW, cssH, r.cellW, r.cellH);
      const prev = termSizeRef.current;
      const changed = prev.cols !== next.cols || prev.rows !== next.rows;
      termSizeRef.current = next;
      if (changed) {
        bufRef.current.resize(next.cols, next.rows);
        setTermSizeLabel(`${next.cols}×${next.rows}`);
        // New grid — clear selection / scroll view
        selRef.current = null;
        setSelection(null);
        scrollOffsetRef.current = 0;
        setScrollOffset(0);
        if (opts?.notifyMud) {
          socketRef.current?.sendJson({
            type: "naws",
            cols: next.cols,
            rows: next.rows,
          });
        }
      }
      redraw();
      return next;
    },
    [redraw],
  );

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const copyText = async (
    kind: "plain" | "ansi",
    scope: "selection" | "screen" | "history",
  ) => {
    const buf = bufRef.current;
    const sel = selRef.current;
    let text: string;
    if (scope === "history") {
      text = buf.snapshotScrollbackPlain();
    } else if (scope === "selection" && sel) {
      text =
        kind === "ansi"
          ? buf.exportSelectionAnsi(sel.r0, sel.c0, sel.r1, sel.c1)
          : buf.exportSelectionPlain(sel.r0, sel.c0, sel.r1, sel.c1);
    } else {
      text = kind === "ansi" ? buf.snapshotAnsi() : buf.snapshotText();
    }
    const ok = await writeClipboard(text);
    setMenuMode(null);
    flash(
      ok
        ? scope === "history"
          ? "已複製歷史"
          : kind === "ansi"
            ? "已複製（含色碼）"
            : "已複製（純文字）"
        : "複製失敗",
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current.mount(canvas);
    if (terminalFontStack) {
      rendererRef.current.setTypography({
        fontFamily: terminalFontStack,
        fontSizePx,
        cellWidthScale,
        lineHeightScale,
      });
    }
    applyFit({ notifyMud: false });
    return () => rendererRef.current.dispose();
  }, [
    applyFit,
    terminalFontStack,
    fontSizePx,
    cellWidthScale,
    lineHeightScale,
  ]);

  useEffect(() => {
    if (!terminalFontStack) return;
    rendererRef.current.setTypography({
      fontFamily: terminalFontStack,
      fontSizePx,
      cellWidthScale,
      lineHeightScale,
    });
    // Font metrics change cell size → re-fit grid and NAWS
    applyFit({ notifyMud: true });
  }, [
    terminalFontStack,
    fontSizePx,
    cellWidthScale,
    lineHeightScale,
    applyFit,
  ]);

  // Observe terminal stage size (window / drawer / map panel)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Only notify MUD when a session is live
        applyFit({ notifyMud: Boolean(socketRef.current) });
      });
    });
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [applyFit, wsUrl]);

  // Charset / width mode change: clear buffer so cells never mix modes
  useEffect(() => {
    bufRef.current.setWidthMode(widthMode);
    redraw();
  }, [widthMode, redraw]);

  // Socket lifecycle: ONLY depends on wsUrl. Do NOT depend on applyFit/redraw —
  // those change identity and would stop() the socket (killing auto-reconnect).
  const applyFitRef = useRef(applyFit);
  applyFitRef.current = applyFit;
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;
  const lastInjectIdRef = useRef(0);

  useEffect(() => {
    if (!wsUrl) return;

    // Measure before hello so NAWS matches the real viewport
    const size = applyFitRef.current({ notifyMud: false });
    bufRef.current = new ScreenBuffer(
      size.cols,
      size.rows,
      widthModeRef.current,
    );
    decoderRef.current.reset();
    lineAcc.current = "";
    scrollOffsetRef.current = 0;
    setScrollOffset(0);
    echoMaskRef.current = false;
    lastInjectIdRef.current = 0;

    const sock = new MudSocket(wsUrl, () => ({
      ...helloRef.current,
      cols: termSizeRef.current.cols,
      rows: termSizeRef.current.rows,
    }));
    socketRef.current = sock;

    sock.setHandlers({
      onBinary: (bytes) => {
        const text = decoderRef.current.push(bytes);
        if (!text) return;
        bufRef.current.writeDecoded(text);
        // Follow live if user is at bottom; stay put while reading history
        if (scrollOffsetRef.current === 0) {
          redrawRef.current();
        } else {
          // Cap offset if history grew past max (still stay scrolled)
          const max = bufRef.current.scrollbackDepth();
          if (scrollOffsetRef.current > max) {
            scrollOffsetRef.current = max;
            setScrollOffset(max);
          }
          redrawRef.current();
        }
        lineAcc.current += text;
        const parts = lineAcc.current.split(/\r?\n/);
        lineAcc.current = parts.pop() ?? "";
        for (const ln of parts) {
          if (ln) onServerLineRef.current?.(ln);
        }
      },
      onEchoMask: (mask) => {
        echoMaskRef.current = mask;
        onEchoMaskRef.current?.(mask);
      },
    });

    const unsub = sock.subscribeStatus(() => {
      onStatusRef.current?.(sock.getStatus());
    });

    sock.start();

    return () => {
      unsub();
      sock.stop();
      onEchoMaskRef.current?.(false);
      if (socketRef.current === sock) socketRef.current = null;
      decoderRef.current.reset();
      lineAcc.current = "";
    };
  }, [wsUrl]);

  // Deliver inject immediately (MudSocket queues if not yet connected)
  useEffect(() => {
    if (!injectCommand?.line) return;
    if (lastInjectIdRef.current === injectCommand.id) return;
    lastInjectIdRef.current = injectCommand.id;
    const expand = expandInputRef.current;
    const lines = expand
      ? expand(injectCommand.line)
      : [injectCommand.line];
    const sock = socketRef.current;
    for (const line of lines) {
      if (sock) sock.send(line);
      // if no sock yet, drop is rare (tab just unmounted); id still advanced
    }
    onInjectConsumedRef.current?.();
  }, [injectCommand?.id, injectCommand?.line]);

  // zMUD Echo commands: paint a dim › line into the live buffer (not server)
  useEffect(() => {
    if (!localEcho) return;
    const safe = localEcho.replace(/\r|\n/g, " ").slice(0, 400);
    bufRef.current.writeDecoded(`\x1b[2;36m› ${safe}\x1b[0m\r\n`);
    if (scrollOffsetRef.current === 0) redraw();
    else setViewOffset(0);
    onLocalEchoConsumedRef.current?.();
  }, [localEcho, redraw, setViewOffset]);

  // Keyboard: copy shortcuts, PageUp/Down scrollback, zMUD numpad dirs
  useEffect(() => {
    const isMudCommandField = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
      const al = el.getAttribute("aria-label") ?? "";
      return al === "command" || al === "password";
    };

    const isOtherFormField = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "SELECT" || tag === "TEXTAREA") return !isMudCommandField(el);
      if (tag === "INPUT") return !isMudCommandField(el);
      return Boolean(el.isContentEditable);
    };

    const onKey = (e: KeyboardEvent) => {
      // ── Copy ────────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const native = window.getSelection()?.toString();
        if (native && native.length > 0) return;
        if (!selRef.current && !e.shiftKey) return;
        e.preventDefault();
        if (e.shiftKey) {
          void copyText("ansi", selRef.current ? "selection" : "screen");
        } else {
          void copyText("plain", selRef.current ? "selection" : "screen");
        }
        return;
      }

      // ── Scrollback navigation ───────────────────────────────────
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const page = Math.max(1, bufRef.current.rows - 2);
        if (e.key === "PageUp") {
          if (isOtherFormField(e.target)) return;
          e.preventDefault();
          setViewOffset(scrollOffsetRef.current + page);
          return;
        }
        if (e.key === "PageDown") {
          if (isOtherFormField(e.target)) return;
          e.preventDefault();
          setViewOffset(scrollOffsetRef.current - page);
          return;
        }
        if (e.key === "End" && e.location !== 3) {
          // main End → jump to live (numpad End is sw)
          if (isOtherFormField(e.target)) return;
          if (scrollOffsetRef.current > 0) {
            e.preventDefault();
            setViewOffset(0);
          }
          return;
        }
        if (e.key === "Home" && e.location !== 3 && e.shiftKey) {
          if (isOtherFormField(e.target)) return;
          e.preventDefault();
          setViewOffset(bufRef.current.scrollbackDepth());
          return;
        }
      }

      // ── zMUD numpad directions ──────────────────────────────────
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (echoMaskRef.current) return; // password entry — don't steal digits
      if (isOtherFormField(e.target)) return;
      if (!socketRef.current) return;

      const dir = numpadDirection(e);
      if (!dir) return;
      e.preventDefault();
      // If reading history, snap to live when moving
      if (scrollOffsetRef.current > 0) setViewOffset(0);
      if (onUserCommandRef.current) {
        onUserCommandRef.current(dir);
      } else {
        socketRef.current.send(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setViewOffset]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const hit = rendererRef.current.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    setMenuMode(null);
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

  const onPointerUp = () => {
    if (!selecting.current) return;
    selecting.current = false;
    const sel = selRef.current;
    if (!sel) return;
    // click without drag → clear selection + zMUD focus command line
    if (sel.r0 === sel.r1 && sel.c0 === sel.c1) {
      selRef.current = null;
      setSelection(null);
      setMenuMode(null);
      redraw();
      onRequestFocusCmdRef.current?.();
      return;
    }
    // float copy bar above command input (bottom of terminal stage)
    setMenuMode("selection");
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuMode(selRef.current ? "selection" : "screen");
  };

  const onWheel = (e: React.WheelEvent) => {
    const depth = bufRef.current.scrollbackDepth();
    if (depth === 0 && scrollOffsetRef.current === 0) return;
    e.preventDefault();
    // deltaY > 0 → scroll down toward live; < 0 → up into history
    const step = e.deltaMode === 1 ? e.deltaY * 3 : e.deltaY / 40;
    const lines = Math.trunc(step) || (e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0);
    if (!lines) return;
    setViewOffset(scrollOffsetRef.current - lines);
  };

  return (
    <div
      ref={wrapRef}
      lang="und"
      className="relative h-full min-h-0 w-full overflow-hidden touch-pan-y"
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      {/* toolbar */}
      <div
        className="absolute top-1 right-1 z-10 flex flex-wrap gap-1 justify-end max-w-[min(100%,22rem)]"
        style={{ pointerEvents: "auto" }}
      >
        {scrollOffset > 0 && (
          <button
            type="button"
            className="rounded border px-2 py-1 text-[11px] font-mono"
            style={{
              background: "var(--accent-dim)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
            title="Jump to live (End)"
            onClick={() => setViewOffset(0)}
          >
            ↓ 即時 · {scrollOffset}
          </button>
        )}
        <span
          className="rounded border px-2 py-1 text-[10px] font-mono tabular-nums"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text-faint)",
          }}
          title="NAWS terminal size (cols×rows)"
        >
          {termSizeLabel}
        </span>
        <button
          type="button"
          className="rounded border px-2 py-1 text-[11px] font-mono"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text-dim)",
          }}
          title="Copy scrollback + screen"
          onClick={() => void copyText("plain", "history")}
        >
          複製歷史
        </button>
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
          // Exact cell grid size (set by renderer); do not CSS-stretch beyond stage
          maxWidth: "100%",
          maxHeight: "100%",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          selecting.current = false;
        }}
      />

      {/* Float on the bottom edge of the terminal stage → sits on top of shell input bar */}
      {menuMode && (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-2 pt-1 pointer-events-none"
        >
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-[var(--radius)] border px-2 py-1.5 text-xs max-w-full"
            style={{
              background: "color-mix(in srgb, var(--bg-panel) 94%, transparent)",
              backdropFilter: "blur(10px)",
              borderColor: "var(--border)",
              color: "var(--text)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
            }}
            role="menu"
            aria-label="複製選單"
          >
            <span
              className="px-1.5 text-[10px] font-mono shrink-0"
              style={{ color: "var(--text-faint)" }}
            >
              {menuMode === "selection" ? "選取" : "整屏"}
            </span>
            <button
              type="button"
              role="menuitem"
              className="rounded-[var(--radius-sm)] border px-2.5 py-1.5 font-medium min-h-[36px]"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              onClick={() => void copyText("plain", menuMode)}
            >
              純文字
              <span className="hidden sm:inline" style={{ color: "var(--text-faint)" }}>
                {" "}
                · 去色碼
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="rounded-[var(--radius-sm)] border px-2.5 py-1.5 font-medium min-h-[36px]"
              style={{
                background: "var(--accent-dim)",
                borderColor: "var(--accent)",
                color: "var(--accent)",
              }}
              onClick={() => void copyText("ansi", menuMode)}
            >
              含色碼
              <span className="hidden sm:inline opacity-80"> · ANSI</span>
            </button>
            {selection && (
              <button
                type="button"
                role="menuitem"
                className="rounded-[var(--radius-sm)] px-2 py-1.5 min-h-[36px]"
                style={{ color: "var(--text-dim)" }}
                onClick={() => {
                  selRef.current = null;
                  setSelection(null);
                  setMenuMode(null);
                  redraw();
                }}
              >
                清除
              </button>
            )}
            <button
              type="button"
              className="rounded-[var(--radius-sm)] px-2 py-1.5 min-h-[36px]"
              style={{ color: "var(--text-faint)" }}
              aria-label="關閉"
              onClick={() => setMenuMode(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 rounded-full px-3 py-1 text-xs font-medium pointer-events-none"
          style={{
            // sit just above typical command bar (~cmd + thumb pad)
            bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 5rem))",
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
