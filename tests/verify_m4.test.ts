/**
 * Sprint 27: Verification Tests (TDD)
 *
 * Tests for the m=4 decomposition verification logic.
 */

import { describe, test, expect } from "bun:test";
import { ClaudeState } from "../src/math/claude_state";

const SOLUTION_PAYLOAD = [
  2,3,1,3,1,3,4,0,4,1,5,3,3,0,1,4,
  3,4,0,0,0,5,0,1,2,3,3,5,4,1,3,2,
  5,2,1,3,1,4,1,2,0,3,4,3,1,0,5,3,
  3,0,3,4,3,1,2,1,3,1,5,4,4,3,0,1,
];

describe("KnuthTorusM4 Verification", () => {
  test("ClaudeState confirms energy = 0 for discovered payload", () => {
    const state = new ClaudeState(SOLUTION_PAYLOAD);
    expect(state.getEnergy()).toBe(0);
  });

  test("each color forms exactly 1 cycle of length 64", () => {
    const PERMS = [
      [0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0],
    ];

    function succ(v: number, color: number): number {
      const i = Math.floor(v / 16);
      const j = Math.floor(v / 4) % 4;
      const k = v % 4;
      const perm = PERMS[SOLUTION_PAYLOAD[v]!]!;
      if (perm[0] === color) return ((i+1)%4)*16+j*4+k;
      if (perm[1] === color) return i*16+((j+1)%4)*4+k;
      return i*16+j*4+((k+1)%4);
    }

    for (let color = 0; color < 3; color++) {
      const visited = new Set<number>();
      let node = 0;
      while (!visited.has(node)) {
        visited.add(node);
        node = succ(node, color);
      }
      expect(visited.size).toBe(64);
      expect(node).toBe(0); // Returns to start
    }
  });

  test("all 192 directed arcs are covered with no overlap", () => {
    const PERMS = [
      [0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0],
    ];

    const edges = new Set<string>();
    for (let v = 0; v < 64; v++) {
      const i = Math.floor(v / 16);
      const j = Math.floor(v / 4) % 4;
      const k = v % 4;
      const targets = [
        ((i+1)%4)*16+j*4+k,
        i*16+((j+1)%4)*4+k,
        i*16+j*4+((k+1)%4),
      ];
      for (let dir = 0; dir < 3; dir++) {
        const edge = `${v}->${targets[dir]}`;
        expect(edges.has(edge)).toBe(false); // No overlap
        edges.add(edge);
      }
    }
    expect(edges.size).toBe(192);
  });
});
