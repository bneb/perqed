/**
 * Sprint 25: SFT Harvester Tests (TDD)
 *
 * Tests the Lean proof parser and JSONL formatter.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { SFTHarvester, type SFTRecord } from "../src/scripts/harvest_sft";
import * as fs from "node:fs";
import * as path from "node:path";

const MOCK_LEAN_FILE = `
theorem erdos_gyarfas_n4 ... := by
  obtain ⟨a, b, c, ha, hb, hc⟩ := hdeg 0
  have g01 : g 0 1 = true := by omega
  --//-- SFT_STATE_START
  -- g : Fin 4 → Fin 4 → Bool
  -- g01 : g 0 1 = true
  -- g12 : g 1 2 = true
  -- g23 : g 2 3 = true
  -- g30 : g 3 0 = true
  -- ⊢ ∃ a b c d : Fin 4, a ≠ b ∧ ...
  --//-- SFT_STATE_END
  --//-- SFT_TACTIC
  exact ⟨0, 1, 2, 3, by decide, by decide, by decide, by decide, g01, g12, g23, g30⟩
`;

const MOCK_NO_MARKERS = `
theorem simple_lemma : 1 + 1 = 2 := by omega
`;

describe("SFTHarvester", () => {
  const tmpDir = path.join("/tmp", "perqed_sft_test_" + Date.now());
  const tmpFile = path.join(tmpDir, "test_sft.jsonl");

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test("extractPair returns correct state and tactic from marked Lean file", () => {
    const pair = SFTHarvester.extractPair(MOCK_LEAN_FILE);

    expect(pair).not.toBeNull();
    expect(pair!.state).toContain("g : Fin 4 → Fin 4 → Bool");
    expect(pair!.state).toContain("g01 : g 0 1 = true");
    expect(pair!.state).toContain("⊢ ∃ a b c d : Fin 4, a ≠ b ∧ ...");
    // State should NOT contain the -- comment prefix
    expect(pair!.state).not.toContain("-- g :");
    // Tactic should be the exact witness
    expect(pair!.tactic).toContain("exact ⟨0, 1, 2, 3");
  });

  test("extractPair returns null when markers are missing", () => {
    const pair = SFTHarvester.extractPair(MOCK_NO_MARKERS);
    expect(pair).toBeNull();
  });

  test("extractPair returns null on empty string", () => {
    expect(SFTHarvester.extractPair("")).toBeNull();
  });

  test("formatRecord produces valid OpenAI conversation format", () => {
    const record = SFTHarvester.formatRecord("⊢ 1 + 1 = 2", "omega");

    expect(record.messages.length).toBe(3);
    expect(record.messages[0]!.role).toBe("system");
    expect(record.messages[1]!.role).toBe("user");
    expect(record.messages[1]!.content).toContain("⊢ 1 + 1 = 2");
    expect(record.messages[2]!.role).toBe("assistant");
    expect(record.messages[2]!.content).toBe("omega");
  });

  test("appendToJsonl creates file and writes valid JSONL", () => {
    SFTHarvester.appendToJsonl(tmpFile, "⊢ True", "trivial");

    expect(fs.existsSync(tmpFile)).toBe(true);

    const content = fs.readFileSync(tmpFile, "utf8").trim();
    const parsed: SFTRecord = JSON.parse(content);

    expect(parsed.messages.length).toBe(3);
    expect(parsed.messages[2]!.content).toBe("trivial");
  });

  test("appendToJsonl appends (does not overwrite) on subsequent calls", () => {
    SFTHarvester.appendToJsonl(tmpFile, "⊢ True", "trivial");
    SFTHarvester.appendToJsonl(tmpFile, "⊢ 1 = 1", "rfl");

    const lines = fs.readFileSync(tmpFile, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);

    const record1: SFTRecord = JSON.parse(lines[0]!);
    const record2: SFTRecord = JSON.parse(lines[1]!);
    expect(record1.messages[2]!.content).toBe("trivial");
    expect(record2.messages[2]!.content).toBe("rfl");
  });
});
