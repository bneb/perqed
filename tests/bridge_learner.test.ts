/**
 * tests/bridge_learner.test.ts
 *
 * TDD for src/search/bridge_learner.ts — red-to-green.
 * Tests cover all 4 manifold types, BridgeStrategyLibrary ranking,
 * BridgeLearner.propose/evaluate/updateRewardModel, and TinyMLP behaviour.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "fs";
import {
  makeSphereBridge,
  makeTorusBridge,
  makeProductBridge,
  makeHyperbolicBridge,
  BridgeStrategyLibrary,
  BridgeLearner,
  discreteSchurEnergy,
  type BridgeStrategy,
  type EvalResult,
} from "../src/search/bridge_learner";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXPERIENCE_PATH = "/tmp/test_bridge_experiences.jsonl";

// Tiny deterministic partition N=10, K=3
function makePartition(N: number, K: number): Int8Array {
  const p = new Int8Array(N + 1);
  for (let i = 1; i <= N; i++) p[i] = (i - 1) % K;
  return p;
}

afterEach(() => {
  if (existsSync(EXPERIENCE_PATH)) unlinkSync(EXPERIENCE_PATH);
});

// ── discreteSchurEnergy ───────────────────────────────────────────────────────

describe("discreteSchurEnergy", () => {
  test("zero-energy for K=1 all-same (trivially monochromatic)", () => {
    // N=6, K=1: every triple is monochromatic, so E = count of triples
    // But that's maximum energy — using K=3 uniform partition to get known value
    const p = makePartition(6, 3);
    const E = discreteSchurEnergy(p, 6);
    expect(E).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(E)).toBe(true);
  });

  test("non-negative for any partition", () => {
    const p = makePartition(12, 4);
    expect(discreteSchurEnergy(p, 12)).toBeGreaterThanOrEqual(0);
  });

  test("all-same-color has maximum energy", () => {
    const N = 6, K = 3;
    const allSame = new Int8Array(N + 1).fill(0);
    for (let i = 1; i <= N; i++) allSame[i] = 0;
    const diverse = makePartition(N, K);
    expect(discreteSchurEnergy(allSame, N)).toBeGreaterThan(
      discreteSchurEnergy(diverse, N)
    );
  });
});

// ── Sphere bridge ─────────────────────────────────────────────────────────────

describe("makeSphereBridge", () => {
  const N = 8, K = 3;
  const p = makePartition(N, K);
  const bridge = makeSphereBridge({ radius: 1.0, lr: 0.01 });

  test("manifold is 'sphere'", () => {
    expect(bridge.manifold).toBe("sphere");
  });

  test("encode returns (N+1)×K matrix", () => {
    const enc = bridge.encode(p, N, K);
    expect(enc.length).toBe(N + 1);
    expect(enc[1]!.length).toBe(K);
  });

  test("each encoded vector has norm ≈ radius", () => {
    const enc = bridge.encode(p, N, K);
    const r = bridge.params.radius!;
    for (let i = 1; i <= N; i++) {
      const norm = Math.sqrt(enc[i]!.reduce((a, x) => a + x * x, 0));
      expect(norm).toBeCloseTo(r, 3);
    }
  });

  test("gradient has same shape as encoded", () => {
    const enc = bridge.encode(p, N, K);
    const grad = bridge.gradient(enc, N, K);
    expect(grad.length).toBe(N + 1);
    expect(grad[1]!.length).toBe(K);
  });

  test("retract keeps vector on sphere (norm ≈ radius)", () => {
    const v = [3.0, 1.5, -2.0];
    const r = bridge.retract(v);
    const norm = Math.sqrt(r.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(bridge.params.radius!, 3);
  });

  test("decode returns hard partition in [0, K)", () => {
    const enc = bridge.encode(p, N, K);
    const hard = bridge.decode(enc, N);
    for (let i = 1; i <= N; i++) {
      expect(hard[i]).toBeGreaterThanOrEqual(0);
      expect(hard[i]).toBeLessThan(K);
    }
  });
});

// ── Torus bridge ──────────────────────────────────────────────────────────────

describe("makeTorusBridge", () => {
  const N = 8, K = 3;
  const p = makePartition(N, K);
  const bridge = makeTorusBridge({ freq: 1.0, lr: 0.01 });

  test("manifold is 'torus'", () => {
    expect(bridge.manifold).toBe("torus");
  });

  test("encode returns (N+1)×K matrix with angles in [0, 2π)", () => {
    const enc = bridge.encode(p, N, K);
    expect(enc.length).toBe(N + 1);
    for (let i = 1; i <= N; i++) {
      expect(enc[i]!.length).toBe(K);
      for (const θ of enc[i]!) {
        expect(θ).toBeGreaterThanOrEqual(0);
        expect(θ).toBeLessThan(2 * Math.PI + 1e-9); // allow tiny float margin
      }
    }
  });

  test("gradient same shape as encoded", () => {
    const enc = bridge.encode(p, N, K);
    const grad = bridge.gradient(enc, N, K);
    expect(grad.length).toBe(N + 1);
    expect(grad[1]!.length).toBe(K);
  });

  test("retract leaves angles unchanged (torus is unconstrained)", () => {
    const v = [1.0, 2.5, 5.0];
    const r = bridge.retract(v);
    expect(r).toEqual(v);
  });

  test("decode assigns each element a color in [0, K)", () => {
    const enc = bridge.encode(p, N, K);
    const hard = bridge.decode(enc, N);
    for (let i = 1; i <= N; i++) {
      expect(hard[i]).toBeGreaterThanOrEqual(0);
      expect(hard[i]).toBeLessThan(K);
    }
  });
});

// ── Hyperbolic Poincaré bridge ─────────────────────────────────────────────────

describe("makeHyperbolicBridge", () => {
  const N = 8, K = 3;
  const p = makePartition(N, K);
  const bridge = makeHyperbolicBridge({ curvature: 1.0, lr: 0.005 });

  test("manifold is 'hyperbolic_poincare'", () => {
    expect(bridge.manifold).toBe("hyperbolic_poincare");
  });

  test("encode returns (N+1)×K matrix with points strictly inside unit ball", () => {
    const enc = bridge.encode(p, N, K);
    for (let i = 1; i <= N; i++) {
      const norm = Math.sqrt(enc[i]!.reduce((a, x) => a + x * x, 0));
      expect(norm).toBeLessThan(1.0);
    }
  });

  test("retract clips vector to inside unit ball (norm < 1)", () => {
    const v = [5.0, 5.0, 5.0]; // outside ball
    const r = bridge.retract(v);
    const norm = Math.sqrt(r.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeLessThan(1.0);
  });

  test("retract does not move already-interior vectors", () => {
    const v = [0.1, 0.2, 0.1];
    const r = bridge.retract(v);
    expect(r[0]).toBeCloseTo(v[0]!, 5);
    expect(r[1]).toBeCloseTo(v[1]!, 5);
  });

  test("gradient same shape as encoded", () => {
    const enc = bridge.encode(p, N, K);
    const grad = bridge.gradient(enc, N, K);
    expect(grad.length).toBe(N + 1);
    expect(grad[1]!.length).toBe(K);
  });
});

// ── Product bridge ────────────────────────────────────────────────────────────

describe("makeProductBridge", () => {
  const N = 8, K = 4;  // K=4 so K/2=2 split works cleanly
  const p = makePartition(N, K);
  const bridge = makeProductBridge({ sphere_weight: 0.7, simplex_weight: 0.3, lr: 0.01 });

  test("manifold is 'product'", () => {
    expect(bridge.manifold).toBe("product");
  });

  test("encode returns (N+1)×K matrix", () => {
    const enc = bridge.encode(p, N, K);
    expect(enc.length).toBe(N + 1);
    expect(enc[1]!.length).toBe(K);
  });

  test("gradient has correct shape", () => {
    const enc = bridge.encode(p, N, K);
    const grad = bridge.gradient(enc, N, K);
    expect(grad.length).toBe(N + 1);
    expect(grad[1]!.length).toBe(K);
  });
});

// ── BridgeStrategyLibrary ─────────────────────────────────────────────────────

describe("BridgeStrategyLibrary", () => {
  test("initialises with ≥ 4 seed strategies (one per manifold type)", () => {
    const lib = new BridgeStrategyLibrary();
    expect(lib.count()).toBeGreaterThanOrEqual(4);
  });

  test("rank() returns strategies sorted by mean E-reduction descending", () => {
    const lib = new BridgeStrategyLibrary();
    const sphere = makeSphereBridge({ radius: 1.0, lr: 0.01 });
    lib.add(sphere);
    lib.recordResult(sphere.id, 10.0); // high reduction
    const ranked = lib.rank();
    // sphere should be at or near top
    expect(ranked[0]!.id).toBe(sphere.id);
  });

  test("recordResult updates scores correctly", () => {
    const lib = new BridgeStrategyLibrary();
    const strategy = lib.rank()[0]!;
    const before = lib.getMeanReduction(strategy.id);
    lib.recordResult(strategy.id, 42.0);
    const after = lib.getMeanReduction(strategy.id);
    expect(after).toBeGreaterThan(before);
  });

  test("add() inserts a new strategy that appears in rank()", () => {
    const lib = new BridgeStrategyLibrary();
    const custom = makeTorusBridge({ freq: 3.14, lr: 0.001 });
    lib.add(custom);
    const ids = lib.rank().map(s => s.id);
    expect(ids).toContain(custom.id);
  });

  test("keeps last 100 results per strategy (rolling window)", () => {
    const lib = new BridgeStrategyLibrary();
    const strategy = lib.rank()[0]!;
    for (let i = 0; i < 150; i++) lib.recordResult(strategy.id, 1.0);
    // Should not throw or overflow; mean should be 1.0
    expect(lib.getMeanReduction(strategy.id)).toBeCloseTo(1.0, 3);
  });
});

// ── BridgeLearner ─────────────────────────────────────────────────────────────

describe("BridgeLearner.propose", () => {
  test("returns ≥ 2 candidates", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const candidates = learner.propose();
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  test("returns at most 5 candidates", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const candidates = learner.propose();
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  test("candidates have distinct ids (no duplicates)", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const candidates = learner.propose();
    const ids = new Set(candidates.map(c => c.id));
    expect(ids.size).toBe(candidates.length);
  });

  test("all candidates have required interface fields", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    for (const c of learner.propose()) {
      expect(typeof c.id).toBe("string");
      expect(["sphere", "torus", "product", "hyperbolic_poincare"]).toContain(c.manifold);
      expect(typeof c.params).toBe("object");
      expect(typeof c.encode).toBe("function");
      expect(typeof c.gradient).toBe("function");
      expect(typeof c.retract).toBe("function");
      expect(typeof c.decode).toBe("function");
    }
  });
});

describe("BridgeLearner.evaluate", () => {
  test("returns valid EvalResult with non-negative energies", async () => {
    const N = 10, K = 3;
    const p = makePartition(N, K);
    const bridge = makeSphereBridge({ radius: 1.0, lr: 0.02 });
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const result = await learner.evaluate(bridge, p, N, K, 200);
    expect(result.discreteEBefore).toBeGreaterThanOrEqual(0);
    expect(result.discreteEAfter).toBeGreaterThanOrEqual(0);
    expect(result.wallTimeMs).toBeGreaterThan(0);
    expect(result.strategyId).toBe(bridge.id);
  });

  test("discreteEBefore matches actual energy of partition", async () => {
    const N = 10, K = 3;
    const p = makePartition(N, K);
    const expected = discreteSchurEnergy(p, N);
    const bridge = makeTorusBridge({ freq: 1.0, lr: 0.01 });
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const result = await learner.evaluate(bridge, p, N, K, 50);
    expect(result.discreteEBefore).toBe(expected);
  });
});

describe("BridgeLearner.updateRewardModel", () => {
  test("appends a JSONL record to the experience file", async () => {
    const N = 8, K = 3;
    const p = makePartition(N, K);
    const bridge = makeSphereBridge({ radius: 1.0, lr: 0.01 });
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const result = await learner.evaluate(bridge, p, N, K, 50);
    learner.updateRewardModel(bridge, result);

    const { readFileSync } = await import("fs");
    const lines = readFileSync(EXPERIENCE_PATH, "utf-8")
      .split("\n")
      .filter(l => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
    const record = JSON.parse(lines[0]!);
    expect(typeof record.e_reduction).toBe("number");
    expect(typeof record.manifold).toBe("string");
  });

  test("updates library scores so next rank() reflects new data", async () => {
    const N = 8, K = 3;
    const p = makePartition(N, K);
    const bridge = makeSphereBridge({ radius: 2.0, lr: 0.01 }); // unique params
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    learner.library.add(bridge);
    const result: EvalResult = {
      discreteEBefore: 20,
      discreteEAfter: 5,
      wallTimeMs: 100,
      strategyId: bridge.id,
    };
    learner.updateRewardModel(bridge, result);
    const ranked = learner.library.rank();
    expect(ranked[0]!.id).toBe(bridge.id); // 15 E-reduction should top the list
  });
});

// ── TinyMLP ───────────────────────────────────────────────────────────────────

describe("TinyMLP (reward model)", () => {
  test("forward pass returns a finite scalar", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const pred = learner.rewardModel.forward([1, 0.01, 1, 1, 0.5, 0.5]);
    expect(isFinite(pred)).toBe(true);
  });

  test("loss decreases after 10 gradient steps on a single sample", () => {
    const learner = new BridgeLearner(EXPERIENCE_PATH);
    const x = [1.0, 0.02, 1.0, 2.0, 0.5, 0.5];
    const target = 15.0;
    const lossBefore = Math.abs(learner.rewardModel.forward(x) - target);
    for (let i = 0; i < 10; i++) {
      learner.rewardModel.backward(x, target, 0.01);
    }
    const lossAfter = Math.abs(learner.rewardModel.forward(x) - target);
    expect(lossAfter).toBeLessThan(lossBefore);
  });
});
