import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dismissLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  dismissLabel = "Dismiss",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={dismissLabel}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assmud-confirm-title"
        aria-describedby="assmud-confirm-body"
        className="relative w-full max-w-sm rounded-[var(--radius)] border p-5 shadow-[var(--shadow)]"
        style={{
          background: "var(--bg-panel)",
          borderColor: "var(--border)",
        }}
      >
        <h2
          id="assmud-confirm-title"
          className="text-base font-semibold mb-2"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
        <p
          id="assmud-confirm-body"
          className="text-sm leading-relaxed mb-5"
          style={{ color: "var(--text-dim)" }}
        >
          {body}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm min-h-[40px]"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text)",
            }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold min-h-[40px]"
            style={{
              background: danger ? "var(--danger)" : "var(--accent)",
              color: "#0a0b0e",
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
