/**
 * Sprint 11: TelemetryEmitter — Non-Blocking State Broadcast
 *
 * Pushes routing signals, agent logs, and proof status to a GitHub Gist
 * at the end of every Orchestrator iteration.
 *
 * Design:
 *   - Fire-and-forget: fetch() is NOT awaited, errors swallowed
 *   - Graceful degradation: silently skips if env vars missing
 *   - Zero cost: GitHub Gist API is free
 *
 * Env vars:
 *   GITHUB_GIST_TOKEN — PAT with gist scope
 *   GITHUB_GIST_ID    — Target Gist ID
 */

import type { RoutingSignals, AttemptLog } from "../types";

// ──────────────────────────────────────────────
// Payload Types
// ──────────────────────────────────────────────

export interface TelemetryPayload {
  runId: string;
  theorem: string;
  status: "IN_PROGRESS" | "SOLVED" | "EXHAUSTED" | "ERROR";
  iteration: number;
  currentSignals: RoutingSignals;
  latestLog: AttemptLog | null;
  history: AttemptLog[];
  timestamp: string;
}

// ──────────────────────────────────────────────
// Emitter
// ──────────────────────────────────────────────

const GIST_FILENAME = "perqed_live_state.json";

export class TelemetryEmitter {
  private token: string | undefined;
  private gistId: string | undefined;

  constructor() {
    this.token = process.env.GITHUB_GIST_TOKEN;
    this.gistId = process.env.GITHUB_GIST_ID;
  }

  /** True if both env vars are set. */
  get isConfigured(): boolean {
    return !!(this.token && this.gistId);
  }

  /**
   * Push the payload to a GitHub Gist.
   *
   * Fire-and-forget: the Promise from fetch() is NOT awaited by the caller.
   * Errors are caught internally — this method never throws and never
   * blocks the orchestrator.
   */
  public emit(payload: TelemetryPayload): void {
    if (!this.token || !this.gistId) {
      // Silently skip — allows offline local dev without env vars
      return;
    }

    const fileContent = JSON.stringify(payload, null, 2);

    // Fire-and-forget: NOT awaited. The orchestrator continues immediately.
    fetch(`https://api.github.com/gists/${this.gistId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: fileContent,
          },
        },
      }),
    }).catch((err) => {
      // Swallow — never crash the proof loop for telemetry
      console.error(`⚠️ [Telemetry] Failed to emit state: ${err.message ?? err}`);
    });
  }
}
