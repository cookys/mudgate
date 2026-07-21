import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";
import {
  colorForAttrs,
  type MapFrameCells,
} from "@assmud/terminal";
import type { MapFrame, MapPin, NavStore } from "@assmud/nav-memory";
import type { TerminalCaptureApi } from "../TerminalHost";

export type CompanionLabels = {
  empty: string;
  storageFull: string;
  frameDeleted: string;
  frameGone: string;
  badgeAuto: string;
  badgeManual: string;
  badgeFrozen: string;
  live: string;
  freeze: string;
  unfreeze: string;
  pinTerminal: string;
  pinTerminalHint: string;
  clearData: string;
  clearDataConfirm: string;
  clearDataTitle: string;
  privacy: string;
  pinPlaceholder: string;
  pinSave: string;
  pinCancel: string;
  pinDelete: string;
  pinEditTitle: string;
  pinNewTitle: string;
  zoom1x: string;
  zoom2x: string;
  confirm: string;
  cancel: string;
};

type Props = {
  store: NavStore;
  profileKey: string;
  tabId: string;
  /** memory-only last auto/manual frame id for this tab */
  lastMapFrameId: string | null;
  onLastMapFrameId: (id: string | null) => void;
  captureApiRef: MutableRefObject<TerminalCaptureApi | null>;
  /** Bump when external capture lands so we refresh display in live mode */
  captureEpoch: number;
  labels: CompanionLabels;
  /** toast helper (storageFull throttled by parent or here) */
  onToast?: (msg: string) => void;
  autoDetectEnabled: boolean;
  onAutoDetectChange: (v: boolean) => void;
  autoDetectLabel: string;
};

type ViewMode = "live" | "frozen";

type PinModal =
  | { kind: "new"; r: number; c: number }
  | { kind: "edit"; pin: MapPin };

export function MapCompanion({
  store,
  profileKey,
  tabId,
  lastMapFrameId,
  onLastMapFrameId,
  captureApiRef,
  captureEpoch,
  labels,
  onToast,
  autoDetectEnabled,
  onAutoDetectChange,
  autoDetectLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [frozenId, setFrozenId] = useState<string | null>(null);
  const [frame, setFrame] = useState<MapFrame | null>(null);
  const [frameMissing, setFrameMissing] = useState(false);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    ox: number;
    oy: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [pinModal, setPinModal] = useState<PinModal | null>(null);
  const [pinText, setPinText] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const storageFullAtRef = useRef(0);

  const displayId =
    viewMode === "frozen" ? frozenId : lastMapFrameId;

  const loadFrame = useCallback(async () => {
    if (!displayId) {
      setFrame(null);
      setFrameMissing(false);
      setPins([]);
      return;
    }
    const f = await store.getFrame(displayId);
    if (!f) {
      setFrame(null);
      setFrameMissing(true);
      setPins([]);
      return;
    }
    setFrame(f);
    setFrameMissing(false);
    const list = await store.listPinsForFrame(f.id);
    setPins(list);
  }, [displayId, store]);

  useEffect(() => {
    void loadFrame();
  }, [loadFrame, captureEpoch]);

  const toastStorageFull = useCallback(() => {
    const now = Date.now();
    if (now - storageFullAtRef.current < 10_000) return;
    storageFullAtRef.current = now;
    onToast?.(labels.storageFull);
  }, [labels.storageFull, onToast]);

  const captureManual = useCallback(async () => {
    const api = captureApiRef.current;
    if (!api) {
      onToast?.(labels.empty);
      return;
    }
    const cells = api.snapshotCells();
    const result = await store.putFrame({
      cells,
      source: "manual-capture",
      confidence: "user",
      profileKey,
      tabId,
    });
    if (!result.ok) {
      if (result.reason === "storageFull" || result.reason === "quota") {
        toastStorageFull();
      }
      return;
    }
    if (result.evicted) onToast?.(labels.frameDeleted);
    onLastMapFrameId(result.id);
  }, [
    captureApiRef,
    store,
    profileKey,
    tabId,
    onLastMapFrameId,
    toastStorageFull,
    onToast,
    labels.empty,
    labels.frameDeleted,
  ]);

  const onFreeze = useCallback(async () => {
    const id = lastMapFrameId;
    if (!id) return;
    await store.setProtected(id, true);
    setFrozenId(id);
    setViewMode("frozen");
    void loadFrame();
  }, [lastMapFrameId, store, loadFrame]);

  const onUnfreeze = useCallback(async () => {
    // Stay on this frame until user picks live
    setViewMode("frozen");
    if (frozenId) {
      await store.setProtected(frozenId, false);
    }
    // Plan: unfreeze still shows that frame until user selects 即時
    void loadFrame();
  }, [frozenId, store, loadFrame]);

  const goLive = useCallback(() => {
    setViewMode("live");
    setFrozenId(null);
  }, []);

  const clearProfileData = useCallback(async () => {
    await store.clearProfile(profileKey);
    onLastMapFrameId(null);
    setFrozenId(null);
    setViewMode("live");
    setFrame(null);
    setPins([]);
    setClearConfirm(false);
  }, [store, profileKey, onLastMapFrameId]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !frame) return;
    const api = captureApiRef.current;
    const baseW = api?.getCellMetrics().cellW ?? 9;
    const baseH = api?.getCellMetrics().cellH ?? 18;
    const fontFamily =
      api?.getCellMetrics().fontFamily ?? "ui-monospace, monospace";
    const cellW = baseW * zoom;
    const cellH = baseH * zoom;
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.font = `${Math.round(cellH * 0.85)}px ${fontFamily}`;
    ctx.textBaseline = "top";

    for (let r = 0; r < frame.rows; r++) {
      for (let c = 0; c < frame.cols; c++) {
        const cell = frame.cells[r * frame.cols + c]!;
        if (cell.wideCont) continue;
        const { fg, bg } = colorForAttrs({
          fg: cell.fg,
          bg: cell.bg,
          bold: cell.bold,
          inverse: cell.inverse,
        });
        const x = c * cellW + pan.x;
        const y = r * cellH + pan.y;
        if (x + cellW < 0 || y + cellH < 0 || x > cssW || y > cssH) continue;
        if (bg !== "#0a0b0e") {
          ctx.fillStyle = bg;
          const span = isLikelyWide(cell, frame, c, r) ? 2 : 1;
          ctx.fillRect(x, y, cellW * span, cellH);
        }
        if (cell.ch && cell.ch !== " ") {
          ctx.fillStyle = fg;
          ctx.fillText(cell.ch, x, y + 1);
        }
      }
    }

    // pins as markers
    for (const pin of pins) {
      const x = pin.c * cellW + pan.x + cellW / 2;
      const y = pin.r * cellH + pan.y + cellH / 2;
      ctx.beginPath();
      ctx.fillStyle = "#e5c07b";
      ctx.arc(x, y, Math.max(3, cellW * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e5c07b";
      ctx.font = `bold ${Math.max(9, Math.round(cellH * 0.45))}px sans-serif`;
      ctx.fillText(pin.text.slice(0, 12), x + 4, y - 4);
    }
  }, [frame, pins, zoom, pan, captureApiRef]);

  const hitCell = (clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    const api = captureApiRef.current;
    if (!wrap || !frame) return null;
    const rect = wrap.getBoundingClientRect();
    const baseW = api?.getCellMetrics().cellW ?? 9;
    const baseH = api?.getCellMetrics().cellH ?? 18;
    const cellW = baseW * zoom;
    const cellH = baseH * zoom;
    const c = Math.floor((clientX - rect.left - pan.x) / cellW);
    const r = Math.floor((clientY - rect.top - pan.y) / cellH);
    if (r < 0 || c < 0 || r >= frame.rows || c >= frame.cols) return null;
    return { r, c };
  };

  const onCanvasClick = (e: ReactMouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const cell = hitCell(e.clientX, e.clientY);
    if (!cell || !frame) return;
    const existing = pins.find((p) => p.r === cell.r && p.c === cell.c);
    if (existing) {
      setPinModal({ kind: "edit", pin: existing });
      setPinText(existing.text);
    } else {
      setPinModal({ kind: "new", r: cell.r, c: cell.c });
      setPinText("");
    }
  };

  const savePin = async () => {
    if (!frame || !pinModal) return;
    const text = pinText.trim();
    if (text.length < 1 || text.length > 200) return;
    if (pinModal.kind === "new") {
      await store.putPin({
        frameId: frame.id,
        r: pinModal.r,
        c: pinModal.c,
        text,
        profileKey,
      });
    } else {
      await store.updatePin(pinModal.pin.id, { text });
    }
    setPinModal(null);
    const list = await store.listPinsForFrame(frame.id);
    setPins(list);
  };

  const deletePin = async () => {
    if (!pinModal || pinModal.kind !== "edit" || !frame) return;
    await store.deletePin(pinModal.pin.id);
    setPinModal(null);
    setPins(await store.listPinsForFrame(frame.id));
  };

  const badge =
    frame?.source === "manual-capture"
      ? labels.badgeManual
      : frame
        ? labels.badgeAuto
        : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col text-[11px]">
      <div
        className="flex flex-wrap gap-1 px-2 py-1.5 border-b items-center"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border"
          style={{
            borderColor: "var(--border)",
            background:
              viewMode === "live" ? "var(--accent-dim)" : "var(--bg-elevated)",
            color: viewMode === "live" ? "var(--accent)" : "var(--text-dim)",
          }}
          onClick={goLive}
        >
          {labels.live}
        </button>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border"
          style={{
            borderColor: "var(--border)",
            background:
              viewMode === "frozen" ? "var(--accent-dim)" : "var(--bg-elevated)",
          }}
          onClick={() => {
            if (viewMode === "frozen") void onUnfreeze();
            else void onFreeze();
          }}
          disabled={!lastMapFrameId && !frozenId}
          title={viewMode === "frozen" ? labels.unfreeze : labels.freeze}
        >
          {viewMode === "frozen" ? `🔒 ${labels.badgeFrozen}` : labels.freeze}
        </button>
        <button
          type="button"
          className="px-1.5 py-0.5 rounded border"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          onClick={() => void captureManual()}
          title={labels.pinTerminalHint}
        >
          {labels.pinTerminal}
        </button>
        <button
          type="button"
          className="px-1 py-0.5 rounded border font-mono"
          style={{
            borderColor: "var(--border)",
            background: zoom === 1 ? "var(--accent-dim)" : "var(--bg-elevated)",
          }}
          onClick={() => setZoom(1)}
        >
          {labels.zoom1x}
        </button>
        <button
          type="button"
          className="px-1 py-0.5 rounded border font-mono"
          style={{
            borderColor: "var(--border)",
            background: zoom === 2 ? "var(--accent-dim)" : "var(--bg-elevated)",
          }}
          onClick={() => setZoom(2)}
        >
          {labels.zoom2x}
        </button>
        <label className="flex items-center gap-1 ml-auto text-[10px]" style={{ color: "var(--text-faint)" }}>
          <input
            type="checkbox"
            checked={autoDetectEnabled}
            onChange={(e) => onAutoDetectChange(e.target.checked)}
          />
          {autoDetectLabel}
        </label>
      </div>

      {badge && (
        <div
          className="px-2 py-0.5 text-[10px] border-b font-medium"
          style={{
            borderColor: "var(--border)",
            color:
              frame?.source === "manual-capture"
                ? "var(--accent)"
                : "var(--text-dim)",
            borderStyle: frame?.source === "auto-burst" ? "dashed" : "solid",
          }}
        >
          {badge}
          {frame?.protected || viewMode === "frozen" ? ` · ${labels.badgeFrozen}` : ""}
        </div>
      )}

      <div
        ref={wrapRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ background: "#0a0b0e" }}
      >
        {!frame && (
          <div
            className="absolute inset-0 flex items-center justify-center p-3 text-center leading-relaxed"
            style={{ color: "var(--text-faint)" }}
          >
            {frameMissing ? labels.frameGone : labels.empty}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onClick={onCanvasClick}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            dragRef.current = {
              ox: e.clientX,
              oy: e.clientY,
              px: pan.x,
              py: pan.y,
              moved: false,
            };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            const dx = e.clientX - d.ox;
            const dy = e.clientY - d.oy;
            if (Math.abs(dx) + Math.abs(dy) > 3) {
              d.moved = true;
              setPan({ x: d.px + dx, y: d.py + dy });
            }
          }}
          onPointerUp={() => {
            const d = dragRef.current;
            dragRef.current = null;
            if (d?.moved) suppressClickRef.current = true;
          }}
        />
      </div>

      {pins.length > 0 && (
        <ul
          className="max-h-20 overflow-auto border-t px-2 py-1 space-y-0.5"
          style={{ borderColor: "var(--border)" }}
        >
          {pins.map((p) => (
            <li key={p.id} className="flex gap-1 items-start">
              <button
                type="button"
                className="text-left flex-1 truncate"
                style={{ color: "var(--text-dim)" }}
                onClick={() => {
                  setPinModal({ kind: "edit", pin: p });
                  setPinText(p.text);
                }}
              >
                ({p.r},{p.c}) {p.text}
              </button>
              <button
                type="button"
                className="text-[10px] px-1"
                style={{ color: "var(--danger, #e06c75)" }}
                onClick={() => void store.deletePin(p.id).then(() => loadFrame())}
              >
                {labels.pinDelete}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className="px-2 py-1 border-t flex items-center justify-between gap-2"
        style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
      >
        <span className="text-[9px] leading-snug">{labels.privacy}</span>
        <button
          type="button"
          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border"
          style={{ borderColor: "var(--border)" }}
          onClick={() => setClearConfirm(true)}
        >
          {labels.clearData}
        </button>
      </div>

      {clearConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-black/50"
          role="alertdialog"
        >
          <div
            className="rounded border p-3 max-w-[240px] space-y-2"
            style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
          >
            <div className="font-medium text-xs">{labels.clearDataTitle}</div>
            <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
              {labels.clearDataConfirm}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-2 py-1 rounded border text-[10px]"
                style={{ borderColor: "var(--border)" }}
                onClick={() => setClearConfirm(false)}
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded text-[10px] font-semibold"
                style={{ background: "#e06c75", color: "#0a0b0e" }}
                onClick={() => void clearProfileData()}
              >
                {labels.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinModal && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-black/50"
          role="dialog"
        >
          <div
            className="rounded border p-3 w-full max-w-[240px] space-y-2"
            style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
          >
            <div className="font-medium text-xs">
              {pinModal.kind === "new" ? labels.pinNewTitle : labels.pinEditTitle}
            </div>
            <input
              className="w-full rounded border px-2 py-1 text-xs bg-transparent"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              value={pinText}
              maxLength={200}
              placeholder={labels.pinPlaceholder}
              onChange={(e) => setPinText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              {pinModal.kind === "edit" && (
                <button
                  type="button"
                  className="px-2 py-1 text-[10px]"
                  style={{ color: "#e06c75" }}
                  onClick={() => void deletePin()}
                >
                  {labels.pinDelete}
                </button>
              )}
              <button
                type="button"
                className="px-2 py-1 rounded border text-[10px]"
                style={{ borderColor: "var(--border)" }}
                onClick={() => setPinModal(null)}
              >
                {labels.pinCancel}
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded text-[10px] font-semibold"
                style={{ background: "var(--accent)", color: "#0a0b0e" }}
                onClick={() => void savePin()}
                disabled={pinText.trim().length < 1}
              >
                {labels.pinSave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isLikelyWide(
  cell: MapFrameCells["cells"][0],
  frame: MapFrame,
  c: number,
  r: number,
): boolean {
  const next = frame.cells[r * frame.cols + c + 1];
  return Boolean(next?.wideCont);
}
