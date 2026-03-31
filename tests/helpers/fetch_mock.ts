/**
 * tests/helpers/fetch_mock.ts
 *
 * Shared fetch-mocking utilities for the Perqed test suite.
 *
 * Bun's globalThis.fetch has a `preconnect` property that bare async
 * functions don't satisfy. Using `as unknown as typeof globalThis.fetch`
 * throughout is noisy; this helper centralises the cast and ensures
 * all tests share a consistent, type-safe mock setup.
 */

/** Cast any async function into Bun's fetch type without satisfying .preconnect. */
export function asFetch(
  fn: (...args: any[]) => Promise<Response>,
): typeof globalThis.fetch {
  return fn as unknown as typeof globalThis.fetch;
}

/**
 * Build a mock that returns a well-formed Gemini JSON response whose
 * single candidate exposes `text` = JSON.stringify(payload).
 */
export function geminiResponseMock(payload: unknown): typeof globalThis.fetch {
  return asFetch(async () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(payload) }] } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

/**
 * Build a mock that cycles through `payloads` in order (round-robin on last).
 * Useful for multi-call sequences (e.g. script generation → synthesis).
 */
export function geminiSequenceMock(payloads: unknown[]): typeof globalThis.fetch {
  let idx = 0;
  return asFetch(async () => {
    const payload = payloads[Math.min(idx++, payloads.length - 1)];
    return new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(payload) }] } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

/**
 * Build a mock that captures every request body and responds with
 * successive payloads from `payloads`.
 *
 * Call `capturedBodies` after the test to inspect what was sent.
 */
export function geminiCapturingMock(payloads: unknown[]): {
  fetch: typeof globalThis.fetch;
  capturedBodies: string[];
} {
  let idx = 0;
  const capturedBodies: string[] = [];

  const fetch = asFetch(async (_url: any, opts: any) => {
    capturedBodies.push((opts as RequestInit)?.body?.toString() ?? "");
    const payload = payloads[Math.min(idx++, payloads.length - 1)];
    return new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(payload) }] } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  return { fetch, capturedBodies };
}

/** Build a mock that always returns a non-200 HTTP error. */
export function geminiErrorMock(status: number): typeof globalThis.fetch {
  return asFetch(async () => new Response("Error", { status }));
}

/** Build a mock that returns an empty candidates array (simulates empty response). */
export function geminiEmptyMock(): typeof globalThis.fetch {
  return asFetch(async () =>
    new Response(
      JSON.stringify({ candidates: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

/** Build a mock whose response text field is an empty string. */
export function geminiBlankTextMock(): typeof globalThis.fetch {
  return asFetch(async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "" }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}
