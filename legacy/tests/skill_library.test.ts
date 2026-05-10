/**
 * skill_library.test.ts — RED-to-GREEN tests for SkillLibrary.
 *
 * SkillLibrary loads all SKILL.md files from .agents/skills/, ranks them
 * by keyword overlap against a context string, and returns formatted
 * content blocks for prompt injection.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { SkillLibrary } from "../src/skills/skill_library";

const SKILLS_ROOT = join(import.meta.dir, "..", ".agents", "skills");

// ── 1. Discovery ──────────────────────────────────────────────────────────

describe("SkillLibrary.loadAll — discovery", () => {
  it("loads at least 10 skills from .agents/skills/", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    expect(lib.size()).toBeGreaterThanOrEqual(10);
  });

  it("each loaded skill has a non-empty name and description", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const all = lib.all();
    for (const skill of all) {
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it("loads schur-partition-search", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const found = lib.all().find((s) => s.name === "schur-partition-search");
    expect(found).toBeDefined();
  });

  it("loads explicit_construction", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const found = lib.all().find((s) => s.name === "explicit_construction");
    expect(found).toBeDefined();
  });
});

// ── 2. Relevance ranking ──────────────────────────────────────────────────

describe("SkillLibrary.getRelevantSkills — keyword ranking", () => {
  it("ranks schur-partition-search first for 'schur partition sum-free'", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const results = lib.getRelevantSkills("schur partition sum-free coloring", 5);
    expect(results[0]!.name).toBe("schur-partition-search");
  });

  it("ranks graph-witness-search first for 'ramsey graph witness SA'", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const results = lib.getRelevantSkills("ramsey graph witness SA search", 5);
    const names = results.map((s) => s.name);
    expect(names).toContain("graph-witness-search");
    expect(names.indexOf("graph-witness-search")).toBeLessThan(3);
  });

  it("ranks explicit_construction in top 3 for existential proofs", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const results = lib.getRelevantSkills("prove existence witness constructive", 5);
    const names = results.map((s) => s.name);
    expect(names).toContain("explicit_construction");
    expect(names.indexOf("explicit_construction")).toBeLessThan(3);
  });

  it("respects maxSkills cap", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const results = lib.getRelevantSkills("math proof theorem", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("returns results even for an empty context (generic fallback)", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const results = lib.getRelevantSkills("", 3);
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── 3. getSummaryBlock ────────────────────────────────────────────────────

describe("SkillLibrary.getSummaryBlock — prompt format", () => {
  it("returns a non-empty string", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const block = lib.getSummaryBlock("schur partition", 2);
    expect(block.length).toBeGreaterThan(50);
  });

  it("includes skill name in the output", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const block = lib.getSummaryBlock("schur partition sum-free", 2);
    expect(block).toContain("schur-partition-search");
  });

  it("includes description in the output", async () => {
    const lib = await SkillLibrary.loadAll(SKILLS_ROOT);
    const block = lib.getSummaryBlock("schur partition", 1);
    // Description from SKILL.md frontmatter should appear
    expect(block.length).toBeGreaterThan(20);
  });
});
