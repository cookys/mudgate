/**
 * Room graph for client automap (not server map_d).
 *
 * Trail = dead-reckoning on every outbound move (always builds nodes).
 * Title/exits triggers upgrade the current room when parse succeeds.
 * Identity upgrade uses fingerprint(title+exits); layout (x,y,z) is presentation.
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
  exits: Partial<Record<CompassDir, string | null>>; // null = stub
  specialExits: string[];
  x: number;
  y: number;
  z: number;
  confidence: RoomConfidence;
  visits: number;
};

export type NearbyExit = {
  dir: CompassDir;
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
  roomCount: number;
};

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  title: string;
  current: boolean;
};

export type LayoutEdge = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type RoomTrackerSnapshot = {
  rooms: GraphRoom[];
  currentId: string | null;
  nearby: NearbyHud;
};

type LastStep = {
  fromId: string;
  dir: CompassDir;
  toId: string;
  created: boolean;
};

let seq = 0;
function newId(): string {
  seq += 1;
  return `r${seq.toString(36)}`;
}

export class RoomTracker {
  rooms = new Map<string, GraphRoom>();
  currentId: string | null = null;
  mapping = true;
  lastMoveDir: CompassDir | null = null;
  lastEvent: string | null = null;
  private pendingTitle: string | null = null;
  private byFp = new Map<string, string>();
  private lastStep: LastStep | null = null;

  reset(): void {
    this.rooms.clear();
    this.byFp.clear();
    this.currentId = null;
    this.lastMoveDir = null;
    this.pendingTitle = null;
    this.lastEvent = null;
    this.lastStep = null;
    seq = 0;
  }

  /**
   * Call for every outbound move command (e / 東 / numpad / pad click).
   * Immediately places a trail room — does not wait for server parse.
   */
  noteOutbound(_line: string, parsedDir: CompassDir | null): void {
    if (!parsedDir || !this.mapping) return;
    this.lastMoveDir = parsedDir;
    this.lastEvent = `move:${parsedDir}`;
    this.ensureStart();
    this.stepOnMove(parsedDir);
  }

  /** Feed one decoded server text line. */
  onServerLine(line: string): void {
    const plain = stripAnsi(line);
    if (!plain.trim()) return;

    if (isMoveFail(plain)) {
      this.undoLastStep();
      this.lastMoveDir = null;
      this.pendingTitle = null;
      this.lastEvent = "move_fail";
      return;
    }

    if (isVisionFail(plain)) {
      this.lastEvent = "vision_fail";
      // trail already stepped on outbound; keep position
      return;
    }

    const exits = parseExitsLine(plain);
    if (exits) {
      this.upgradeCurrent(this.pendingTitle, exits.dirs, exits.special);
      this.pendingTitle = null;
      this.lastMoveDir = null;
      this.lastStep = null;
      this.lastEvent = "exits";
      return;
    }

    if (looksLikeTitle(plain)) {
      const t = normalizeTitle(plain);
      this.pendingTitle = t;
      // Upgrade placeholder title immediately (RW may delay exits line)
      const cur = this.currentId ? this.rooms.get(this.currentId) : null;
      if (cur && (cur.title === "?" || cur.title === "起點" || cur.confidence === "guessed")) {
        cur.title = t;
        if (cur.confidence === "guessed") {
          // still guessed until exits confirm
        }
        this.lastEvent = "title";
      }
    }
  }

  private ensureStart(): void {
    if (this.currentId && this.rooms.has(this.currentId)) return;
    const start = this.createRoom({
      title: "起點",
      dirs: [],
      special: [],
      x: 0,
      y: 0,
      z: 0,
      confidence: "guessed",
    });
    this.currentId = start.id;
    this.lastEvent = "start";
  }

  private stepOnMove(dir: CompassDir): void {
    const cur = this.rooms.get(this.currentId!);
    if (!cur) return;

    if (cur.exits[dir] === undefined) cur.exits[dir] = null;

    const existing = cur.exits[dir];
    if (typeof existing === "string" && this.rooms.has(existing)) {
      this.currentId = existing;
      const n = this.rooms.get(existing)!;
      n.visits += 1;
      this.lastStep = {
        fromId: cur.id,
        dir,
        toId: existing,
        created: false,
      };
      this.lastEvent = `follow:${dir}`;
      return;
    }

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
    // Soft reverse only as stub on destination (not a link) until observed
    const rev = reverseDir(dir);
    if (rev && room.exits[rev] === undefined) {
      room.exits[rev] = null;
    }
    this.currentId = room.id;
    this.lastStep = {
      fromId: cur.id,
      dir,
      toId: room.id,
      created: true,
    };
    this.lastEvent = `dig:${dir}`;
  }

  private undoLastStep(): void {
    const step = this.lastStep;
    if (!step) return;
    const from = this.rooms.get(step.fromId);
    const to = this.rooms.get(step.toId);
    if (from) {
      // revert edge to stub or clear if we created the dest
      if (step.created) {
        delete from.exits[step.dir];
      } else {
        from.exits[step.dir] = step.toId; // keep link
      }
    }
    if (step.created && to && to.confidence === "guessed" && to.visits <= 1) {
      this.rooms.delete(to.id);
      this.byFp.delete(to.fingerprint);
    }
    this.currentId = step.fromId;
    this.lastStep = null;
  }

  /** Enrich current room with title + exit list from triggers. */
  private upgradeCurrent(
    titleIn: string | null,
    dirs: CompassDir[],
    special: string[],
  ): void {
    this.ensureStart();
    const cur = this.rooms.get(this.currentId!)!;
    const title =
      normalizeTitle(titleIn ?? "") ||
      (cur.title !== "?" && cur.title !== "起點" ? cur.title : "未知名稱");

    cur.title = title;
    for (const d of dirs) {
      if (cur.exits[d] === undefined) cur.exits[d] = null;
    }
    cur.specialExits = special;
    cur.confidence = "known";
    cur.fingerprint = fingerprint(title, dirs);
    this.byFp.set(cur.fingerprint, cur.id);
    cur.visits += 1;

    // If we arrived via lastStep and reverse is listed, link back
    if (this.lastStep) {
      const rev = reverseDir(this.lastStep.dir);
      if (rev && dirs.includes(rev)) {
        const existing = cur.exits[rev];
        if (existing === undefined || existing === null) {
          cur.exits[rev] = this.lastStep.fromId;
        }
        const from = this.rooms.get(this.lastStep.fromId);
        if (from) from.exits[this.lastStep.dir] = cur.id;
      }
    }
  }

  private createRoom(opts: {
    title: string;
    dirs: CompassDir[];
    special: string[];
    x: number;
    y: number;
    z: number;
    confidence: RoomConfidence;
  }): GraphRoom {
    const id = newId();
    const exits: GraphRoom["exits"] = {};
    for (const d of opts.dirs) exits[d] = null;
    const fp = fingerprint(opts.title, opts.dirs) + `#${id}`;
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
        roomCount: this.rooms.size,
      };
    }
    const exits: NearbyExit[] = [];
    for (const d of Object.keys(cur.exits) as CompassDir[]) {
      if (cur.exits[d] === undefined) continue;
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
      roomCount: this.rooms.size,
    };
  }

  snapshot(): RoomTrackerSnapshot {
    return {
      rooms: [...this.rooms.values()],
      currentId: this.currentId,
      nearby: this.nearby(),
    };
  }

  layoutNodes(): LayoutNode[] {
    return [...this.rooms.values()].map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      z: r.z,
      title: r.title,
      current: r.id === this.currentId,
    }));
  }

  layoutEdges(): LayoutEdge[] {
    const edges: LayoutEdge[] = [];
    for (const r of this.rooms.values()) {
      for (const d of Object.keys(r.exits) as CompassDir[]) {
        const dest = r.exits[d];
        if (typeof dest !== "string") continue;
        const n = this.rooms.get(dest);
        if (!n) continue;
        // only emit once (lower id first) to avoid double lines
        if (r.id > dest) continue;
        edges.push({ x0: r.x, y0: r.y, x1: n.x, y1: n.y });
      }
    }
    return edges;
  }
}

/** @deprecated */
export class ClientMap {
  private t = new RoomTracker();
  rooms = this.t.rooms;
  get current() {
    return this.t.currentId;
  }
  move(dir: CompassDir, nextTitle: string): { id: string } {
    this.t.noteOutbound(dir, dir);
    this.t.onServerLine(nextTitle);
    this.t.onServerLine(`出口：${dirLabel(dir)}`);
    return { id: this.t.currentId ?? "" };
  }
  ascii(): string {
    const n = this.t.nearby();
    return n.title ? `@ ${n.title} (${n.roomCount})` : "(empty)";
  }
}

function dirLabel(d: CompassDir): string {
  const m: Partial<Record<CompassDir, string>> = {
    n: "北",
    s: "南",
    e: "東",
    w: "西",
    u: "上",
    d: "下",
  };
  return m[d] ?? d;
}

export type { MoveDialect };
