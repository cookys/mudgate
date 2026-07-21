import { useState } from "react";
import type { MudProfile } from "@assmud/profiles";
import {
  getProfilePassword,
  setProfilePassword,
  clearProfileSecret,
  validateProfile,
} from "@assmud/profiles";

type Props = {
  profiles: MudProfile[];
  selectedId: string;
  onChange: (list: MudProfile[]) => void;
  onSelect: (id: string) => void;
};

const emptyDraft = (): Partial<MudProfile> => ({
  id: "",
  name: "",
  host: "",
  port: 4000,
  charset: "big5hkscs",
});

export function ProfileEditor({
  profiles,
  selectedId,
  onChange,
  onSelect,
}: Props) {
  const selected = profiles.find((p) => p.id === selectedId);
  const [draft, setDraft] = useState<Partial<MudProfile>>(
    () => selected ?? emptyDraft(),
  );
  const [password, setPassword] = useState(() =>
    selected ? getProfilePassword(selected.id) ?? "" : "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");

  const startCreate = () => {
    setMode("create");
    setDraft(emptyDraft());
    setPassword("");
    setErr(null);
  };

  const startEdit = () => {
    if (!selected) return;
    setMode("edit");
    setDraft({ ...selected });
    setPassword(getProfilePassword(selected.id) ?? "");
    setErr(null);
  };

  const cancel = () => {
    setMode("view");
    setErr(null);
    if (selected) {
      setDraft({ ...selected });
      setPassword(getProfilePassword(selected.id) ?? "");
    }
  };

  const save = () => {
    try {
      const p = validateProfile({
        ...draft,
        id: draft.id || `p-${Date.now()}`,
        name: draft.name || draft.host || "unnamed",
      });
      let next: MudProfile[];
      if (mode === "create") {
        if (profiles.some((x) => x.id === p.id)) {
          throw new Error("id already exists");
        }
        next = [...profiles, p];
      } else {
        next = profiles.map((x) => (x.id === selectedId ? p : x));
      }
      onChange(next);
      if (password) setProfilePassword(p.id, password);
      else clearProfileSecret(p.id);
      onSelect(p.id);
      setMode("view");
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "invalid");
    }
  };

  const remove = () => {
    if (!selected || profiles.length <= 1) return;
    clearProfileSecret(selected.id);
    const next = profiles.filter((p) => p.id !== selected.id);
    onChange(next);
    onSelect(next[0]!.id);
    setMode("view");
  };

  if (mode === "view") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs rounded border px-2 py-1"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            onClick={startCreate}
          >
            + New profile
          </button>
          <button
            type="button"
            className="text-xs rounded border px-2 py-1"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            onClick={startEdit}
            disabled={!selected}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-xs rounded border px-2 py-1"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            onClick={remove}
            disabled={!selected || profiles.length <= 1}
          >
            Delete
          </button>
        </div>
        {selected && (
          <p className="text-[11px] font-mono" style={{ color: "var(--text-faint)" }}>
            {selected.host}:{selected.port} · {selected.charset}
            {getProfilePassword(selected.id) ? " · 🔑 secret stored" : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border p-2" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--text)" }}>
        {mode === "create" ? "New profile" : "Edit profile"}
      </div>
      {(
        [
          ["id", "id"],
          ["name", "name"],
          ["host", "host"],
          ["port", "port"],
          ["charset", "charset"],
        ] as const
      ).map(([key, label]) => (
        <label
          key={key}
          className="block text-[11px]"
          style={{ color: "var(--text-dim)" }}
        >
          {label}
          <input
            className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            disabled={mode === "edit" && key === "id"}
            value={String(draft[key] ?? "")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [key]:
                  key === "port" ? Number(e.target.value) : e.target.value,
              }))
            }
          />
        </label>
      ))}
      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        Auto-login password (local only, not exported)
        <input
          type="password"
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
      </label>
      {err && (
        <p className="text-[11px]" style={{ color: "var(--danger)" }}>
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs rounded px-2 py-1 font-semibold"
          style={{ background: "var(--accent)", color: "#0a0b0e" }}
          onClick={save}
        >
          Save
        </button>
        <button
          type="button"
          className="text-xs rounded border px-2 py-1"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
