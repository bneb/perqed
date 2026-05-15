/**
 * partition_sa_worker_thread.ts — Bun Worker thread entry point.
 *
 * Receives a serialized PartitionSAConfig via postMessage, runs runPartitionSA,
 * and posts the PartitionSAResult back. Int8Arrays are reconstructed from plain
 * number arrays since postMessage doesn't preserve typed arrays across workers.
 */

import { runPartitionSA } from "./partition_sa_worker";
import type { PartitionSAConfig } from "./partition_sa_worker";

declare var self: Worker;
self.onmessage = async (e: MessageEvent) => {
  const raw = e.data.config as Record<string, unknown>;

  // Reconstruct typed arrays from plain arrays (serialized by coordinator)
  const config: PartitionSAConfig = {
    ...(raw as any),
    warmStart: raw.warmStart
      ? new Int8Array(raw.warmStart as number[])
      : undefined,
    crossover_parents: raw.crossover_parents
      ? [
          new Int8Array((raw.crossover_parents as number[][])[0]!),
          new Int8Array((raw.crossover_parents as number[][])[1]!),
        ]
      : undefined,
  };

  try {
    const result = await runPartitionSA(config);
    // postMessage the result (partition is Int8Array — transferable)
    self.postMessage(result, [result.partition.buffer as ArrayBuffer]);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};
