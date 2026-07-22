import type { StatusEvent } from "../lib/mudSocket";
import { statusCopy, tone, useT } from "../i18n";

type Props = {
  status: StatusEvent;
  compact?: boolean;
  className?: string;
};

export function StatusPill({
  status,
  compact = false,
  className = "",
}: Props) {
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
      className={`inline-flex items-center rounded-full border text-xs font-medium ${
        compact ? "h-8 w-8 justify-center" : "gap-2 px-2.5 py-1"
      } ${className}`}
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text-dim)",
      }}
      role="status"
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      data-status-display={compact ? "indicator" : "pill"}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: color,
          boxShadow: ton === "ok" || ton === "warn" ? `0 0 10px ${color}` : undefined,
          animation:
            ton === "warn" ? "mudgate-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      {compact ? null : (
        <span className="max-w-[10rem] truncate sm:max-w-none" data-status-label>
          {label}
        </span>
      )}
    </span>
  );
}
