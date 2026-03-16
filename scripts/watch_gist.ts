#!/usr/bin/env bun
/**
 * Perqed Gist Watcher
 *
 * Monitors the running R(4,6) search and updates the live status gist
 * every POLL_INTERVAL_MS. Writes to gist 66d185688c92067a1878666b311aab1a
 * (the one polled by perqed.com/minutiae).
 *
 * Usage:
 *   bun scripts/watch_gist.ts [pid]
 *   bun scripts/watch_gist.ts 92106
 */

import { join } from "path";
import { execSync } from "child_process";

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const GIST_ID = "66d185688c92067a1878666b311aab1a";
const RUN_DIR = join(import.meta.dir, "../agent_workspace/runs/ramsey_R4_6_lower_bound_36");
const SCRATCH_DIR = join(RUN_DIR, "scratch");
const TARGET_PID = parseInt(process.argv[2] ?? "0", 10);

const startTime = Date.now();

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function elapsedStr(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function getStatus(): Promise<object> {
  const elapsed = Date.now() - startTime;
  const alive = TARGET_PID > 0 ? isAlive(TARGET_PID) : false;

  // Check for witness
  const witnessPath = join(SCRATCH_DIR, "witness.json");
  let witnessFound = false;
  try {
    await Bun.file(witnessPath).json();
    witnessFound = true;
  } catch { /* not found */ }

  // Check lab log for latest lines
  let latestLog = "";
  try {
    const log = await Bun.file(join(RUN_DIR, "lab_log.md")).text();
    const lines = log.split("\n").filter(l => l.trim());
    latestLog = lines.slice(-3).join(" | ");
  } catch { /* no log yet */ }

  return {
    runId: "ramsey_R4_6_lower_bound_36",
    theorem: "R(4,6) ≥ 36",
    status: witnessFound ? "✅ PROVED" : alive ? "🔥 SEARCHING" : "💤 STOPPED",
    pid: TARGET_PID,
    alive,
    elapsedWallTime: elapsedStr(elapsed),
    witnessFound,
    target: "35 vertices, 8 workers × 500M iters, island_model",
    lastUpdated: new Date().toISOString(),
    latestLog: latestLog || "(search engine running — no tactic log yet)",
    history: [
      { agent: "ARCHITECT", success: true, note: "ramsey_coloring search_config extracted" },
      { agent: "SEARCH_ENGINE", success: witnessFound, note: "8-worker parallel SA, T=3.0→0" },
    ],
  };
}

async function updateGist(status: object): Promise<void> {
  const tmpPath = "/tmp/perqed_live_state.json";
  await Bun.write(tmpPath, JSON.stringify(status, null, 2));
  execSync(`gh gist edit ${GIST_ID} ${tmpPath}`);
}

async function poll(): Promise<void> {
  const status = await getStatus();
  const s = status as any;

  console.log(`[${new Date().toLocaleTimeString()}] ${s.status} | elapsed=${s.elapsedWallTime} | pid=${TARGET_PID} alive=${s.alive} | witness=${s.witnessFound}`);

  try {
    await updateGist(status);
    console.log(`  ✅ Gist updated`);
  } catch (err) {
    console.error(`  ❌ Gist update failed:`, err);
  }

  if (s.witnessFound) {
    console.log("\n🏆 WITNESS FOUND! Stopping watcher.");
    process.exit(0);
  }

  if (!s.alive && TARGET_PID > 0) {
    console.log("\n⚠️  Search process has exited. Doing final update and stopping watcher.");
    process.exit(0);
  }
}

console.log(`🔭 Perqed Gist Watcher started`);
console.log(`   Monitoring PID: ${TARGET_PID || "(none)"}`);
console.log(`   Poll interval: ${POLL_INTERVAL_MS / 60_000} minutes`);
console.log(`   Gist: https://gist.github.com/${GIST_ID}`);
console.log(`   Run dir: ${RUN_DIR}\n`);

// Immediate first poll
await poll();

// Then every POLL_INTERVAL_MS
setInterval(poll, POLL_INTERVAL_MS);
