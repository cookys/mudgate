type Props = { status: string };

export function StatusPill({ status }: Props) {
  const s = status.toLowerCase();
  let tone: "idle" | "ok" | "warn" | "danger" = "idle";
  if (s.includes("connect") && !s.includes("disconnect") && !s.includes("error")) {
    tone = s.includes("ing") || s.includes("hand") || s.includes("recon") ? "warn" : "ok";
  }
  if (s.includes("ready") || s === "connected") tone = "ok";
  if (s.includes("error") || s.includes("denied") || s.includes("unauth")) tone = "danger";
  if (s.includes("disconnect") || s === "idle") tone = "idle";
  if (s.includes("recon")) tone = "warn";

  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "danger"
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
          boxShadow: tone === "ok" || tone === "warn" ? `0 0 10px ${color}` : undefined,
          animation:
            tone === "warn" ? "assmud-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      <span className="max-w-[10rem] truncate sm:max-w-none">{status}</span>
      <style>{`
        @keyframes assmud-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
