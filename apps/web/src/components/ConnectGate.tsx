import type { MudProfile } from "@assmud/profiles";
import type { AccentId } from "../lib/theme";

type Props = {
  tagline: string;
  profiles: MudProfile[];
  profileId: string;
  token: string;
  accent: AccentId;
  onProfile: (id: string) => void;
  onToken: (t: string) => void;
  onAccent: (a: AccentId) => void;
  onConnect: () => void;
  onImportProfiles: (file: File) => void;
  onExportProfiles: () => void;
};

export function ConnectGate({
  tagline,
  profiles,
  profileId,
  token,
  accent,
  onProfile,
  onToken,
  onAccent,
  onConnect,
  onImportProfiles,
  onExportProfiles,
}: Props) {
  const p = profiles.find((x) => x.id === profileId) ?? profiles[0];

  return (
    <div className="min-h-full flex items-center justify-center p-4 sm:p-8">
      <div
        className="w-full max-w-md rounded-[var(--radius)] border p-6 sm:p-8 shadow-[var(--shadow)]"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="font-mono text-xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{
                color: "var(--accent)",
                background: "var(--accent-dim)",
              }}
            >
              assmud
            </span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              v0.1
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
            style={{ color: "var(--text)" }}
          >
            Enter the wire
          </h1>
          <p
            className="text-sm leading-relaxed font-mono"
            style={{ color: "var(--text-dim)" }}
          >
            {tagline}
          </p>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-medium" style={{ color: "var(--text-dim)" }}>
            World / profile
            <select
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--text)",
                // @ts-expect-error css var ring
                "--tw-ring-color": "var(--accent-glow)",
              }}
              value={profileId}
              onChange={(e) => onProfile(e.target.value)}
            >
              {profiles.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name} — {pr.host}:{pr.port}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium" style={{ color: "var(--text-dim)" }}>
            Auth token
            <span className="font-normal" style={{ color: "var(--text-faint)" }}>
              {" "}
              (remote-prod; leave empty on LAN dev)
            </span>
            <input
              className="mt-1.5 w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm font-mono outline-none focus:ring-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              value={token}
              onChange={(e) => onToken(e.target.value)}
              autoComplete="off"
              placeholder="optional"
            />
          </label>

          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--text-dim)" }}>
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
                  onClick={() => onAccent(opt.id)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2 text-sm transition"
                  style={{
                    borderColor:
                      accent === opt.id ? "var(--accent)" : "var(--border)",
                    background:
                      accent === opt.id ? "var(--accent-dim)" : "var(--bg-elevated)",
                    color: "var(--text)",
                    boxShadow:
                      accent === opt.id ? `0 0 0 1px var(--accent-glow)` : undefined,
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: opt.swatch }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onConnect}
            className="w-full rounded-[var(--radius-sm)] py-3 text-sm font-semibold tracking-wide transition active:scale-[0.99]"
            style={{
              background: "var(--accent)",
              color: "#0a0b0e",
              boxShadow: `0 0 24px var(--accent-glow)`,
            }}
          >
            Connect to {p?.name ?? "MUD"} →
          </button>

          <div
            className="flex justify-between text-[11px] pt-1"
            style={{ color: "var(--text-faint)" }}
          >
            <button type="button" className="hover:underline" onClick={onExportProfiles}>
              export profiles
            </button>
            <label className="hover:underline cursor-pointer">
              import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportProfiles(f);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
