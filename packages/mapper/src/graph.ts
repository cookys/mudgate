/**
 * Room graph for client automap (not server map_d).
 * Identity = fingerprint(title + exits); layout (x,y,z) is presentation only.
 * No auto reverse-link until reverse is observed (skeptic G4).
 */

import {
  DELTA,
  reverseDir,
  type CompassDir,
  type MoveDialect,
} from "./dirs.js";
import {
  fingerprint,
  isMoveFail,
  isVisionFail,
  looksLikeTitle,
  normalizeTitle,
  parseExitsLine,
  stripAnsi,
} from "./parse.js";

export type RoomConfidence = "known" | "guessed" | "unknown";

export type GraphRoom = {
  id: string;
  title: string;
  fingerprint: string;
  exits: Partial<Record<CompassDir, string | null>>; // null = stub (known open, no dest yet)
  specialExits: string[];
  x: number;
  y: number;
  z: number;
  confidence: RoomConfidence;
  visits: number;
};

export type NearbyExit = {
  dir: CompassDir;
  /** stub | linked | unknown (not listed by server) */
  state: "stub" | "linked" | "unknown";
  neighborTitle?: string;
  neighborId?: string;
};

export type NearbyHud = {
  title: string | null;
  confidence: RoomConfidence;
  exits: NearbyExit[];
  roomId: string | null;
  mapping: boolean;
  lastEvent: string | null;
};

export type RoomTrackerSnapshot = {
  rooms: GraphRoom[];
  currentId: string | null;
  nearby: NearbyHud;
};

let seq = 0;
function newId(): string {
  seq += 1;
  return `r${seq.toString(36)}`;
}

export class RoomTracker {
  rooms = new Map<string, GraphRoom>();
  currentId: string | null = null;
  /** Auto-create rooms on move (user can disable). */
  mapping = true;
  lastMoveDir: CompassDir | null = null;
  lastEvent: string | null = null;
  /** Pending title candidate between move and exits line. */
  private pendingTitle: string | null = null;
  private byFp = new Map<string, string>(); // fingerprint → roomId

  reset(): void {
    this.rooms.clear();
    this.byFp.clear();
    this.currentId = null;
    this.lastMoveDir = null;
    this.pendingTitle = null;
    this.lastEvent = null;
    seq = 0;
  }

  noteOutbound(line: string, parsedDir: CompassDir | null): void {
    if (parsedDir) {
      this.lastMoveDir = parsedDir;
      this.lastEvent = `move:${parsedDir}`;
    }
  }

  /**
   * Feed one decoded server text line (may include residual ANSI — stripped).
   */
  onServerLine(line: string): void {
    const plain = stripAnsi(line);
    if (!plain.trim()) return;

    if (isMoveFail(plain)) {
      this.lastMoveDir = null;
      this.pendingTitle = null;
      this.lastEvent = "move_fail";
      return;
    }
    if (isVisionFail(plain)) {
      // keep lastMoveDir so we can still step without rematch
      this.lastEvent = "vision_fail";
      if (this.lastMoveDir && this.mapping && this.currentId) {
        this.applyMoveBlind(this.lastMoveDir);
        this.lastMoveDir = null;
      }
      return;
    }

    const exits = parseExitsLine(plain);
    if (exits) {
      this.commitRoom(this.pendingTitle, exits.dirs, exits.special);
      this.pendingTitle = null;
      this.lastMoveDir = null;
      return;
    }

    if (looksLikeTitle(plain)) {
      this.pendingTitle = normalizeTitle(plain);
    }
  }

  private applyMoveBlind(dir: CompassDir): void {
    const cur = this.currentId ? this.rooms.get(this.currentId) : null;
    if (!cur) return;
    const linked = cur.exits[dir];
    if (typeof linked === "string") {
      this.currentId = linked;
      const r = this.rooms.get(linked);
      if (r) r.visits += 1;
      this.lastEvent = "blind_follow";
      return;
    }
    // place guessed room at layout delta
    const [dx, dy, dz] = DELTA[dir];
    const room = this.createRoom({
      title: "?",
      dirs: [],
      special: [],
      x: cur.x + dx,
      y: cur.y + dy,
      z: cur.z + dz,
      confidence: "guessed",
    });
    cur.exits[dir] = room.id;
    this.currentId = room.id;
    this.lastEvent = "blind_new";
  }

  private commitRoom(
    titleIn: string | null,
    dirs: CompassDir[],
    special: string[],
  ): void {
    const title = normalizeTitle(titleIn ?? "") || "未知名稱";
    const fp = fingerprint(title, dirs);

    // Match existing by fingerprint first
    let roomId = this.byFp.get(fp);
    let room = roomId ? this.rooms.get(roomId) : undefined;

    if (!room && this.lastMoveDir && this.currentId && this.mapping) {
      const cur = this.rooms.get(this.currentId)!;
      const existingEdge = cur.exits[this.lastMoveDir];
      if (typeof existingEdge === "string") {
        room = this.rooms.get(existingEdge);
        roomId = room?.id;
      }
      if (!room) {
        const [dx, dy, dz] = DELTA[this.lastMoveDir];
        room = this.createRoom({
          title,
          dirs,
          special,
          x: cur.x + dx,
          y: cur.y + dy,
          z: cur.z + dz,
          confidence: "known",
          fp,
        });
        cur.exits[this.lastMoveDir] = room.id;
        // do NOT invent reverse until observed
        roomId = room.id;
      } else {
        this.syncExits(room, dirs, special);
        room.title = title;
        room.fingerprint = fp;
        this.byFp.set(fp, room.id);
      }
    } else if (!room) {
      room = this.createRoom({
        title,
        dirs,
        special,
        x: 0,
        y: 0,
        z: 0,
        confidence: "known",
        fp,
      });
      roomId = room.id;
    } else {
      this.syncExits(room, dirs, special);
      room.title = title;
      room.visits += 1;
    }

    if (room && this.lastMoveDir && this.currentId && this.currentId !== room.id) {
      const cur = this.rooms.get(this.currentId);
      if (cur) cur.exits[this.lastMoveDir] = room.id;
      // Link reverse only if server listed that dir (stub or empty) — never invent
      const rev = reverseDir(this.lastMoveDir);
      if (rev && dirs.includes(rev)) {
        const existing = room.exits[rev];
        if (existing === undefined || existing === null) {
          room.exits[rev] = this.currentId;
        }
      }
    }

    this.currentId = room!.id;
    this.lastEvent = "room";
  }

  private syncExits(
    room: GraphRoom,
    dirs: CompassDir[],
    special: string[],
  ): void {
    for (const d of dirs) {
      if (room.exits[d] === undefined) room.exits[d] = null; // stub
    }
    room.specialExits = special;
    room.fingerprint = fingerprint(room.title, dirs);
    this.byFp.set(room.fingerprint, room.id);
  }

  private createRoom(opts: {
    title: string;
    dirs: CompassDir[];
    special: string[];
    x: number;
    y: number;
    z: number;
    confidence: RoomConfidence;
    fp?: string;
  }): GraphRoom {
    const id = newId();
    const exits: GraphRoom["exits"] = {};
    for (const d of opts.dirs) exits[d] = null;
    const fp = opts.fp ?? fingerprint(opts.title, opts.dirs);
    const room: GraphRoom = {
      id,
      title: opts.title,
      fingerprint: fp,
      exits,
      specialExits: opts.special,
      x: opts.x,
      y: opts.y,
      z: opts.z,
      confidence: opts.confidence,
      visits: 1,
    };
    this.rooms.set(id, room);
    if (opts.title !== "?") this.byFp.set(fp, id);
    return room;
  }

  nearby(): NearbyHud {
    const cur = this.currentId ? this.rooms.get(this.currentId) : null;
    if (!cur) {
      return {
        title: null,
        confidence: "unknown",
        exits: [],
        roomId: null,
        mapping: this.mapping,
        lastEvent: this.lastEvent,
      };
    }
    const exits: NearbyExit[] = [];
    const listed = new Set(
      (Object.keys(cur.exits) as CompassDir[]).filter(
        (d) => cur.exits[d] !== undefined,
      ),
    );
    for (const d of listed) {
      const dest = cur.exits[d];
      if (typeof dest === "string") {
        const n = this.rooms.get(dest);
        exits.push({
          dir: d,
          state: "linked",
          neighborTitle: n?.title,
          neighborId: dest,
        });
      } else {
        exits.push({ dir: d, state: "stub" });
      }
    }
    return {
      title: cur.title,
      confidence: cur.confidence,
      exits,
      roomId: cur.id,
      mapping: this.mapping,
      lastEvent: this.lastEvent,
    };
  }

  snapshot(): RoomTrackerSnapshot {
    return {
      rooms: [...this.rooms.values()],
      currentId: this.currentId,
      nearby: this.nearby(),
    };
  }

  /** Graph nodes for WebGL / canvas POC */
  layoutNodes(): { id: string; x: number; y: number; z: number; title: string; current: boolean }[] {
    return [...this.rooms.values()].map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      z: r.z,
      title: r.title,
      current: r.id === this.currentId,
    }));
  }
}

/** @deprecated spike — prefer RoomTracker */
export class ClientMap {
  private t = new RoomTracker();
  rooms = this.t.rooms;
  get current() {
    return this.t.currentId;
  }
  move(dir: CompassDir, nextTitle: string): { id: string } {
    this.t.noteOutbound(dir, dir);
    this.t.onServerLine(nextTitle);
    this.t.onServerLine(`出口：${dir}`);
    return { id: this.t.currentId ?? "" };
  }
  ascii(radius = 5): string {
    void radius;
    const n = this.t.nearby();
    return n.title ? `@ ${n.title}` : "(empty)";
  }
}

export type { MoveDialect };
