// @ts-nocheck — Depends on unimplemented modules (graph6, cycle_finder)
/**
 * Sprint 21: General Solver Pipeline — Streaming Frontier Verifier
 *
 * Streams non-isomorphic graphs from nauty/geng directly into a TypeScript
 * CycleFinder via Bun's native subprocess API. This decouples graph generation
 * (C-level symmetry breaking) from constraint verification (bounded DFS).
 *
 * Usage:
 *   brew install nauty
 *   bun run src/scripts/run_frontier.ts 10
 *   for n in {10..18}; do bun run src/scripts/run_frontier.ts $n; done
 */

import { Graph6Decoder } from "../math/graph6";
import { CycleFinder } from "../math/cycle_finder";
import * as fs from "node:fs/promises";
import { join } from "node:path";

const targetN = parseInt(process.argv[2] || "10", 10);

async function verifyFrontier(n: number) {
  console.log("═══════════════════════════════════════════════");
  console.log("  🔬 ERDŐS-GYÁRFÁS GENERAL SOLVER PIPELINE");
  console.log(`  n = ${n} vertices, min degree ≥ 3`);
  console.log("  Engine: nauty/geng (C) → Graph6 → CycleFinder (TS)");
  console.log("═══════════════════════════════════════════════\n");

  const startTime = performance.now();

  // Spawn geng: -d3 (min degree 3), -q (quiet), n vertices
  const proc = Bun.spawn(["geng", "-d3", "-q", n.toString()], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let graphsChecked = 0;
  let counterexample: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const g6 = line.trim();
      if (!g6) continue;

      const adj = Graph6Decoder.decode(g6);
      graphsChecked++;

      if (!CycleFinder.hasPowerOfTwoCycle(adj)) {
        counterexample = g6;
        proc.kill();
        break;
      }

      if (graphsChecked % 50_000 === 0) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        const rate = Math.round(graphsChecked / ((performance.now() - startTime) / 1000));
        console.log(`  ... ${graphsChecked.toLocaleString().padStart(12)} graphs verified (${rate.toLocaleString()}/s, ${elapsed}s) ...`);
      }
    }

    if (counterexample) break;
  }

  await proc.exited;

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  const rate = Math.round(graphsChecked / ((performance.now() - startTime) / 1000));

  console.log("\n═══════════════════════════════════════════════");
  if (counterexample) {
    const adj = Graph6Decoder.decode(counterexample);
    const degrees = adj.map((a) => a.length);
    console.log(`  🚨 COUNTEREXAMPLE FOUND AT n=${n}`);
    console.log(`  Graph6: ${counterexample}`);
    console.log(`  Degrees: [${degrees}]`);
    console.log(`  Edges: ${adj.reduce((s, a) => s + a.length, 0) / 2}`);
  } else {
    console.log(`  ✅ VERIFIED n=${n}: All ${graphsChecked.toLocaleString()} graphs satisfy the conjecture.`);
    console.log(`  ⏱️  ${elapsed}s (${rate.toLocaleString()} graphs/s)`);
  }
  console.log("═══════════════════════════════════════════════\n");

  // Append result to JSONL log
  const result = {
    n,
    status: counterexample ? "counterexample" : "verified",
    graphs_checked: graphsChecked,
    elapsed_seconds: parseFloat(elapsed),
    rate_per_second: rate,
    counterexample_g6: counterexample,
    timestamp: new Date().toISOString(),
  };

  const dataDir = join(import.meta.dir, "../../data");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(
    join(dataDir, "frontier_results.jsonl"),
    JSON.stringify(result) + "\n",
  );
}

verifyFrontier(targetN).catch((err) => {
  console.error("💥 General Solver failed:", err);
  process.exit(1);
});
