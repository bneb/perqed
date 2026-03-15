/**
 * LocalEmbedder — Ollama `nomic-embed-text` Embedding Service
 *
 * Converts Lean 4 theorem signatures and descriptions into dense vectors
 * using the local Ollama instance. Fails gracefully (returns []) if
 * Ollama is unreachable, so the Orchestrator never crashes.
 */

export class LocalEmbedder {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = "http://localhost:11434/api/embeddings",
    model = "nomic-embed-text",
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * Converts a text string into a dense vector embedding.
   *
   * @param text - Lean 4 theorem signature, tactic state, or description
   * @returns Dense vector array, or [] on failure
   */
  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    } catch (error: any) {
      console.error("[Embedder] Failed to reach local Ollama instance:", error.message);
      return [];
    }
  }
}
