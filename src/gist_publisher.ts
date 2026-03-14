/**
 * Gist Publisher — pushes live proof state to a GitHub Gist
 * for the website's minutiae page to poll.
 *
 * Gated behind env vars:
 *   PERQED_GIST_ID   — The Gist ID to update
 *   GITHUB_TOKEN      — A GitHub PAT with gist scope
 *
 * Usage: call publishState() after each proof iteration.
 */

export interface PerqedLiveState {
  theorem: string;
  iteration: number;
  elapsed: string;
  status: 'proving' | 'solved' | 'failed' | 'idle';
  tacticState: string;
  thinking: string;
  tactics: Array<{ tactic: string; confidence: number; result?: string }>;
  timestamp: string;
  events: Array<{ time: string; message: string; type?: 'success' | 'error' | 'info' }>;
}

const GIST_FILENAME = 'perqed_state.json';

export class GistPublisher {
  private gistId: string;
  private token: string;
  private events: PerqedLiveState['events'] = [];
  private startTime: number = Date.now();

  constructor(gistId: string, token: string) {
    this.gistId = gistId;
    this.token = token;
  }

  /**
   * Create a GistPublisher from env vars, or return null if not configured.
   */
  static fromEnv(): GistPublisher | null {
    const gistId = process.env.PERQED_GIST_ID;
    const token = process.env.GITHUB_TOKEN;
    if (!gistId || !token) return null;
    return new GistPublisher(gistId, token);
  }

  /**
   * Add an event to the log (kept in memory, flushed on publish).
   */
  addEvent(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const time = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.events.push({ time, message, type });

    // Keep only last 50 events
    if (this.events.length > 50) {
      this.events = this.events.slice(-50);
    }
  }

  /**
   * Get elapsed time as a human-readable string.
   */
  getElapsed(): string {
    const secs = Math.floor((Date.now() - this.startTime) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  }

  /**
   * Reset the event log and start timer (call at the beginning of each proof).
   */
  reset() {
    this.events = [];
    this.startTime = Date.now();
  }

  /**
   * Publish state to the Gist. Non-blocking — errors are logged but swallowed.
   */
  async publishState(state: Omit<PerqedLiveState, 'timestamp' | 'events' | 'elapsed'>): Promise<void> {
    const fullState: PerqedLiveState = {
      ...state,
      elapsed: this.getElapsed(),
      timestamp: new Date().toISOString(),
      events: this.events,
    };

    try {
      const res = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(fullState, null, 2),
            },
          },
        }),
      });

      if (!res.ok) {
        console.error(`⚠️  Gist publish failed: HTTP ${res.status}`);
      }
    } catch (err) {
      // Swallow — never let telemetry break the proof loop
      console.error(`⚠️  Gist publish error: ${err}`);
    }
  }
}
