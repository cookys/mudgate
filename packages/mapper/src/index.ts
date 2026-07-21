/**
 * Client-side automap spike (Phase 5) — not server map_d.
 * Graph of rooms visited via movement commands.
 */

export type RoomId = string;
export type ExitDir =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | "u"
  | "d";

export type Room = {
  id: RoomId;
  title: string;
  exits: Partial<Record<ExitDir, RoomId>>;
  x: number;
  y: number;
};

const DELTA: Record<ExitDir, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
  u: [0, 0],
  d: [0, 0],
};

export class ClientMap {
  rooms = new Map<RoomId, Room>();
  current: RoomId | null = null;

  ensure(id: RoomId, title = id): Room {
    let r = this.rooms.get(id);
    if (!r) {
      r = { id, title, exits: {}, x: 0, y: 0 };
      this.rooms.set(id, r);
    }
    if (title) r.title = title;
    return r;
  }

  move(dir: ExitDir, nextTitle: string): Room {
    if (!this.current) {
      const start = this.ensure("0,0", "start");
      start.x = 0;
      start.y = 0;
      this.current = start.id;
    }
    const cur = this.rooms.get(this.current)!;
    const [dx, dy] = DELTA[dir];
    const nid = `${cur.x + dx},${cur.y + dy}`;
    const next = this.ensure(nid, nextTitle);
    next.x = cur.x + dx;
    next.y = cur.y + dy;
    cur.exits[dir] = next.id;
    const rev = reverse(dir);
    if (rev) next.exits[rev] = cur.id;
    this.current = next.id;
    return next;
  }

  /** ASCII dump of visited coords */
  ascii(radius = 5): string {
    if (!this.current) return "(empty)";
    const cur = this.rooms.get(this.current)!;
    const lines: string[] = [];
    for (let y = cur.y - radius; y <= cur.y + radius; y++) {
      let row = "";
      for (let x = cur.x - radius; x <= cur.x + radius; x++) {
        const id = `${x},${y}`;
        if (id === this.current) row += "@";
        else if (this.rooms.has(id)) row += "o";
        else row += ".";
      }
      lines.push(row);
    }
    return lines.join("\n");
  }
}

function reverse(d: ExitDir): ExitDir | null {
  const m: Partial<Record<ExitDir, ExitDir>> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
    ne: "sw",
    sw: "ne",
    nw: "se",
    se: "nw",
    u: "d",
    d: "u",
  };
  return m[d] ?? null;
}
