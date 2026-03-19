/**
 * auto_curriculum.ts — Autonomous conjecture generation & search loop.
 *
 * The Auto-Curriculum Daemon reads the verified_lib/ to identify what
 * has already been proven, asks the Gemini Architect for 3 strictly harder
 * incremental conjectures (e.g., R(4,6) >= 36 → R(4,6) >= 37), and runs
 * the full SA orchestrator on each one in sequence.
 *
 * Activated via: ./perqed --daemon
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import { orchestratedSearch, type OrchestratedSearchConfig } from "../search/ramsey_orchestrator";

// ── Defaults ───────────────────────────────────────────────────────────────

const DAEMON_SLEEP_MS = 60_000;    // 60 s between conjecture batches
const CONJECTURE_COUNT = 3;        // how many harder problems to propose per cycle
const MAX_SA_ITERATIONS = 5_000_000; // SA budget per conjecture

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProposedConjecture {
  goal: string; // e.g. "R(4,6) >= 37"
  n: number;
  r: number;
  s: number;
}

export interface DaemonConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  verifiedLibDir?: string;
  daemonSleepMs?: number;
  maxSAIterations?: number;
  /** Override for tests — if provided, daemon runs exactly once and resolves */
  singleShot?: boolean;
}

// ── Gemini conjecture proposer ─────────────────────────────────────────────

async function proposeNextConjectures(
  apiKey: string,
  model: string,
  baseUrl: string,
  provenGoals: string[],
): Promise<ProposedConjecture[]> {
  const knowledgeBlock =
    provenGoals.length > 0
      ? `Proven so far:\n${provenGoals.map(g => `  - ${g}`).join("\n")}`
      : "No goals proven yet — start from R(4,6) >= 36.";

  const prompt = [
    "You are an autonomous mathematical research daemon.",
    "Your task is to propose 3 strictly harder Ramsey number conjectures to attempt next.",
    "",
    knowledgeBlock,
    "",
    `Output ONLY a JSON array of exactly ${CONJECTURE_COUNT} objects, each with fields:`,
    `  { "goal": "R(r,s) >= N", "n": <integer>, "r": <integer>, "s": <integer> }`,
    "Order from easiest to hardest. Increment N by 1 for the first conjecture.",
    "Return raw JSON only — no markdown, no prose.",
  ].join("\n");

  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status} in daemon`);
  const json = (await res.json()) as any;
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/```\s*$/m, "").trim();
  return JSON.parse(cleaned) as ProposedConjecture[];
}

// ── Verified library scanner ───────────────────────────────────────────────

async function readProvenGoals(verifiedLibDir: string): Promise<string[]> {
  if (!existsSync(verifiedLibDir)) return [];
  try {
    const files = await readdir(verifiedLibDir);
    const goals: string[] = [];
    for (const f of files) {
      if (extname(f) !== ".json") continue;
      try {
        const raw = await readFile(join(verifiedLibDir, f), "utf-8");
        const obj = JSON.parse(raw);
        if (obj?.goal) goals.push(obj.goal as string);
      } catch { /* skip corrupt files */ }
    }
    return goals;
  } catch {
    return [];
  }
}

// ── Main daemon loop ───────────────────────────────────────────────────────

export class AutoCurriculumDaemon {
  private readonly config: Required<DaemonConfig>;

  constructor(config: DaemonConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? "gemini-2.5-pro",
      baseUrl: config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
      verifiedLibDir: config.verifiedLibDir ?? "verified_lib",
      daemonSleepMs: config.daemonSleepMs ?? DAEMON_SLEEP_MS,
      maxSAIterations: config.maxSAIterations ?? MAX_SA_ITERATIONS,
      singleShot: config.singleShot ?? false,
    };
  }

  /**
   * Start the autonomous research loop.
   * Loops forever (until process signal) unless singleShot=true.
   */
  async run(): Promise<void> {
    console.log("🤖 [AutoCurriculumDaemon] Starting autonomous research loop...");

    while (true) {
      try {
        await this._cycle();
      } catch (err) {
        console.error(`[AutoCurriculumDaemon] Cycle error: ${err}`);
      }

      if (this.config.singleShot) {
        console.log("[AutoCurriculumDaemon] Single-shot mode — exiting loop.");
        return;
      }

      console.log(`[AutoCurriculumDaemon] Sleeping ${this.config.daemonSleepMs}ms before next cycle...`);
      await Bun.sleep(this.config.daemonSleepMs);
    }
  }

  private async _cycle(): Promise<void> {
    // 1. Read what's proven
    const provenGoals = await readProvenGoals(this.config.verifiedLibDir);
    console.log(`[AutoCurriculumDaemon] Proven goals: ${provenGoals.length}`);

    // 2. Ask Gemini for harder conjectures
    let conjectures: ProposedConjecture[];
    try {
      conjectures = await proposeNextConjectures(
        this.config.apiKey,
        this.config.model,
        this.config.baseUrl,
        provenGoals,
      );
    } catch (err) {
      console.warn(`[AutoCurriculumDaemon] Conjecture generation failed: ${err}`);
      // Fallback: standard R(4,6) progression
      conjectures = [
        { goal: "R(4,6) >= 36", n: 35, r: 4, s: 6 },
        { goal: "R(4,6) >= 37", n: 36, r: 4, s: 6 },
        { goal: "R(4,6) >= 38", n: 37, r: 4, s: 6 },
      ];
    }

    console.log(`[AutoCurriculumDaemon] Proposed ${conjectures.length} conjectures:`);
    for (const c of conjectures) console.log(`  → ${c.goal}`);

    // 3. Run SA on each conjecture in sequence
    for (const conjecture of conjectures) {
      console.log(`\n[AutoCurriculumDaemon] Attempting: ${conjecture.goal}`);
      try {
        const searchConfig: OrchestratedSearchConfig = {
          n: conjecture.n,
          r: conjecture.r,
          s: conjecture.s,
          saIterations: this.config.maxSAIterations,
          strategy: "island_model",
          workers: 4,
          seed: "paley",
          onProgress: (w, iter, energy, best, temp) => {
            if (iter % 500_000 === 0) {
              process.stdout.write(
                `\r[W${w}] iter=${iter.toLocaleString()} E=${energy} best=${best} T=${temp.toFixed(4)}   `
              );
            }
          },
        };

        const result = await orchestratedSearch(searchConfig);
        console.log(`\n[AutoCurriculumDaemon] ${conjecture.goal} → best E=${result.best.bestEnergy}`);

        if (result.best.bestEnergy === 0) {
          console.log(`🎯 [AutoCurriculumDaemon] WITNESS FOUND for ${conjecture.goal}!`);
          // TODO: write to verified_lib/
        }
      } catch (err) {
        console.error(`[AutoCurriculumDaemon] Search failed for ${conjecture.goal}: ${err}`);
      }
    }
  }
}
