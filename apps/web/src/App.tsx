import { useCallback, useMemo, useState } from "react";
import { TerminalHost, type HelloMsg } from "./TerminalHost";
import {
  DEFAULT_PROFILES,
  loadProfiles,
  saveProfiles,
  type MudProfile,
  exportProfilesJson,
  importProfilesJson,
} from "@assmud/profiles";
import { ScriptEngine } from "@assmud/script-engine";
import { RW_STARTER_PACK } from "@assmud/rw-pack";
import { ClientMap } from "@assmud/mapper";

const DEFAULT_WS =
  import.meta.env.VITE_PROXY_WS ?? "ws://127.0.0.1:7788/ws";

type Tab = {
  id: string;
  profileId: string;
  connected: boolean;
  status: string;
  log: string[];
};

const engine = new ScriptEngine();
try {
  engine.importPackage(JSON.stringify(RW_STARTER_PACK));
} catch {
  /* ignore */
}
const clientMap = new ClientMap();

export function App() {
  const [profiles, setProfiles] = useState<MudProfile[]>(() => loadProfiles());
  const [token, setToken] = useState(
    () => localStorage.getItem("assmud_token") ?? "",
  );
  const [activeProfile, setActiveProfile] = useState(profiles[0]?.id ?? "rw-4000");
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "t1",
      profileId: profiles[0]?.id ?? "rw-4000",
      connected: false,
      status: "idle",
      log: [],
    },
  ]);
  const [tabId, setTabId] = useState("t1");
  const [cmd, setCmd] = useState("");
  const [mapAscii, setMapAscii] = useState("(move n/s/e/w to map)");
  const [showLog, setShowLog] = useState(false);

  const tab = tabs.find((t) => t.id === tabId)!;
  const profile =
    profiles.find((p) => p.id === (tab?.profileId ?? activeProfile)) ??
    profiles[0]!;

  const setTabStatus = useCallback((id: string, status: string) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
  }, []);

  const wsUrl = useMemo(() => {
    if (!tab?.connected) return null;
    return DEFAULT_WS;
  }, [tab?.connected]);

  const hello: HelloMsg = useMemo(
    () => ({
      type: "hello",
      token: token || undefined,
      host: profile.host,
      port: profile.port,
      cols: 80,
      rows: 28,
    }),
    [token, profile],
  );

  const onSendThroughEngine = (line: string) => {
    const expanded = engine.expandInput(line);
    for (const l of expanded) {
      const dir = l.trim().toLowerCase();
      if (["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"].includes(dir)) {
        clientMap.move(dir as "n", dir);
        setMapAscii(clientMap.ascii(4));
      }
    }
    return expanded;
  };

  const downloadLog = () => {
    const blob = new Blob([tab.log.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assmud-session-${tab.id}.log`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 h-full flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">assmud</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            multi-MUD · {profile.name} · {tab.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded px-2 py-1 text-xs border ${
                t.id === tabId
                  ? "bg-sky-800 border-sky-600"
                  : "bg-zinc-900 border-zinc-700"
              }`}
              onClick={() => setTabId(t.id)}
            >
              {t.id}
            </button>
          ))}
          <button
            type="button"
            className="rounded px-2 py-1 text-xs border border-zinc-700 bg-zinc-900"
            onClick={() => {
              const id = `t${tabs.length + 1}`;
              setTabs((ts) => [
                ...ts,
                {
                  id,
                  profileId: activeProfile,
                  connected: false,
                  status: "idle",
                  log: [],
                },
              ]);
              setTabId(id);
            }}
          >
            + tab
          </button>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
        <label className="text-xs flex flex-col gap-1">
          Profile
          <select
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm"
            value={tab.profileId}
            disabled={tab.connected}
            onChange={(e) => {
              const pid = e.target.value;
              setActiveProfile(pid);
              setTabs((ts) =>
                ts.map((t) => (t.id === tabId ? { ...t, profileId: pid } : t)),
              );
            }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.host}:{p.port})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs flex flex-col gap-1">
          Auth token
          <input
            className="rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 font-mono text-sm"
            value={token}
            disabled={tab.connected}
            onChange={(e) => {
              setToken(e.target.value);
              localStorage.setItem("assmud_token", e.target.value);
            }}
          />
        </label>
        <div className="flex items-end gap-2 flex-wrap">
          <button
            type="button"
            className="rounded bg-sky-700 hover:bg-sky-600 px-3 py-2 text-sm disabled:opacity-40"
            disabled={tab.connected}
            onClick={() =>
              setTabs((ts) =>
                ts.map((t) =>
                  t.id === tabId ? { ...t, connected: true } : t,
                ),
              )
            }
          >
            連線
          </button>
          <button
            type="button"
            className="rounded bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm"
            onClick={() =>
              setTabs((ts) =>
                ts.map((t) =>
                  t.id === tabId
                    ? { ...t, connected: false, status: "idle" }
                    : t,
                ),
              )
            }
          >
            斷線
          </button>
        </div>
        <div className="flex items-end gap-1 flex-wrap">
          {["n", "s", "e", "w", "look", "score"].map((b) => (
            <button
              key={b}
              type="button"
              className="rounded bg-emerald-900/80 border border-emerald-800 px-2 py-1.5 text-xs font-mono active:scale-95"
              onClick={() => setCmd(b)}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={() => setShowLog((v) => !v)}
          >
            log
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={downloadLog}
          >
            save log
          </button>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1.5 text-xs"
            onClick={() => {
              const blob = new Blob([exportProfilesJson(profiles)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "assmud-profiles.json";
              a.click();
            }}
          >
            export profiles
          </button>
          <label className="rounded border border-zinc-700 px-2 py-1.5 text-xs cursor-pointer">
            import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                const list = importProfilesJson(text);
                setProfiles(list);
                saveProfiles(list);
              }}
            />
          </label>
        </div>
      </section>

      <div className="flex-1 min-h-[280px] grid lg:grid-cols-[1fr_160px] gap-2">
        <TerminalHost
          key={tabId + String(tab.connected)}
          wsUrl={wsUrl}
          hello={hello}
          injectCommand={cmd}
          onInjectConsumed={() => setCmd("")}
          expandInput={onSendThroughEngine}
          onServerLine={(line) => {
            engine.onServerLine(line);
            setTabs((ts) =>
              ts.map((t) =>
                t.id === tabId
                  ? { ...t, log: [...t.log.slice(-5000), line] }
                  : t,
              ),
            );
          }}
          onStatus={(s) => setTabStatus(tabId, s)}
        />
        <aside className="hidden lg:block rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-tight whitespace-pre text-zinc-400 overflow-auto">
          <div className="text-zinc-500 mb-1">client map</div>
          {mapAscii}
        </aside>
      </div>

      {showLog && (
        <pre className="max-h-40 overflow-auto text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-400">
          {tab.log.slice(-100).join("\n") || "(empty log)"}
        </pre>
      )}

      <footer className="text-[10px] text-zinc-600 pb-2">
        profiles: {profiles.length || DEFAULT_PROFILES.length} · pack:{" "}
        {RW_STARTER_PACK.name} · desktop+mobile · develop
      </footer>
    </div>
  );
}
