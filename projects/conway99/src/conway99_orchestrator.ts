/**
 * Conway 99 Multi-Core Orchestrator — Island Model
 *
 * Spawns N independent Web Worker islands, each running the 499K IPS
 * IncrementalSRGEngine. Maintains a live ANSI dashboard showing all
 * workers' status, global best energy, and aggregate IPS.
 *
 * Usage:
 *   bun run projects/conway99/src/conway99_orchestrator.ts
 *   bun run projects/conway99/src/conway99_orchestrator.ts --workers 8
 *   bun run projects/conway99/src/conway99_orchestrator.ts --duration 3600
 */

import { cpus } from "node:os";
import { join } from "node:path";
import { OrchestratorState } from "./conway99_orchestrator_state";

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(name: string, def: number): number {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]!, 10) : def;
}

const NUM_WORKERS = getArg("workers", cpus().length);
const DURATION_S = getArg("duration", 0); // 0 = infinite
const STATE_DIR = join(import.meta.dir, "../data/best_states");

// ── State ──
const orch = new OrchestratorState(STATE_DIR);
const startTime = performance.now();
let totalNewBests = 0;
let dashboardInterval: ReturnType<typeof setInterval>;

// ── ANSI Dashboard ──
function renderDashboard(): void {
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  const aggIPS = orch.getAggregateIPS();
  const workerIds = orch.getWorkerIds();

  // Move cursor to top and clear
  process.stdout.write("\x1b[H\x1b[2J");

  const lines: string[] = [];
  lines.push("╔═══════════════════════════════════════════════════════════════╗");
  lines.push("║  🔍 CONWAY 99 — MULTI-CORE ISLAND MODEL                     ║");
  lines.push(`║  Target: SRG(99, 14, 1, 2) | Workers: ${String(NUM_WORKERS).padStart(2)}                    ║`);
  lines.push(`║  Elapsed: ${elapsed.padStart(8)}s | Global IPS: ${aggIPS.toLocaleString().padStart(12)}        ║`);
  lines.push(`║  Global Best: ${String(orch.globalBestEnergy === Infinity ? "—" : orch.globalBestEnergy).padStart(6)} | Saves: ${String(totalNewBests).padStart(4)}                       ║`);
  lines.push("╠═══════════════════════════════════════════════════════════════╣");
  lines.push("║  ID │   Energy │     Best │     Temp │        IPS │     Iter ║");
  lines.push("║─────┼──────────┼──────────┼──────────┼────────────┼──────────║");

  for (const id of workerIds) {
    const w = orch.getWorkerStatus(id);
    if (!w) continue;
    const e = String(w.energy).padStart(8);
    const b = String(w.iter > 0 ? "—" : "—").padStart(8);
    const t = w.temp.toFixed(2).padStart(8);
    const ips = w.ips.toLocaleString().padStart(10);
    const it = (w.iter / 1_000_000).toFixed(1).padStart(6) + "M";
    lines.push(`║  ${String(id).padStart(2)} │ ${e} │ ${b} │ ${t} │ ${ips} │ ${it} ║`);
  }

  lines.push("╚═══════════════════════════════════════════════════════════════╝");
  console.log(lines.join("\n"));
}

// ── Spawn workers ──
const workers: Worker[] = [];

function spawnWorker(workerId: number): void {
  const worker = new Worker(join(import.meta.dir, "conway99_worker.ts"));

  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data;

    switch (msg.type) {
      case "READY":
        // Worker initialized
        break;

      case "HEARTBEAT":
        orch.processHeartbeat(
          msg.workerId,
          msg.energy,
          msg.temp,
          msg.ips,
          msg.iter,
        );
        break;

      case "NEW_BEST": {
        const isGlobal = orch.processNewBest(msg.workerId, msg.energy, msg.state);
        if (isGlobal) {
          totalNewBests++;
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          // Force a dashboard refresh on global best
          renderDashboard();
          console.log(
            `  🌟 NEW GLOBAL BEST: E=${msg.energy} (worker ${msg.workerId}, ${elapsed}s)`,
          );
        }
        break;
      }

      case "SOLUTION": {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        clearInterval(dashboardInterval);

        console.log("\n");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`  🏆 SRG(99, 14, 1, 2) FOUND BY WORKER ${msg.workerId} 🏆`);
        console.log(`  Elapsed: ${elapsed}s | Iteration: ${msg.iter.toLocaleString()}`);
        console.log("═══════════════════════════════════════════════════════════════");

        // Persist the solution
        orch.processNewBest(msg.workerId, 0, msg.state);

        // Terminate all workers
        for (const w of workers) w.terminate();
        process.exit(0);
      }
    }
  };

  worker.onerror = (err) => {
    console.error(`Worker ${workerId} error:`, err);
  };

  worker.postMessage({ workerId });
  workers.push(worker);
}

// ── Main ──
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  🔍 CONWAY 99 — MULTI-CORE ISLAND MODEL`);
console.log(`  Target: SRG(99, 14, 1, 2)`);
console.log(`  Workers: ${NUM_WORKERS} | Duration: ${DURATION_S > 0 ? DURATION_S + "s" : "∞"}`);
console.log(`  Engine: IncrementalSRGEngine (path-based O(k) delta)`);
console.log(`  Schedule: T₀=100, α=0.99999, reheat=E^0.4`);
console.log(`  State dir: ${STATE_DIR}`);
console.log("═══════════════════════════════════════════════════════════════\n");
console.log("  Spawning workers...\n");

for (let i = 0; i < NUM_WORKERS; i++) {
  spawnWorker(i);
}

// Dashboard refresh every 2 seconds
dashboardInterval = setInterval(renderDashboard, 2000);

// Duration limit
if (DURATION_S > 0) {
  setTimeout(() => {
    clearInterval(dashboardInterval);
    renderDashboard();
    console.log(`\n  ⏱  Duration limit reached (${DURATION_S}s). Shutting down.`);
    console.log(`  🏆 Global best energy: ${orch.globalBestEnergy}`);
    console.log(`  💾 States saved: ${totalNewBests}\n`);

    for (const w of workers) w.terminate();
    process.exit(0);
  }, DURATION_S * 1000);
}

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  clearInterval(dashboardInterval);
  console.log(`\n\n  Shutting down gracefully...`);
  console.log(`  🏆 Global best energy: ${orch.globalBestEnergy}`);
  console.log(`  💾 States saved: ${totalNewBests}\n`);

  for (const w of workers) w.terminate();
  process.exit(0);
});
