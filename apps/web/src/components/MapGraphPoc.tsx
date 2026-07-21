/**
 * WebGL (fallback Canvas2D) graph POC — nodes + edges for trail mode.
 */
import { useEffect, useRef } from "react";

export type PocNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  title: string;
  current: boolean;
};

export type PocEdge = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type Props = {
  nodes: PocNode[];
  edges?: PocEdge[];
};

export function MapGraphPoc({ nodes, edges = [] }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = Math.max(120, parent?.clientWidth ?? 280);
    const h = Math.max(180, parent?.clientHeight ?? 220);
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // Prefer 2d for text labels; WebGL points optional path kept simple via 2d
    const ctx = canvas.getContext("2d");
    if (ctx) {
      draw2d(ctx, nodes, edges, w, h, dpr);
      return;
    }
  }, [nodes, edges]);

  return (
    <canvas
      ref={ref}
      className="w-full flex-1 min-h-[180px]"
      style={{ background: "var(--bg-elevated)" }}
      aria-label="map graph poc"
    />
  );
}

function bounds(nodes: PocNode[]) {
  if (nodes.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  return { minX, maxX, minY, maxY };
}

function draw2d(
  ctx: CanvasRenderingContext2D,
  nodes: PocNode[],
  edges: PocEdge[],
  w: number,
  h: number,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0c0e14";
  ctx.fillRect(0, 0, w, h);

  if (nodes.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("走 n/s/e/w 開始足跡", 16, h / 2);
    return;
  }

  const b = bounds(nodes);
  const pad = 28;
  const sx = (w - pad * 2) / (b.maxX - b.minX);
  const sy = (h - pad * 2) / (b.maxY - b.minY);
  const s = Math.min(sx, sy) * 0.85;
  const ox = pad + (w - pad * 2 - (b.maxX - b.minX) * s) / 2;
  const oy = pad + (h - pad * 2 - (b.maxY - b.minY) * s) / 2;
  const cx = (x: number) => ox + (x - b.minX) * s;
  const cy = (y: number) => oy + (y - b.minY) * s;

  // edges first
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  for (const e of edges) {
    ctx.beginPath();
    ctx.moveTo(cx(e.x0), cy(e.y0));
    ctx.lineTo(cx(e.x1), cy(e.y1));
    ctx.stroke();
  }

  for (const n of nodes) {
    const x = cx(n.x);
    const y = cy(n.y);
    ctx.beginPath();
    ctx.arc(x, y, n.current ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = n.current ? "#5eead4" : "#64748b";
    ctx.fill();
    if (n.current) {
      ctx.strokeStyle = "#5eead4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = n.current ? "#e2e8f0" : "#94a3b8";
    ctx.font = "10px ui-monospace, monospace";
    const label = n.title === "?" ? "·" : n.title.slice(0, 8);
    ctx.fillText(label, x + 10, y + 3);
  }
}
