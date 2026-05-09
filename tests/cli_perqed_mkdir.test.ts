import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { createRunDirectory } from "../src/cli/perqed";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("createRunDirectory", () => {
  const testWorkspace = join(tmpdir(), "perqed_test_workspace_" + Date.now());

  beforeAll(async () => {
    await mkdir(join(testWorkspace, "runs"), { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("creates a new directory if it does not exist", async () => {
    const config = { run_name: "unique_run" } as any;
    const result = await createRunDirectory(testWorkspace, config);

    expect(result.runDir).toBe(join(testWorkspace, "runs", "unique_run"));
    expect(config.run_name).toBe("unique_run");

    const stats = await stat(result.runDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test("auto-increments the run_name if the directory already exists", async () => {
    const config = { run_name: "duplicate_run" } as any;
    
    // First call creates the original
    const result1 = await createRunDirectory(testWorkspace, config);
    expect(result1.runDir).toBe(join(testWorkspace, "runs", "duplicate_run"));

    // Reset config.run_name back to the base to simulate a new run generating the same name
    config.run_name = "duplicate_run";
    const result2 = await createRunDirectory(testWorkspace, config);

    expect(result2.runDir).toBe(join(testWorkspace, "runs", "duplicate_run_1"));
    expect(config.run_name).toBe("duplicate_run_1");
    
    // Reset and try a third time
    config.run_name = "duplicate_run";
    const result3 = await createRunDirectory(testWorkspace, config);

    expect(result3.runDir).toBe(join(testWorkspace, "runs", "duplicate_run_2"));
    expect(config.run_name).toBe("duplicate_run_2");
  });
});
