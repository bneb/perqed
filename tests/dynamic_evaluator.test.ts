/**
 * dynamic_evaluator.test.ts — RED-to-GREEN FFI pipeline validation.
 *
 * Compiles a trivial C++ "sum-of-array" function, loads it via bun:ffi,
 * calls it with a known Uint8Array and asserts the result is correct.
 *
 * Skips gracefully if clang++ is not on PATH.
 */
import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { buildAndLoadEvaluator, STUB_CPP_SUM, type CompiledEvaluator } from "../src/search/dynamic_evaluator";
import { rmSync, existsSync } from "node:fs";

const RUN_NAME = `test_ffi_${Date.now()}`;
let evaluator: CompiledEvaluator | null = null;
let clangAvailable = false;

function checkClang(): boolean {
  try {
    const { exitCode } = Bun.spawnSync(["clang++", "--version"]);
    return exitCode === 0;
  } catch {
    return false;
  }
}

describe("Dynamic JIT Evaluator (FFI)", () => {
  beforeAll(async () => {
    clangAvailable = checkClang();
    if (!clangAvailable) {
      console.log("[dynamic_evaluator.test] clang++ not found — skipping FFI tests");
      return;
    }
    evaluator = await buildAndLoadEvaluator(RUN_NAME, STUB_CPP_SUM);
  });

  afterAll(() => {
    evaluator?.cleanup();
    // Clean up artifact directory
    const dir = `agent_workspace/runs/${RUN_NAME}`;
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  });

  test("compiles and loads without throwing", () => {
    if (!clangAvailable) return;
    expect(evaluator).not.toBeNull();
  });

  test("evaluate() returns correct sum for [1,2,3,4,5]", () => {
    if (!clangAvailable || !evaluator) return;
    const matrix = new Uint8Array([1, 2, 3, 4, 5]);
    const result = evaluator.evaluate(matrix, matrix.length);
    expect(result).toBe(15);
  });

  test("evaluate() returns 0 for all-zero matrix", () => {
    if (!clangAvailable || !evaluator) return;
    const matrix = new Uint8Array(10); // all zeros
    expect(evaluator.evaluate(matrix, 10)).toBe(0);
  });

  test("evaluate() handles single-element array", () => {
    if (!clangAvailable || !evaluator) return;
    const matrix = new Uint8Array([42]);
    expect(evaluator.evaluate(matrix, 1)).toBe(42);
  });

  test("buildAndLoadEvaluator produces .cpp and .dylib/.so artifacts", () => {
    if (!clangAvailable) return;
    const { suffix } = require("bun:ffi");
    expect(existsSync(`agent_workspace/runs/${RUN_NAME}/eval.cpp`)).toBe(true);
    expect(existsSync(`agent_workspace/runs/${RUN_NAME}/libeval.${suffix}`)).toBe(true);
  });

  test("buildAndLoadEvaluator throws on invalid C++ source", async () => {
    if (!clangAvailable) return;
    expect(
      buildAndLoadEvaluator(`${RUN_NAME}_invalid`, "THIS IS NOT C++")
    ).rejects.toThrow("C++ compilation failed");
  });
});

describe("CompilerAgent", () => {
  test("returns fallback stub when apiKey is 'test'", async () => {
    const { CompilerAgent } = await import("../src/agents/compiler");
    const agent = new CompilerAgent({ apiKey: "test" });
    const src = await agent.generateEvaluator({ constraint: "R(4,6)", n: 35, r: 4, s: 6 });
    expect(src).toContain("calculate_energy");
    expect(src).toContain("int32_t");
  });

  test("fallback stub contains extern C block", async () => {
    const { CompilerAgent } = await import("../src/agents/compiler");
    const agent = new CompilerAgent({ apiKey: "test" });
    const src = await agent.generateEvaluator({ constraint: "test", n: 10, r: 3, s: 3 });
    expect(src).toContain('extern "C"');
  });
});
