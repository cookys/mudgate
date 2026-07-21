import type { MapFrameCell, WidthMode } from "@assmud/terminal";

export type FrameConfidence = "inferred" | "user" | "official-hint";

export type MapFrame = {
  v: 1;
  id: string;
  capturedAt: number;
  cols: number;
  rows: number;
  cells: MapFrameCell[];
  widthMode: WidthMode;
  /** C0: always "" (compute in C1.5) */
  fingerprint: string;
  source: "auto-burst" | "manual-capture" | "stitch-tile";
  confidence: FrameConfidence;
  /** profile.id only */
  profileKey: string;
  tabId: string;
  label?: string;
  protected: boolean;
};

export type MapPin = {
  v: 1;
  id: string;
  frameId: string;
  r: number;
  c: number;
  text: string;
  createdAt: number;
  profileKey: string;
};

export type PersistResult =
  | {
      ok: true;
      id: string;
      /** true when an unprotected frame was LRU-evicted (cascade pins) */
      evicted?: boolean;
    }
  | { ok: false; reason: "storageFull" | "quota" | "error"; message?: string };

export const MAX_FRAMES_PER_PROFILE = 30;
export const NAV_DB_NAME = "assmud-nav";
export const NAV_DB_VERSION = 1;
