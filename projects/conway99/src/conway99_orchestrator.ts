/**
 * SRG Multi-Core Orchestrator — Island Model
 *
 * Spawns N independent Web Worker islands targeting any SRG.
 * Live ANSI dashboard with triangle count and spectral anomaly detection.
 *
 * Usage:
 *   bun run projects/conway99/src/conway99_orchestrator.ts --spec conway99
 *   bun run projects/conway99/src/conway99_orchestrator.ts --spec gewirtz_56
 *   bun run projects/conway99/src/conway99_orchestrator.ts --spec gewirtz_56 --workers 8 --duration 600
 */

import { cpus } from "node:os";
import { join } from "node:path";
import * as fs from "node:fs";
import { OrchestratorState } from "./conway99_orchestrator_state";

// ── CLI args ──
const args = process.argv.slice(2);
function getArg(name: string, def: number): number {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1]!, 10) : def;
}
function getStringArg(name: string, def: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1]! : def;
}

// ── Load problem spec ──
const specName = getStringArg("spec", "conway99");
const specDir = join(import.meta.dir, "../problem_specs");
const specPath = join(specDir, `${specName}.json`);

let SRG_V = 99, SRG_K = 14, SRG_LAMBDA = 1, SRG_MU = 2;
let specLabel = "SRG(99, 14, 1, 2)";
let targetTriangles: number | null = null;
let specDescription = "Conway 99";

if (fs.existsSync(specPath)) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  SRG_V = spec.parameters.v;
  SRG_K = spec.parameters.k;
  SRG_LAMBDA = spec.parameters.lambda;
  SRG_MU = spec.parameters.mu;
  targetTriangles = spec.targetTriangles ?? null;
  specDescription = spec.name ?? specName;
  specLabel = `SRG(${SRG_V}, ${SRG_K}, ${SRG_LAMBDA}, ${SRG_MU})`;
}

const NUM_WORKERS = getArg("workers", cpus().length);
const DURATION_S = getArg("duration", 0);
const STATE_DIR = join(import.meta.dir, `../data/${specName}_states`);

// ── State ──
const orch = new OrchestratorState(STATE_DIR);
const startTime = performance.now();
let totalNewBests = 0;
let dashboardInterval: ReturnType<typeof setInterval>;
let globalBestTriangles = 0;

// ── ANSI Dashboard ──
function renderDashboard(): void {
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  const aggIPS = orch.getAggregateIPS();
  const workerIds = orch.getWorkerIds();

  process.stdout.write("\x1b[H\x1b[2J");

  const lines: string[] = [];
  lines.push("+" + "=".repeat(73) + "+");
  lines.push(`|  ${specDescription} — ${specLabel}`.padEnd(73) + " |");
  lines.push(`|  Workers: ${String(NUM_WORKERS).padStart(2)} | Elapsed: ${elapsed.padStart(8)}s | Global IPS: ${aggIPS.toLocaleString().padStart(12)}`.padEnd(73) + " |");
  lines.push(`|  Global Best: ${String(orch.globalBestEnergy === Infinity ? "---" : orch.globalBestEnergy).padStart(6)} | Triangles: ${String(globalBestTriangles).padStart(5)}${targetTriangles !== null ? ` (target: ${targetTriangles})` : ""} | Saves: ${String(totalNewBests).padStart(4)}`.padEnd(73) + " |");
  lines.push("+" + "-".repeat(73) + "+");
  lines.push(`|  ID |   Energy |    Tri |     Temp |        IPS |        Iter`.padEnd(73) + " |");
  lines.push("+" + "-".repeat(73) + "+");

  for (const id of workerIds) {
    const w = orch.getWorkerStatus(id);
    if (!w) continue;
    const e = String(w.energy).padStart(8);
    const tri = String((w as any).triangles ?? 0).padStart(6);
    const t = w.temp.toFixed(2).padStart(8);
    const ips = w.ips.toLocaleString().padStart(10);
    const it = (w.iter / 1_000_000).toFixed(1).padStart(8) + "M";

    // Anomaly detection: triangles hit target but E > 0
    let prefix = "|";
    if (targetTriangles !== null && (w as any).triangles === targetTriangles && w.energy > 0) {
      prefix = "|\x1b[32m"; // green
    }
    const suffix = prefix.includes("\x1b") ? "\x1b[0m |" : " |";

    lines.push(`${prefix}  ${String(id).padStart(2)} | ${e} | ${tri} | ${t} | ${ips} | ${it}`.padEnd(prefix.includes("\x1b") ? 73 + 9 : 73) + suffix);
  }

  lines.push("+" + "=".repeat(73) + "+");
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
        break;

      case "HEARTBEAT":
        orch.processHeartbeat(
          msg.workerId,
          msg.energy,
          msg.temp,
          msg.ips,
          msg.iter,
        );
        // Store triangles in worker status
        const ws = orch.getWorkerStatus(msg.workerId);
        if (ws) (ws as any).triangles = msg.triangles ?? 0;
        break;

      case "NEW_BEST": {
        const isGlobal = orch.processNewBest(msg.workerId, msg.energy, msg.state);
        if (isGlobal) {
          totalNewBests++;
          globalBestTriangles = msg.triangles ?? 0;
          renderDashboard();
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          console.log(
            `  NEW GLOBAL BEST: E=${msg.energy} T=${msg.triangles ?? "?"} (worker ${msg.workerId}, ${elapsed}s)`,
          );
        }
        break;
      }

      case "SOLUTION": {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        clearInterval(dashboardInterval);

        console.log("\n");
        console.log("=".repeat(65));
        console.log(`  ${specLabel} FOUND BY WORKER ${msg.workerId}`);
        console.log(`  Elapsed: ${elapsed}s | Iteration: ${msg.iter.toLocaleString()}`);
        console.log(`  Triangles: ${msg.triangles ?? "?"}`);
        console.log("=".repeat(65));

        orch.processNewBest(msg.workerId, 0, msg.state);
        for (const w of workers) w.terminate();
        process.exit(0);
      }
    }
  };

  worker.onerror = (err) => {
    console.error(`Worker ${workerId} error:`, err);
  };

  // Pass SRG parameters to worker
  worker.postMessage({
    workerId,
    v: SRG_V,
    k: SRG_K,
    lambda: SRG_LAMBDA,
    mu: SRG_MU,
    targetTriangles: targetTriangles ?? 0,
  });
  workers.push(worker);
}

// ── Main ──
console.log("=".repeat(65));
console.log(`  ${specDescription} — ${specLabel}`);
console.log(`  Workers: ${NUM_WORKERS} | Duration: ${DURATION_S > 0 ? DURATION_S + "s" : "infinite"}`);
console.log(`  Engine: IncrementalSRGEngine (path-based O(k) delta)`);
console.log(`  Schedule: T0=100, alpha=0.999995, reheat=E^0.4`);
if (targetTriangles !== null) console.log(`  Target triangles: ${targetTriangles}`);
console.log(`  State dir: ${STATE_DIR}`);
console.log("=".repeat(65) + "\n");
console.log("  Spawning workers...\n");

for (let i = 0; i < NUM_WORKERS; i++) {
  spawnWorker(i);
}

dashboardInterval = setInterval(renderDashboard, 2000);

if (DURATION_S > 0) {
  setTimeout(() => {
    clearInterval(dashboardInterval);
    renderDashboard();
    console.log(`\n  Duration limit reached (${DURATION_S}s). Shutting down.`);
    console.log(`  Global best energy: ${orch.globalBestEnergy}`);
    console.log(`  States saved: ${totalNewBests}\n`);
    for (const w of workers) w.terminate();
    process.exit(0);
  }, DURATION_S * 1000);
}

process.on("SIGINT", () => {
  clearInterval(dashboardInterval);
  console.log(`\n\n  Shutting down gracefully...`);
  console.log(`  Global best energy: ${orch.globalBestEnergy}`);
  console.log(`  States saved: ${totalNewBests}\n`);
  for (const w of workers) w.terminate();
  process.exit(0);
});
