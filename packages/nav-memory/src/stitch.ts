import type { MapFrameCell } from "@mudgate/terminal";

export type StitchDir = "n" | "s" | "e" | "w";

/**
 * Experimental stitch prototype (C1.6): place successive map_d-like tiles
 * on a coarse cell grid using last move dir. Not topology-true.
 */
export type StitchTile = {
  id: string;
  originC: number;
  originR: number;
  cols: number;
  rows: number;
  /** sparse: key `${c},${r}` → ch */
  cells: Map<string, string>;
};

export type StitchState = {
  enabled: boolean;
  tiles: StitchTile[];
  cursorC: number;
  cursorR: number;
};

export function createStitchState(): StitchState {
  return { enabled: false, tiles: [], cursorC: 0, cursorR: 0 };
}

const STEP = 4; // heuristic cell step per move

export function dirOffset(dir: StitchDir): { dc: number; dr: number } {
  switch (dir) {
    case "n":
      return { dc: 0, dr: -STEP };
    case "s":
      return { dc: 0, dr: STEP };
    case "e":
      return { dc: STEP, dr: 0 };
    case "w":
      return { dc: -STEP, dr: 0 };
  }
}

export function placeStitchTile(
  state: StitchState,
  input: {
    id: string;
    cols: number;
    rows: number;
    cells: MapFrameCell[];
    /** last outbound dir if known */
    dir?: StitchDir | null;
  },
): StitchState {
  if (!state.enabled) return state;
  let { cursorC, cursorR } = state;
  if (input.dir) {
    const o = dirOffset(input.dir);
    cursorC += o.dc;
    cursorR += o.dr;
  }
  const map = new Map<string, string>();
  for (let r = 0; r < input.rows; r++) {
    for (let c = 0; c < input.cols; c++) {
      const cell = input.cells[r * input.cols + c]!;
      if (cell.wideCont || !cell.ch || cell.ch === " ") continue;
      map.set(`${cursorC + c},${cursorR + r}`, cell.ch);
    }
  }
  const tile: StitchTile = {
    id: input.id,
    originC: cursorC,
    originR: cursorR,
    cols: input.cols,
    rows: input.rows,
    cells: map,
  };
  return {
    ...state,
    cursorC,
    cursorR,
    tiles: [...state.tiles, tile],
  };
}

/** Flatten tiles to a bounding-box text grid for tests / dump. */
export function stitchToAscii(state: StitchState, max = 40): string {
  if (!state.tiles.length) return "";
  let minC = Infinity,
    minR = Infinity,
    maxC = -Infinity,
    maxR = -Infinity;
  const all = new Map<string, string>();
  for (const t of state.tiles) {
    for (const [k, ch] of t.cells) {
      all.set(k, ch);
      const [cs, rs] = k.split(",");
      const c = Number(cs);
      const r = Number(rs);
      minC = Math.min(minC, c);
      minR = Math.min(minR, r);
      maxC = Math.max(maxC, c);
      maxR = Math.max(maxR, r);
    }
  }
  const w = Math.min(max, maxC - minC + 1);
  const h = Math.min(max, maxR - minR + 1);
  const lines: string[] = [];
  for (let r = 0; r < h; r++) {
    let line = "";
    for (let c = 0; c < w; c++) {
      line += all.get(`${minC + c},${minR + r}`) ?? " ";
    }
    lines.push(line.replace(/\s+$/, "") || " ");
  }
  return lines.join("\n");
}

export function clearStitch(state: StitchState): StitchState {
  return { enabled: state.enabled, tiles: [], cursorC: 0, cursorR: 0 };
}
