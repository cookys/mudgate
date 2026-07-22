import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas2DRenderer } from "@mudgate/terminal";
import {
  STATIC_CATALOG,
  applyPreset,
  resolveFontStackProbed,
  type TermFontConfig,
} from "../termFonts/catalog";
import { isAlignScoreGood, probeCjkGlyph, TRIAL_FIXTURE } from "../termFonts/trial";

type Props = {
  open: boolean;
  base: TermFontConfig;
  locale: "zh-TW" | "zh-CN" | "en";
  onClose: () => void;
  onApply: (cfg: TermFontConfig) => void;
};

export function FontTrialPanel({
  open,
  base,
  locale,
  onClose,
  onApply,
}: Props) {
  const [leftId, setLeftId] = useState(base.presetId);
  const [rightId, setRightId] = useState(
    STATIC_CATALOG.find((c) => c.id !== base.presetId)?.id ?? "jetbrains-mono",
  );
  const [customPrimary, setCustomPrimary] = useState(base.primary);
  const leftCanvas = useRef<HTMLCanvasElement>(null);
  const rightCanvas = useRef<HTMLCanvasElement>(null);
  const [scores, setScores] = useState({ left: 0, right: 0 });

  const leftCfg = useMemo(() => {
    const p = applyPreset(leftId);
    return leftId === "custom" ? { ...p, primary: customPrimary, presetId: "custom" } : p;
  }, [leftId, customPrimary]);
  const rightCfg = useMemo(() => applyPreset(rightId), [rightId]);

  useEffect(() => {
    if (!open) return;
    const run = (canvas: HTMLCanvasElement | null, cfg: TermFontConfig) => {
      if (!canvas) return 0;
      const r = new Canvas2DRenderer();
      r.mount(canvas);
      const stack = resolveFontStackProbed(cfg, locale);
      r.setTypography({
        fontFamily: stack,
        fontSizePx: cfg.fontSizePx,
        cellWidthScale: cfg.cellWidthScale,
        lineHeightScale: cfg.lineHeightScale,
      });
      const score = r.measureAlignScore();
      const probe = probeCjkGlyph(
        cfg.primary.includes(" ") ? `"${cfg.primary}"` : cfg.primary,
      );
      // draw fixture sample line
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0a0b0e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e8eaed";
        ctx.font = `500 ${cfg.fontSizePx}px ${stack}`;
        ctx.textBaseline = "top";
        TRIAL_FIXTURE.split("\n").forEach((line, i) => {
          ctx.fillText(line, 4, 4 + i * (cfg.fontSizePx + 4));
        });
        if (!probe.ok) {
          ctx.fillStyle = "#f59e0b";
          ctx.font = `500 10px monospace`;
          ctx.fillText("CJK glyph probe: miss → TC chain", 4, 78);
        }
      }
      r.dispose();
      return score;
    };
    // next frame so canvas is laid out
    const id = requestAnimationFrame(() => {
      setScores({
        left: run(leftCanvas.current, leftCfg),
        right: run(rightCanvas.current, rightCfg),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, leftCfg, rightCfg, locale]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-label="Font trial"
    >
      <div
        className="w-full max-w-3xl rounded-[var(--radius)] border p-4 max-h-[90vh] overflow-auto"
        style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Font trial A/B
          </h2>
          <button type="button" className="text-xs" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ["A", leftId, setLeftId, leftCanvas, scores.left, leftCfg],
              ["B", rightId, setRightId, rightCanvas, scores.right, rightCfg],
            ] as const
          ).map(([label, id, setId, cref, score, cfg]) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
                  {label}
                </span>
                <select
                  className="flex-1 text-xs rounded border px-2 py-1"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                >
                  {STATIC_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {label === "A" && id === "custom" && (
                <input
                  className="w-full text-xs font-mono rounded border px-2 py-1"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                  value={customPrimary}
                  onChange={(e) => setCustomPrimary(e.target.value)}
                  placeholder="Custom primary family"
                />
              )}
              <canvas
                ref={cref}
                width={320}
                height={96}
                className="w-full rounded border"
                style={{ borderColor: "var(--border)", background: "#0a0b0e" }}
              />
              <p className="text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
                alignScore={score.toFixed(3)}{" "}
                {isAlignScoreGood(score) ? (
                  <span style={{ color: "var(--accent)" }}>≈2.0 ✓</span>
                ) : (
                  <span style={{ color: "var(--text-faint)" }}>off dual-width</span>
                )}
              </p>
              <button
                type="button"
                className="text-xs rounded px-2 py-1 font-semibold"
                style={{ background: "var(--accent)", color: "#0a0b0e" }}
                onClick={() => onApply(cfg)}
              >
                Use {label}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
