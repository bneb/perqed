import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface GraveyardEntry {
  hypothesisSignature: string;
  failureReason: string;
  killerEdgeCase: any;
  timestamp: string;
}

export class LakatosianVault {
  /**
   * Returns the path to the abstract graveyard JSON.
   */
  static getGraveyardPath(workspaceDir: string): string {
    const dataDir = join(workspaceDir, "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    return join(dataDir, "abstract_graveyard.json");
  }

  /**
   * Normalizes a hypothesis string by removing excess whitespace and casing.
   * This ensures we don't store 5 identical mathematical bounds that just have varying spaces.
   */
  static normalizeSignature(hypothesis: string): string {
    return hypothesis
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Records a strictly falsified hypothesis boundary.
   */
  static recordFailure(workspaceDir: string, hypothesis: string, killerEdgeCase: any, failureReason: string = "COUNTER_EXAMPLE_FOUND"): void {
    const path = this.getGraveyardPath(workspaceDir);
    const normalized = this.normalizeSignature(hypothesis);

    let entries: GraveyardEntry[] = [];
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        entries = JSON.parse(raw) as GraveyardEntry[];
      } catch (e) {
        console.warn(`[LakatosianVault] Failed to parse graveyard: ${String(e)}`);
        entries = [];
      }
    }

    // Deduplication check
    if (entries.some(e => this.normalizeSignature(e.hypothesisSignature) === normalized)) {
      // Already exists, skip recording to prevent bloat
      return;
    }

    const newEntry: GraveyardEntry = {
      hypothesisSignature: hypothesis,
      failureReason,
      killerEdgeCase,
      timestamp: new Date().toISOString(),
    };

    entries.push(newEntry);

    // Write-through
    writeFileSync(path, JSON.stringify(entries, null, 2), "utf-8");
    console.log(`\n💾 [LakatosianVault] Hypothesis hashed & persisted to absolute graveyard.`);
  }

  /**
   * Retrieves the most recent falsified hypotheses (limit default: 20)
   * to ensure LLM context tokens don't explode.
   */
  static getAllFailures(workspaceDir: string, limit: number = 20): GraveyardEntry[] {
    const path = this.getGraveyardPath(workspaceDir);
    if (!existsSync(path)) {
      return [];
    }

    try {
      const raw = readFileSync(path, "utf-8");
      const entries = JSON.parse(raw) as GraveyardEntry[];
      
      // Since new entries are appended to the end, simply reversing provides chronological order (newest first)
      entries.reverse();
      
      return entries.slice(0, limit);
    } catch {
      return [];
    }
  }
}
