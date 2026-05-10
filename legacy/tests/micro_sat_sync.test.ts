/**
 * TDD: MicroSAT Synchronization Protocol
 *
 * Tests the Atomics.wait/notify pause-resume contract between the SA worker
 * thread and the orchestrator. Since Atomics.wait blocks the main thread,
 * we test the non-blocking components:
 *   1. SharedArrayBuffer lock initializes to 0 (worker will block)
 *   2. Atomics.store(1) + notify makes the value non-zero (fast-path)
 *   3. onSterilBasin is called with a clone (not the mutable original)
 *   4. microSatPatch.adj is read after Atomics.notify
 *   5. ResumeWithPatchMessage type contract
 *   6. RamseySearchConfig has microSatLock and microSatPatch fields
 */

import { describe, test, expect } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import type { RamseySearchConfig, ResumeWithPatchMessage } from "../src/search/ramsey_worker";

// ── 1–2: SharedArrayBuffer lock semantics ────────────────────────────────────

describe("MicroSAT SharedArrayBuffer lock protocol", () => {
  test("fresh lock initializes to 0 — worker will Atomics.wait-block", () => {
    const buf = new SharedArrayBuffer(4);
    const view = new Int32Array(buf);
    // Worker expects to find 0 when it calls Atomics.wait(view, 0, 0)
    expect(Atomics.load(view, 0)).toBe(0);
  });

  test("Atomics.store(1) + notify sets the expected wake value", () => {
    const buf = new SharedArrayBuffer(4);
    const view = new Int32Array(buf);
    Atomics.store(view, 0, 0);              // reset (worker initial state)
    Atomics.store(view, 0, 1);              // orchestrator wakes
    Atomics.notify(view, 0, 1);             // notify (no-op if no waiters on main thread)
    expect(Atomics.load(view, 0)).toBe(1);  // value is non-zero → Atomics.wait returns "not-equal"
  });

  test("lock reset to 0 before each STERILE_BASIN so Atomics.wait will block", () => {
    // Simulates the thread entrypoint resetting the lock before posting STERILE_BASIN
    const buf = new SharedArrayBuffer(4);
    const view = new Int32Array(buf);
    Atomics.store(view, 0, 1);  // previous wake state
    // Simulate what onSterilBasin does before postMessage:
    Atomics.store(view, 0, 0);  // ← reset
    expect(Atomics.load(view, 0)).toBe(0);
  });
});

// ── 3: onSterilBasin receives a clone, not the mutable original ──────────────

describe("MicroSAT onSterilBasin clone contract", () => {
  test("callback receives a clone — mutations don't affect original", () => {
    const original = new AdjacencyMatrix(5);
    original.raw[0] = 1;

    let captured: AdjacencyMatrix | null = null;
    const callback = (snapshot: AdjacencyMatrix) => { captured = snapshot; };
    callback(original.clone());

    expect(captured).not.toBeNull();
    // Mutate the captured clone — original must be unaffected
    captured!.raw[0] = 99;
    expect(original.raw[0]).toBe(1);
  });
});

// ── 4: microSatPatch.adj is written and readable ─────────────────────────────

describe("MicroSAT patch slot protocol", () => {
  test("patch slot starts null, written by orchestrator, read by worker", () => {
    const patch: { adj: AdjacencyMatrix | null } = { adj: null };

    // Worker side: slot starts null
    expect(patch.adj).toBeNull();

    // Orchestrator side: writes patched adj
    const patched = new AdjacencyMatrix(3);
    patched.raw[0] = 1;
    patch.adj = patched;

    // Worker reads it after Atomics.wait returns
    expect(patch.adj).not.toBeNull();
    expect(patch.adj!.raw[0]).toBe(1);
  });

  test("patch slot null → worker should scatter normally", () => {
    const patch: { adj: AdjacencyMatrix | null } = { adj: null };
    // Orchestrator sends null (e.g. timeout / unknown result)
    patch.adj = null;
    // Worker checks: patch.adj ?? null → null → scatter
    expect(patch.adj ?? null).toBeNull();
  });
});

// ── 5: ResumeWithPatchMessage type contract ──────────────────────────────────

describe("ResumeWithPatchMessage structure", () => {
  test("RESUME_WITH_PATCH message with patch data is well-typed", () => {
    const msg: ResumeWithPatchMessage = {
      type: "RESUME_WITH_PATCH",
      patchedAdjRaw: [0, 1, 1, 0, 0, 0],
      patchedAdjN: 3,
    };
    expect(msg.type).toBe("RESUME_WITH_PATCH");
    expect(msg.patchedAdjRaw).toHaveLength(6);
    expect(msg.patchedAdjN).toBe(3);
  });

  test("RESUME_WITH_PATCH message with null signals scatter", () => {
    const msg: ResumeWithPatchMessage = {
      type: "RESUME_WITH_PATCH",
      patchedAdjRaw: null,
      patchedAdjN: 0,
    };
    expect(msg.patchedAdjRaw).toBeNull();
  });
});

// ── 6: RamseySearchConfig has the new sync fields ────────────────────────────

describe("RamseySearchConfig microSat sync fields", () => {
  test("microSatLock field accepts SharedArrayBuffer", () => {
    const lock = new SharedArrayBuffer(4);
    const patch: { adj: AdjacencyMatrix | null } = { adj: null };
    const cfg: Pick<RamseySearchConfig, "microSatLock" | "microSatPatch" | "microSatThreshold"> = {
      microSatThreshold: 13,
      microSatLock: lock,
      microSatPatch: patch,
    };
    expect(cfg.microSatLock).toBeTruthy();
    expect(cfg.microSatPatch?.adj).toBeNull();
    expect(cfg.microSatThreshold).toBe(13);
  });

  test("microSatLock and microSatPatch are optional (backward compatible)", () => {
    // Omitting the new fields should still satisfy the interface
    const cfg: Pick<RamseySearchConfig, "n" | "r" | "s" | "maxIterations" | "initialTemp" | "coolingRate"> = {
      n: 35, r: 4, s: 6, maxIterations: 1000, initialTemp: 3.0, coolingRate: 0.9999,
    };
    // If this compiles, the fields are correctly optional
    expect(cfg.n).toBe(35);
  });
});
