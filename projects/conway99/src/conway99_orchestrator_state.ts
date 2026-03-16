/**
 * OrchestratorState — Testable state management for the multi-core orchestrator.
 *
 * Handles:
 * - Global best energy tracking
 * - State persistence to disk on new global bests
 * - Per-worker heartbeat tracking
 * - Aggregate IPS computation
 */

import * as fs from "node:fs";
import { join } from "node:path";

interface WorkerStatus {
  energy: number;
  temp: number;
  ips: number;
  iter: number;
  lastUpdate: number;
}

export class OrchestratorState {
  globalBestEnergy: number = Infinity;
  private stateDir: string;
  private workers: Map<number, WorkerStatus> = new Map();

  constructor(stateDir: string) {
    this.stateDir = stateDir;
    fs.mkdirSync(stateDir, { recursive: true });
  }

  /**
   * Process a NEW_BEST message from a worker.
   * Returns true if this is a new global best.
   */
  processNewBest(workerId: number, energy: number, adjacency: Uint8Array): boolean {
    if (energy >= this.globalBestEnergy) return false;

    this.globalBestEnergy = energy;

    // Persist to disk
    const timestamp = Date.now();
    const filename = `conway99_E${energy}_w${workerId}_${timestamp}.json`;
    const filepath = join(this.stateDir, filename);

    const data = JSON.stringify({
      type: "SRG(99, 14, 1, 2)",
      energy,
      workerId,
      timestamp: new Date(timestamp).toISOString(),
      adjacency: Array.from(adjacency),
    });

    fs.writeFileSync(filepath, data);
    return true;
  }

  /** Process a HEARTBEAT message from a worker. */
  processHeartbeat(workerId: number, energy: number, temp: number, ips: number, iter: number): void {
    this.workers.set(workerId, {
      energy,
      temp,
      ips,
      iter,
      lastUpdate: Date.now(),
    });
  }

  /** Get status for a specific worker. */
  getWorkerStatus(workerId: number): WorkerStatus | undefined {
    return this.workers.get(workerId);
  }

  /** Sum of all workers' latest IPS values. */
  getAggregateIPS(): number {
    let total = 0;
    for (const w of this.workers.values()) {
      total += w.ips;
    }
    return total;
  }

  /** Get all worker IDs, sorted. */
  getWorkerIds(): number[] {
    return Array.from(this.workers.keys()).sort((a, b) => a - b);
  }
}
