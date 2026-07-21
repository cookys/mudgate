export type {
  FrameConfidence,
  MapFrame,
  MapPin,
  Journey,
  JourneyStep,
  PersistResult,
} from "./types.js";
export {
  MAX_FRAMES_PER_PROFILE,
  NAV_DB_NAME,
  NAV_DB_VERSION,
} from "./types.js";
export { BurstDetector, type BurstDetectorOpts } from "./burstDetector.js";
export {
  MemoryNavStore,
  getMemoryNavStore,
  resetMemoryNavStore,
} from "./memoryStore.js";
export { IdNavStore, getIdNavStore } from "./idbStore.js";
export { newId } from "./id.js";
export {
  computeFingerprint,
  rankFingerprintMatches,
  searchNavMemory,
  type FingerprintMatch,
  type SearchHit,
} from "./fingerprint.js";
export {
  createStitchState,
  placeStitchTile,
  clearStitch,
  stitchToAscii,
  dirOffset,
  type StitchState,
  type StitchDir,
  type StitchTile,
} from "./stitch.js";

import { getIdNavStore, type IdNavStore } from "./idbStore.js";
import {
  getMemoryNavStore,
  type MemoryNavStore,
} from "./memoryStore.js";

export type NavStore = MemoryNavStore | IdNavStore;

/** Prefer IndexedDB in browser; memory fallback (SSR / tests / no IDB). */
export function getNavStore(): NavStore {
  if (typeof indexedDB !== "undefined") {
    try {
      return getIdNavStore();
    } catch {
      /* fall through */
    }
  }
  return getMemoryNavStore();
}
