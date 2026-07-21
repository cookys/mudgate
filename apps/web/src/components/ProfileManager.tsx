import { useState } from "react";
import type { MudProfile } from "@assmud/profiles";
import { isVaultUnlocked, vaultExists } from "@assmud/profiles";
import { ProfileEditor } from "./ProfileEditor";
import { VaultPanel } from "./VaultPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  profiles: MudProfile[];
  selectedId: string;
  onChange: (list: MudProfile[]) => void;
  onSelect: (id: string) => void;
};

/**
 * Shared profile manager (ConnectGate + in-session drawer).
 * Vault unlock required before editing account/password/auto-login.
 */
export function ProfileManager({
  open,
  onClose,
  profiles,
  selectedId,
  onChange,
  onSelect,
}: Props) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;
  const unlocked = isVaultUnlocked();
  const exists = vaultExists();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal
      aria-label="設定檔管理"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-auto rounded-t-[var(--radius)] sm:rounded-[var(--radius)] border shadow-xl"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-panel)",
          }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            管理設定檔
          </h2>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            onClick={onClose}
          >
            關閉
          </button>
        </div>
        <div className="p-4 space-y-4">
          <VaultPanel onChange={refresh} />
          {!unlocked && exists && (
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              🔒 解鎖後可編輯帳號／密碼／自動登入。host/port 仍可先改。
            </p>
          )}
          {!exists && (
            <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              若要存密碼或自動登入，請先建立密碼庫。
            </p>
          )}
          <ProfileEditor
            profiles={profiles}
            selectedId={selectedId}
            onChange={onChange}
            onSelect={onSelect}
            secretsEnabled={unlocked}
          />
        </div>
      </div>
    </div>
  );
}
