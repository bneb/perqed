/**
 * Sprint 25: SFT Harvester — Lean Proof → JSONL Extractor
 *
 * Parses Lean 4 files for SFT_STATE/SFT_TACTIC markers and extracts
 * the (State → Tactic) pair into OpenAI conversation JSONL format
 * for Supervised Fine-Tuning of the DeepSeek Prover Tactician.
 *
 * Usage:
 *   bun run src/scripts/harvest_sft.ts src/lean/ErdosGyarfasN4.lean
 *   bun run src/scripts/harvest_sft.ts src/lean/ErdosGyarfasN4.lean data/sft_dataset.jsonl
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface SFTRecord {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

export class SFTHarvester {
  /**
   * Parse a Lean file for SFT markers and extract the state-tactic pair.
   * Returns null if markers are missing or malformed.
   */
  static extractPair(
    leanFileContent: string,
  ): { state: string; tactic: string } | null {
    const lines = leanFileContent.split("\n");
    const stateLines: string[] = [];
    let tacticLine: string | null = null;
    let inState = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();

      if (line.includes("--//-- SFT_STATE_START")) {
        inState = true;
        continue;
      }
      if (line.includes("--//-- SFT_STATE_END")) {
        inState = false;
        continue;
      }
      if (line.includes("--//-- SFT_TACTIC")) {
        // The tactic is the next non-empty line
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]!.trim();
          if (nextLine.length > 0) {
            tacticLine = nextLine;
            break;
          }
        }
        break;
      }

      if (inState) {
        // Strip Lean comment prefix (-- ) from state lines
        stateLines.push(line.replace(/^--\s*/, ""));
      }
    }

    if (stateLines.length === 0 || !tacticLine) {
      return null;
    }

    return {
      state: stateLines.join("\n"),
      tactic: tacticLine,
    };
  }

  /**
   * Format a state-tactic pair into OpenAI conversation JSONL format.
   */
  static formatRecord(state: string, tactic: string): SFTRecord {
    return {
      messages: [
        {
          role: "system",
          content:
            "You are an expert Lean 4 tactic generator. Given a proof state, output the exact tactic required to advance the proof.",
        },
        {
          role: "user",
          content: `Current State:\n${state}`,
        },
        {
          role: "assistant",
          content: tactic,
        },
      ],
    };
  }

  /**
   * Append a state-tactic pair to the specified JSONL dataset file.
   */
  static appendToJsonl(
    datasetPath: string,
    state: string,
    tactic: string,
  ): void {
    const record = this.formatRecord(state, tactic);
    const dir = path.dirname(datasetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(datasetPath, JSON.stringify(record) + "\n", "utf8");
  }
}

// CLI execution
if (import.meta.main) {
  const targetFile =
    process.argv[2] || "src/lean/ErdosGyarfasN4.lean";
  const datasetPath = process.argv[3] || "data/sft_dataset.jsonl";

  try {
    const content = fs.readFileSync(targetFile, "utf8");
    const pair = SFTHarvester.extractPair(content);

    if (pair) {
      SFTHarvester.appendToJsonl(datasetPath, pair.state, pair.tactic);
      console.log(`✅ Harvested SFT pair → ${datasetPath}`);
      console.log(`   State: ${pair.state.split("\n").length} lines`);
      console.log(`   Tactic: ${pair.tactic}`);
    } else {
      console.error("❌ No valid SFT markers found in the file.");
      process.exit(1);
    }
  } catch (error) {
    console.error(`🚨 Error: ${error}`);
    process.exit(1);
  }
}
