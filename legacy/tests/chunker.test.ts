/**
 * Sprint 14: TextChunker Tests (TDD RED → GREEN)
 *
 * Verifies sentence-boundary text splitting for arXiv abstracts.
 */

import { describe, test, expect } from "bun:test";
import { TextChunker } from "../src/utils/chunker";

describe("TextChunker", () => {

  test("splits a long text into chunks under maxChars", () => {
    const text =
      "We study the distribution of prime numbers. " +
      "The Riemann hypothesis remains unproven. " +
      "We introduce a novel sieve method for counting primes in short intervals. " +
      "Our approach combines analytic and algebraic techniques. " +
      "We prove an asymptotic formula for the number of primes up to X. " +
      "The error term is bounded by O(X^{1/2} log X). " +
      "Applications to the Goldbach conjecture are discussed. " +
      "We also study twin primes and their distribution. " +
      "A key lemma involves the Selberg sieve. " +
      "The final result improves on the best known bound by a factor of log log X.";

    const chunks = TextChunker.chunkAbstract(text, 200);

    // Every chunk should be under maxChars (allowing for one sentence overshoot)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThan(400); // generous upper bound
    }
    // Should produce multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("does not lose data — joined chunks ≈ original text", () => {
    const text =
      "Algebraic geometry studies solutions of polynomial equations. " +
      "Scheme theory provides the modern foundation. " +
      "Cohomology is a powerful invariant.";

    const chunks = TextChunker.chunkAbstract(text, 80);
    const joined = chunks.join(" ");

    // All original sentences should appear in the joined result
    expect(joined).toContain("Algebraic geometry");
    expect(joined).toContain("Scheme theory");
    expect(joined).toContain("Cohomology");
  });

  test("returns single chunk for short text", () => {
    const text = "We prove Fermat's Last Theorem.";
    const chunks = TextChunker.chunkAbstract(text, 500);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("Fermat");
  });

  test("handles empty text", () => {
    const chunks = TextChunker.chunkAbstract("", 500);
    expect(chunks.length).toBe(0);
  });

  test("handles text with newlines", () => {
    const text = "First sentence.\nSecond sentence.\nThird sentence.";
    const chunks = TextChunker.chunkAbstract(text, 500);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("First sentence");
    expect(chunks[0]).toContain("Second sentence");
    expect(chunks[0]).toContain("Third sentence");
  });
});
