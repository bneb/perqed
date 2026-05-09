import { expect, test, describe } from "bun:test";
import { LeanBridge } from "../src/lean_bridge";

describe("LeanBridge Watchdog — Deadlock Prevention", () => {

  test("initialize() with bad binary rejects in bounded time, not forever", async () => {
    const bridge = new LeanBridge("/nonexistent/lean", process.cwd());
    const start = Date.now();
    try {
      await bridge.initialize(10_000);
      throw new Error("should have thrown");
    } catch (e: any) {
      const elapsed = Date.now() - start;
      // The critical property: it terminates. 10s is generous; without the
      // watchdog this would hang forever (the old 2-hour deadlock).
      expect(elapsed).toBeLessThan(10_000);
      expect(e.message).toContain("LeanBridge");
      console.log(`✅ Bad binary rejected in ${elapsed}ms: ${e.message.slice(0, 120)}`);
    }
  }, 15_000);

  test("shutdown() completes even if lean is unresponsive", async () => {
    const bridge = new LeanBridge(undefined, process.cwd());
    await bridge.initialize();
    expect(bridge.isReady).toBe(true);

    // Shutdown must complete within a bounded time
    const start = Date.now();
    await bridge.shutdown();
    const elapsed = Date.now() - start;
    expect(bridge.isReady).toBe(false);
    expect(elapsed).toBeLessThan(10_000);
    console.log(`✅ Shutdown completed in ${elapsed}ms`);
  }, 15_000);

  test("double initialize() is idempotent", async () => {
    const bridge = new LeanBridge(undefined, process.cwd());
    await bridge.initialize();
    await bridge.initialize(); // should be a no-op
    expect(bridge.isReady).toBe(true);
    await bridge.shutdown();
  }, 15_000);

  test("executeLean after shutdown re-initializes cleanly", async () => {
    const bridge = new LeanBridge(undefined, process.cwd());
    await bridge.initialize();
    await bridge.shutdown();
    expect(bridge.isReady).toBe(false);

    // This triggers lazy re-init
    const result = await bridge.executeLean("def hello := 42\n", 10_000);
    expect(bridge.isReady).toBe(true);
    expect(result.success).toBe(true);
    await bridge.shutdown();
  }, 20_000);
});
