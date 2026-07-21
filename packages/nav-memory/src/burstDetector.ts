import type { VtCaptureEvent } from "@assmud/terminal";

export type BurstDetectorOpts = {
  windowMs?: number;
  minDistinctCupRows?: number;
  settleQuietMs?: number;
  minIntervalMs?: number;
  now?: () => number;
  setMapCaptureArmed: (armed: boolean) => void;
  /**
   * Persist a snapshot. Only called from tryCapture when gates pass.
   * Must NOT update lastMapFrameId itself — detector does that only on ok.
   * May return a Promise (IDB).
   */
  tryPersist: () =>
    | { ok: true; id: string }
    | { ok: false }
    | Promise<{ ok: true; id: string } | { ok: false }>;
  onCaptured?: (id: string) => void;
  /** Optional timer APIs (inject for tests). */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
};

/**
 * BurstDetector v0 — map_d-likely CUP burst → settle quiet → capture.
 * @see docs/plans/2026-07-22-mapd-nav-companion.md §2.2.1
 */
export class BurstDetector {
  windowMs: number;
  minDistinctCupRows: number;
  settleQuietMs: number;
  minIntervalMs: number;
  autoDetectEnabled = true;

  private armed = false;
  /** row → last seen at */
  private cupRows = new Map<number, number>();
  private lastCaptureAt = -Infinity;
  private settleTimer: unknown = null;
  private retryTimer: unknown = null;
  private nowFn: () => number;
  private setMapCaptureArmed: (armed: boolean) => void;
  private tryPersist: BurstDetectorOpts["tryPersist"];
  private onCaptured?: (id: string) => void;
  private schedule: (fn: () => void, ms: number) => unknown;
  private cancel: (handle: unknown) => void;
  private capturing = false;

  constructor(opts: BurstDetectorOpts) {
    this.windowMs = opts.windowMs ?? 400;
    this.minDistinctCupRows = opts.minDistinctCupRows ?? 6;
    this.settleQuietMs = opts.settleQuietMs ?? 80;
    this.minIntervalMs = opts.minIntervalMs ?? 250;
    this.nowFn = opts.now ?? (() => Date.now());
    this.setMapCaptureArmed = opts.setMapCaptureArmed;
    this.tryPersist = opts.tryPersist;
    this.onCaptured = opts.onCaptured;
    this.schedule =
      opts.schedule ??
      ((fn, ms) => setTimeout(fn, ms));
    this.cancel =
      opts.cancel ??
      ((h) => {
        if (h != null) clearTimeout(h as ReturnType<typeof setTimeout>);
      });
  }

  isArmed(): boolean {
    return this.armed;
  }

  setAutoDetectEnabled(enabled: boolean): void {
    this.autoDetectEnabled = enabled;
    if (!enabled) {
      this.disarm("auto-off");
    }
  }

  handleEvent(e: VtCaptureEvent): void {
    if (!this.autoDetectEnabled) return;
    const now = e.at;

    if (e.type === "cup-abs") {
      this.cupRows.set(e.row, now);
      // drop stale
      for (const [row, at] of this.cupRows) {
        if (at < now - this.windowMs) this.cupRows.delete(row);
      }
      if (this.cupRows.size >= this.minDistinctCupRows) {
        if (!this.armed) {
          this.armed = true;
          this.setMapCaptureArmed(true);
        }
        this.resetSettleTimer();
      } else if (this.armed) {
        this.resetSettleTimer();
      }
      return;
    }

    if (e.type === "buf-mut" && this.armed) {
      this.resetSettleTimer();
    }
  }

  /** Force cancel (tab close / unmount). */
  dispose(): void {
    this.clearTimers();
    if (this.armed) {
      this.armed = false;
      this.setMapCaptureArmed(false);
    }
    this.cupRows.clear();
  }

  private disarm(_why: string): void {
    this.armed = false;
    this.setMapCaptureArmed(false);
    this.cupRows.clear();
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.settleTimer != null) {
      this.cancel(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.retryTimer != null) {
      this.cancel(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private resetSettleTimer(): void {
    if (this.settleTimer != null) this.cancel(this.settleTimer);
    this.settleTimer = this.schedule(() => {
      this.settleTimer = null;
      this.tryCapture();
    }, this.settleQuietMs);
  }

  private tryCapture(): void {
    if (!this.autoDetectEnabled || !this.armed || this.capturing) return;
    const now = this.nowFn();
    if (now - this.lastCaptureAt < this.minIntervalMs) {
      // schedule one-shot retry when interval satisfied
      if (this.retryTimer == null) {
        const wait = this.lastCaptureAt + this.minIntervalMs - now;
        this.retryTimer = this.schedule(() => {
          this.retryTimer = null;
          this.tryCapture();
        }, Math.max(0, wait));
      }
      return;
    }

    this.capturing = true;
    // disarm immediately so half-frame writes after gate don't re-arm mid-persist
    this.armed = false;
    this.setMapCaptureArmed(false);
    this.cupRows.clear();
    if (this.settleTimer != null) {
      this.cancel(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.retryTimer != null) {
      this.cancel(this.retryTimer);
      this.retryTimer = null;
    }

    const finish = (result: { ok: true; id: string } | { ok: false }) => {
      this.capturing = false;
      if (result.ok) {
        this.lastCaptureAt = now;
        this.onCaptured?.(result.id);
      }
    };

    try {
      const result = this.tryPersist();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        void (result as Promise<{ ok: true; id: string } | { ok: false }>).then(
          finish,
          () => finish({ ok: false }),
        );
      } else {
        finish(result as { ok: true; id: string } | { ok: false });
      }
    } catch {
      finish({ ok: false });
    }
  }
}
