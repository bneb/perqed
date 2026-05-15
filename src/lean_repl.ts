import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";
import { existsSync } from "node:fs";

export interface ReplResponse {
  env: number;
  messages?: Array<{
    severity: "error" | "warning" | "information";
    pos: { line: number; column: number };
    data: string;
  }>;
  goals?: string[];
  proofState?: number;
  proofStatus?: string;
  message?: string;
}

export interface ILeanREPL {
  sendCmd(cmd: any): Promise<ReplResponse>;
  sendBatchCmd(cmds: any[]): Promise<ReplResponse[]>;
  close(): void;
}

export class LeanREPLBridge implements ILeanREPL {
  private proc: ChildProcessWithoutNullStreams;
  private buffer: string = "";
  private pendingRequests: Array<{ resolve: (res: ReplResponse) => void; reject: (err: Error) => void }> = [];
  private lastStderr: string = "";
  private hasExited: boolean = false;
  private exitCode: number | null = null;

  /**
   * Walk up from `startDir` to find the nearest directory containing
   * `lakefile.lean`. This ensures `lake exe repl` boots with full
   * Mathlib access even when called from a run subdirectory.
   */
  private static findProjectRoot(startDir: string): string {
    let dir = startDir;
    const root = path.parse(dir).root;
    while (dir !== root) {
      if (existsSync(path.join(dir, "lakefile.lean"))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    // Fallback: if nothing found, use startDir (will likely fail, but
    // gives a clear error from lake rather than a silent wrong-dir boot)
    return startDir;
  }

  constructor(workspaceDir: string) {
    const requestedDir = path.resolve(workspaceDir);
    const projectRoot = LeanREPLBridge.findProjectRoot(requestedDir);
    const lakeBin = `${process.env.HOME}/.elan/bin/lake`;
    if (projectRoot !== requestedDir) {
      console.log(`[LeanREPL] Resolved project root: ${projectRoot} (requested: ${requestedDir})`);
    }
    console.log(`[LeanREPL] Initializing Lake inside CWD: ${projectRoot}`);
    this.proc = spawn(lakeBin, ["exe", "repl"], {
      cwd: projectRoot,
    });

    this.proc.stdout.on("data", (chunk: Buffer) => {
      const data = chunk.toString();
      console.log("[LeanREPL] RAW STDOUT:", data);
      this.buffer += data;
      this.processBuffer();
    });

    this.proc.stderr.on("data", (chunk: Buffer) => {
      const data = chunk.toString();
      console.error("[LeanREPL] RAW STDERR:", data);
      this.lastStderr += data;
    });

    this.proc.on("exit", (code) => {
      this.hasExited = true;
      this.exitCode = code;
      console.error(`[LeanREPL] Process exited with code ${code}. Stderr: ${this.lastStderr}`);
      
      // Reject all pending requests
      while (this.pendingRequests.length > 0) {
        const { reject } = this.pendingRequests.shift()!;
        reject(new Error(`Lean REPL exited with code ${code}. Stderr: ${this.lastStderr}`));
      }
    });

    this.proc.on("error", (err) => {
      console.error("[LeanREPL] Process error:", err);
      this.hasExited = true;
      while (this.pendingRequests.length > 0) {
        const { reject } = this.pendingRequests.shift()!;
        reject(err);
      }
    });
  }

  private processBuffer() {
    if (!this.buffer.trim()) return;

    // The REPL might output multiple JSON objects or partial objects
    // We try to find the first complete JSON object
    try {
      // Find the first occurrence of '{' and the corresponding closing '}'
      // This is a bit simplistic but usually works for REPL JSON output
      const startIdx = this.buffer.indexOf("{");
      if (startIdx === -1) {
        this.buffer = ""; // Clear noise
        return;
      }

      // Try to parse from startIdx to the end
      // If it fails, it might be incomplete
      let endIdx = this.buffer.lastIndexOf("}");
      if (endIdx === -1 || endIdx < startIdx) return;

      const candidate = this.buffer.substring(startIdx, endIdx + 1);
      const payload = JSON.parse(candidate) as ReplResponse;
      
      const request = this.pendingRequests.shift();
      if (request) request.resolve(payload);
      
      this.buffer = this.buffer.substring(endIdx + 1);
      if (this.buffer.trim()) {
        this.processBuffer(); // Process remaining buffer
      }
    } catch (e) {
      // JSON cannot be parsed yet, wait for more chunks.
    }
  }

  async sendCmd(payload: Record<string, any>): Promise<ReplResponse> {
    if (this.hasExited) {
      throw new Error(`Cannot send command: Lean REPL has exited with code ${this.exitCode}. Stderr: ${this.lastStderr}`);
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ resolve, reject });
      this.proc.stdin.write(JSON.stringify(payload) + "\n\n");
    });
  }

  /**
   * Submits multiple independent commands to the Lean REPL and waits for all of them
   * to return a response. This allows for batched evaluation of N tactics against
   * the same base environment without spinning up new REPLs or waiting sequentially.
   */
  async sendBatchCmd(payloads: Record<string, any>[]): Promise<ReplResponse[]> {
    if (this.hasExited) {
      throw new Error(`Cannot send commands: Lean REPL has exited with code ${this.exitCode}. Stderr: ${this.lastStderr}`);
    }

    const promises = payloads.map(payload => {
      return new Promise<ReplResponse>((resolve, reject) => {
        this.pendingRequests.push({ resolve, reject });
        this.proc.stdin.write(JSON.stringify(payload) + "\n\n");
      });
    });

    return Promise.all(promises);
  }

  public close() {
    try {
      if (this.proc) {
        this.proc.kill("SIGKILL");
        this.proc.stdout?.destroy();
        this.proc.stderr?.destroy();
        this.proc.stdin?.destroy();
      }
    } catch (e) {
      // Ignore any errors during cleanup
    }
  }
}

/**
 * RemoteLeanREPLBridge — RPC client for disaggregated Lean 4 REPL execution.
 * Allows the orchestrator to dispatch validation workloads to a scalable backend
 * fleet instead of bottlenecking the local Node.js process.
 */
export class RemoteLeanREPLBridge implements ILeanREPL {
  constructor(private rpcEndpoint: string) {}

  async sendCmd(cmd: any): Promise<ReplResponse> {
    const res = await this.sendBatchCmd([cmd]);
    return res[0]!;
  }

  async sendBatchCmd(cmds: any[]): Promise<ReplResponse[]> {
    const response = await fetch(`${this.rpcEndpoint}/api/repl/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: cmds }),
    });

    if (!response.ok) {
      throw new Error(`Remote REPL failed: ${response.statusText}`);
    }

    return await response.json() as ReplResponse[];
  }

  public close(): void {
    // No local process to kill; stateless HTTP requests.
  }
}
