/**
 * theorem_graph.ts — Hierarchical graph of proof obligations and obstructions.
 *
 * Tracks the structural landscape of a proof search:
 * - GOAL nodes: top-level conjectures  
 * - SUBGOAL nodes: decomposed obligations
 * - OBSTRUCTION nodes: proven dead-ends (e.g. "Z3 UNSAT on 60-elem window at E=6")
 * - WITNESS nodes: verified constructions
 *
 * Edges connect nodes via REQUIRES / BLOCKED_BY / RESOLVED_BY relationships.
 * Persisted as JSONL (same pattern as ResearchJournal).
 */

import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeKind = "GOAL" | "SUBGOAL" | "OBSTRUCTION" | "WITNESS";
export type EdgeKind = "REQUIRES" | "BLOCKED_BY" | "RESOLVED_BY";

export interface TheoremNode {
  id: string;
  kind: NodeKind;
  label: string;
  evidence?: string;
  /** For OBSTRUCTION: the E value where search stalled */
  energy?: number;
  /** For WITNESS: the actual coloring (1-indexed slice) */
  partition?: number[];
  timestamp: string;
  /**
   * Poincaré ball B² coordinates [x, y] with ||coord|| < 1.
   * Nodes near origin = general structural obstructions;
   * Nodes near boundary = specific failed attempts.
   * Assigned by embedInPoincareBall() based on BFS depth from the root.
   */
  hyperbolicCoords?: [number, number];
}

export interface TheoremEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

type PersistedRecord =
  | ({ recordType: "node" } & TheoremNode)
  | ({ recordType: "edge" } & TheoremEdge);

// ── TheoremGraph ──────────────────────────────────────────────────────────────

export class TheoremGraph {
  private nodes = new Map<string, TheoremNode>();
  private edges: TheoremEdge[] = [];

  constructor(private readonly graphPath: string) {
    this.loadFromDisk();
  }

  // ── Mutation ─────────────────────────────────────────────────────────────────

  addNode(node: Omit<TheoremNode, "id" | "timestamp">): TheoremNode {
    const full: TheoremNode = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...node,
    };
    this.nodes.set(full.id, full);
    this.persist({ recordType: "node", ...full });
    return full;
  }

  addEdge(from: string, to: string, kind: EdgeKind): void {
    const edge: TheoremEdge = { from, to, kind };
    this.edges.push(edge);
    this.persist({ recordType: "edge", ...edge });
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  getNode(id: string): TheoremNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): TheoremNode[] {
    return [...this.nodes.values()];
  }

  getObstructions(): TheoremNode[] {
    return [...this.nodes.values()].filter(n => n.kind === "OBSTRUCTION");
  }

  getWitnesses(): TheoremNode[] {
    return [...this.nodes.values()].filter(n => n.kind === "WITNESS");
  }

  isResolved(nodeId: string): boolean {
    return this.edges.some(e => e.to === nodeId && e.kind === "RESOLVED_BY");
  }

  /**
   * Returns OBSTRUCTION nodes sorted by energy descending (worst first).
   * Useful for understanding which E values are structurally rigid.
   */
  getObstructionsByEnergy(): TheoremNode[] {
    return this.getObstructions()
      .filter(n => n.energy !== undefined)
      .sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0));
  }

  // ── Prompt injection ──────────────────────────────────────────────────────────

  /**
   * Generate a compact markdown summary of all known obstructions,
   * capped at maxChars for prompt injection. Flat ordering (most recent last).
   */
  toPromptString(maxChars = 2000): string {
    const obstructions = this.getObstructions();
    if (obstructions.length === 0) return "";

    const lines = [
      "### THEOREM GRAPH — Known Structural Obstructions",
      "(Do not repeat approaches that were proven dead-ends below)",
    ];

    for (const o of obstructions.slice(-20)) {
      lines.push(`- [E=${o.energy ?? "?"}] ${o.label}${o.evidence ? ` — ${o.evidence}` : ""}`);
    }

    return lines.join("\n").slice(0, maxChars);
  }

  // ── Poincaré Ball Hyperbolic Embedding ─────────────────────────────────────────────

  /**
   * Möbius addition in the Poincaré ball B²:
   *   x ⊕ y = ((1 + 2⟨x,y⟩ + ||y||²)x + (1 - ||x||²)y) / (1 + 2⟨x,y⟩ + ||x||²||y||²)
   */
  private static mobiusAdd(x: [number, number], y: [number, number]): [number, number] {
    const xy = x[0]*y[0] + x[1]*y[1];
    const xx = x[0]*x[0] + x[1]*x[1];
    const yy = y[0]*y[0] + y[1]*y[1];
    const denom = 1 + 2*xy + xx*yy;
    return [
      ((1 + 2*xy + yy)*x[0] + (1 - xx)*y[0]) / denom,
      ((1 + 2*xy + yy)*x[1] + (1 - xx)*y[1]) / denom,
    ];
  }

  /**
   * Hyperbolic geodesic distance in the Poincaré ball:
   *   d(x, y) = 2 arctanh(||-x ⊕ y||)
   */
  private static hyperbolicDist(x: [number, number], y: [number, number]): number {
    const neg_x: [number, number] = [-x[0], -x[1]];
    const m = TheoremGraph.mobiusAdd(neg_x, y);
    const norm = Math.sqrt(m[0]*m[0] + m[1]*m[1]);
    return 2 * Math.atanh(Math.min(norm, 0.9999)); // cap to avoid inf
  }

  /**
   * Assign Poincaré ball coordinates to all OBSTRUCTION nodes based on
   * insertion order (a proxy for BFS depth: earlier = more general).
   *
   * Nodes are placed at radius r = tanh(depth / maxDepth * 1.5) on a
   * deterministic angle based on their index, giving a natural hierarchy:
   * - General (early, low-energy) obstructions near origin
   * - Specific (late, high-energy) obstructions near boundary
   */
  embedInPoincareBall(): void {
    const obstructions = this.getObstructions();
    const n = obstructions.length;
    if (n === 0) return;
    obstructions.forEach((node, idx) => {
      const r = Math.tanh((idx / Math.max(n - 1, 1)) * 1.5);
      const angle = (2 * Math.PI * idx) / Math.max(n, 1);
      node.hyperbolicCoords = [r * Math.cos(angle), r * Math.sin(angle)];
    });
  }

  /**
   * Like toPromptString() but orders obstructions by hyperbolic distance
   * from the origin: most general (near origin) first, most specific last.
   * This gives the ARCHITECT a hierarchy-aware context where broader
   * structural patterns appear before fine-grained failure details.
   */
  toHyperbolicPromptString(maxChars = 2000): string {
    this.embedInPoincareBall();
    const origin: [number, number] = [0, 0];
    const obstructions = this.getObstructions()
      .filter(n => n.hyperbolicCoords !== undefined)
      .sort((a, b) => {
        const da = TheoremGraph.hyperbolicDist(origin, a.hyperbolicCoords!);
        const db = TheoremGraph.hyperbolicDist(origin, b.hyperbolicCoords!);
        return da - db; // ascending: general first
      });

    if (obstructions.length === 0) return this.toPromptString(maxChars);

    const lines = [
      "### THEOREM GRAPH — Structural Obstructions (general → specific)",
      "(Do not repeat approaches that were proven dead-ends below)",
    ];

    for (const o of obstructions.slice(-20)) {
      const depth = o.hyperbolicCoords
        ? TheoremGraph.hyperbolicDist(origin, o.hyperbolicCoords).toFixed(2)
        : "?";
      lines.push(`- [E=${o.energy ?? "?"}, d=${depth}] ${o.label}${o.evidence ? ` — ${o.evidence}` : ""}`);
    }

    return lines.join("\n").slice(0, maxChars);
  }

  // ── Persistence ───────────────────────────────────────────────────────────────

  private persist(record: PersistedRecord): void {
    mkdirSync(dirname(this.graphPath), { recursive: true });
    appendFileSync(this.graphPath, JSON.stringify(record) + "\n");
  }

  private loadFromDisk(): void {
    if (!existsSync(this.graphPath)) return;
    const lines = readFileSync(this.graphPath, "utf-8")
      .split("\n")
      .filter(l => l.trim().length > 0);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as PersistedRecord;
        if (record.recordType === "node") {
          const { recordType: _r, ...node } = record;
          this.nodes.set(node.id, node);
        } else if (record.recordType === "edge") {
          const { recordType: _r, ...edge } = record;
          this.edges.push(edge);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }
}
