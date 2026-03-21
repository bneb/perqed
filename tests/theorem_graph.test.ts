/**
 * theorem_graph.test.ts — TDD tests for the TheoremGraph data structure.
 *
 * Red-to-green workflow: define the contract, then implement to pass.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { TheoremGraph } from "../src/proof_dag/theorem_graph";
import { existsSync, unlinkSync } from "node:fs";

const TMP_GRAPH = "/tmp/test_theorem_graph.jsonl";

beforeEach(() => {
  try { unlinkSync(TMP_GRAPH); } catch {}
});

describe("TheoremGraph — node CRUD", () => {
  it("addNode returns a node with id and timestamp", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    const n = g.addNode({ kind: "GOAL", label: "S(6) ≥ 537" });
    expect(n.id).toBeTruthy();
    expect(n.timestamp).toBeTruthy();
    expect(n.kind).toBe("GOAL");
    expect(n.label).toBe("S(6) ≥ 537");
  });

  it("getNode returns the same node that was added", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    const inserted = g.addNode({ kind: "SUBGOAL", label: "P_0 is sum-free" });
    expect(g.getNode(inserted.id)).toEqual(inserted);
  });

  it("getAllNodes returns all inserted nodes", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    g.addNode({ kind: "GOAL", label: "Goal A" });
    g.addNode({ kind: "OBSTRUCTION", label: "Obs B", energy: 6 });
    g.addNode({ kind: "WITNESS", label: "Wit C" });
    expect(g.getAllNodes()).toHaveLength(3);
  });
});

describe("TheoremGraph — getObstructions", () => {
  it("returns only OBSTRUCTION nodes", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    g.addNode({ kind: "GOAL", label: "goal" });
    g.addNode({ kind: "OBSTRUCTION", label: "obs1", energy: 6 });
    g.addNode({ kind: "OBSTRUCTION", label: "obs2", energy: 12 });
    g.addNode({ kind: "WITNESS", label: "wit" });
    const obs = g.getObstructions();
    expect(obs).toHaveLength(2);
    expect(obs.every(o => o.kind === "OBSTRUCTION")).toBe(true);
  });

  it("energy stored correctly on obstruction", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    g.addNode({ kind: "OBSTRUCTION", label: "E=6 Z3 unsat", energy: 6 });
    expect(g.getObstructions()[0]!.energy).toBe(6);
  });
});

describe("TheoremGraph — isResolved", () => {
  it("subgoal is not resolved without a RESOLVED_BY edge", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    const sub = g.addNode({ kind: "SUBGOAL", label: "partition is sum-free" });
    expect(g.isResolved(sub.id)).toBe(false);
  });

  it("subgoal becomes resolved after adding RESOLVED_BY edge", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    const sub = g.addNode({ kind: "SUBGOAL", label: "partition is sum-free" });
    const wit = g.addNode({ kind: "WITNESS", label: "E=0 partition" });
    g.addEdge(wit.id, sub.id, "RESOLVED_BY");
    expect(g.isResolved(sub.id)).toBe(true);
  });
});

describe("TheoremGraph — toPromptString", () => {
  it("returns empty string when no obstructions", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    g.addNode({ kind: "GOAL", label: "S(6) ≥ 537" });
    expect(g.toPromptString()).toBe("");
  });

  it("includes all obstruction labels", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    g.addNode({ kind: "OBSTRUCTION", label: "Z3 UNSAT: 60-elem window at E=6", energy: 6 });
    g.addNode({ kind: "OBSTRUCTION", label: "Z3 UNSAT: 307-elem window at E=13", energy: 13 });
    const s = g.toPromptString();
    expect(s).toContain("60-elem window at E=6");
    expect(s).toContain("307-elem window at E=13");
  });

  it("respects maxChars limit", () => {
    const g = new TheoremGraph(TMP_GRAPH);
    for (let i = 0; i < 50; i++) {
      g.addNode({ kind: "OBSTRUCTION", label: `Very long obstruction description number ${i} with lots of words`, energy: i });
    }
    const s = g.toPromptString(200);
    expect(s.length).toBeLessThanOrEqual(200);
  });
});

describe("TheoremGraph — JSONL persistence", () => {
  it("nodes survive reload from disk", () => {
    const g1 = new TheoremGraph(TMP_GRAPH);
    g1.addNode({ kind: "OBSTRUCTION", label: "persisted obs", energy: 6 });

    // Reload from disk
    const g2 = new TheoremGraph(TMP_GRAPH);
    const obs = g2.getObstructions();
    expect(obs).toHaveLength(1);
    expect(obs[0]!.label).toBe("persisted obs");
    expect(obs[0]!.energy).toBe(6);
  });

  it("edges survive reload from disk", () => {
    const g1 = new TheoremGraph(TMP_GRAPH);
    const sub = g1.addNode({ kind: "SUBGOAL", label: "sum-free" });
    const wit = g1.addNode({ kind: "WITNESS", label: "E=0" });
    g1.addEdge(wit.id, sub.id, "RESOLVED_BY");

    const g2 = new TheoremGraph(TMP_GRAPH);
    expect(g2.isResolved(sub.id)).toBe(true);
  });
});
