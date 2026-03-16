#!/usr/bin/env bun
/**
 * perqed — CLI Entry Point
 *
 * Two-phase architecture:
 *   Phase 1: --prompt → ARCHITECT produces run_config.json
 *   Phase 2: Runner reads run_config.json and executes the proof search
 *
 * Usage:
 *   bun run src/cli/perqed.ts --prompt="Ramsey lower bounds, R(3, 11)"
 *
 * Prerequisites:
 *   - GEMINI_API_KEY in environment or .env
 */

import { join } from "node:path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

function parseArgs(): { prompt: string } {
  const args = process.argv.slice(2);
  const promptArg = args.find((a) => a.startsWith("--prompt="));

  if (!promptArg) {
    console.error("Usage: perqed --prompt=\"<problem description>\"");
    console.error("Example: perqed --prompt=\"Ramsey lower bounds, R(3, 11)\"");
    process.exit(1);
  }

  return { prompt: promptArg.replace("--prompt=", "") };
}

// ──────────────────────────────────────────────
// Run Config Schema
// ──────────────────────────────────────────────

export interface RunConfig {
  /** Slug for the workspace run directory (e.g., "ramsey_r3_11_01") */
  run_name: string;
  /** Human-readable problem description */
  problem_description: string;
  /** Lean 4 theorem name */
  theorem_name: string;
  /** Lean 4 theorem signature (the type after `:=`) */
  theorem_signature: string;
  /** Max orchestrator iterations */
  max_iterations: number;
  /** Objective markdown for the workspace */
  objective_md: string;
  /** Domain skills markdown (problem-specific tips) */
  domain_skills_md: string;
}

const RUN_CONFIG_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    run_name: {
      type: SchemaType.STRING as const,
      description:
        "A lowercase_underscore slug for the workspace directory, e.g. 'ramsey_r3_11_01'",
    },
    problem_description: {
      type: SchemaType.STRING as const,
      description: "One-line human-readable description of the problem",
    },
    theorem_name: {
      type: SchemaType.STRING as const,
      description:
        "Valid Lean 4 identifier for the theorem, e.g. 'ramsey_R3_11_lower_bound'",
    },
    theorem_signature: {
      type: SchemaType.STRING as const,
      description:
        "The complete Lean 4 theorem signature after 'theorem <name>', including hypotheses and the goal. Must be valid Lean 4 syntax.",
    },
    max_iterations: {
      type: SchemaType.NUMBER as const,
      description: "Recommended max orchestrator iterations (10-50)",
    },
    objective_md: {
      type: SchemaType.STRING as const,
      description:
        "Full markdown content for objective.md. Should describe the problem, the proof strategy, and what success looks like.",
    },
    domain_skills_md: {
      type: SchemaType.STRING as const,
      description:
        "Problem-specific tips and tactics for the TACTICIAN. Include relevant Lean 4 tactics, common pitfalls, and mathematical context.",
    },
  },
  required: [
    "run_name",
    "problem_description",
    "theorem_name",
    "theorem_signature",
    "max_iterations",
    "objective_md",
    "domain_skills_md",
  ],
};

// ──────────────────────────────────────────────
// ARCHITECT Preamble
// ──────────────────────────────────────────────

const FORMULATION_PREAMBLE = `You are the Perqed Problem Formulator. A user has described a mathematical problem they want to prove in Lean 4.

Your job is to produce a structured run configuration that the Perqed proof engine can execute autonomously.

## What You Must Produce

1. **theorem_name**: A valid Lean 4 identifier (e.g., \`ramsey_R3_11_lower_bound\`)
2. **theorem_signature**: Valid Lean 4 type signature for the theorem. This is everything after \`theorem <name>\` and before \`:= by\`. It must type-check in Lean 4.
3. **objective_md**: A detailed markdown description of the problem for the TACTICIAN agents
4. **domain_skills_md**: Problem-specific tactical advice (which Lean tactics work for this class of problem, common pitfalls)
5. **max_iterations**: How many orchestrator iterations to budget

## Important Rules

- The theorem must be **formally expressible** in Lean 4 using Fin types, Bool functions, or Nat
- For graph theory problems, encode graphs as \`Fin n → Fin n → Bool\` (adjacency function)
- For Ramsey lower bounds, the theorem should state: "there exists a 2-coloring of K_n with no monochromatic K_r and no monochromatic independent set of size s"
- Break large problems into decidable finite instances when possible
- If the problem requires a witness (constructive existence), structure the theorem accordingly
- Include relevant Mathlib imports if needed, but prefer self-contained proofs

## Available Infrastructure

The Perqed engine has:
- Simulated Annealing search engine (graph-level, ~500K IPS)
- IncrementalSRGEngine with O(k) CN delta, triangle tracking, frozen anchors
- Multi-core Island Model orchestrator (10 workers, ~3.2M IPS)
- Lean 4 kernel verification via \`decide\` tactic
- DeepSeek Prover (local) + Gemini (cloud) multi-agent tactic search

## The User's Problem Description

`;

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  const { prompt } = parseArgs();

  console.log("═══════════════════════════════════════════════");
  console.log("  🧠 PERQED — Problem Formulation Phase");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Prompt: "${prompt}"`);
  console.log("═══════════════════════════════════════════════\n");

  // 1. Get Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set. Export it or add to .env");
    process.exit(1);
  }

  // 2. Call ARCHITECT for problem formulation
  console.log("🏛️  Asking ARCHITECT to formulate the problem...\n");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      "You are the Perqed Problem Formulator. Output a structured JSON run configuration for the Perqed proof engine.",
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: RUN_CONFIG_SCHEMA as any,
    },
  });

  const fullPrompt = FORMULATION_PREAMBLE + prompt;

  let config: RunConfig;
  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    config = JSON.parse(text) as RunConfig;
  } catch (err) {
    console.error("❌ ARCHITECT failed to produce config:", err);
    process.exit(1);
  }

  // 3. Display the config
  console.log("✅ ARCHITECT produced run configuration:\n");
  console.log(`  Run Name:     ${config.run_name}`);
  console.log(`  Problem:      ${config.problem_description}`);
  console.log(`  Theorem:      ${config.theorem_name}`);
  console.log(`  Max Iters:    ${config.max_iterations}`);
  console.log(`  Signature:    ${config.theorem_signature.slice(0, 80)}...`);
  console.log();

  // 4. Write run_config.json to the workspace
  const workspaceBase = join(import.meta.dir, "../../agent_workspace");
  const configPath = join(workspaceBase, "runs", config.run_name, "run_config.json");
  const runDir = join(workspaceBase, "runs", config.run_name);

  const { mkdir } = await import("node:fs/promises");
  await mkdir(runDir, { recursive: true });
  await Bun.write(configPath, JSON.stringify(config, null, 2));

  console.log(`📁 Config written to: ${configPath}`);
  console.log();
  console.log("To execute this run:");
  console.log(`  GEMINI_API_KEY=... bun run src/cli/run.ts --config=${configPath}`);
  console.log();
  console.log("Or review the config first:");
  console.log(`  cat ${configPath}`);
}

main().catch((err) => {
  console.error("💥 Perqed formulation failed:", err);
  process.exit(1);
});
