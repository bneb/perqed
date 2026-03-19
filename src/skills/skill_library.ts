/**
 * SkillLibrary — Universal skill discovery and relevance-based injection.
 *
 * Loads all SKILL.md files from a skills root directory at startup. Ranks
 * skills against any context string using token overlap (TF-style). Returns
 * formatted prompt blocks for injection into ARCHITECT and prover prompts.
 *
 * Design decisions:
 *   - Pure keyword overlap — no hardcoded problem class → skill mappings.
 *     Any new skill added to .agents/skills/ is automatically discoverable.
 *   - Relevance tokens = name tokens + description tokens + H2 section titles from body.
 *     This captures "when to apply" semantics without reading full content into ranking.
 *   - Full SKILL.md body is included in the prompt block so the agent has
 *     complete actionable instructions, not just a hint.
 *   - maxSkills cap (default 3) keeps prompt overhead bounded.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface SkillEntry {
  /** Directory name, e.g. "schur-partition-search" */
  name: string;
  /** From YAML frontmatter `description:` field */
  description: string;
  /** Full SKILL.md body (after frontmatter) */
  content: string;
  /** Relevance tokens: name + description + H2 headings, all lowercased */
  tokens: Set<string>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function parseFrontmatter(raw: string): { description: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { description: "", body: raw };
  const front = match[1] ?? "";
  const body = match[2] ?? "";
  // Handle multi-line description (YAML block scalar >)
  const descMatch = front.match(/description:\s*>?\n?([\s\S]*?)(?=\n\w|\n---|$)/);
  const description = descMatch ? descMatch[1]!.replace(/\n\s*/g, " ").trim() : "";
  return { description, body };
}

function extractH2Headings(body: string): string[] {
  return (body.match(/^## .+$/gm) ?? []).map((h) => h.replace(/^##\s*/, ""));
}

export class SkillLibrary {
  private skills: SkillEntry[] = [];

  private constructor(skills: SkillEntry[]) {
    this.skills = skills;
  }

  /** Load all SKILL.md files from the given root directory. */
  static async loadAll(skillsRoot: string): Promise<SkillLibrary> {
    let names: string[];
    try {
      names = await readdir(skillsRoot);
    } catch {
      return new SkillLibrary([]);
    }

    const skills: SkillEntry[] = [];

    for (const name of names) {
      try {
        const isDir = (await stat(join(skillsRoot, name))).isDirectory();
        if (!isDir) continue;
      } catch { continue; }

      const skillMdPath = join(skillsRoot, name, "SKILL.md");
      try {
        const raw = await Bun.file(skillMdPath).text();
        const { description, body } = parseFrontmatter(raw);
        const headings = extractH2Headings(body);

        const tokenSources = [name, description, ...headings].join(" ");
        const tokens = new Set(tokenize(tokenSources));

        skills.push({
          name,
          description: description || name,
          content: body.trim(),
          tokens,
        });
      } catch {
        // Skip skill dirs without SKILL.md
        continue;
      }
    }

    return new SkillLibrary(skills);
  }

  /** Total number of loaded skills. */
  size(): number {
    return this.skills.length;
  }

  /** All loaded skill entries. */
  all(): SkillEntry[] {
    return this.skills;
  }

  /**
   * Return the top-k most relevant skills for the given context string.
   *
   * Relevance = number of context tokens that appear in the skill's token set
   * (intersection over union of context tokens). Skills with zero overlap are
   * still returned if fewer than maxSkills have overlap, to ensure fallback.
   *
   * @param contextText  Free-text context: goal string, journal summary, etc.
   * @param maxSkills    Maximum number of skills to return (default 3).
   */
  getRelevantSkills(contextText: string, maxSkills = 3): SkillEntry[] {
    const contextTokens = tokenize(contextText);

    if (contextTokens.length === 0) {
      // No context: return first maxSkills by load order (alphabetical)
      return this.skills.slice(0, maxSkills);
    }

    const contextSet = new Set(contextTokens);

    const scored = this.skills.map((skill) => {
      let overlap = 0;
      for (const t of contextSet) {
        if (skill.tokens.has(t)) overlap++;
      }
      // Normalize: overlap / (|context| + |skill tokens| - overlap)  (Jaccard-like)
      const union = contextSet.size + skill.tokens.size - overlap;
      const score = union > 0 ? overlap / union : 0;
      return { skill, score };
    });

    // Sort descending by score; stable (preserves load order for ties)
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, maxSkills).map((s) => s.skill);
  }

  /**
   * Return a formatted prompt block with the top-k relevant skills.
   * Suitable for direct injection into ARCHITECT or prover prompts.
   *
   * Format:
   *   ## APPLICABLE SKILLS
   *   ### [skill-name]
   *   > Description: ...
   *   <full SKILL.md body>
   *   ---
   *
   * @param contextText  Free-text context: goal string, problem description, etc.
   * @param maxSkills    Number of skills to include (default 3).
   */
  getSummaryBlock(contextText: string, maxSkills = 3): string {
    const relevant = this.getRelevantSkills(contextText, maxSkills);
    if (relevant.length === 0) return "";

    const sections = relevant.map(
      (s) =>
        `### SKILL: ${s.name}\n` +
        `> ${s.description}\n\n` +
        s.content
    );

    return (
      `## APPLICABLE SKILLS (read and apply the most relevant ones)\n\n` +
      sections.join("\n\n---\n\n")
    );
  }
}
