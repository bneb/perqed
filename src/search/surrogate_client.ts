/**
 * surrogate_client.ts — HTTP client for the PyTorch Value Network FastAPI server.
 *
 * Calls POST /predict → returns predicted Ramsey energy float.
 * Calls POST /predict_batch → returns predicted energies for a batch.
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

  /**
   * Batch-predict energy scores for multiple flattened adjacency matrices.
   *
   * Accepts an array of either:
   *   - binary strings (e.g. "001101...") — converted to int arrays internally
   *   - int arrays (e.g. [0, 0, 1, 1, ...]) — passed directly to /predict_batch
   *
   * @param matrices  Array of flattened adjacency matrices (strings or int arrays)
   * @returns         Array of predicted energy floats in the same order
   * @throws          On non-2xx response or network failure
   */
  async predictBatch(matrices: (string | number[])[]): Promise<number[]> {
    if (matrices.length === 0) return [];

    // Normalise all inputs to int arrays for the /predict_batch endpoint
    const normalised: number[][] = matrices.map((m) => {
      if (typeof m === "string") {
        return m.split("").map(Number);
      }
      return m;
    });

    const res = await fetch(`${this.baseUrl}/predict_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrices: normalised }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(
        `SurrogateClient.predictBatch failed: HTTP ${res.status} — ${JSON.stringify(detail)}`
      );
    }

    const body = (await res.json()) as { predictions: number[] };
    return body.predictions;
  }

  // ── Partition Value Network ──────────────────────────────────────────────────

  /**
   * Block-histogram encoder for Schur partitions.
   * Matches partition_model.py encode_partition() exactly.
   *
   * @param partition  Int8Array, 1-indexed (index 0 unused), values in [0, K)
   * @param N          Domain size
   * @param K          Number of color classes
   * @param block      Block size (default 20)
   * @returns          Feature vector of length ⌈N/block⌉ × K, values in [0, 1]
   */
  static encodePartition(
    partition: Int8Array,
    N: number,
    K: number,
    block: number = 20,
  ): number[] {
    const nBlocks = Math.ceil(N / block);
    const features: number[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const start = b * block + 1;   // 1-indexed
      const end = Math.min((b + 1) * block, N);
      const blockLen = end - start + 1;
      const counts = new Array<number>(K).fill(0);
      for (let i = start; i <= end; i++) {
        const color = partition[i] ?? 0;
        if (color >= 0 && color < K) counts[color]++;
      }
      for (let k = 0; k < K; k++) features.push(counts[k]! / blockLen);
    }
    return features;
  }

  /**
   * Returns true if the partition value network endpoint is reachable.
   */
  async checkPartitionHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/partition/health`);
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      return body.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Predict Schur energy for a single encoded partition.
   * @param enc  Feature vector from encodePartition()
   */
  async predictPartition(enc: number[]): Promise<number> {
    const res = await fetch(`${this.baseUrl}/partition/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partition_enc: enc }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(
        `SurrogateClient.predictPartition failed: HTTP ${res.status} — ${JSON.stringify(detail)}`
      );
    }
    const body = (await res.json()) as { energy: number };
    return body.energy;
  }

  /**
   * Batch-predict energies for multiple encoded partitions.
   */
  async predictPartitionBatch(encs: number[][]): Promise<number[]> {
    if (encs.length === 0) return [];
    return Promise.all(encs.map(enc => this.predictPartition(enc)));
  }
}

