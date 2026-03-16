#!/usr/bin/env bun
/**
 * perqed — CLI Entry Point (Single Flow)
 *
 * Formulate → Confirm → Run in one command.
 *
 * Usage:
 *   bun run perqed -- --prompt="Ramsey lower bounds, R(4, 6) >= 37"
 *   bun run perqed -- --prompt="..." --noconfirm    # skip confirmation
 *   bun run perqed -- --config=path/to/run_config.json  # resume from config
 *
 * Prerequisites:
 *   - GEMINI_API_KEY in environment or .env
 */

import { join } from "node:path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { WorkspaceManager } from "../workspace";
import { SolverBridge } from "../solver";
import { LeanBridge } from "../lean_bridge";
import { AgentFactory } from "../agents/factory";
import { runDynamicLoop } from "../orchestrator";
import { ramseySearch, adjToMatrix, type RamseySearchConfig } from "../search/ramsey_worker";
import { generateRamseyLean } from "../codegen/lean_codegen";
import { TreePrinter } from "../utils/tree_printer";

// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

interface CliArgs {
  prompt?: string;
  configPath?: string;
  noconfirm: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const promptArg = args.find((a) => a.startsWith("--prompt="));
  const configArg = args.find((a) => a.startsWith("--config="));
  const noconfirm = args.includes("--noconfirm");

  if (!promptArg && !configArg) {
    console.error("Usage:");
    console.error("  perqed --prompt=\"<problem description>\"");
    console.error("  perqed --config=<path/to/run_config.json>");
    console.error("  perqed --prompt=\"...\" --noconfirm");
    process.exit(1);
  }

  return {
    prompt: promptArg?.replace("--prompt=", ""),
    configPath: configArg?.replace("--config=", ""),
    noconfirm,
  };
}

// ──────────────────────────────────────────────
// Run Config Schema
// ──────────────────────────────────────────────

export interface SearchPhase {
  type: "ramsey_sa";
  /** Number of vertices */
  vertices: number;
  /** Clique size (red) */
  r: number;
  /** Independent set size (blue) */
  s: number;
  /** Number of SA iterations (default: 10M) */
  sa_iterations?: number;
}

export interface RunConfig {
  run_name: string;
  problem_description: string;
  theorem_name: string;
  theorem_signature: string;
  max_iterations: number;
  objective_md: string;
  domain_skills_md: string;
  /** If present, run a search phase before Lean proof */
  search_phase?: SearchPhase;
}

const SEARCH_PHASE_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    type: { type: SchemaType.STRING as const, enum: ["ramsey_sa"] },
    vertices: { type: SchemaType.NUMBER as const, description: "Number of vertices in the graph" },
    r: { type: SchemaType.NUMBER as const, description: "Clique size (red)" },
    s: { type: SchemaType.NUMBER as const, description: "Independent set size (blue)" },
    sa_iterations: { type: SchemaType.NUMBER as const, description: "SA iterations (default 10M)" },
  },
  required: ["type", "vertices", "r", "s"],
};

const RUN_CONFIG_SCHEMA = {
  type: SchemaType.OBJECT as const,
  properties: {
    run_name: {
      type: SchemaType.STRING as const,
      description: "A lowercase_underscore slug for the workspace directory",
    },
    problem_description: {
      type: SchemaType.STRING as const,
      description: "One-line human-readable description of the problem",
    },
    theorem_name: {
      type: SchemaType.STRING as const,
      description: "Valid Lean 4 identifier for the theorem",
    },
    theorem_signature: {
      type: SchemaType.STRING as const,
      description: "Complete Lean 4 theorem signature (after 'theorem <name>'). Must be valid Lean 4 syntax.",
    },
    max_iterations: {
      type: SchemaType.NUMBER as const,
      description: "Recommended max orchestrator iterations (10-50)",
    },
    objective_md: {
      type: SchemaType.STRING as const,
      description: "Full markdown for objective.md — problem description, proof strategy, success criteria.",
    },
    domain_skills_md: {
      type: SchemaType.STRING as const,
      description: "Problem-specific tips and tactics for the TACTICIAN.",
    },
    search_phase: {
      ...SEARCH_PHASE_SCHEMA,
      description: "REQUIRED for constructive existence proofs (e.g., Ramsey lower bounds). Describes the SA search to find the witness graph before Lean verification.",
    },
  },
  required: [
    "run_name", "problem_description", "theorem_name",
    "theorem_signature", "max_iterations", "objective_md", "domain_skills_md",
  ],
};

// ──────────────────────────────────────────────
// ARCHITECT Preamble
// ──────────────────────────────────────────────

const FORMULATION_PREAMBLE = `You are the Perqed Problem Formulator. A user has described a mathematical problem they want to prove in Lean 4.

Your job is to produce a structured run configuration that the Perqed proof engine can execute autonomously.

## What You Must Produce

1. **theorem_name**: A valid Lean 4 identifier (e.g., \`ramsey_R4_6_lower_bound_37\`)
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

## CRITICAL: When to Include search_phase

If the theorem is a **constructive existence proof** (starts with \`∃\`), the proof requires a **witness**.
For graph existence problems (Ramsey lower bounds, SRG existence, etc.), you MUST include a \`search_phase\` field.

Example for R(4,6) ≥ 37:
\`\`\`json
"search_phase": {
  "type": "ramsey_sa",
  "vertices": 36,
  "r": 4,
  "s": 6,
  "sa_iterations": 10000000
}
\`\`\`

The Perqed engine will:
1. Run SA search with the given parameters to find E=0 witness
2. Generate Lean 4 source with the witness hardcoded
3. Verify via \`decide\`

## The User's Problem Description

`;

// ──────────────────────────────────────────────
// Phase 1: Formulate
// ──────────────────────────────────────────────

async function formulate(prompt: string, apiKey: string): Promise<RunConfig> {
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

  const result = await model.generateContent(FORMULATION_PREAMBLE + prompt);
  return JSON.parse(result.response.text()) as RunConfig;
}

// ──────────────────────────────────────────────
// Phase 2: Confirm
// ──────────────────────────────────────────────

function displayConfig(config: RunConfig, configPath: string) {
  console.log("✅ ARCHITECT produced run configuration:\n");
  console.log(`  Run Name:  ${config.run_name}`);
  console.log(`  Problem:   ${config.problem_description}`);
  console.log(`  Theorem:   ${config.theorem_name}`);
  console.log(`  Budget:    ${config.max_iterations} iterations`);
  console.log(`  Signature: ${config.theorem_signature.slice(0, 100)}...`);
  if (config.search_phase) {
    const sp = config.search_phase;
    console.log(`  Search:    ${sp.type} — ${sp.vertices} vertices, R(${sp.r},${sp.s}), ${(sp.sa_iterations ?? 10_000_000).toLocaleString()} iters`);
  }
  console.log(`  Config:    ${configPath}`);
  console.log();
}

async function confirmOrAbort(): Promise<void> {
  console.log("Continue with this plan? [Y/n] (or use --noconfirm to skip)");
  process.stdout.write("> ");

  const response = await new Promise<string>((resolve) => {
    const handler = (chunk: Buffer) => {
      process.stdin.removeListener("data", handler);
      process.stdin.pause();
      resolve(chunk.toString().trim().toLowerCase());
    };
    process.stdin.resume();
    process.stdin.once("data", handler);
  });

  if (response && response !== "y" && response !== "yes") {
    console.log("\n🛑 Aborted. Config saved — re-run with --config= to resume.");
    process.exit(0);
  }
  console.log();
}

// ──────────────────────────────────────────────
// Phase 3: Run
// ──────────────────────────────────────────────

async function executeRun(config: RunConfig, apiKey: string): Promise<void> {
  const workspaceBase = join(import.meta.dir, "../../agent_workspace");
  const workspace = new WorkspaceManager(workspaceBase, config.run_name);
  await workspace.init();

  // Write objective + domain skills
  await Bun.write(workspace.paths.objective, config.objective_md);
  const skillsPath = join(workspace.paths.domainSkills, "problem_context.md");
  await Bun.write(skillsPath, config.domain_skills_md);

  console.log("═══════════════════════════════════════════════");
  console.log("  🔥 PERQED — Execution");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Workspace: ${workspace.paths.runDir}`);
  console.log("═══════════════════════════════════════════════\n");

  const startTime = Date.now();

  // ── Search Phase: Run SA to find witness ──
  if (config.search_phase) {
    const sp = config.search_phase;
    const iters = sp.sa_iterations ?? 10_000_000;

    console.log(`🔎 Search Phase: ${sp.type}`);
    console.log(`   Vertices: ${sp.vertices}, R(${sp.r},${sp.s}), ${iters.toLocaleString()} iterations\n`);

    const saConfig: RamseySearchConfig = {
      n: sp.vertices,
      r: sp.r,
      s: sp.s,
      maxIterations: iters,
      initialTemp: 2.0,
      coolingRate: 1 - (1 / iters),  // reach ~0.37 at end
      reheatTemp: 1.5,
      reheatAfter: 50000,
    };

    const result = ramseySearch(saConfig, (iter, energy, best, temp) => {
      const pct = ((iter / iters) * 100).toFixed(1);
      console.log(`   [${pct}%] iter=${iter.toLocaleString()} E=${energy} best=${best} T=${temp.toFixed(4)}`);
    });

    console.log(`\n   SA complete: best E=${result.bestEnergy}, ${result.ips.toLocaleString()} IPS`);

    if (result.witness) {
      console.log(`   🏆 WITNESS FOUND! E=0 at iteration ${result.iterations.toLocaleString()}\n`);

      // Save witness as JSON
      const matrix = adjToMatrix(result.witness);
      const witnessPath = join(workspace.paths.scratch, "witness.json");
      await Bun.write(witnessPath, JSON.stringify({ n: sp.vertices, r: sp.r, s: sp.s, adjacency: matrix }, null, 2));
      console.log(`   📁 Witness saved: ${witnessPath}`);

      // Generate Lean proof
      const leanSource = generateRamseyLean(config.theorem_name, sp.vertices, sp.r, sp.s, matrix);
      const leanPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.lean`);
      await Bun.write(leanPath, leanSource);
      console.log(`   📜 Lean proof generated: ${leanPath}`);
      console.log(`   ⏳ Verifying with Lean kernel...\n`);

      // Verify with Lean
      const proc = Bun.spawn(["lake", "env", "lean", leanPath], {
        cwd: workspaceBase + "/..",
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      if (exitCode === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log("══════════════════════════════════════════════");
        console.log(`  🏆 VERIFIED: ${config.theorem_name} proved in ${elapsed}s`);
        console.log(`  Witness: ${sp.vertices}-vertex graph, R(${sp.r},${sp.s}) ≥ ${sp.vertices + 1}`);
        console.log("══════════════════════════════════════════════\n");
        return;
      } else {
        console.log(`   ⚠️  Lean verification failed: ${stderr.slice(0, 200)}`);
        console.log(`   Falling back to tactic search...\n`);
      }
    } else {
      console.log(`   ❌ No witness found (best E=${result.bestEnergy})`);
      console.log(`   The search exhausted its budget. Try more iterations or a different approach.\n`);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log("══════════════════════════════════════════════");
      console.log(`  ❌ SEARCH EXHAUSTED after ${elapsed}s`);
      console.log(`  Best energy: ${result.bestEnergy}`);
      console.log("══════════════════════════════════════════════\n");
      return;
    }
  }

  // ── Tactic Phase: LLM-driven proof search (for non-constructive proofs) ──
  const factory = new AgentFactory({ geminiApiKey: apiKey });
  const solver = new SolverBridge();
  const lean = new LeanBridge();

  const result = await runDynamicLoop(workspace, solver, {
    maxGlobalIterations: config.max_iterations,
    maxLocalRetries: 3,
    leanBridge: lean,
    theoremName: config.theorem_name,
    theoremSignature: config.theorem_signature,
    agentFactory: factory,
    batchSize: 3,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n══════════════════════════════════════════════");
  if (result.status === "SOLVED") {
    console.log(`  🏆 SUCCESS: ${config.theorem_name} proved in ${elapsed}s`);
    const proofPath = join(workspace.paths.verifiedLib, `${config.theorem_name}.lean`);
    const proofFile = Bun.file(proofPath);
    if (await proofFile.exists()) {
      console.log(`\n📜 Verified proof:\n${await proofFile.text()}`);
    }
  } else {
    console.log(`  ❌ BUDGET EXHAUSTED after ${elapsed}s (${config.max_iterations} iters)`);
    console.log(`  Lab log: ${workspace.paths.labLog}`);
  }

  if (result.tree) {
    console.log(TreePrinter.print(result.tree));
  }
  console.log("══════════════════════════════════════════════\n");
}

// ──────────────────────────────────────────────
// Main — Single Flow
// ──────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set. Export it or add to .env");
    process.exit(1);
  }

  let config: RunConfig;
  let configPath: string;
  const workspaceBase = join(import.meta.dir, "../../agent_workspace");

  if (args.configPath) {
    // Resume from existing config
    const configFile = Bun.file(args.configPath);
    if (!(await configFile.exists())) {
      console.error(`❌ Config not found: ${args.configPath}`);
      process.exit(1);
    }
    config = await configFile.json();
    configPath = args.configPath;
  } else {
    // Phase 1: Formulate
    console.log("═══════════════════════════════════════════════");
    console.log("  🧠 PERQED — Problem Formulation");
    console.log("═══════════════════════════════════════════════");
    console.log(`  Prompt: "${args.prompt}"`);
    console.log("═══════════════════════════════════════════════\n");

    config = await formulate(args.prompt!, apiKey);
    configPath = join(workspaceBase, "runs", config.run_name, "run_config.json");

    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(workspaceBase, "runs", config.run_name), { recursive: true });
    await Bun.write(configPath, JSON.stringify(config, null, 2));
  }

  // Phase 2: Confirm
  displayConfig(config, configPath);

  if (!args.noconfirm) {
    await confirmOrAbort();
  } else {
    console.log("  (--noconfirm: skipping confirmation)\n");
  }

  // Phase 3: Run
  await executeRun(config, apiKey);
}

main().catch((err) => {
  console.error("💥 Perqed failed:", err);
  process.exit(1);
});
