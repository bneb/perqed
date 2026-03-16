/**
 * Sprint 21: Graph6Decoder Tests (TDD RED → GREEN)
 * 
 * Tests the Graph6 format decoder used to parse nauty/geng output.
 */

import { describe, test, expect } from "bun:test";
import { Graph6Decoder } from "./graph6";

describe("Graph6Decoder", () => {
  test("decodes empty string to empty adjacency list", () => {
    expect(Graph6Decoder.decode("")).toEqual([]);
  });

  test("decodes K_4 (complete graph on 4 vertices) — graph6 string 'C~'", () => {
    // K_4 in graph6: 'C' = 4 vertices (67 - 63 = 4), '~' = all edges (63 = 0b111111)
    const adj = Graph6Decoder.decode("C~");
    expect(adj.length).toBe(4);
    // Every vertex connects to all 3 others
    for (let i = 0; i < 4; i++) {
      expect(adj[i]!.length).toBe(3);
      for (let j = 0; j < 4; j++) {
        if (i !== j) {
          expect(adj[i]).toContain(j);
        }
      }
    }
  });

  test("decodes single edge graph K_2 — graph6 string 'A_'", () => {
    // K_2: 'A' = 2 vertices. Upper triangle: 1 bit for edge (0,1).
    // Bit pattern 100000 = 32 → char 63+32 = 95 = '_'
    const adj = Graph6Decoder.decode("A_");
    expect(adj.length).toBe(2);
    expect(adj[0]).toContain(1);
    expect(adj[1]).toContain(0);
  });

  test("decodes cycle graph C_5 — graph6 string 'Dhc'", () => {
    // C_5: 5 vertices, edges: 0-1, 1-2, 2-3, 3-4, 4-0
    // Upper triangle bits: (0,1)=1, (0,2)=0, (1,2)=1, (0,3)=0, (1,3)=0, (2,3)=1, (0,4)=1, (1,4)=0, (2,4)=0, (3,4)=1
    const adj = Graph6Decoder.decode("Dhc");
    expect(adj.length).toBe(5);
    // Each vertex has degree 2
    for (let i = 0; i < 5; i++) {
      expect(adj[i]!.length).toBe(2);
    }
    // Check cycle edges
    expect(adj[0]).toContain(1);
    expect(adj[1]).toContain(2);
    expect(adj[2]).toContain(3);
    expect(adj[3]).toContain(4);
    expect(adj[4]).toContain(0);
  });

  test("decoded graph is always symmetric (undirected)", () => {
    const adj = Graph6Decoder.decode("C~");
    for (let i = 0; i < adj.length; i++) {
      for (const j of adj[i]!) {
        expect(adj[j]).toContain(i);
      }
    }
  });
});
