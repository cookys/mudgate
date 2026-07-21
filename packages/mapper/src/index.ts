/**
 * Client automap — room graph + Chinese/English text parse.
 * Separate from server VT map_d.
 */

export type {
  CompassDir,
  MoveDialect,
} from "./dirs.js";
export {
  HUD_DIRS,
  parseDirection,
  commandForDir,
  labelForDir,
  parseMoveCommand,
  reverseDir,
  DELTA,
} from "./dirs.js";

export {
  stripAnsi,
  normalizeTitle,
  looksLikeTitle,
  parseExitsLine,
  isMoveFail,
  isVisionFail,
  fingerprint,
  type ParsedExits,
} from "./parse.js";

export {
  RoomTracker,
  ClientMap,
  type GraphRoom,
  type NearbyHud,
  type NearbyExit,
  type RoomConfidence,
  type RoomTrackerSnapshot,
} from "./graph.js";
