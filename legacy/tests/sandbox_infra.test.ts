import { expect, test, describe, beforeEach, afterAll } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";

const BASE_DIR = "./tmp_test_sandbox";
const RUN_NAME = "test_run";

beforeEach(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
  await mkdir(BASE_DIR, { recursive: true });
  // Mock a global cache to satisfy WorkspaceManager.init
  const cacheDir = join(BASE_DIR, ".perqed_cache");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(join(cacheDir, ".lake"), { recursive: true });
  writeFileSync(join(cacheDir, "lakefile.lean"), "test content");
});

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

describe("WorkspaceManager — Sandbox Infrastructure", () => {
  test("allocateWorkerSandbox provisions all necessary Lean files", async () => {
    // 1. Setup root workspace with Lean files
    writeFileSync(join(BASE_DIR, "lakefile.lean"), "lean_lib Perqed");
    writeFileSync(join(BASE_DIR, "lean-toolchain"), "leanprover/lean4:v4.7.0");
    await mkdir(join(BASE_DIR, ".lake"), { recursive: true });

    const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
    await wm.init();

    // 2. Allocate a sandbox
    const { directory } = await wm.allocateWorkerSandbox("worker_1");

    // 3. Verify existence of critical Lean files in the sandbox
    expect(existsSync(join(directory, "lakefile.lean"))).toBe(true);
    expect(existsSync(join(directory, "lean-toolchain"))).toBe(true);
    expect(existsSync(join(directory, ".lake"))).toBe(true);
    
    // Also verify shared hubs
    expect(existsSync(join(directory, "verified_lib"))).toBe(true);
    expect(existsSync(join(directory, "domain_skills"))).toBe(true);
  });
});
