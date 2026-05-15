import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";
import { TrytetInstaller } from "./trytet_installer";

export class TrytetDaemon {
  private static bootLock: Promise<void> | null = null;

  static async isHealthy(endpoint: string = "http://localhost:3000"): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${endpoint}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      // Standalone mode returns 503 HTTP when OCI registries are bypassed in offline mode.
      return res.ok || res.status === 503;
    } catch {
      return false;
    }
  }

  static async ensureRunning(endpoint: string = "http://localhost:3000"): Promise<void> {
    if (await this.isHealthy(endpoint)) {
      return; // Already running
    }

    if (this.bootLock) {
       console.log("[TrytetDaemon] Boot sequence already in progress, waiting for lock...");
       await this.bootLock;
       return;
    }

    this.bootLock = (async () => {
      console.log("[TrytetDaemon] Engine offline at port 3000. Booting native daemon...");
      
      const engineRoot = process.env.PERQED_HOME || process.cwd();
      const binaryPath = TrytetInstaller.resolveBinary(engineRoot);

      // Prepare workspace logging
      const workspaceDir = process.cwd();
      const logPath = join(workspaceDir, ".trytet.log");
      const outContent = openSync(logPath, "a");

      // Spawn detached
      const child = spawn(binaryPath, [], {
        detached: true,
        stdio: ["ignore", outContent, outContent]
      });

      child.unref();

      console.log(`[TrytetDaemon] Spawned Trytet engine daemon (PID: ${child.pid}). Waiting for endpoints to become responsive...`);

      // Exponential backoff check
      for (let attempts = 0; attempts < 10; attempts++) {
        await new Promise(r => setTimeout(r, 500));
        if (await this.isHealthy(endpoint)) {
          console.log("[TrytetDaemon] Engine is ready and accepting Wasm workloads.");
          return;
        }
      }

      throw new Error(`[TrytetDaemon] Failed to establish connection with Daemon after 5 seconds. Check ${logPath}.`);
    })();

    try {
       await this.bootLock;
    } finally {
       this.bootLock = null;
    }
  }
}
