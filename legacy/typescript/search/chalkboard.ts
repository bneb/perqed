/**
 * chalkboard.ts — SVG renderer for stuck Ramsey graphs.
 *
 * Applies a Kamada-Kawai-inspired spring embedder to lay out the vertices
 * of an AdjacencyMatrix in 2D, then serialises as a self-contained SVG.
 *
 * The SVG is attached to Gemini Vision prompts by architect_client.ts
 * so the ARCHITECT can "see" the symmetry structure of the local minimum.
 *
 * Usage:
 *   await renderToSVG(adj, "agent_workspace/runs/run_42/scratch/stuck_state.svg");
 */
import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ── Layout engine ─────────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number; }

/**
 * Spring embedder: N iterations of repulsion (Coulomb) + attraction (Hooke).
 * Simple, dependency-free, deterministic with a fixed seed sequence.
 *
 * @param n       Number of vertices
 * @param edges   Set of connected pairs (symmetric)
 * @param width   Canvas width
 * @param height  Canvas height
 * @param iters   Layout iterations (default 300)
 */
function springLayout(
  n: number,
  edges: [number, number][],
  width: number,
  height: number,
  iters: number = 300,
): Vec2[] {
  // Initialise on a circle for stable deterministic start
  const pos: Vec2[] = Array.from({ length: n }, (_, i) => ({
    x: width / 2 + (width * 0.4) * Math.cos((2 * Math.PI * i) / n),
    y: height / 2 + (height * 0.4) * Math.sin((2 * Math.PI * i) / n),
  }));

  const k = Math.sqrt((width * height) / Math.max(n, 1)); // ideal spring length
  const edgeSet = new Set(edges.map(([a, b]) => `${a}-${b}`));

  for (let iter = 0; iter < iters; iter++) {
    const force: Vec2[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    const cooling = 1 - iter / iters;

    // Repulsion between all pairs (Coulomb)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i]!.x - pos[j]!.x;
        const dy = pos[i]!.y - pos[j]!.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const f = (k * k) / dist;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        force[i]!.x += fx;
        force[i]!.y += fy;
        force[j]!.x -= fx;
        force[j]!.y -= fy;
      }
    }

    // Attraction along edges (Hooke)
    for (const [a, b] of edges) {
      const dx = pos[b]!.x - pos[a]!.x;
      const dy = pos[b]!.y - pos[a]!.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const f = (dist * dist) / k;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      force[a]!.x += fx;
      force[a]!.y += fy;
      force[b]!.x -= fx;
      force[b]!.y -= fy;
    }

    // Apply forces with cooling
    const maxDisp = k * cooling * 0.5;
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(force[i]!.x ** 2 + force[i]!.y ** 2) || 1;
      const disp = Math.min(mag, maxDisp);
      pos[i]!.x = Math.max(20, Math.min(width - 20, pos[i]!.x + (force[i]!.x / mag) * disp));
      pos[i]!.y = Math.max(20, Math.min(height - 20, pos[i]!.y + (force[i]!.y / mag) * disp));
    }
  }

  return pos;
}

// ── SVG builder ───────────────────────────────────────────────────────────────

/**
 * Render an AdjacencyMatrix to a self-contained SVG string.
 *
 * - Red edges: present edges (1-entries in upper triangle)
 * - Dark background
 * - Vertices labelled with their index
 */
export function buildSVG(adj: AdjacencyMatrix, width = 800, height = 800): string {
  const n = adj.n;
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adj.hasEdge(i, j)) edges.push([i, j]);
    }
  }

  const pos = springLayout(n, edges, width, height);

  const lines: string[] = [];

  // Background
  lines.push(`<rect width="${width}" height="${height}" fill="#0d1117"/>`);

  // Edges
  for (const [a, b] of edges) {
    lines.push(
      `<line x1="${pos[a]!.x.toFixed(1)}" y1="${pos[a]!.y.toFixed(1)}" ` +
      `x2="${pos[b]!.x.toFixed(1)}" y2="${pos[b]!.y.toFixed(1)}" ` +
      `stroke="#e05252" stroke-width="1.2" opacity="0.7"/>`
    );
  }

  // Vertices
  for (let i = 0; i < n; i++) {
    const { x, y } = pos[i]!;
    lines.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#58a6ff" stroke="#1f6feb" stroke-width="1.5"/>`);
    lines.push(`<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="7" fill="#ffffff" font-family="monospace">${i}</text>`);
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...lines,
    `</svg>`,
  ].join("\n");
}

/**
 * Render an AdjacencyMatrix to an SVG file on disk.
 *
 * @param adj         The adjacency matrix to visualise
 * @param outputPath  Where to write the .svg file
 */
export async function renderToSVG(
  adj: AdjacencyMatrix,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const svg = buildSVG(adj);
  await Bun.write(outputPath, svg);
}

/**
 * Read an SVG file and return it base64-encoded (for Gemini Vision inlineData).
 */
export async function svgToBase64(svgPath: string): Promise<string> {
  const bytes = await Bun.file(svgPath).arrayBuffer();
  return Buffer.from(bytes).toString("base64");
}
