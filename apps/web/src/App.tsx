import { useMemo, useState } from "react";
import { TerminalHost } from "./TerminalHost";

const DEFAULT_WS =
  import.meta.env.VITE_PROXY_WS ?? "ws://127.0.0.1:7788/ws";

export function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("assmud_token") ?? "",
  );
  const [host, setHost] = useState("mud.revivalworld.org");
  const [port, setPort] = useState("4000");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("idle");

  const wsUrl = useMemo(() => {
    if (!connected) return null;
    // No secrets in query string — auth goes in first WS hello frame
    return DEFAULT_WS;
  }, [connected]);

  const hello = useMemo(
    () => ({
      type: "hello" as const,
      token: token || undefined,
      host,
      port: Number(port) || 4000,
      cols: 80,
      rows: 28,
    }),
    [token, host, port],
  );

  return (
    <div className="mx-auto max-w-5xl p-4 h-full flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">assmud</h1>
          <p className="text-sm text-zinc-400">
            Web MUD client · Phase 1a · status: {status}
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
        <label className="text-xs flex flex-col gap-1">
          MUD host
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={connected}
          />
        </label>
        <label className="text-xs flex flex-col gap-1">
          Port
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            disabled={connected}
          />
        </label>
        <label className="text-xs flex flex-col gap-1">
          Auth token（remote-prod 需要；hello 傳送）
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem("assmud_token", e.target.value);
            }}
            disabled={connected}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded bg-sky-700 hover:bg-sky-600 px-4 py-2 text-sm disabled:opacity-40"
            disabled={connected}
            onClick={() => setConnected(true)}
          >
            連線
          </button>
          <button
            type="button"
            className="rounded bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm"
            onClick={() => {
              setConnected(false);
              setStatus("idle");
            }}
          >
            斷線
          </button>
        </div>
      </section>

      <div className="flex-1 min-h-[320px]">
        <TerminalHost wsUrl={wsUrl} hello={hello} onStatus={setStatus} />
      </div>
    </div>
  );
}
