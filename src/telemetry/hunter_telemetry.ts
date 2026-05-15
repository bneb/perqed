/**
 * Sprint 24: HunterTelemetry — Non-Blocking Gist Uplink
 *
 * Fire-and-forget telemetry client that pushes hunt state to a GitHub Gist.
 * Strictly fail-safe: swallows all network errors to prevent crashing
 * the mathematical engine during multi-day overnight runs.
 */

export interface HuntTelemetryPayload {
  n: number;
  restartsCompleted: number;
  totalRestarts: number;
  globalBestEnergy: number;
  globalBestGraph: number[][] | null;
  latestDegrees: number[];
  elapsedSeconds: number;
  timestamp: string;
}

export class HunterTelemetry {
  /**
   * Push hunt state to the Perqed telemetry Gist.
   * Fire-and-forget: catches all errors to protect the hunt.
   */
  static async push(payload: HuntTelemetryPayload): Promise<void> {
    const gistId = process.env.PERQED_GIST_ID;
    const token = process.env.PERQED_GITHUB_TOKEN;

    if (!gistId || !token) {
      return; // Silently skip — no env vars, no telemetry
    }

    const gistContent = {
      description: `Perqed Hunt: n=${payload.n} | Energy: ${payload.globalBestEnergy} | Restart ${payload.restartsCompleted}/${payload.totalRestarts}`,
      files: {
        "hunter_telemetry.json": {
          content: JSON.stringify(payload, null, 2),
        },
      },
    };

    try {
      const response = await fetch(
        `https://api.github.com/gists/${gistId}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gistContent),
        },
      );

      if (!response.ok) {
        console.error(
          `⚠️ Telemetry push failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch {
      // Swallow all network errors. The hunt must go on.
    }
  }
}
