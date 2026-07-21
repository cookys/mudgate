import { useEffect, useState } from "react";
import type { MudProfile } from "@assmud/profiles";
import {
  getProfilePassword,
  getProfileAccount,
  getProfileAutoLogin,
  getProfileSecret,
  setProfileSecretEntry,
  clearProfileSecret,
  validateProfile,
  isVaultUnlocked,
} from "@assmud/profiles";

type Props = {
  profiles: MudProfile[];
  selectedId: string;
  onChange: (list: MudProfile[]) => void;
  onSelect: (id: string) => void;
  /** When false, host/port still editable; secrets fields disabled */
  secretsEnabled?: boolean;
  /** Bumps when vault lock/unlock — reload secrets without leaving edit mode */
  vaultEpoch?: number;
  onEditingChange?: (editing: boolean) => void;
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
  secretsEnabled = true,
  vaultEpoch = 0,
  onEditingChange,
}: Props) {
  const selected = profiles.find((p) => p.id === selectedId);
  const [draft, setDraft] = useState<Partial<MudProfile>>(
    () => selected ?? emptyDraft(),
  );
  /** Port as text while editing — Number() on each keystroke breaks input ("" → 0). */
  const [portText, setPortText] = useState(() =>
    String(selected?.port ?? emptyDraft().port ?? 4000),
  );
  const [account, setAccount] = useState(() =>
    selected && isVaultUnlocked()
      ? (getProfileAccount(selected.id) ?? "")
      : "",
  );
  const [password, setPassword] = useState(() =>
    selected && isVaultUnlocked()
      ? (getProfilePassword(selected.id) ?? "")
      : "",
  );
  const [autoLogin, setAutoLogin] = useState(() =>
    selected && isVaultUnlocked()
      ? getProfileAutoLogin(selected.id)
      : false,
  );
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [busy, setBusy] = useState(false);
  /** Avoid clobbering password the user is mid-typing when vaultEpoch bumps. */
  const [secretsDirty, setSecretsDirty] = useState(false);

  const loadSecretsIntoForm = (id: string, force = false) => {
    if (!isVaultUnlocked()) {
      if (force || !secretsDirty) {
        setAccount("");
        setPassword("");
        setAutoLogin(false);
      }
      return;
    }
    if (secretsDirty && !force) return;
    const s = getProfileSecret(id);
    setAccount(s?.account ?? "");
    setPassword(s?.password ?? "");
    setAutoLogin(Boolean(s?.autoLogin));
  };

  useEffect(() => {
    onEditingChange?.(mode !== "view");
  }, [mode, onEditingChange]);

  // Vault unlock: load secrets into open form without leaving edit mode
  useEffect(() => {
    if (mode === "view") return;
    if (!selected) return;
    if (!secretsEnabled) return;
    loadSecretsIntoForm(selected.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vaultEpoch is the intentional trigger
  }, [vaultEpoch, secretsEnabled]);

  const startCreate = () => {
    setMode("create");
    const d = emptyDraft();
    setDraft(d);
    setPortText(String(d.port ?? 4000));
    setAccount("");
    setPassword("");
    setAutoLogin(false);
    setSecretsDirty(false);
    setErr(null);
  };

  const startEdit = () => {
    if (!selected) return;
    setMode("edit");
    setDraft({ ...selected });
    setPortText(String(selected.port));
    setSecretsDirty(false);
    loadSecretsIntoForm(selected.id, true);
    setErr(null);
  };

  const cancel = () => {
    setMode("view");
    setErr(null);
    setSecretsDirty(false);
    if (selected) {
      setDraft({ ...selected });
      setPortText(String(selected.port));
      loadSecretsIntoForm(selected.id, true);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const portNum = Number(portText.trim());
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        throw new Error("port must be integer 1–65535");
      }
      const p = validateProfile({
        ...draft,
        port: portNum,
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

      const wantsSecret = Boolean(password || account || autoLogin);
      if (wantsSecret) {
        if (!secretsEnabled || !isVaultUnlocked()) {
          throw new Error("請先解鎖或建立密碼庫再存帳密");
        }
        if (autoLogin && !account && !password) {
          throw new Error("auto-login needs account and/or password");
        }
        await setProfileSecretEntry(p.id, {
          account: account.trim() || undefined,
          password: password || undefined,
          autoLogin,
        });
      } else if (secretsEnabled && isVaultUnlocked()) {
        await clearProfileSecret(p.id);
      }

      onSelect(p.id);
      setSecretsDirty(false);
      setMode("view");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "invalid");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected || profiles.length <= 1) return;
    if (isVaultUnlocked()) {
      try {
        await clearProfileSecret(selected.id);
      } catch {
        /* ignore */
      }
    }
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
            + 新增設定檔
          </button>
          <button
            type="button"
            className="text-xs rounded border px-2 py-1"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            onClick={startEdit}
            disabled={!selected}
          >
            編輯
          </button>
          <button
            type="button"
            className="text-xs rounded border px-2 py-1"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            onClick={() => void remove()}
            disabled={!selected || profiles.length <= 1}
          >
            刪除
          </button>
        </div>
        {selected && (
          <p
            className="text-[11px] font-mono"
            style={{ color: "var(--text-faint)" }}
          >
            {selected.host}:{selected.port} · {selected.charset}
            {isVaultUnlocked() && getProfileAccount(selected.id)
              ? ` · 👤 ${getProfileAccount(selected.id)}`
              : ""}
            {isVaultUnlocked() && getProfilePassword(selected.id)
              ? " · 🔑"
              : ""}
            {isVaultUnlocked() && getProfileAutoLogin(selected.id)
              ? " · auto-login"
              : !isVaultUnlocked()
                ? " · 🔒"
                : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="space-y-2 rounded border p-2"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="text-xs font-medium" style={{ color: "var(--text)" }}>
        {mode === "create" ? "新增設定檔" : "編輯設定檔"}
      </div>
      {(
        [
          ["id", "id"],
          ["name", "name"],
          ["host", "host"],
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
                [key]: e.target.value,
              }))
            }
          />
        </label>
      ))}
      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        port
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={portText}
          onChange={(e) => {
            // digits only; allow empty while typing
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            setPortText(v);
          }}
          placeholder="4000"
          autoComplete="off"
        />
      </label>

      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        地圖指令方言（點擊出口）
        <select
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={draft.moveDialect === "zh" ? "zh" : "en"}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              moveDialect: e.target.value === "zh" ? "zh" : "en",
            }))
          }
        >
          <option value="en">en — e / n / ne …（RW 預設）</option>
          <option value="zh">zh — 東 / 北 / 東北 …</option>
        </select>
      </label>

      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        帳號（自動登入，僅密碼庫）
        <input
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs disabled:opacity-50"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={account}
          disabled={!secretsEnabled}
          onChange={(e) => {
            setSecretsDirty(true);
            setAccount(e.target.value);
          }}
          autoComplete="off"
          name="assmud-profile-account"
          placeholder={secretsEnabled ? "連線後送出" : "先解鎖密碼庫"}
        />
      </label>
      <label className="block text-[11px]" style={{ color: "var(--text-dim)" }}>
        密碼（僅密碼庫 · WILL ECHO 時送出）
        <input
          type="password"
          className="mt-0.5 w-full rounded border px-2 py-1 font-mono text-xs disabled:opacity-50"
          style={{
            background: "var(--bg-elevated)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          value={password}
          disabled={!secretsEnabled}
          onChange={(e) => {
            setSecretsDirty(true);
            setPassword(e.target.value);
          }}
          // Deter browser/password-manager hijack that clears/jumps focus
          autoComplete="new-password"
          name="assmud-profile-secret"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
        />
      </label>
      <label
        className="flex items-start gap-2 text-[10px] leading-snug"
        style={{ color: "var(--text-faint)" }}
      >
        <input
          type="checkbox"
          checked={autoLogin}
          disabled={!secretsEnabled}
          onChange={(e) => {
            setSecretsDirty(true);
            setAutoLogin(e.target.checked);
          }}
        />
        啟用自動登入（帳號延遲送出；密碼在伺服器開 ECHO mask 時送出）
      </label>

      {err && (
        <p className="text-[11px]" style={{ color: "var(--danger)" }}>
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="text-xs rounded px-2 py-1 font-semibold disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#0a0b0e" }}
          onClick={() => void save()}
        >
          儲存
        </button>
        <button
          type="button"
          className="text-xs rounded border px-2 py-1"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          onClick={cancel}
        >
          取消
        </button>
      </div>
    </div>
  );
}
