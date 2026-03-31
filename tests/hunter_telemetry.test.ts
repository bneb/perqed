/**
 * Sprint 24: HunterTelemetry Tests (TDD)
 *
 * Tests the fire-and-forget Gist uplink with mocked fetch.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { HunterTelemetry, type HuntTelemetryPayload } from "../src/telemetry/hunter_telemetry";

const DUMMY_PAYLOAD: HuntTelemetryPayload = {
  n: 32,
  restartsCompleted: 2,
  totalRestarts: 10,
  globalBestEnergy: 14,
  globalBestGraph: [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]],
  latestDegrees: [3, 3, 3, 3],
  elapsedSeconds: 42.5,
  timestamp: "2026-03-15T00:00:00.000Z",
};

describe("HunterTelemetry", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalGistId: string | undefined;
  let originalToken: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalGistId = process.env.PERQED_GIST_ID;
    originalToken = process.env.PERQED_GITHUB_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.PERQED_GIST_ID = originalGistId;
    process.env.PERQED_GITHUB_TOKEN = originalToken;
  });

  test("calls GitHub Gist API with correct URL, headers, and body", async () => {
    process.env.PERQED_GIST_ID = "test-gist-123";
    process.env.PERQED_GITHUB_TOKEN = "ghp_test_token";

    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (mock(async (url: any, init?: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ id: "test-gist-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any) as unknown as typeof fetch;

    await HunterTelemetry.push(DUMMY_PAYLOAD);

    expect(capturedUrl).toBe("https://api.github.com/gists/test-gist-123");
    expect(capturedInit?.method).toBe("PATCH");
    expect((capturedInit?.headers as any)?.Authorization).toBe("token ghp_test_token");

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.files["hunter_telemetry.json"].content).toContain('"globalBestEnergy": 14');
  });

  test("does not throw on network failure (fail-safe)", async () => {
    process.env.PERQED_GIST_ID = "test-gist-123";
    process.env.PERQED_GITHUB_TOKEN = "ghp_test_token";

    globalThis.fetch = (mock(async () => {
      throw new Error("Network unreachable");
    }) as any) as unknown as typeof fetch;

    // This MUST NOT throw
    await expect(HunterTelemetry.push(DUMMY_PAYLOAD)).resolves.toBeUndefined();
  });

  test("does not throw on HTTP error response (fail-safe)", async () => {
    process.env.PERQED_GIST_ID = "test-gist-123";
    process.env.PERQED_GITHUB_TOKEN = "ghp_test_token";

    globalThis.fetch = (mock(async () => {
      return new Response("Rate limited", { status: 429 });
    }) as any) as unknown as typeof fetch;

    await expect(HunterTelemetry.push(DUMMY_PAYLOAD)).resolves.toBeUndefined();
  });

  test("silently skips when env vars are not set", async () => {
    delete process.env.PERQED_GIST_ID;
    delete process.env.PERQED_GITHUB_TOKEN;

    let fetchCalled = false;
    globalThis.fetch = (mock(async () => {
      fetchCalled = true;
      return new Response("", { status: 200 });
    }) as any) as unknown as typeof fetch;

    await HunterTelemetry.push(DUMMY_PAYLOAD);
    expect(fetchCalled).toBe(false);
  });
});
