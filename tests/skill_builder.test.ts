/**
 * SKILL Library tests — TDD RED → GREEN
 *
 * Tests for:
 *   1. validateSkillFile / assertValidSkillFile
 *   2. SkillBuilder.buildSkill() — mock Gemini, file written
 */

import { describe, test, expect, afterAll } from "bun:test";
import { rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { validateSkillFile, assertValidSkillFile } from "../src/skills/skill_validator";
import { SkillBuilder } from "../src/skills/skill_builder";

const TEST_SKILLS_ROOT = "/tmp/test_skills_perqed";

afterAll(async () => {
  await rm(TEST_SKILLS_ROOT, { recursive: true, force: true });
});

// ──────────────────────────────────────────────────────────────────────────
// validateSkillFile
// ──────────────────────────────────────────────────────────────────────────

const VALID_SKILL = `---
name: test-skill
description: A test skill for unit tests
---

# test-skill

## Technique
This technique involves applying the pigeonhole principle to finite sets.

## When to Apply
Use when you need to prove the existence of a collision in a finite set.

## Worked Example
Prove R(3,3) ≤ 6: color K_6 red/blue. Each vertex has 5 neighbors; by pigeonhole,
3 are the same color. Those 3 form a monochromatic triangle.

## Lean 4 Template
\`\`\`lean
-- Pigeonhole in Lean 4
theorem pigeonhole (n : Nat) : n < n + 1 := Nat.lt_succ_self n
\`\`\`

## TypeScript Template
\`\`\`typescript
// No TypeScript template needed for this pure math technique
\`\`\`

## Key References
- [Ramsey 1930] On a problem of formal logic. Proc. London Math. Soc.
`;

describe("validateSkillFile", () => {
  test("accepts valid SKILL content", () => {
    const { valid, errors } = validateSkillFile(VALID_SKILL);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test("rejects content with no frontmatter", () => {
    const { valid, errors } = validateSkillFile("# No frontmatter here\n\n## Technique\nSome content.");
    expect(valid).toBe(false);
    expect(errors.some((e) => e.toLowerCase().includes("frontmatter"))).toBe(true);
  });

  test("rejects content missing frontmatter 'name' field", () => {
    const content = `---
description: Missing the name field
---

## Technique\nX\n## When to Apply\nX\n## Worked Example\nX\n## Key References\nX`;
    const { valid, errors } = validateSkillFile(content);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"name"'))).toBe(true);
  });

  test("rejects content missing frontmatter 'description' field", () => {
    const content = `---
name: my-skill
---

## Technique\nX\n## When to Apply\nX\n## Worked Example\nX\n## Key References\nX`;
    const { valid, errors } = validateSkillFile(content);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('"description"'))).toBe(true);
  });

  test("rejects content missing required sections", () => {
    const contentMissingRef = `---
name: x
description: y
---
## Technique\nX\n## When to Apply\nX\n## Worked Example\nX`;
    const { valid, errors } = validateSkillFile(contentMissingRef);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("Key References"))).toBe(true);
  });

  test("reports ALL missing sections in one call", () => {
    const minimalFm = `---\nname: x\ndescription: y\n---\n`;
    const { errors } = validateSkillFile(minimalFm);
    // Should report all 4 missing sections
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("assertValidSkillFile", () => {
  test("does not throw on valid content", () => {
    expect(() => assertValidSkillFile(VALID_SKILL)).not.toThrow();
  });

  test("throws with descriptive message on invalid content", () => {
    let thrown = "";
    try {
      assertValidSkillFile("no frontmatter", "/path/to/SKILL.md");
    } catch (e: any) {
      thrown = e.message;
    }
    expect(thrown).not.toBe("");
    expect(thrown.toLowerCase()).toContain("skill.md");
    expect(thrown.toLowerCase()).toContain("frontmatter");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// SkillBuilder
// ──────────────────────────────────────────────────────────────────────────

describe("SkillBuilder.buildSkill()", () => {
  test("writes SKILL.md with correct frontmatter when Gemini is mocked", async () => {
    // Intercept Gemini call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url: any, _opts: any) => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: VALID_SKILL }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const builder = new SkillBuilder(
      "fake-api-key",
      "gemini-2.5-flash",
      TEST_SKILLS_ROOT,
    );

    const result = await builder.buildSkill({
      name: "test-skill",
      description: "A test skill",
      problemToSolve: "Show R(3,3) = 6",
      expectedTechnique: "Pigeonhole principle",
      sourceHint: "Ramsey 1930",
    });

    globalThis.fetch = originalFetch;

    const skillPath = join(TEST_SKILLS_ROOT, "test-skill", "SKILL.md");
    expect(existsSync(skillPath)).toBe(true);

    const written = await readFile(skillPath, "utf-8");
    expect(written).toContain("name: test-skill");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("returns valid=false when Gemini returns malformed content", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "This is not a valid SKILL.md — no frontmatter." }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const builder = new SkillBuilder("fake-key", "gemini-2.5-flash", TEST_SKILLS_ROOT);

    const result = await builder.buildSkill({
      name: "bad-skill",
      description: "Bad example",
      problemToSolve: "Anything",
      expectedTechnique: "Anything",
      sourceHint: "Anywhere",
    });

    globalThis.fetch = originalFetch;

    // File is still written (so caller can inspect), but valid=false
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("buildAll continues despite individual failures", async () => {
    const originalFetch = globalThis.fetch;
    // Track which "skill" is being built by call count per-skill bucket
    const callCounts = { first: 0, second: 0 };
    let skillIndex = 0;

    globalThis.fetch = async (url: any, opts: any) => {
      // Each buildSkill issues 1 Gemini call (with up to 3 retries on HTTP error)
      // We make the first skill's calls always 500, second always 200
      const body = opts ? JSON.parse(opts.body ?? "{}") : {};
      const prompt: string = body?.contents?.[0]?.parts?.[0]?.text ?? "";

      // Identify which skill by its name in the prompt
      if (prompt.includes("will-fail")) {
        callCounts.first++;
        return new Response("Internal Server Error", { status: 500 });
      }
      // will-succeed or unknown
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: VALID_SKILL }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const builder = new SkillBuilder("fake-key", "gemini-2.5-flash", TEST_SKILLS_ROOT);

    const results = await builder.buildAll([
      { name: "will-fail", description: "fail", problemToSolve: "x", expectedTechnique: "x", sourceHint: "x" },
      { name: "will-succeed", description: "ok", problemToSolve: "ok", expectedTechnique: "ok", sourceHint: "ok" },
    ]);

    globalThis.fetch = originalFetch;

    expect(results).toHaveLength(2);
    // buildAll must not throw regardless of individual failures
    const failResult = results.find((r) => r.name === "will-fail");
    const successResult = results.find((r) => r.name === "will-succeed");
    expect(failResult).toBeDefined();
    expect(successResult?.valid).toBe(true);
  });
});
