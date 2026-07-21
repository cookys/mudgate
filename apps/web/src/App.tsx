import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ConnectGate } from "./components/ConnectGate";
import { ConfirmModal } from "./components/ConfirmModal";
import { StatusPill } from "./components/StatusPill";
import {
  applyAccent,
  loadAccent,
  pickTagline,
  type AccentId,
} from "./lib/theme";

function newTabId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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

function useIsLg() {
  const [lg, setLg] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = () => setLg(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return lg;
}

export function App() {
  const [profiles, setProfiles] = useState<MudProfile[]>(() => loadProfiles());
  const [token, setToken] = useState(
    () => localStorage.getItem("assmud_token") ?? "",
  );
  const [accent, setAccent] = useState<AccentId>(() => loadAccent());
  const [tagline] = useState(() => pickTagline());
  const [activeProfile, setActiveProfile] = useState(
    profiles[0]?.id ?? "rw-4000",
  );
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const id = newTabId();
    return [
      {
        id,
        profileId: "rw-4000",
        connected: false,
        status: "idle",
        log: [],
      },
    ];
  });
  const [tabId, setTabId] = useState(() => tabs[0]?.id ?? "t0");
  const [cmd, setCmd] = useState("");
  const [inputDraft, setInputDraft] = useState("");
  const [mapAscii, setMapAscii] = useState("(move n/s/e/w to map)");
  const [showLog, setShowLog] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const isLg = useIsLg();
  // Board: map open desktop, closed mobile
  const [mapOpen, setMapOpen] = useState(true);
  useEffect(() => {
    setMapOpen(isLg);
  }, [isLg]);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0]!;
  const profile =
    profiles.find((p) => p.id === (tab?.profileId ?? activeProfile)) ??
    profiles[0]!;

  const anyConnected = tabs.some((t) => t.connected);
  const closeTarget = closeTargetId
    ? tabs.find((t) => t.id === closeTargetId)
    : undefined;
  const closeTargetName =
    profiles.find((p) => p.id === closeTarget?.profileId)?.name ??
    closeTarget?.id ??
    "session";

  const requestCloseTab = (id: string) => {
    setCloseTargetId(id);
  };

  const confirmCloseTab = () => {
    const id = closeTargetId;
    setCloseTargetId(null);
    if (!id) return;

    setTabs((ts) => {
      const remaining = ts.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const fresh: Tab = {
          id: newTabId(),
          profileId: activeProfile,
          connected: false,
          status: "idle",
          log: [],
        };
        // switch after state settles
        queueMicrotask(() => setTabId(fresh.id));
        return [fresh];
      }
      if (tabId === id) {
        const idx = ts.findIndex((t) => t.id === id);
        const fallback =
          remaining[Math.max(0, idx - 1)] ?? remaining[0]!;
        queueMicrotask(() => setTabId(fallback.id));
      }
      return remaining;
    });
  };

  const tabIdRef = useRef(tabId);
  tabIdRef.current = tabId;

  // Stable forever — never recreated, so children cannot loop on identity.
  const setTabStatus = useCallback((id: string, status: string) => {
    setTabs((ts) => {
      const cur = ts.find((t) => t.id === id);
      if (!cur || cur.status === status) return ts;
      return ts.map((t) => (t.id === id ? { ...t, status } : t));
    });
  }, []);

  const handleStatus = useCallback(
    (s: string) => {
      setTabStatus(tabIdRef.current, s);
    },
    [setTabStatus],
  );

  const handleServerLine = useCallback((line: string) => {
    engine.onServerLine(line);
    const id = tabIdRef.current;
    setTabs((ts) =>
      ts.map((t) =>
        t.id === id ? { ...t, log: [...t.log.slice(-5000), line] } : t,
      ),
    );
  }, []);

  // Prefer loopback WS when page is loopback (avoids LAN hairpin / fd storms).
  const wsUrl = useMemo(() => {
    if (!tab?.connected) return null;
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h === "127.0.0.1" || h === "localhost") {
        return "ws://127.0.0.1:7788/ws";
      }
    }
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

  const onSendThroughEngine = useCallback((line: string) => {
    const expanded = engine.expandInput(line);
    for (const l of expanded) {
      const dir = l.trim().toLowerCase();
      if (["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"].includes(dir)) {
        clientMap.move(dir as "n", dir);
        setMapAscii(clientMap.ascii(4));
      }
    }
    return expanded;
  }, []);

  const downloadLog = () => {
    const blob = new Blob([tab.log.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assmud-session-${tab.id}.log`;
    a.click();
  };

  const exportProfiles = () => {
    const blob = new Blob([exportProfilesJson(profiles)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "assmud-profiles.json";
    a.click();
  };

  const importProfilesFile = async (file: File) => {
    const text = await file.text();
    const list = importProfilesJson(text);
    setProfiles(list);
    saveProfiles(list);
  };

  const connectTab = () => {
    setTabs((ts) =>
      ts.map((t) => (t.id === tabId ? { ...t, connected: true } : t)),
    );
  };

  const disconnectTab = () => {
    setTabs((ts) =>
      ts.map((t) =>
        t.id === tabId ? { ...t, connected: false, status: "idle" } : t,
      ),
    );
  };

  const submitCmd = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    setCmd(trimmed);
    setInputDraft("");
  };

  // ── Connect gate (pre-session) ─────────────────────────────────────
  if (!anyConnected) {
    return (
      <ConnectGate
        tagline={tagline}
        profiles={profiles.length ? profiles : DEFAULT_PROFILES}
        profileId={tab.profileId}
        token={token}
        accent={accent}
        onProfile={(id) => {
          setActiveProfile(id);
          setTabs((ts) =>
            ts.map((t) => (t.id === tabId ? { ...t, profileId: id } : t)),
          );
        }}
        onToken={(t) => {
          setToken(t);
          localStorage.setItem("assmud_token", t);
        }}
        onAccent={(a) => {
          setAccent(a);
          applyAccent(a);
        }}
        onConnect={connectTab}
        onImportProfiles={(f) => void importProfilesFile(f)}
        onExportProfiles={exportProfiles}
      />
    );
  }

  // ── Play shell ─────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col min-h-0"
      style={{ background: "var(--bg-void)" }}
    >
      <ConfirmModal
        open={closeTargetId != null}
        title="Close session?"
        body={
          closeTarget?.connected
            ? `「${closeTargetName}」仍在線上。關閉會斷線並丟掉此分頁的即時連線（log 一併清除）。`
            : `關閉分頁「${closeTargetName}」？未儲存的 session log 會一併清除。`
        }
        confirmLabel="Close"
        cancelLabel="Keep"
        danger
        onConfirm={confirmCloseTab}
        onCancel={() => setCloseTargetId(null)}
      />

      {/* Topbar */}
      <header
        className="flex items-center gap-2 px-3 sm:px-4 shrink-0 border-b"
        style={{
          height: "var(--topbar-h)",
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
      >
        <span
          className="font-mono text-xs font-semibold tracking-widest uppercase shrink-0"
          style={{ color: "var(--accent)" }}
        >
          assmud
        </span>

        <div className="flex items-center gap-1 min-w-0 overflow-x-auto flex-1">
          {tabs.map((t) => {
            const p = profiles.find((x) => x.id === t.profileId);
            const active = t.id === tabId;
            return (
              <div
                key={t.id}
                className="inline-flex items-stretch shrink-0 rounded-[var(--radius-sm)] border overflow-hidden"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active
                    ? "var(--accent-dim)"
                    : "var(--bg-elevated)",
                }}
              >
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs font-mono transition max-w-[8rem] truncate"
                  style={{ color: "var(--text)" }}
                  onClick={() => setTabId(t.id)}
                  title={p?.name ?? t.id}
                >
                  {p?.name?.slice(0, 12) ?? t.id}
                  {t.connected ? (
                    <span
                      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ background: "var(--ok)" }}
                      aria-hidden
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  className="px-1.5 text-xs border-l min-w-[28px] hover:opacity-100 opacity-70 transition"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    color: "var(--text-dim)",
                  }}
                  aria-label={`Close ${p?.name ?? t.id}`}
                  title="Close session"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestCloseTab(t.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="rounded-[var(--radius-sm)] px-2 py-1 text-xs border shrink-0"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-dim)",
            }}
            onClick={() => {
              const id = newTabId();
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
            title="New tab"
          >
            +
          </button>
        </div>

        <StatusPill status={tab.status} />

        <button
          type="button"
          className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs border hidden sm:inline-flex"
          style={{
            borderColor: "var(--border)",
            background: mapOpen ? "var(--accent-dim)" : "var(--bg-elevated)",
            color: "var(--text-dim)",
          }}
          onClick={() => setMapOpen((v) => !v)}
        >
          map
        </button>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs border"
          style={{
            borderColor: drawerOpen ? "var(--accent)" : "var(--border)",
            background: drawerOpen ? "var(--accent-dim)" : "var(--bg-elevated)",
            color: "var(--text)",
          }}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Settings"
        >
          ⚙
        </button>
      </header>

      {/* Main stage */}
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 p-2 sm:p-3">
            <div
              className="h-full min-h-0 rounded-[var(--radius)] border overflow-hidden"
              style={{
                borderColor: "var(--border)",
                background: "#0a0b0e",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
              }}
            >
              {tab.connected ? (
                <TerminalHost
                  key={tabId}
                  wsUrl={wsUrl}
                  hello={hello}
                  injectCommand={cmd}
                  onInjectConsumed={() => setCmd("")}
                  expandInput={onSendThroughEngine}
                  onServerLine={handleServerLine}
                  onStatus={handleStatus}
                />
              ) : (
                <div
                  className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center"
                  style={{ color: "var(--text-dim)" }}
                >
                  <p className="font-mono text-sm">Session idle — not on the wire.</p>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--accent)",
                      color: "#0a0b0e",
                    }}
                    onClick={connectTab}
                  >
                    Connect →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map panel — open by default on lg+, closed mobile */}
        {mapOpen && (
          <aside
            className="w-[min(280px,42vw)] shrink-0 border-l flex flex-col min-h-0 absolute right-0 top-0 bottom-0 z-10 lg:static lg:z-0"
            style={{
              background: "var(--bg-panel)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 border-b text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              <span className="font-mono tracking-wide">client map</span>
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border text-[11px]"
                style={{ borderColor: "var(--border)" }}
                onClick={() => setMapOpen(false)}
              >
                ✕
              </button>
            </div>
            <pre
              className="flex-1 overflow-auto p-3 font-mono text-[10px] leading-tight whitespace-pre"
              style={{ color: "var(--text-dim)" }}
            >
              {mapAscii}
            </pre>
          </aside>
        )}

        {/* Settings drawer */}
        {drawerOpen && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/50 lg:bg-black/30"
              aria-label="Close settings"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-sm border-l flex flex-col shadow-[var(--shadow)]"
              style={{
                background: "var(--bg-panel)",
                borderColor: "var(--border)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="text-sm font-semibold">Session</h2>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                  onClick={() => setDrawerOpen(false)}
                >
                  close
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>
                    Profile
                  </div>
                  <select
                    className="w-full rounded-[var(--radius-sm)] border px-3 py-2 font-mono text-sm"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    value={tab.profileId}
                    disabled={tab.connected}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setActiveProfile(pid);
                      setTabs((ts) =>
                        ts.map((t) =>
                          t.id === tabId ? { ...t, profileId: pid } : t,
                        ),
                      );
                    }}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.host}:{p.port})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>
                    Auth token
                  </div>
                  <input
                    className="w-full rounded-[var(--radius-sm)] border px-3 py-2 font-mono text-sm"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    value={token}
                    disabled={tab.connected}
                    onChange={(e) => {
                      setToken(e.target.value);
                      localStorage.setItem("assmud_token", e.target.value);
                    }}
                  />
                </div>
                <div>
                  <div className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                    Accent
                  </div>
                  <div className="flex gap-2">
                    {(
                      [
                        { id: "mint" as const, label: "Mint", swatch: "#3dffa8" },
                        { id: "blue" as const, label: "Blue", swatch: "#5b9dff" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAccent(opt.id);
                          applyAccent(opt.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2 text-xs"
                        style={{
                          borderColor:
                            accent === opt.id ? "var(--accent)" : "var(--border)",
                          background:
                            accent === opt.id
                              ? "var(--accent-dim)"
                              : "var(--bg-elevated)",
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: opt.swatch }}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tab.connected ? (
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] px-3 py-2 text-xs font-medium"
                      style={{
                        background: "var(--danger)",
                        color: "#0a0b0e",
                      }}
                      onClick={disconnectTab}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] px-3 py-2 text-xs font-semibold"
                      style={{ background: "var(--accent)", color: "#0a0b0e" }}
                      onClick={connectTab}
                    >
                      Connect
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => setShowLog((v) => !v)}
                  >
                    {showLog ? "Hide log" : "Show log"}
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border)" }}
                    onClick={downloadLog}
                  >
                    Save log
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border)" }}
                    onClick={exportProfiles}
                  >
                    Export profiles
                  </button>
                  <label
                    className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Import
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importProfilesFile(f);
                      }}
                    />
                  </label>
                </div>
                {showLog && (
                  <pre
                    className="max-h-48 overflow-auto text-[11px] font-mono rounded border p-2"
                    style={{
                      background: "var(--bg-void)",
                      borderColor: "var(--border)",
                      color: "var(--text-dim)",
                    }}
                  >
                    {tab.log.slice(-100).join("\n") || "(empty log)"}
                  </pre>
                )}
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  pack: {RW_STARTER_PACK.name} · profiles:{" "}
                  {profiles.length || DEFAULT_PROFILES.length}
                </p>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Command bar */}
      <footer
        className="shrink-0 border-t px-2 sm:px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
      >
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            submitCmd(inputDraft);
          }}
        >
          <span
            className="font-mono text-sm select-none hidden sm:inline"
            style={{ color: "var(--accent)" }}
          >
            ›
          </span>
          <input
            value={inputDraft}
            onChange={(e) => setInputDraft(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
            disabled={!tab.connected}
            className="flex-1 rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 min-h-[44px]"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text)",
              // @ts-expect-error css var
              "--tw-ring-color": "var(--accent-glow)",
            }}
            placeholder={tab.connected ? "command / alias…" : "connect first"}
          />
          <button
            type="submit"
            disabled={!tab.connected}
            className="rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-semibold min-w-[4.5rem] min-h-[44px] disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "#0a0b0e",
            }}
          >
            Send
          </button>
        </form>

        {/* Thumb pad — always visible on mobile, subtle on desktop */}
        <div className="flex flex-wrap gap-1.5 mt-2 pb-1">
          {(
            [
              ["n", "n"],
              ["s", "s"],
              ["e", "e"],
              ["w", "w"],
              ["look", "look"],
              ["score", "score"],
            ] as const
          ).map(([label, val]) => (
            <button
              key={label}
              type="button"
              disabled={!tab.connected}
              className="rounded-[var(--radius-sm)] border font-mono text-xs min-w-[44px] min-h-[40px] px-2.5 active:scale-95 disabled:opacity-40"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--text-dim)",
              }}
              onClick={() => submitCmd(val)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-[var(--radius-sm)] border font-mono text-xs min-w-[44px] min-h-[40px] px-2.5 sm:hidden"
            style={{
              background: mapOpen ? "var(--accent-dim)" : "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text-dim)",
            }}
            onClick={() => setMapOpen((v) => !v)}
          >
            map
          </button>
        </div>
      </footer>
    </div>
  );
}
