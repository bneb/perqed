/**
 * Tests for Conway 99 multi-core orchestrator.
 *
 * Verifies:
 * - State persistence: NEW_BEST messages correctly serialize to disk
 * - Message handling: heartbeats aggregate correctly
 * - No concurrency errors under rapid fire
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

// We test the persistence logic directly, not through actual workers
import { OrchestratorState } from "../src/conway99_orchestrator_state";

const TEST_DIR = "/tmp/conway99_test_states";

describe("OrchestratorState", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("initializes with Infinity global best", () => {
    const orch = new OrchestratorState(TEST_DIR);
    expect(orch.globalBestEnergy).toBe(Infinity);
  });

  it("updates global best on lower energy", () => {
    const orch = new OrchestratorState(TEST_DIR);
    const state = new Uint8Array(99 * 99);
    const updated = orch.processNewBest(0, 5000, state);
    expect(updated).toBe(true);
    expect(orch.globalBestEnergy).toBe(5000);
  });

  it("rejects higher energy", () => {
    const orch = new OrchestratorState(TEST_DIR);
    const state = new Uint8Array(99 * 99);
    orch.processNewBest(0, 5000, state);
    const updated = orch.processNewBest(1, 6000, state);
    expect(updated).toBe(false);
    expect(orch.globalBestEnergy).toBe(5000);
  });

  it("persists state to disk on new global best", () => {
    const orch = new OrchestratorState(TEST_DIR);
    const state = new Uint8Array(99 * 99);
    // Set some non-zero values to verify data integrity
    state[0] = 1; state[100] = 1; state[9800] = 1;

    orch.processNewBest(0, 5000, state);

    const files = fs.readdirSync(TEST_DIR);
    expect(files.length).toBe(1);
    expect(files[0]!).toContain("E5000");

    // Verify data integrity
    const saved = JSON.parse(fs.readFileSync(path.join(TEST_DIR, files[0]!), "utf-8"));
    expect(saved.energy).toBe(5000);
    expect(saved.workerId).toBe(0);
    expect(saved.adjacency[0]).toBe(1);
    expect(saved.adjacency[100]).toBe(1);
  });

  it("persists multiple improving states", () => {
    const orch = new OrchestratorState(TEST_DIR);
    const state = new Uint8Array(99 * 99);

    orch.processNewBest(0, 5000, state);
    orch.processNewBest(1, 4500, state);
    orch.processNewBest(2, 4000, state);

    const files = fs.readdirSync(TEST_DIR);
    expect(files.length).toBe(3);
    expect(orch.globalBestEnergy).toBe(4000);
  });

  it("tracks heartbeats per worker", () => {
    const orch = new OrchestratorState(TEST_DIR);

    orch.processHeartbeat(0, 10000, 50.0, 500_000, 0);
    orch.processHeartbeat(1, 8000, 30.0, 480_000, 0);

    const w0 = orch.getWorkerStatus(0);
    expect(w0!.energy).toBe(10000);
    expect(w0!.ips).toBe(500_000);

    const w1 = orch.getWorkerStatus(1);
    expect(w1!.energy).toBe(8000);
  });

  it("survives rapid-fire NEW_BEST without errors", () => {
    const orch = new OrchestratorState(TEST_DIR);
    const state = new Uint8Array(99 * 99);

    // Simulate 100 rapid improving states from different workers
    for (let i = 0; i < 100; i++) {
      const energy = 10000 - i * 50;
      const workerId = i % 8;
      orch.processNewBest(workerId, energy, state);
    }

    expect(orch.globalBestEnergy).toBe(10000 - 99 * 50);
    const files = fs.readdirSync(TEST_DIR);
    expect(files.length).toBe(100);
  });

  it("computes aggregate IPS", () => {
    const orch = new OrchestratorState(TEST_DIR);

    orch.processHeartbeat(0, 10000, 50.0, 500_000, 0);
    orch.processHeartbeat(1, 8000, 30.0, 480_000, 0);
    orch.processHeartbeat(2, 9000, 40.0, 510_000, 0);

    expect(orch.getAggregateIPS()).toBe(1_490_000);
  });
});
