import { useState } from "react";
import {
  vaultExists,
  isVaultUnlocked,
  createVault,
  unlockVault,
  lockVault,
  clearVault,
  hasLegacyPlaintextSecrets,
  migrateLegacyIntoVault,
  discardLegacyPlaintext,
  hasWebCryptoSubtle,
  VaultError,
} from "@assmud/profiles";

type Props = {
  onChange: () => void;
};

export function VaultPanel({ onChange }: Props) {
  const [master, setMaster] = useState("");
  const [master2, setMaster2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exists = vaultExists();
  const unlocked = isVaultUnlocked();
  const legacy = hasLegacyPlaintextSecrets();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setMaster("");
      setMaster2("");
      onChange();
    } catch (e) {
      const msg =
        e instanceof VaultError
          ? e.message
          : e instanceof Error
            ? e.message
            : "vault error";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded border p-3 space-y-2 text-xs"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div className="font-medium" style={{ color: "var(--text)" }}>
        密碼庫（Vault）{" "}
        <span style={{ color: "var(--text-faint)" }}>
          {exists ? (unlocked ? "· 已解鎖" : "· 🔒 已鎖定") : "· 尚未建立"}
        </span>
      </div>
      <p className="text-[10px] leading-snug" style={{ color: "var(--text-faint)" }}>
        AES-256-GCM + PBKDF2 at-rest
        {hasWebCryptoSubtle()
          ? "（WebCrypto）"
          : "（純 JS 後備 — LAN HTTP 無 subtle）"}
        。解鎖當下 XSS/擴充仍可能竊取主密碼；線上 telnet 亦非 E2E。
      </p>

      {legacy && (
        <div
          className="rounded border p-2 space-y-1"
          style={{ borderColor: "var(--accent)", color: "var(--text-dim)" }}
        >
          <div>發現舊版明文密碼庫（assmud.profileSecrets）</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || master.length < 4}
              className="rounded px-2 py-1 font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#0a0b0e" }}
              onClick={() =>
                void run(async () => {
                  await migrateLegacyIntoVault(master);
                })
              }
            >
              匯入並加密
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded border px-2 py-1"
              style={{ borderColor: "var(--border)" }}
              onClick={() => {
                if (confirm("丟棄明文密碼庫？不可恢復。")) {
                  discardLegacyPlaintext();
                  onChange();
                }
              }}
            >
              丟棄明文
            </button>
          </div>
        </div>
      )}

      {!exists && (
        <>
          <label className="block" style={{ color: "var(--text-dim)" }}>
            建立主密碼（至少 4 字）
            <input
              type="password"
              className="mt-0.5 w-full rounded border px-2 py-1 font-mono"
              style={{
                background: "var(--bg-void)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block" style={{ color: "var(--text-dim)" }}>
            再輸入一次
            <input
              type="password"
              className="mt-0.5 w-full rounded border px-2 py-1 font-mono"
              style={{
                background: "var(--bg-void)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              value={master2}
              onChange={(e) => setMaster2(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            disabled={busy || master.length < 4 || master !== master2}
            className="rounded px-2 py-1.5 font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#0a0b0e" }}
            onClick={() =>
              void run(async () => {
                if (master !== master2) throw new Error("passwords differ");
                await createVault(master);
              })
            }
          >
            建立密碼庫
          </button>
        </>
      )}

      {exists && !unlocked && (
        <>
          <label className="block" style={{ color: "var(--text-dim)" }}>
            主密碼解鎖
            <input
              type="password"
              className="mt-0.5 w-full rounded border px-2 py-1 font-mono"
              style={{
                background: "var(--bg-void)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !master}
              className="rounded px-2 py-1.5 font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#0a0b0e" }}
              onClick={() =>
                void run(async () => {
                  await unlockVault(master);
                })
              }
            >
              解鎖
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded border px-2 py-1"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              onClick={() => {
                if (
                  confirm(
                    "清除密碼庫？所有已存帳密將永久消失（at-rest 密文刪除）。",
                  )
                ) {
                  void run(async () => {
                    await clearVault();
                  });
                }
              }}
            >
              清除密碼庫
            </button>
          </div>
        </>
      )}

      {exists && unlocked && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1"
            style={{ borderColor: "var(--border)" }}
            onClick={() => {
              lockVault();
              onChange();
            }}
          >
            鎖定
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            onClick={() => {
              if (confirm("清除密碼庫？不可恢復。")) {
                void run(async () => {
                  await clearVault();
                });
              }
            }}
          >
            清除密碼庫
          </button>
        </div>
      )}

      {err && (
        <p style={{ color: "var(--danger)" }} className="text-[11px]">
          {err}
        </p>
      )}
    </div>
  );
}
