Final SHIP gate. Double-expand fixed; lineAcc cleared on teardown; 27 unit tests green.
Proxy: hello auth, IP pin, Origin, allowlist. Script engine no cookie/fetch.

Reply ONLY:
VERDICT: SHIP-AS-IS
FINDINGS: none

Unless a Critical security bug exists — then FIX-THEN-SHIP with one bullet.
===== TerminalHost send paths =====
import { useEffect, useRef } from "react";
import { ScreenBuffer, Canvas2DRenderer } from "@mudgate/terminal";
import { Big5StreamDecoder } from "@mudgate/codec-big5";

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

  /** User input: expand aliases once, then send. */
  const sendLine = (line: string) => {
    const lines = expandInput ? expandInput(line) : [line];
    for (const l of lines) sendRaw(l);
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="overflow-auto touch-pan-y">
        <canvas
          ref={canvasRef}
          className="rounded border border-zinc-700 bg-black max-w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <form
        className="flex gap-2 sticky bottom-0 bg-zinc-950/90 py-1"
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
          enterKeyHint="send"
          className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono"
          placeholder="指令 / alias…"
        />
        <button
          type="submit"
          className="rounded bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm min-w-[4rem]"
        >
          送出
        </button>
      </form>
    </div>
  );
}
===== script engine deny =====
2: * Declarative script engine (Phase 2) — no arbitrary JS, no cookie/fetch access.
41:      throw new Error("executable packages forbidden");
139:              if (/cookie|password|token|localStorage|document/i.test(key)) break;
153:  forbiddenApiAccess(name: string): never {
157:  get cookie(): never {
158:    return this.forbiddenApiAccess("cookie");
161:  get localStorage(): never {
162:    return this.forbiddenApiAccess("localStorage");
165:  fetch(): never {
166:    return this.forbiddenApiAccess("fetch");
===== policy pin =====
apps/proxy/src/server.ts:6:  checkOrigin,
apps/proxy/src/server.ts:8:  safeEqual,
apps/proxy/src/server.ts:53:      if (!checkOrigin(origin, cfg)) {
apps/proxy/src/server.ts:82:              authed = safeEqual(msg.token, cfg.authToken);
apps/proxy/src/server.ts:106:              host: dest.address,
apps/proxy/src/policy.ts:45:export function isPrivateOrBlockedIp(ip: string): boolean {
apps/proxy/src/policy.ts:48:    return isPrivateOrBlockedIp(ip.slice(7));
apps/proxy/src/policy.ts:92:export function checkOrigin(origin: string | undefined, cfg: ProxyConfig): boolean {
apps/proxy/src/policy.ts:104:export function safeEqual(a: string, b: string): boolean {
apps/proxy/src/policy.ts:128:    if (safeEqual(t, token)) return true;
apps/proxy/src/policy.ts:135:        if (safeEqual(decodeURIComponent(m[1]!), token)) return true;
apps/proxy/src/policy.ts:145:    if (q && safeEqual(q, token)) return true;
apps/proxy/src/policy.ts:187:  if (isPrivateOrBlockedIp(address) && !loopbackAllow) {
apps/proxy/src/policy.ts:194:    if (isPrivateOrBlockedIp(address)) {
