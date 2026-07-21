import { useState } from "react";
import type { MudProfile } from "@assmud/profiles";
import {
  getProfilePassword,
  getProfileAccount,
  getProfileAutoLogin,
  getProfileSecret,
  setProfileSecretEntry,
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
  const [account, setAccount] = useState(() =>
    selected ? getProfileAccount(selected.id) ?? "" : "",
  );
  const [password, setPassword] = useState(() =>
    selected ? getProfilePassword(selected.id) ?? "" : "",
  );
  const [autoLogin, setAutoLogin] = useState(() =>
    selected ? getProfileAutoLogin(selected.id) : false,
  );
  const [storePlain, setStorePlain] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");

  const loadSecretsIntoForm = (id: string) => {
    const s = getProfileSecret(id);
    setAccount(s?.account ?? "");
    setPassword(s?.password ?? "");
    setAutoLogin(Boolean(s?.autoLogin));
  };

  const startCreate = () => {
    setMode("create");
    setDraft(emptyDraft());
    setAccount("");
    setPassword("");
    setAutoLogin(false);
    setStorePlain(false);
    setErr(null);
  };

  const startEdit = () => {
    if (!selected) return;
    setMode("edit");
    setDraft({ ...selected });
    loadSecretsIntoForm(selected.id);
    setStorePlain(Boolean(getProfileSecret(selected.id)?.password));
    setErr(null);
  };

  const cancel = () => {
    setMode("view");
    setErr(null);
    if (selected) {
      setDraft({ ...selected });
      loadSecretsIntoForm(selected.id);
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
      if (password || account || autoLogin) {
        if (password && !storePlain) {
          throw new Error(
            "opt-in required to store password in plaintext localStorage",
          );
        }
        if (autoLogin && !account && !password) {
          throw new Error("auto-login needs account and/or password");
        }
        setProfileSecretEntry(p.id, {
          account: account.trim() || undefined,
          password: password || undefined,
          autoLogin,
        });
      } else {
        clearProfileSecret(p.id);
      }
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
            {getProfileAccount(selected.id)
              ? ` · 👤 ${getProfileAccount(selected.id)}`
              : ""}
            {getProfilePassword(selected.id) ? " · 🔑 secret" : ""}
            {getProfileAutoLogin(selected.id) ? " · auto-login" : ""}
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
        Account / character (auto-login, local only)
        <input
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          autoComplete="off"
          placeholder="sent once after connect"
        />
      </label>
      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        Password (local only, not exported)
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
          placeholder="sent on Telnet ECHO mask (not text trigger)"
        />
      </label>
      <label
        className="flex items-start gap-2 text-[10px] leading-snug"
        style={{ color: "var(--text-faint)" }}
      >
        <input
          type="checkbox"
          checked={autoLogin}
          onChange={(e) => setAutoLogin(e.target.checked)}
        />
        Enable auto-login: send account after connect; send password when server
        enables password-mode (WILL ECHO). No fragile “Password:” text trigger.
      </label>
      <label
        className="flex items-start gap-2 text-[10px] leading-snug"
        style={{ color: "var(--text-faint)" }}
      >
        <input
          type="checkbox"
          checked={storePlain}
          onChange={(e) => setStorePlain(e.target.checked)}
        />
        I opt in to store password in **plaintext localStorage** on this device
        (not exported; proxy/MUD operators can still see it on the wire).
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
