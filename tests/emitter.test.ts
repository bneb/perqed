/**
 * Sprint 11: TelemetryEmitter Tests (TDD RED → GREEN)
 *
 * Tests:
 * 1. emit() exits cleanly without throwing if env vars missing
 * 2. emit() calls fetch with correct URL, headers, method when configured
 * 3. Payload shape inside files["perqed_live_state.json"].content is correct
 * 4. emit() swallows fetch errors (never throws)
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { TelemetryEmitter, type TelemetryPayload } from "../src/telemetry/emitter";

// ──────────────────────────────────────────────
// Fixture
// ──────────────────────────────────────────────

function makePayload(overrides: Partial<TelemetryPayload> = {}): TelemetryPayload {
  return {
    runId: "test-run-123",
    theorem: "nat_add_comm",
    status: "IN_PROGRESS",
    iteration: 3,
    currentSignals: {
      totalAttempts: 5,
      consecutiveFailures: 2,
      goalCount: 1,
      isStuckInLoop: false,
      lastErrors: ["tactic 'simp' failed"],
      hasArchitectDirective: true,
    },
    latestLog: {
      agent: "TACTICIAN",
      action: "PROPOSE_LEAN_TACTICS",
      success: false,
      error: "tactic 'simp' failed",
      timestamp: Date.now(),
    },
    history: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("TelemetryEmitter", () => {
  let savedGistToken: string | undefined;
  let savedGistId: string | undefined;

  beforeEach(() => {
    savedGistToken = process.env.GITHUB_GIST_TOKEN;
    savedGistId = process.env.GITHUB_GIST_ID;
  });

  afterEach(() => {
    // Restore env vars
    if (savedGistToken !== undefined) process.env.GITHUB_GIST_TOKEN = savedGistToken;
    else delete process.env.GITHUB_GIST_TOKEN;
    if (savedGistId !== undefined) process.env.GITHUB_GIST_ID = savedGistId;
    else delete process.env.GITHUB_GIST_ID;
  });

  // ── 1. Graceful degradation when env vars missing ──

  test("emit() exits cleanly when GITHUB_GIST_TOKEN is missing", () => {
    delete process.env.GITHUB_GIST_TOKEN;
    delete process.env.GITHUB_GIST_ID;

    const emitter = new TelemetryEmitter();
    // Should not throw
    expect(() => emitter.emit(makePayload())).not.toThrow();
  });

  test("isConfigured returns false when env vars missing", () => {
    delete process.env.GITHUB_GIST_TOKEN;
    delete process.env.GITHUB_GIST_ID;

    const emitter = new TelemetryEmitter();
    expect(emitter.isConfigured).toBe(false);
  });

  test("isConfigured returns true when both env vars set", () => {
    process.env.GITHUB_GIST_TOKEN = "test-token";
    process.env.GITHUB_GIST_ID = "test-gist-id";

    const emitter = new TelemetryEmitter();
    expect(emitter.isConfigured).toBe(true);
  });

  // ── 2. Correct fetch call when configured ──

  test("emit() calls fetch with correct URL, method, and headers", async () => {
    process.env.GITHUB_GIST_TOKEN = "ghp_testtoken123";
    process.env.GITHUB_GIST_ID = "abc123gistid";

    let capturedUrl = "";
    let capturedInit: RequestInit = {};

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = typeof input === "string" ? input : input.url;
      capturedInit = init ?? {};
      return new Response(JSON.stringify({ id: "abc123gistid" }), { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const emitter = new TelemetryEmitter();
      emitter.emit(makePayload());

      // Wait a tick for the fire-and-forget to execute
      await new Promise((r) => setTimeout(r, 50));

      expect(capturedUrl).toBe("https://api.github.com/gists/abc123gistid");
      expect(capturedInit.method).toBe("PATCH");

      const headers = capturedInit.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer ghp_testtoken123");
      expect(headers["Accept"]).toBe("application/vnd.github+json");
      expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 3. Correct payload shape ──

  test("emit() sends correct payload inside files['perqed_live_state.json'].content", async () => {
    process.env.GITHUB_GIST_TOKEN = "ghp_testtoken123";
    process.env.GITHUB_GIST_ID = "abc123gistid";

    let capturedBody: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: any, init?: any) => {
      capturedBody = JSON.parse(init?.body ?? "{}");
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const payload = makePayload({ iteration: 7, status: "SOLVED" });
      const emitter = new TelemetryEmitter();
      emitter.emit(payload);

      await new Promise((r) => setTimeout(r, 50));

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.files).toBeDefined();
      expect(capturedBody.files["perqed_live_state.json"]).toBeDefined();

      const content = JSON.parse(capturedBody.files["perqed_live_state.json"].content);
      expect(content.runId).toBe("test-run-123");
      expect(content.theorem).toBe("nat_add_comm");
      expect(content.status).toBe("SOLVED");
      expect(content.iteration).toBe(7);
      expect(content.currentSignals).toBeDefined();
      expect(content.currentSignals.consecutiveFailures).toBe(2);
      expect(content.latestLog).toBeDefined();
      expect(content.latestLog.agent).toBe("TACTICIAN");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 4. Swallows fetch errors ──

  test("emit() swallows fetch errors without throwing", async () => {
    process.env.GITHUB_GIST_TOKEN = "ghp_testtoken123";
    process.env.GITHUB_GIST_ID = "abc123gistid";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("Network failure");
    }) as unknown as typeof fetch;

    try {
      const emitter = new TelemetryEmitter();
      // Should NOT throw
      expect(() => emitter.emit(makePayload())).not.toThrow();

      // Wait for the catch handler to fire
      await new Promise((r) => setTimeout(r, 50));
      // If we get here without crashing, the test passes
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ── 5. Does not call fetch when not configured ──

  test("emit() does NOT call fetch when env vars missing", async () => {
    delete process.env.GITHUB_GIST_TOKEN;
    delete process.env.GITHUB_GIST_ID;

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const emitter = new TelemetryEmitter();
      emitter.emit(makePayload());

      await new Promise((r) => setTimeout(r, 50));
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
