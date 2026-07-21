/**
 * WebGL (fallback Canvas2D) graph POC for room layout nodes.
 * Not production pathfinding UI — visual spike for trail mode.
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

type Props = {
  nodes: PocNode[];
};

export function MapGraphPoc({ nodes }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? 280;
    const h = Math.max(180, parent?.clientHeight ?? 220);
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl) {
      drawWebGL(gl as WebGLRenderingContext, nodes, w, h);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) draw2d(ctx, nodes, w, h, devicePixelRatio);
  }, [nodes]);

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
  w: number,
  h: number,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const b = bounds(nodes);
  const pad = 24;
  const sx = (w - pad * 2) / (b.maxX - b.minX);
  const sy = (h - pad * 2) / (b.maxY - b.minY);
  const s = Math.min(sx, sy) * 0.9;
  const cx = (x: number) => pad + (x - b.minX) * s + (w - pad * 2 - (b.maxX - b.minX) * s) / 2;
  const cy = (y: number) => pad + (y - b.minY) * s + (h - pad * 2 - (b.maxY - b.minY) * s) / 2;

  for (const n of nodes) {
    const x = cx(n.x);
    const y = cy(n.y);
    ctx.beginPath();
    ctx.arc(x, y, n.current ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = n.current ? "#5eead4" : "#64748b";
    ctx.fill();
    if (n.current) {
      ctx.strokeStyle = "#5eead4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(n.title.slice(0, 6), x + 8, y + 3);
  }
}

function drawWebGL(
  gl: WebGLRenderingContext,
  nodes: PocNode[],
  cssW: number,
  cssH: number,
) {
  const vsSrc = `
    attribute vec2 a_pos;
    attribute float a_cur;
    varying float v_cur;
    void main() {
      v_cur = a_cur;
      gl_Position = vec4(a_pos, 0.0, 1.0);
      gl_PointSize = a_cur > 0.5 ? 14.0 : 8.0;
    }
  `;
  const fsSrc = `
    precision mediump float;
    varying float v_cur;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      if (dot(c,c) > 0.25) discard;
      if (v_cur > 0.5) gl_FragColor = vec4(0.37, 0.92, 0.83, 1.0);
      else gl_FragColor = vec4(0.39, 0.45, 0.55, 1.0);
    }
  `;
  const prog = link(gl, vsSrc, fsSrc);
  if (!prog) {
    // fallback via 2d if compile fails
    const canvas = gl.canvas as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx) draw2d(ctx, nodes, cssW, cssH, devicePixelRatio);
    return;
  }
  gl.useProgram(prog);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.06, 0.07, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (nodes.length === 0) return;

  const b = bounds(nodes);
  const pos: number[] = [];
  const cur: number[] = [];
  for (const n of nodes) {
    const nx = ((n.x - b.minX) / (b.maxX - b.minX)) * 1.6 - 0.8;
    const ny = -(((n.y - b.minY) / (b.maxY - b.minY)) * 1.6 - 0.8);
    pos.push(nx, ny);
    cur.push(n.current ? 1 : 0);
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cur), gl.STATIC_DRAW);
  const aCur = gl.getAttribLocation(prog, "a_cur");
  gl.enableVertexAttribArray(aCur);
  gl.vertexAttribPointer(aCur, 1, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.POINTS, 0, nodes.length);
}

function link(
  gl: WebGLRenderingContext,
  vsSrc: string,
  fsSrc: string,
): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
  return s;
}
