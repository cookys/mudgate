import type { MapFrameCells } from "@assmud/terminal";
import {
  MAX_FRAMES_PER_PROFILE,
  type Journey,
  type JourneyStep,
  type MapFrame,
  type MapPin,
  type PersistResult,
} from "./types.js";
import { newId } from "./id.js";
import { computeFingerprint } from "./fingerprint.js";

/**
 * In-memory nav store — unit tests + Node; mirrors IDB policy (§2.3.2).
 * Browser production uses IdNavStore (same API surface).
 */
export class MemoryNavStore {
  frames = new Map<string, MapFrame>();
  pins = new Map<string, MapPin>();
  journeys = new Map<string, Journey>();

  async putFrame(input: {
    cells: MapFrameCells;
    source: MapFrame["source"];
    confidence: MapFrame["confidence"];
    profileKey: string;
    tabId: string;
    protected?: boolean;
    label?: string;
    capturedAt?: number;
    id?: string;
  }): Promise<PersistResult> {
    const profileKey = input.profileKey;
    const list = [...this.frames.values()]
      .filter((f) => f.profileKey === profileKey)
      .sort((a, b) => a.capturedAt - b.capturedAt);

    let evicted = false;
    if (list.length >= MAX_FRAMES_PER_PROFILE) {
      const victim = list.find((f) => !f.protected);
      if (!victim) {
        return { ok: false, reason: "storageFull" };
      }
      this.deleteFrameCascade(victim.id);
      evicted = true;
    }

    const id = input.id ?? newId("frm-");
    const cells = input.cells.cells.map((c) => ({ ...c }));
    const frame: MapFrame = {
      v: 1,
      id,
      capturedAt: input.capturedAt ?? Date.now(),
      cols: input.cells.cols,
      rows: input.cells.rows,
      cells,
      widthMode: input.cells.widthMode,
      fingerprint: computeFingerprint({
        cols: input.cells.cols,
        rows: input.cells.rows,
        widthMode: input.cells.widthMode,
        cells,
      }),
      source: input.source,
      confidence: input.confidence,
      profileKey,
      tabId: input.tabId,
      label: input.label,
      protected: input.protected ?? false,
    };
    this.frames.set(id, frame);
    return { ok: true, id, evicted: evicted || undefined };
  }

  async getFrame(id: string): Promise<MapFrame | undefined> {
    const f = this.frames.get(id);
    return f ? structuredCloneFrame(f) : undefined;
  }

  async listFrames(profileKey: string): Promise<MapFrame[]> {
    return [...this.frames.values()]
      .filter((f) => f.profileKey === profileKey)
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .map(structuredCloneFrame);
  }

  async setProtected(id: string, protectedFlag: boolean): Promise<boolean> {
    const f = this.frames.get(id);
    if (!f) return false;
    f.protected = protectedFlag;
    return true;
  }

  async deleteFrameCascade(id: string): Promise<number> {
    this.frames.delete(id);
    let n = 0;
    for (const [pid, pin] of this.pins) {
      if (pin.frameId === id) {
        this.pins.delete(pid);
        n++;
      }
    }
    return n;
  }

  async clearProfile(profileKey: string): Promise<void> {
    for (const [id, f] of this.frames) {
      if (f.profileKey === profileKey) this.frames.delete(id);
    }
    for (const [id, p] of this.pins) {
      if (p.profileKey === profileKey) this.pins.delete(id);
    }
    for (const [id, j] of this.journeys) {
      if (j.profileKey === profileKey) this.journeys.delete(id);
    }
  }

  async putJourney(input: {
    name: string;
    profileKey: string;
    steps?: JourneyStep[];
    id?: string;
  }): Promise<Journey> {
    const now = Date.now();
    const id = input.id ?? newId("jny-");
    const existing = this.journeys.get(id);
    const j: Journey = {
      v: 1,
      id,
      name: input.name.trim() || "untitled",
      profileKey: input.profileKey,
      steps: input.steps ? input.steps.map((s) => ({ ...s })) : existing?.steps ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.journeys.set(id, j);
    return { ...j, steps: j.steps.map((s) => ({ ...s })) };
  }

  async appendJourneyStep(
    id: string,
    step: JourneyStep,
  ): Promise<Journey | null> {
    const j = this.journeys.get(id);
    if (!j) return null;
    j.steps.push({ ...step });
    j.updatedAt = Date.now();
    return { ...j, steps: j.steps.map((s) => ({ ...s })) };
  }

  async getJourney(id: string): Promise<Journey | undefined> {
    const j = this.journeys.get(id);
    return j ? { ...j, steps: j.steps.map((s) => ({ ...s })) } : undefined;
  }

  async listJourneys(profileKey: string): Promise<Journey[]> {
    return [...this.journeys.values()]
      .filter((j) => j.profileKey === profileKey)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((j) => ({ ...j, steps: j.steps.map((s) => ({ ...s })) }));
  }

  async deleteJourney(id: string): Promise<boolean> {
    return this.journeys.delete(id);
  }

  /** Export journey JSON (no secrets). */
  exportJourneyJson(j: Journey): string {
    return JSON.stringify(
      {
        v: 1,
        name: j.name,
        steps: j.steps.map((s) => ({
          cmd: s.cmd,
          at: s.at,
          frameId: s.frameId,
          titleHint: s.titleHint,
        })),
      },
      null,
      2,
    );
  }

  async importJourneyJson(
    profileKey: string,
    raw: string,
  ): Promise<Journey | null> {
    try {
      const o = JSON.parse(raw) as {
        name?: string;
        steps?: JourneyStep[];
      };
      if (!o || typeof o !== "object") return null;
      const steps = Array.isArray(o.steps)
        ? o.steps
            .filter((s) => s && typeof s.cmd === "string")
            .map((s) => ({
              cmd: String(s.cmd).slice(0, 200),
              at: typeof s.at === "number" ? s.at : Date.now(),
              frameId: s.frameId,
              titleHint: s.titleHint,
            }))
        : [];
      return await this.putJourney({
        name: (o.name ?? "imported").trim() || "imported",
        profileKey,
        steps,
      });
    } catch {
      return null;
    }
  }

  async putPin(pin: Omit<MapPin, "v" | "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }): Promise<MapPin | null> {
    const frame = this.frames.get(pin.frameId);
    if (!frame) return null;
    if (pin.r < 0 || pin.r >= frame.rows || pin.c < 0 || pin.c >= frame.cols) {
      return null;
    }
    const text = pin.text.trim();
    if (text.length < 1 || text.length > 200) return null;

    const id = pin.id ?? newId("pin-");
    const full: MapPin = {
      v: 1,
      id,
      frameId: pin.frameId,
      r: pin.r,
      c: pin.c,
      text,
      createdAt: pin.createdAt ?? Date.now(),
      profileKey: pin.profileKey,
    };
    this.pins.set(id, full);
    return { ...full };
  }

  async updatePin(
    id: string,
    patch: { text?: string; r?: number; c?: number },
  ): Promise<MapPin | null> {
    const pin = this.pins.get(id);
    if (!pin) return null;
    const frame = this.frames.get(pin.frameId);
    if (!frame) return null;
    if (patch.text !== undefined) {
      const text = patch.text.trim();
      if (text.length < 1 || text.length > 200) return null;
      pin.text = text;
    }
    if (patch.r !== undefined) {
      if (patch.r < 0 || patch.r >= frame.rows) return null;
      pin.r = patch.r;
    }
    if (patch.c !== undefined) {
      if (patch.c < 0 || patch.c >= frame.cols) return null;
      pin.c = patch.c;
    }
    return { ...pin };
  }

  async deletePin(id: string): Promise<boolean> {
    return this.pins.delete(id);
  }

  async listPinsForFrame(frameId: string): Promise<MapPin[]> {
    return [...this.pins.values()]
      .filter((p) => p.frameId === frameId)
      .map((p) => ({ ...p }));
  }

  async listPins(profileKey: string): Promise<MapPin[]> {
    return [...this.pins.values()]
      .filter((p) => p.profileKey === profileKey)
      .map((p) => ({ ...p }));
  }
}

function structuredCloneFrame(f: MapFrame): MapFrame {
  return {
    ...f,
    cells: f.cells.map((c) => ({ ...c })),
  };
}

/** Singleton memory store for browser fallback when IDB unavailable (tests). */
let shared: MemoryNavStore | null = null;

export function getMemoryNavStore(): MemoryNavStore {
  if (!shared) shared = new MemoryNavStore();
  return shared;
}

export function resetMemoryNavStore(): void {
  shared = new MemoryNavStore();
}
