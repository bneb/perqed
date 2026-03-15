/**
 * Sprint 12b: Gemini Schema Tests — Frontier Digest Pattern
 *
 * Verifies that the ARCHITECT schema includes:
 * - BACKTRACK action for tree navigation
 * - target_node_id for branch-level directives
 * - tactics field for specific Lean 4 instructions
 * - System prompt mentions frontier digest workflow
 */

import { describe, test, expect } from "bun:test";

describe("Gemini ARCHITECT Schema — Frontier Digest", () => {
  test("ARCHITECT_SCHEMA includes BACKTRACK and DIRECTIVE actions", async () => {
    const source = await Bun.file("./src/agents/gemini.ts").text();

    expect(source).toContain('"BACKTRACK"');
    expect(source).toContain('"DIRECTIVE"');
    expect(source).toContain('"GIVE_UP"');
  });

  test("ARCHITECT_SCHEMA requires target_node_id", async () => {
    const source = await Bun.file("./src/agents/gemini.ts").text();

    expect(source).toContain("target_node_id");
    expect(source).toContain('"action", "target_node_id", "reasoning"');
  });

  test("ARCHITECT_SCHEMA includes optional tactics field", async () => {
    const source = await Bun.file("./src/agents/gemini.ts").text();

    // The tactics field should exist in ARCHITECT_SCHEMA properties
    // It's for DIRECTIVE actions — specific Lean 4 tactics
    expect(source).toContain("tactics:");
    expect(source).toContain("Lean 4 tactics");
  });

  test("ARCHITECT system prompt mentions Frontier Digest", async () => {
    const source = await Bun.file("./src/agents/gemini.ts").text();

    expect(source).toContain("Frontier Digest");
    expect(source).toContain("target_node_id");
    expect(source).toContain("BACKTRACK");
    expect(source).toContain("dead-end");
  });
});
