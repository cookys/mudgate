export type SessionTabItem = {
  id: string;
  label: string;
  connected: boolean;
};

type Props = {
  tabs: readonly SessionTabItem[];
  activeId: string;
  profileManagerOpen: boolean;
  placement: "header" | "content";
  sessionLabel: string;
  manageLabel: string;
  closeLabel: string;
  newLabel: string;
  onSelect: (id: string) => void;
  onManage: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

/** One session-navigation view, placed responsively without duplicating state. */
export function SessionTabs({
  tabs,
  activeId,
  profileManagerOpen,
  placement,
  sessionLabel,
  manageLabel,
  closeLabel,
  newLabel,
  onSelect,
  onManage,
  onClose,
  onNew,
}: Props) {
  const placementClass =
    placement === "header"
      ? "mobile-portrait-hide flex flex-1"
      : "mobile-portrait-only w-full shrink-0 border-b px-1.5 py-1";

  return (
    <nav
      className={`${placementClass} items-center gap-1 min-w-0 overflow-x-auto`}
      style={
        placement === "content"
          ? {
              borderColor: "var(--border)",
              background: "var(--bg-panel)",
            }
          : undefined
      }
      aria-label={sessionLabel}
      data-session-tabs-placement={placement}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className="inline-flex items-stretch shrink-0 rounded-[var(--radius-sm)] border overflow-hidden"
            style={{
              borderColor: active ? "var(--accent)" : "var(--border)",
              background: active
                ? "var(--accent-dim)"
                : "var(--bg-elevated)",
            }}
          >
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-mono transition max-w-[8rem] truncate"
              style={{ color: "var(--text)" }}
              onClick={() => onSelect(tab.id)}
              title={tab.label}
              aria-pressed={active}
            >
              {tab.label.slice(0, 12)}
              {tab.connected ? (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: "var(--ok)" }}
                  aria-hidden
                />
              ) : null}
            </button>
            <button
              type="button"
              className="px-1.5 text-[11px] border-l min-w-[26px] hover:opacity-100 opacity-70 transition"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                color:
                  active && profileManagerOpen
                    ? "var(--accent)"
                    : "var(--text-dim)",
              }}
              aria-label={`${manageLabel}: ${tab.label}`}
              title={manageLabel}
              onClick={() => onManage(tab.id)}
            >
              ⚙
            </button>
            <button
              type="button"
              className="px-1.5 text-xs border-l min-w-[28px] hover:opacity-100 opacity-70 transition"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                color: "var(--text-dim)",
              }}
              aria-label={`${closeLabel}: ${tab.label}`}
              title={closeLabel}
              onClick={() => onClose(tab.id)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="rounded-[var(--radius-sm)] px-2 py-1 text-xs border shrink-0"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elevated)",
          color: "var(--text-dim)",
        }}
        onClick={onNew}
        aria-label={newLabel}
        title={newLabel}
      >
        +
      </button>
    </nav>
  );
}
