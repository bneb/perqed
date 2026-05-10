import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSkillsIndex } from "../src/agents/skills_loader";

const TEST_SKILLS_ROOT = "/tmp/test_skills_loader_perqed";

beforeAll(async () => {
  await rm(TEST_SKILLS_ROOT, { recursive: true, force: true });
  await mkdir(TEST_SKILLS_ROOT, { recursive: true });

  // Create Skill 1
  const skill1Dir = join(TEST_SKILLS_ROOT, "skill-a");
  await mkdir(skill1Dir);
  await writeFile(
    join(skill1Dir, "SKILL.md"),
    `---
description: Advanced solver for linear systems
---
# Skill A
Content here`
  );

  // Create Skill 2 (no description)
  const skill2Dir = join(TEST_SKILLS_ROOT, "skill-b");
  await mkdir(skill2Dir);
  await writeFile(
    join(skill2Dir, "SKILL.md"),
    `---
name: skill-b
---
# Skill B
No description`
  );

  // Create empty dir with no SKILL.md
  await mkdir(join(TEST_SKILLS_ROOT, "skill-c"));
});

afterAll(async () => {
  await rm(TEST_SKILLS_ROOT, { recursive: true, force: true });
});

describe("skills_loader", () => {
  test("generates markdown index from valid skills directory", () => {
    const index = loadSkillsIndex(TEST_SKILLS_ROOT);
    
    expect(index).toContain("- **skill-a**: Advanced solver for linear systems");
    expect(index).toContain("- **skill-b**: (No description provided)");
    expect(index).not.toContain("skill-c"); // No SKILL.md
  });

  test("handles non-existent skills directory gracefully", () => {
    const index = loadSkillsIndex("/tmp/does_not_exist_xyz555");
    expect(index).toBe("");
  });
});
