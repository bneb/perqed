/**
 * SkillBuilder — autonomously constructs SKILL.md files.
 *
 * Given a SkillSpec (problem, technique, source), the builder:
 *   1. Constructs a detailed prompt for the Gemini REST API.
 *   2. Receives a complete SKILL.md document in response.
 *   3. Validates the format via skill_validator.
 *   4. Writes to .agents/skills/<name>/SKILL.md.
 *
 * Uses the same REST API pattern as ArchitectClient (not GeminiAgent),
 * because SKILL generation needs free-text output, not structured JSON.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validateSkillFile } from "./skill_validator";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface SkillSpec {
  /** Snake-case name, used as directory name: e.g. "probabilistic-ramsey" */
  name: string;
  /** One-line description that goes in the frontmatter */
  description: string;
  /** The problem the agent will solve to generate the SKILL content */
  problemToSolve: string;
  /** The key mathematical technique to distill */
  expectedTechnique: string;
  /** Textbook / paper reference for the technique */
  sourceHint: string;
}

export interface SkillBuildResult {
  name: string;
  path: string;
  valid: boolean;
  errors: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Thin Gemini REST client (free-text, not structured JSON)
// ──────────────────────────────────────────────────────────────────────────

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

function extractJSON(raw: string): string {
  const match = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match?.[1]?.trim() ?? raw.trim();
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  retries = 3,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  };

  let lastErr = "";
  for (let i = 1; i <= retries; i++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const body = (await resp.json()) as GeminiApiResponse;
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) throw new Error("Empty Gemini response");
      return text;
    } catch (e: any) {
      lastErr = e.message;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw new Error(`Gemini failed after ${retries} attempts: ${lastErr}`);
}

// ──────────────────────────────────────────────────────────────────────────
// SkillBuilder
// ──────────────────────────────────────────────────────────────────────────

const SKILL_SYSTEM_PROMPT = `You are an expert mathematical research agent and technical writer.
Your task is to produce a reusable SKILL.md document that precisely captures a mathematical proof technique.
The document must be self-contained: a future automated agent reading only this file should be able to apply the technique.
Return ONLY the raw markdown content (no prose wrapping, no explanation), starting with the YAML frontmatter block.`;

export class SkillBuilder {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.5-flash",
    private readonly skillsRoot = ".agents/skills",
  ) {}

  /**
   * Builds a single SKILL.md from a spec.
   *
   * @throws if Gemini returns content that fails validation after retries
   */
  async buildSkill(spec: SkillSpec): Promise<SkillBuildResult> {
    const skillDir = join(this.skillsRoot, spec.name);
    await mkdir(skillDir, { recursive: true });

    const prompt = `${SKILL_SYSTEM_PROMPT}

---

SKILL Name: ${spec.name}
Description: ${spec.description}
Problem to solve: ${spec.problemToSolve}
Key technique: ${spec.expectedTechnique}
Source reference: ${spec.sourceHint}

Produce a SKILL.md document with this EXACT structure (do not add or remove sections):

---
name: ${spec.name}
description: ${spec.description}
---

# ${spec.name}

## Technique
[Precise, formal description of the mathematical technique — 2–4 paragraphs. Include key theorems and conditions.]

## When to Apply
[Specific conditions under which this technique is applicable. Be concrete — mention problem classes, graph sizes, energy levels, etc.]

## Worked Example
[Full, worked solution to: ${spec.problemToSolve}
Include all intermediate steps. Do not skip algebra or proof steps.]

## Lean 4 Template
\`\`\`lean
-- Boilerplate Lean 4 code demonstrating how to encode this technique
\`\`\`

## TypeScript Template
\`\`\`typescript
// Boilerplate TypeScript/Bun code demonstrating how to apply this technique
\`\`\`

## Key References
- [Author YYYY] Title. Journal/Conference. DOI or URL.
(2–5 well-chosen citations)
`;

    const content = await callGemini(this.apiKey, this.model, prompt);
    const { valid, errors } = validateSkillFile(content);

    const skillPath = join(skillDir, "SKILL.md");
    await writeFile(skillPath, content, "utf-8");
    console.log(`[SkillBuilder] Wrote ${skillPath} (valid=${valid})`);

    if (!valid) {
      console.warn(`[SkillBuilder] Validation warnings for "${spec.name}":\n  ${errors.join("\n  ")}`);
    }

    return { name: spec.name, path: skillPath, valid, errors };
  }

  /**
   * Builds multiple SKILLs sequentially.
   * Logs failures but does not abort the batch.
   */
  async buildAll(specs: SkillSpec[]): Promise<SkillBuildResult[]> {
    const results: SkillBuildResult[] = [];
    for (const spec of specs) {
      try {
        results.push(await this.buildSkill(spec));
      } catch (err: any) {
        console.error(`[SkillBuilder] Failed to build "${spec.name}": ${err.message}`);
        results.push({
          name: spec.name,
          path: join(this.skillsRoot, spec.name, "SKILL.md"),
          valid: false,
          errors: [err.message],
        });
      }
    }
    return results;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Priority SKILLs for the R(4,6) search
// ──────────────────────────────────────────────────────────────────────────

export const RAMSEY_SKILL_SPECS: SkillSpec[] = [
  {
    name: "probabilistic-ramsey",
    description: "Probabilistic lower bounds for Ramsey numbers via the Lovász Local Lemma",
    problemToSolve: "Derive a lower bound for R(k, k) using the probabilistic method with the LLL",
    expectedTechnique: "Lovász Local Lemma applied to random 2-colorings of complete graphs",
    sourceHint: "Alon & Spencer, The Probabilistic Method, Chapter 5; Erdős & Hajnal 1967",
  },
  {
    name: "paley-construction",
    description: "Using Paley graphs as explicit circulant witnesses for Ramsey lower bounds",
    problemToSolve: "Construct the Paley graph P(q) for a prime power q ≡ 1 (mod 4) and verify it witnesses R(k, q/(k-1)) for suitable k",
    expectedTechnique: "Paley graphs: vertices = F_q, edges = quadratic residues; self-complementary, no large clique",
    sourceHint: "Exoo 1989; Graham, Rothschild, Spencer — Ramsey Theory, Chapter 3",
  },
  {
    name: "flag-algebra-basics",
    description: "Introduction to Razborov's flag algebra method for Ramsey upper bounds",
    problemToSolve: "Use flag algebras to derive an upper bound for R(4,4) by formulating the SDP relaxation",
    expectedTechnique: "Flag algebra: represent densities of small graphs as vectors, apply SDP to bound forbidden density",
    sourceHint: "Razborov 2007, Flag Algebras, JACM; Baber & Talbot 2011",
  },
  {
    name: "energy-landscape-sa",
    description: "Simulated Annealing cooling schedule design for combinatorial graph problems",
    problemToSolve: "Design an SA schedule for 2-coloring K_35 with R(4,6) energy function that avoids glass floor stagnation",
    expectedTechnique: "Non-monotonic reheat on stagnation: T_r = max(1, E_best^(2/5)); doubling stagnation window; physical core clamping",
    sourceHint: "Kirkpatrick, Gelatt & Vecchi 1983; Marinari & Parisi 1992 (simulated tempering)",
  },
];
