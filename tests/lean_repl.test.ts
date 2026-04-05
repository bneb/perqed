import { test, expect, describe, afterEach, beforeEach } from "bun:test";
import { LeanREPLBridge } from "../src/lean_repl";

describe("LeanREPLBridge", () => {
  let repl: LeanREPLBridge;

  beforeEach(() => {
    repl = new LeanREPLBridge("/Users/kevin/projects/perqed");
  });

  afterEach(() => {
    if (repl) repl.kill();
  });

  test("should start REPL, parse expressions, and handle proof states sequentially", async () => {
    // 1. Basic expression parsing
    console.log("  [Test] Discarding to sendCmd alpha...");
    const res1 = await repl.sendCmd({ cmd: "def alpha := 1" });
    console.log("  [Test] sendCmd resolved with:", res1);
    expect(res1.env).toBeDefined();
    expect(res1.messages).toBeUndefined(); // no errors

    // 2. Maintain state across envs
    console.log("  [Test] Discarding to sendCmd beta...");
    const res2 = await repl.sendCmd({ env: res1.env, cmd: "def beta := alpha + 1" });
    expect(res2.env).toBeDefined();
    expect(res2.messages).toBeUndefined();

    // 3. Proof states and goals
    console.log("  [Test] Discarding to sendCmd theorem...");
    const res3 = await repl.sendCmd({ 
      env: res2.env,
      cmd: "theorem basic_proof (n : Nat) : n = n := by sorry" 
    });
    expect(res3.env).toBeDefined();
    expect(res3.sorries).toBeDefined();
    expect(res3.sorries!.length).toBeGreaterThan(0);
    
    const proofStateId = res3.sorries![0].proofState;
    expect(proofStateId).toBeDefined();

    console.log("  [Test] Discarding to sendCmd tactic...");
    const res4 = await repl.sendCmd({ proofState: proofStateId, tactic: "rfl" });
    expect(res4.proofState).toBeDefined();
    expect(res4.goals).toBeDefined();
    // length of goals shouldn't be defined explicitly if we don't know it, but empty array means proven.
    expect(res4.goals!.length).toBe(0);
  }, 20_000);
});
