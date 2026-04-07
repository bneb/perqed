import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { TransitionBuffer } from "../../src/ml/replay_buffer";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEST_WORKSPACE = join(process.cwd(), "test_workspace_ml");

describe("PyTorch Replay Buffer Interceptor", () => {
  const cleanup = () => {
    const p = TransitionBuffer.getBufferPath(TEST_WORKSPACE);
    if (existsSync(p)) {
      unlinkSync(p);
    }
  };

  beforeAll(cleanup);
  afterAll(cleanup);

  test("Properly normalizes structural boundaries and formats multi-dimensional discrete matrices", () => {
    const matrix = [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1]
    ];
    
    TransitionBuffer.recordPlay(
      TEST_WORKSPACE,
      "   R( 3, 3) < 10   \n",
      matrix,
      0, // Zero energy -> Exact witness (SAT)
      { max_clique: 2 }
    );

    const path = TransitionBuffer.getBufferPath(TEST_WORKSPACE);
    expect(existsSync(path)).toBe(true);

    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw.trim());

    expect(parsed.hypothesisSignature).toBe("r( 3, 3) < 10");
    expect(parsed.energy).toBe(0);
    expect(parsed.matrix[0][2]).toBe(1);
    expect(parsed.invariants.max_clique).toBe(2);
  });
});
