import type { StatusEvent } from "../lib/mudSocket";
import { statusCopy, tone, useT } from "../i18n";

type Props = { status: StatusEvent };

export function StatusPill({ status }: Props) {
  const t = useT();
  const ton = tone(status.code);
  const copy = statusCopy(status);
  const label = t(copy.key, copy.vars);

  const color =
    ton === "ok"
      ? "var(--ok)"
      : ton === "warn"
        ? "var(--warn)"
        : ton === "danger"
          ? "var(--danger)"
          : "var(--text-faint)";

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text-dim)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: color,
          boxShadow: ton === "ok" || ton === "warn" ? `0 0 10px ${color}` : undefined,
          animation:
            ton === "warn" ? "assmud-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      <span className="max-w-[10rem] truncate sm:max-w-none">{label}</span>
      <style>{`
        @keyframes assmud-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
