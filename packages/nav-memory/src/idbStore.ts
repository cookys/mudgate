import type { MapFrameCells } from "@assmud/terminal";
import {
  MAX_FRAMES_PER_PROFILE,
  NAV_DB_NAME,
  NAV_DB_VERSION,
  type Journey,
  type JourneyStep,
  type MapFrame,
  type MapPin,
  type PersistResult,
} from "./types.js";
import { newId } from "./id.js";
import { computeFingerprint } from "./fingerprint.js";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(NAV_DB_NAME, NAV_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("frames")) {
        const frames = db.createObjectStore("frames", { keyPath: "id" });
        frames.createIndex("byProfile", "profileKey", { unique: false });
        frames.createIndex("byProfileTime", ["profileKey", "capturedAt"], {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains("pins")) {
        const pins = db.createObjectStore("pins", { keyPath: "id" });
        pins.createIndex("byFrame", "frameId", { unique: false });
        pins.createIndex("byProfile", "profileKey", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("journeys")) {
        const journeys = db.createObjectStore("journeys", { keyPath: "id" });
        journeys.createIndex("byProfile", "profileKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB tx aborted"));
  });
}

/**
 * IndexedDB nav store (`assmud-nav` v1) — C0 production backend.
 * Policy: §2.3.2 one-txn count→evict1→put; cascade pins; soft MAX 30.
 */
export class IdNavStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

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
    try {
      return await this.putFrameOnce(input);
    } catch (e) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
      if (name === "QuotaExceededError") {
        try {
          await this.evictOneUnprotected(input.profileKey);
          return await this.putFrameOnce(input);
        } catch {
          return { ok: false, reason: "quota" };
        }
      }
      return { ok: false, reason: "error", message: String(e) };
    }
  }

  private async putFrameOnce(input: {
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
    const db = await this.db();
    const tx = db.transaction(["frames", "pins"], "readwrite");
    const frames = tx.objectStore("frames");
    const pins = tx.objectStore("pins");
    const idx = frames.index("byProfile");

    const existing = await reqToPromise(
      idx.getAll(IDBKeyRange.only(input.profileKey)),
    ) as MapFrame[];
    existing.sort((a, b) => a.capturedAt - b.capturedAt);

    let evicted = false;
    if (existing.length >= MAX_FRAMES_PER_PROFILE) {
      const victim = existing.find((f) => !f.protected);
      if (!victim) {
        // abort without put
        tx.abort();
        try {
          await txDone(tx);
        } catch {
          /* aborted */
        }
        return { ok: false, reason: "storageFull" };
      }
      // cascade pins
      const pinIdx = pins.index("byFrame");
      const victimPins = (await reqToPromise(
        pinIdx.getAll(IDBKeyRange.only(victim.id)),
      )) as MapPin[];
      for (const p of victimPins) {
        pins.delete(p.id);
      }
      frames.delete(victim.id);
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
      profileKey: input.profileKey,
      tabId: input.tabId,
      label: input.label,
      protected: input.protected ?? false,
    };
    frames.put(frame);
    await txDone(tx);
    return { ok: true, id, evicted: evicted || undefined };
  }

  private async evictOneUnprotected(profileKey: string): Promise<boolean> {
    const db = await this.db();
    const tx = db.transaction(["frames", "pins"], "readwrite");
    const frames = tx.objectStore("frames");
    const pins = tx.objectStore("pins");
    const existing = (await reqToPromise(
      frames.index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as MapFrame[];
    existing.sort((a, b) => a.capturedAt - b.capturedAt);
    const victim = existing.find((f) => !f.protected);
    if (!victim) {
      tx.abort();
      return false;
    }
    const victimPins = (await reqToPromise(
      pins.index("byFrame").getAll(IDBKeyRange.only(victim.id)),
    )) as MapPin[];
    for (const p of victimPins) pins.delete(p.id);
    frames.delete(victim.id);
    await txDone(tx);
    return true;
  }

  async getFrame(id: string): Promise<MapFrame | undefined> {
    const db = await this.db();
    const tx = db.transaction("frames", "readonly");
    const f = (await reqToPromise(tx.objectStore("frames").get(id))) as
      | MapFrame
      | undefined;
    await txDone(tx);
    return f;
  }

  async listFrames(profileKey: string): Promise<MapFrame[]> {
    const db = await this.db();
    const tx = db.transaction("frames", "readonly");
    const list = (await reqToPromise(
      tx.objectStore("frames").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as MapFrame[];
    await txDone(tx);
    return list.sort((a, b) => b.capturedAt - a.capturedAt);
  }

  async setProtected(id: string, protectedFlag: boolean): Promise<boolean> {
    const db = await this.db();
    const tx = db.transaction("frames", "readwrite");
    const store = tx.objectStore("frames");
    const f = (await reqToPromise(store.get(id))) as MapFrame | undefined;
    if (!f) {
      tx.abort();
      return false;
    }
    f.protected = protectedFlag;
    store.put(f);
    await txDone(tx);
    return true;
  }

  async deleteFrameCascade(id: string): Promise<number> {
    const db = await this.db();
    const tx = db.transaction(["frames", "pins"], "readwrite");
    const pins = tx.objectStore("pins");
    const victimPins = (await reqToPromise(
      pins.index("byFrame").getAll(IDBKeyRange.only(id)),
    )) as MapPin[];
    for (const p of victimPins) pins.delete(p.id);
    tx.objectStore("frames").delete(id);
    await txDone(tx);
    return victimPins.length;
  }

  async clearProfile(profileKey: string): Promise<void> {
    const db = await this.db();
    const storeNames = ["frames", "pins", "journeys"].filter((n) =>
      db.objectStoreNames.contains(n),
    );
    const tx = db.transaction(storeNames, "readwrite");
    const frames = (await reqToPromise(
      tx.objectStore("frames").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as MapFrame[];
    for (const f of frames) tx.objectStore("frames").delete(f.id);
    const pinList = (await reqToPromise(
      tx.objectStore("pins").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as MapPin[];
    for (const p of pinList) tx.objectStore("pins").delete(p.id);
    if (db.objectStoreNames.contains("journeys")) {
      const jList = (await reqToPromise(
        tx.objectStore("journeys").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
      )) as Journey[];
      for (const j of jList) tx.objectStore("journeys").delete(j.id);
    }
    await txDone(tx);
  }

  async putPin(pin: Omit<MapPin, "v" | "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }): Promise<MapPin | null> {
    const frame = await this.getFrame(pin.frameId);
    if (!frame) return null;
    if (pin.r < 0 || pin.r >= frame.rows || pin.c < 0 || pin.c >= frame.cols) {
      return null;
    }
    const text = pin.text.trim();
    if (text.length < 1 || text.length > 200) return null;
    const full: MapPin = {
      v: 1,
      id: pin.id ?? newId("pin-"),
      frameId: pin.frameId,
      r: pin.r,
      c: pin.c,
      text,
      createdAt: pin.createdAt ?? Date.now(),
      profileKey: pin.profileKey,
    };
    const db = await this.db();
    const tx = db.transaction("pins", "readwrite");
    tx.objectStore("pins").put(full);
    await txDone(tx);
    return full;
  }

  async updatePin(
    id: string,
    patch: { text?: string; r?: number; c?: number },
  ): Promise<MapPin | null> {
    const db = await this.db();
    const tx = db.transaction(["pins", "frames"], "readwrite");
    const pin = (await reqToPromise(tx.objectStore("pins").get(id))) as
      | MapPin
      | undefined;
    if (!pin) {
      tx.abort();
      return null;
    }
    const frame = (await reqToPromise(
      tx.objectStore("frames").get(pin.frameId),
    )) as MapFrame | undefined;
    if (!frame) {
      tx.abort();
      return null;
    }
    if (patch.text !== undefined) {
      const text = patch.text.trim();
      if (text.length < 1 || text.length > 200) {
        tx.abort();
        return null;
      }
      pin.text = text;
    }
    if (patch.r !== undefined) {
      if (patch.r < 0 || patch.r >= frame.rows) {
        tx.abort();
        return null;
      }
      pin.r = patch.r;
    }
    if (patch.c !== undefined) {
      if (patch.c < 0 || patch.c >= frame.cols) {
        tx.abort();
        return null;
      }
      pin.c = patch.c;
    }
    tx.objectStore("pins").put(pin);
    await txDone(tx);
    return pin;
  }

  async deletePin(id: string): Promise<boolean> {
    const db = await this.db();
    const tx = db.transaction("pins", "readwrite");
    const existing = await reqToPromise(tx.objectStore("pins").get(id));
    if (!existing) {
      tx.abort();
      return false;
    }
    tx.objectStore("pins").delete(id);
    await txDone(tx);
    return true;
  }

  async listPinsForFrame(frameId: string): Promise<MapPin[]> {
    const db = await this.db();
    const tx = db.transaction("pins", "readonly");
    const list = (await reqToPromise(
      tx.objectStore("pins").index("byFrame").getAll(IDBKeyRange.only(frameId)),
    )) as MapPin[];
    await txDone(tx);
    return list;
  }

  async listPins(profileKey: string): Promise<MapPin[]> {
    const db = await this.db();
    const tx = db.transaction("pins", "readonly");
    const list = (await reqToPromise(
      tx.objectStore("pins").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as MapPin[];
    await txDone(tx);
    return list;
  }

  async putJourney(input: {
    name: string;
    profileKey: string;
    steps?: JourneyStep[];
    id?: string;
  }): Promise<Journey> {
    const db = await this.db();
    const now = Date.now();
    const id = input.id ?? newId("jny-");
    let existing: Journey | undefined;
    if (input.id) {
      const tx0 = db.transaction("journeys", "readonly");
      existing = (await reqToPromise(
        tx0.objectStore("journeys").get(id),
      )) as Journey | undefined;
      await txDone(tx0);
    }
    const j: Journey = {
      v: 1,
      id,
      name: input.name.trim() || "untitled",
      profileKey: input.profileKey,
      steps: input.steps
        ? input.steps.map((s) => ({ ...s }))
        : existing?.steps ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const tx = db.transaction("journeys", "readwrite");
    tx.objectStore("journeys").put(j);
    await txDone(tx);
    return { ...j, steps: j.steps.map((s) => ({ ...s })) };
  }

  async appendJourneyStep(
    id: string,
    step: JourneyStep,
  ): Promise<Journey | null> {
    const db = await this.db();
    const tx = db.transaction("journeys", "readwrite");
    const j = (await reqToPromise(tx.objectStore("journeys").get(id))) as
      | Journey
      | undefined;
    if (!j) {
      tx.abort();
      return null;
    }
    j.steps.push({ ...step });
    j.updatedAt = Date.now();
    tx.objectStore("journeys").put(j);
    await txDone(tx);
    return { ...j, steps: j.steps.map((s) => ({ ...s })) };
  }

  async getJourney(id: string): Promise<Journey | undefined> {
    const db = await this.db();
    const tx = db.transaction("journeys", "readonly");
    const j = (await reqToPromise(tx.objectStore("journeys").get(id))) as
      | Journey
      | undefined;
    await txDone(tx);
    return j ? { ...j, steps: j.steps.map((s) => ({ ...s })) } : undefined;
  }

  async listJourneys(profileKey: string): Promise<Journey[]> {
    const db = await this.db();
    const tx = db.transaction("journeys", "readonly");
    const list = (await reqToPromise(
      tx.objectStore("journeys").index("byProfile").getAll(IDBKeyRange.only(profileKey)),
    )) as Journey[];
    await txDone(tx);
    return list
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((j) => ({ ...j, steps: j.steps.map((s) => ({ ...s })) }));
  }

  async deleteJourney(id: string): Promise<boolean> {
    const db = await this.db();
    const tx = db.transaction("journeys", "readwrite");
    const existing = await reqToPromise(tx.objectStore("journeys").get(id));
    if (!existing) {
      tx.abort();
      return false;
    }
    tx.objectStore("journeys").delete(id);
    await txDone(tx);
    return true;
  }

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
      const o = JSON.parse(raw) as { name?: string; steps?: JourneyStep[] };
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
}

let sharedIdb: IdNavStore | null = null;

export function getIdNavStore(): IdNavStore {
  if (!sharedIdb) sharedIdb = new IdNavStore();
  return sharedIdb;
}
