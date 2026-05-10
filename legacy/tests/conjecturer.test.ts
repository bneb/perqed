/**
 * Sprint 15: ConjecturerAgent Tests (TDD RED → GREEN)
 *
 * Tests the Gemini-based hypothesis generator with mocked API calls.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { ConjecturerAgent, type Conjecture } from "../src/agents/conjecturer";
import { geminiResponseMock } from "./helpers/fetch_mock";

// Mock conjectures that Gemini would return
const MOCK_CONJECTURES: Conjecture[] = [
  {
    name: "prime_gap_bound",
    signature: "theorem prime_gap_bound (n : Nat) (h : n > 2) : ∃ p, Nat.Prime p ∧ n < p ∧ p < 2 * n",
    description: "A constructive version of Bertrand's postulate for natural numbers greater than 2.",
  },
  {
    name: "sum_divisors_bound",
    signature: "theorem sum_divisors_bound (n : Nat) (h : n > 0) : σ(n) ≤ n * (Nat.log 2 n + 1)",
    description: "Upper bound on the sum of divisors function in terms of the binary logarithm.",
  },
];

describe("ConjecturerAgent", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("generateConjectures parses structured JSON from Gemini", async () => {
    globalThis.fetch = geminiResponseMock(MOCK_CONJECTURES);

    const agent = new ConjecturerAgent("fake-api-key");
    const results = await agent.generateConjectures("Some arXiv literature context");

    expect(results.length).toBe(2);
    expect(results[0]!.name).toBe("prime_gap_bound");
    expect(results[0]!.signature).toContain("Nat.Prime p");
    expect(results[1]!.name).toBe("sum_divisors_bound");
    expect(results[1]!.description).toContain("sum of divisors");
  });

  test("generateConjectures returns all required fields", async () => {
    globalThis.fetch = geminiResponseMock(MOCK_CONJECTURES);

    const agent = new ConjecturerAgent("fake-api-key");
    const results = await agent.generateConjectures("Literature context");

    for (const conj of results) {
      expect(typeof conj.name).toBe("string");
      expect(typeof conj.signature).toBe("string");
      expect(typeof conj.description).toBe("string");
      expect(conj.name.length).toBeGreaterThan(0);
      expect(conj.signature.length).toBeGreaterThan(0);
    }
  });
});
