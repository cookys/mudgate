import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ScreenBuffer } from "@mudgate/terminal";
import { BurstDetector } from "../src/burstDetector.js";
import { MemoryNavStore } from "../src/memoryStore.js";

/**
 * Build absolute CUP to row (1-based) then write a char.
 * Emits cup-abs via ScreenBuffer sink.
 */
function cupRow(buf: ScreenBuffer, row1: number, ch = "."): void {
  buf.writeDecoded(`\x1b[${row1};1H${ch}`);
}

describe("BurstDetector fixtures P1/P2/P3/N1/N2 + N3", () => {
  let now: number;
  let store: MemoryNavStore;
  let captures: string[];
  let armedLog: boolean[];
  let buf: ScreenBuffer;
  let det: BurstDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 10_000;
    store = new MemoryNavStore();
    captures = [];
    armedLog = [];
    buf = new ScreenBuffer(40, 24, "cjk");
    buf.setNowFn(() => now);

    det = new BurstDetector({
      now: () => now,
      setMapCaptureArmed: (a) => {
        buf.setMapCaptureArmed(a);
        armedLog.push(a);
      },
      tryPersist: () => {
        const cells = buf.snapshotCells();
        // sync path for unit tests
        const id = `cap-${captures.length + 1}`;
        // use store synchronously via deasync pattern — putFrame is async but memory is sync under the hood
        void store.putFrame({
          cells,
          source: "auto-burst",
          confidence: "inferred",
          profileKey: "p1",
          tabId: "t1",
          id,
          capturedAt: now,
        });
        captures.push(id);
        return { ok: true, id };
      },
      onCaptured: (id) => {
        /* tracked via captures */
        void id;
      },
      schedule: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });

    buf.setCaptureSink((e) => det.handleEvent(e));
  });

  afterEach(() => {
    det.dispose();
    vi.useRealTimers();
  });

  it("P1: ≥6 distinct CUP → quiet ≥settleQuietMs → 1 frame matching quiet buffer", async () => {
    for (let r = 1; r <= 6; r++) {
      now += 10;
      cupRow(buf, r, String(r));
    }
    // mark final content
    now += 10;
    buf.writeDecoded("\x1b[10;1HFINAL");
    // settle
    now += 80;
    await vi.advanceTimersByTimeAsync(80);

    expect(captures).toHaveLength(1);
    const frame = await store.getFrame(captures[0]!);
    expect(frame).toBeDefined();
    expect(frame!.source).toBe("auto-burst");
    // row 10 (0-based 9) has FINAL
    const idx = 9 * frame!.cols + 0;
    expect(frame!.cells[idx]!.ch).toBe("F");
    expect(det.isArmed()).toBe(false);
  });

  it("P2: ≥6 CUP → continue buf-mut → quiet → frame == final buffer", async () => {
    for (let r = 1; r <= 6; r++) {
      now += 10;
      cupRow(buf, r, "a");
    }
    // still writing after arm — each write resets settle
    now += 20;
    buf.writeDecoded("\x1b[12;1HMID");
    await vi.advanceTimersByTimeAsync(40); // not enough quiet
    expect(captures).toHaveLength(0);

    now += 20;
    buf.writeDecoded("\x1b[12;1HEND!");
    now += 80;
    await vi.advanceTimersByTimeAsync(80);

    expect(captures).toHaveLength(1);
    const frame = await store.getFrame(captures[0]!);
    const idx = 11 * frame!.cols + 0;
    expect(frame!.cells[idx]!.ch).toBe("E");
    expect(frame!.cells[idx + 1]!.ch).toBe("N");
    expect(frame!.cells[idx + 2]!.ch).toBe("D");
  });

  it("P3: settle during minInterval → retry after interval captures once", async () => {
    // first capture
    for (let r = 1; r <= 6; r++) {
      now += 5;
      cupRow(buf, r, "1");
    }
    now += 80;
    await vi.advanceTimersByTimeAsync(80);
    expect(captures).toHaveLength(1);
    const t0 = now;

    // second burst immediately (within minInterval 250)
    for (let r = 1; r <= 6; r++) {
      now += 5;
      cupRow(buf, r, "2");
    }
    // settle fires while still in interval
    const settleAt = now + 80;
    now = settleAt;
    await vi.advanceTimersByTimeAsync(80);
    // may still be waiting retry
    expect(captures.length).toBeLessThanOrEqual(1);

    // advance to lastCaptureAt + 250
    const wait = Math.max(0, t0 + 250 - now);
    now += wait + 1;
    await vi.advanceTimersByTimeAsync(wait + 1);
    expect(captures).toHaveLength(2);
    expect(det.isArmed()).toBe(false);
  });

  it("N1: single CUP / ordinary scroll → 0 frames", async () => {
    now += 10;
    cupRow(buf, 1, "x");
    now += 200;
    await vi.advanceTimersByTimeAsync(200);
    buf.writeDecoded("hello\nworld\n");
    now += 200;
    await vi.advanceTimersByTimeAsync(200);
    expect(captures).toHaveLength(0);
    expect(det.isArmed()).toBe(false);
  });

  it("N2: auto off → 0 frames even with burst", async () => {
    det.setAutoDetectEnabled(false);
    for (let r = 1; r <= 8; r++) {
      now += 10;
      cupRow(buf, r, "z");
    }
    now += 100;
    await vi.advanceTimersByTimeAsync(100);
    expect(captures).toHaveLength(0);
  });

  it("N3: auto-off mid-retry clears armed and never captures", async () => {
    // first capture to set lastCaptureAt
    for (let r = 1; r <= 6; r++) {
      now += 5;
      cupRow(buf, r, "1");
    }
    now += 80;
    await vi.advanceTimersByTimeAsync(80);
    expect(captures).toHaveLength(1);

    // second burst within interval
    for (let r = 1; r <= 6; r++) {
      now += 5;
      cupRow(buf, r, "2");
    }
    now += 80;
    await vi.advanceTimersByTimeAsync(80);
    // armed may be true waiting retry
    det.setAutoDetectEnabled(false);
    expect(det.isArmed()).toBe(false);
    now += 500;
    await vi.advanceTimersByTimeAsync(500);
    expect(captures).toHaveLength(1);
  });

  it("persist failure does not leave false lastMapFrame (no onCaptured id)", async () => {
    const ids: string[] = [];
    det.dispose();
    det = new BurstDetector({
      now: () => now,
      setMapCaptureArmed: (a) => buf.setMapCaptureArmed(a),
      tryPersist: () => ({ ok: false }),
      onCaptured: (id) => ids.push(id),
      schedule: (fn, ms) => setTimeout(fn, ms),
      cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
    buf.setCaptureSink((e) => det.handleEvent(e));

    for (let r = 1; r <= 6; r++) {
      now += 10;
      cupRow(buf, r, "f");
    }
    now += 80;
    await vi.advanceTimersByTimeAsync(80);
    expect(ids).toHaveLength(0);
    expect(det.isArmed()).toBe(false);
  });
});
