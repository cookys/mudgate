import { useMemo, type ReactNode } from "react";
import type { NearbyHud, MoveDialect, CompassDir } from "@mudgate/mapper";
import { commandForDir, labelForDir } from "@mudgate/mapper";
import { MapGraphPoc } from "./MapGraphPoc";

export type MapPanelMode = "nearby" | "trail" | "mirror";

type Props = {
  mode: MapPanelMode;
  onModeChange: (m: MapPanelMode) => void;
  nearby: NearbyHud;
  nodes: {
    id: string;
    x: number;
    y: number;
    z: number;
    title: string;
    current: boolean;
  }[];
  edges: { x0: number; y0: number; x1: number; y1: number }[];
  dialect: MoveDialect;
  labelsZh: boolean;
  onWalk: (cmd: string) => void;
  onClose: () => void;
  title: string;
  modeNearby: string;
  modeTrail: string;
  modeMirror: string;
  emptyHint: string;
  /** @deprecated C0: replaced by companion slot */
  mirrorBacklog?: string;
  confidenceKnown: string;
  confidenceGuessed: string;
  confidenceUnknown: string;
  /** C0 map companion (城圖 tab) */
  companion?: ReactNode;
};

const PAD_ORDER: (CompassDir | null)[] = [
  "nw",
  "n",
  "ne",
  "w",
  null,
  "e",
  "sw",
  "s",
  "se",
];

export function MapNavPanel({
  mode,
  onModeChange,
  nearby,
  nodes,
  edges,
  dialect,
  labelsZh,
  onWalk,
  onClose,
  title,
  modeNearby,
  modeTrail,
  modeMirror,
  emptyHint,
  mirrorBacklog,
  confidenceKnown,
  confidenceGuessed,
  confidenceUnknown,
  companion,
}: Props) {
  const byDir = useMemo(() => {
    const m = new Map<CompassDir, (typeof nearby.exits)[0]>();
    for (const e of nearby.exits) m.set(e.dir, e);
    return m;
  }, [nearby.exits]);

  const confLabel =
    nearby.confidence === "known"
      ? confidenceKnown
      : nearby.confidence === "guessed"
        ? confidenceGuessed
        : confidenceUnknown;

  return (
    <aside
      className="w-[min(300px,42vw)] shrink-0 border-l flex flex-col min-h-0 absolute right-0 top-0 bottom-0 z-10 lg:static lg:z-0"
      style={{
        background: "var(--bg-panel)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b text-xs gap-2"
        style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        <span className="font-mono tracking-wide shrink-0">{title}</span>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border text-[11px]"
          style={{ borderColor: "var(--border)" }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Mode tabs */}
      <div
        className="flex gap-1 px-2 py-1.5 border-b text-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        {(
          [
            ["nearby", modeNearby],
            ["trail", modeTrail],
            ["mirror", modeMirror],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="flex-1 rounded px-1 py-1 font-medium"
            style={{
              background:
                mode === id ? "var(--accent-dim)" : "var(--bg-elevated)",
              color: mode === id ? "var(--accent)" : "var(--text-dim)",
              opacity: 1,
            }}
            onClick={() => onModeChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "mirror" && (
        <div className="flex-1 min-h-0 relative flex flex-col">
          {companion ?? (
            <div
              className="flex-1 p-3 text-[11px] leading-relaxed"
              style={{ color: "var(--text-faint)" }}
            >
              {mirrorBacklog}
            </div>
          )}
        </div>
      )}

      {mode === "trail" && (
        <div className="flex-1 min-h-0 flex flex-col">
          <MapGraphPoc nodes={nodes} edges={edges} />
          <p
            className="px-2 py-1 text-[10px] border-t"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            足跡 · {nodes.length} 房 · {edges.length} 邊
            {nearby.lastEvent ? ` · ${nearby.lastEvent}` : ""}
          </p>
        </div>
      )}

      {mode === "nearby" && (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider mb-0.5"
              style={{ color: "var(--text-faint)" }}
            >
              {confLabel}
            </div>
            <div
              className="text-sm font-medium leading-snug break-words"
              style={{ color: "var(--text)" }}
            >
              {nearby.title ?? "—"}
            </div>
            {!nearby.title && (
              <p
                className="text-[11px] mt-1 leading-snug"
                style={{ color: "var(--text-faint)" }}
              >
                {emptyHint}
              </p>
            )}
            {nearby.roomCount > 0 && (
              <p
                className="text-[10px] mt-1 font-mono"
                style={{ color: "var(--text-faint)" }}
              >
                足跡 {nearby.roomCount} 房
                {nearby.lastEvent ? ` · ${nearby.lastEvent}` : ""}
              </p>
            )}
          </div>

          {/* Direction pad */}
          <div
            className="grid grid-cols-3 gap-1 max-w-[200px] mx-auto"
            role="group"
            aria-label="directions"
          >
            {PAD_ORDER.map((dir, i) => {
              if (!dir) {
                return (
                  <div
                    key={`c-${i}`}
                    className="aspect-square rounded-full border flex items-center justify-center text-[10px]"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                      boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 40%, transparent)",
                    }}
                    title={nearby.title ?? ""}
                  >
                    ◆
                  </div>
                );
              }
              const info = byDir.get(dir);
              const known = info !== undefined;
              const linked = info?.state === "linked";
              const cmd = commandForDir(dir, dialect);
              const lab = labelForDir(dir, labelsZh ? "zh" : "en");
              return (
                <button
                  key={dir}
                  type="button"
                  className="aspect-square rounded border text-[11px] font-mono leading-tight disabled:opacity-35"
                  style={{
                    borderColor: linked
                      ? "var(--accent)"
                      : known
                        ? "var(--border)"
                        : "var(--border)",
                    background: linked
                      ? "var(--accent-dim)"
                      : "var(--bg-elevated)",
                    color: known ? "var(--text)" : "var(--text-faint)",
                    borderStyle: known ? "solid" : "dashed",
                  }}
                  title={
                    info?.neighborTitle
                      ? `${lab} → ${info.neighborTitle} (${cmd})`
                      : `${lab} (${cmd})`
                  }
                  onClick={() => onWalk(cmd)}
                >
                  <span className="block">{lab}</span>
                  {info?.neighborTitle && (
                    <span
                      className="block text-[8px] truncate px-0.5"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {info.neighborTitle}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* U / D */}
          <div className="flex gap-2 max-w-[200px] mx-auto">
            {(["u", "d"] as const).map((dir) => {
              const info = byDir.get(dir);
              const known = info !== undefined;
              const cmd = commandForDir(dir, dialect);
              const lab = labelForDir(dir, labelsZh ? "zh" : "en");
              return (
                <button
                  key={dir}
                  type="button"
                  className="flex-1 rounded border py-1.5 text-[11px] font-mono"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-elevated)",
                    color: known ? "var(--text)" : "var(--text-faint)",
                    borderStyle: known ? "solid" : "dashed",
                  }}
                  onClick={() => onWalk(cmd)}
                >
                  {lab}
                </button>
              );
            })}
          </div>

          {nearby.exits.some((e) => e.state === "stub" || e.state === "linked") && (
            <ul className="text-[10px] space-y-0.5 font-mono">
              {nearby.exits.map((e) => (
                <li key={e.dir} style={{ color: "var(--text-dim)" }}>
                  {labelForDir(e.dir, labelsZh ? "zh" : "en")}
                  {e.state === "linked" && e.neighborTitle
                    ? ` → ${e.neighborTitle}`
                    : e.state === "stub"
                      ? " · …"
                      : ""}
                </li>
              ))}
            </ul>
          )}

          <p className="text-[9px]" style={{ color: "var(--text-faint)" }}>
            {dialect === "en" ? "cmd: en (e/n/…)" : "cmd: zh (東/北/…)"}
          </p>
        </div>
      )}
    </aside>
  );
}
