/**
 * surrogate_client.ts — HTTP client for the PyTorch Value Network FastAPI server.
 *
 * Calls POST /predict → returns predicted Ramsey energy float.
 * Handles server-offline gracefully via checkHealth().
 */

export class SurrogateClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8765") {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // strip trailing slash
  }

  /**
   * Returns true if the FastAPI Value Network server is reachable and healthy.
   * Safe to call repeatedly — swallows all network errors.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      return body.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Predict the Ramsey energy for a flattened adjacency matrix string.
   *
   * @param matrixFlat  Upper-triangle binary string (len = N*(N-1)/2, e.g. 595 for N=35)
   * @returns           Predicted energy float from the surrogate model
   * @throws            On non-2xx response or network failure
   */
  async predict(matrixFlat: string): Promise<number> {
    const res = await fetch(`${this.baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix_flat: matrixFlat }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(
        `SurrogateClient.predict failed: HTTP ${res.status} — ${JSON.stringify(detail)}`
      );
    }

    const body = (await res.json()) as { energy: number };
    return body.energy;
  }
}
