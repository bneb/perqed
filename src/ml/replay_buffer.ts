import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface SATransition {
  hypothesisSignature: string;
  matrix: any; 
  invariants: Record<string, any>;
  energy: number;
  timestamp: string;
}

export class TransitionBuffer {
  /**
   * Retrieves or builds the target directory for Python DataLoaders to consume.
   */
  static getBufferPath(workspaceDir: string): string {
    const dataDir = join(workspaceDir, "training_buffers");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    return join(dataDir, "sa_transitions.jsonl");
  }

  /**
   * Harvests the graph topological telemetry when SA finishes a trajectory.
   * Energy 0 represents a mathematical success ($SAT$). Energy > 0 is a failed plateau.
   */
  static recordPlay(
    workspaceDir: string,
    hypothesis: string,
    matrix: any,
    energy: number,
    invariants: Record<string, any> = {}
  ): void {
    // Only serialize if a matrix is clearly provided
    if (!matrix) return;

    const path = this.getBufferPath(workspaceDir);
    const sig = hypothesis.replace(/\s+/g, " ").trim().toLowerCase();

    const transition: SATransition = {
      hypothesisSignature: sig,
      matrix,
      invariants,
      energy,
      timestamp: new Date().toISOString(),
    };

    try {
      appendFileSync(path, JSON.stringify(transition) + "\n", "utf-8");
      console.log(`\n🧠 [TransitionBuffer] Logged topology (Energy: ${energy}) -> PyTorch Data Loader`);
    } catch (e) {
      console.warn(`[TransitionBuffer] PyTorch loop serialization failed: ${String(e)}`);
    }
  }
}
