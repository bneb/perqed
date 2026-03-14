/**
 * Sprint 6: Workspace v2 — scratch/verified_lib structure tests.
 *
 * Tests the restructured workspace with:
 *   /scratch — volatile sandbox (lab_log, progress, tactic state)
 *   /verified_lib — append-only vault (committed Lean proofs)
 */

import { expect, test, describe, afterAll } from "bun:test";
import { rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceManager } from "../src/workspace";

const BASE_DIR = "./tmp_test_workspace_v2";
const RUN_NAME = "ws_v2_test";

async function setupWorkspace(): Promise<WorkspaceManager> {
  await rm(BASE_DIR, { recursive: true, force: true });
  const wm = new WorkspaceManager(BASE_DIR, RUN_NAME);
  await wm.init();
  return wm;
}

afterAll(async () => {
  await rm(BASE_DIR, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// Directory Structure
// ──────────────────────────────────────────────

describe("Workspace v2 — Directory Structure", () => {
  test("init() creates scratch/ directory", async () => {
    const wm = await setupWorkspace();
    const scratchDir = join(BASE_DIR, "runs", RUN_NAME, "scratch");
    const entries = await readdir(scratchDir);
    expect(entries).toBeDefined();
  });

  test("init() creates verified_lib/ directory", async () => {
    const wm = await setupWorkspace();
    const verifiedDir = join(BASE_DIR, "runs", RUN_NAME, "verified_lib");
    const entries = await readdir(verifiedDir);
    expect(entries).toBeDefined();
  });

  test("paths.scratch resolves to runs/<runName>/scratch", async () => {
    const wm = await setupWorkspace();
    expect(wm.paths.scratch).toBe(join(BASE_DIR, "runs", RUN_NAME, "scratch"));
  });

  test("paths.verifiedLib resolves to runs/<runName>/verified_lib", async () => {
    const wm = await setupWorkspace();
    expect(wm.paths.verifiedLib).toBe(join(BASE_DIR, "runs", RUN_NAME, "verified_lib"));
  });

  test("paths.tacticState resolves inside scratch/", async () => {
    const wm = await setupWorkspace();
    expect(wm.paths.tacticState).toContain("scratch");
    expect(wm.paths.tacticState).toContain("current_tactic_state.txt");
  });
});

// ──────────────────────────────────────────────
// Verified Lib — The Vault
// ──────────────────────────────────────────────

describe("Workspace v2 — Verified Lib", () => {
  test("commitProof writes .lean file to verified_lib/", async () => {
    const wm = await setupWorkspace();

    const leanSource = [
      "theorem add_comm (n m : Nat) : n + m = m + n := by",
      "  omega",
    ].join("\n");

    await wm.commitProof("add_comm", leanSource);

    const proofFile = Bun.file(join(wm.paths.verifiedLib, "add_comm.lean"));
    expect(await proofFile.exists()).toBe(true);

    const content = await proofFile.text();
    expect(content).toContain("theorem add_comm");
    expect(content).toContain("omega");
  });

  test("commitProof appends import to index.lean", async () => {
    const wm = await setupWorkspace();

    await wm.commitProof("lemma1", "theorem lemma1 : True := trivial");
    await wm.commitProof("lemma2", "theorem lemma2 : True := trivial");

    const indexFile = Bun.file(join(wm.paths.verifiedLib, "index.lean"));
    expect(await indexFile.exists()).toBe(true);

    const content = await indexFile.text();
    expect(content).toContain("lemma1");
    expect(content).toContain("lemma2");
  });

  test("commitProof does not overwrite existing proofs", async () => {
    const wm = await setupWorkspace();

    await wm.commitProof("unique_lemma", "theorem unique_lemma : True := trivial");

    // Second commit with same name should NOT overwrite
    await wm.commitProof("unique_lemma", "OVERWRITTEN CONTENT");

    const content = await Bun.file(join(wm.paths.verifiedLib, "unique_lemma.lean")).text();
    expect(content).not.toContain("OVERWRITTEN");
    expect(content).toContain("trivial");
  });

  test("getVerifiedProofs returns list of committed proof names", async () => {
    const wm = await setupWorkspace();

    await wm.commitProof("proof_a", "theorem proof_a : True := trivial");
    await wm.commitProof("proof_b", "theorem proof_b : True := trivial");

    const proofs = await wm.getVerifiedProofs();
    expect(proofs).toContain("proof_a");
    expect(proofs).toContain("proof_b");
  });
});

// ──────────────────────────────────────────────
// Tactic State Management
// ──────────────────────────────────────────────

describe("Workspace v2 — Tactic State", () => {
  test("writeTacticState stores state in scratch/", async () => {
    const wm = await setupWorkspace();

    await wm.writeTacticState("1 goal\nn m : Nat\n⊢ n + m = m + n");

    const state = await Bun.file(wm.paths.tacticState).text();
    expect(state).toContain("⊢ n + m = m + n");
  });

  test("readTacticState returns empty string when no state exists", async () => {
    const wm = await setupWorkspace();
    const state = await wm.readTacticState();
    expect(state).toBe("");
  });

  test("readTacticState returns previously written state", async () => {
    const wm = await setupWorkspace();

    await wm.writeTacticState("⊢ True");
    const state = await wm.readTacticState();
    expect(state).toBe("⊢ True");
  });
});
