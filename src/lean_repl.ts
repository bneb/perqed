import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";

export interface ReplResponse {
  env: number;
  messages?: Array<{
    severity: "error" | "warning" | "information";
    pos: { line: number; column: number };
    data: string;
  }>;
  goals?: string[];
}

export class LeanREPLBridge {
  private proc: ChildProcessWithoutNullStreams;
  private buffer: string = "";
  private pendingRequests: Array<(res: ReplResponse) => void> = [];

  constructor(workspaceDir: string) {
    const absPath = path.resolve(workspaceDir);
    console.log(`[LeanREPL] Initializing Lake inside absolute CWD: ${absPath}`);
    this.proc = spawn("lake", ["exe", "repl"], {
      cwd: absPath,
    });

    this.proc.stdout.on("data", (chunk: Buffer) => {
      console.log("[LeanREPL] RAW STDOUT:", chunk.toString());
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.proc.stderr.on("data", (chunk: Buffer) => {
      console.error("[LeanREPL] RAW STDERR:", chunk.toString());
    });
  }

  private processBuffer() {
    if (!this.buffer.trim()) return;

    try {
      const payload = JSON.parse(this.buffer) as ReplResponse;
      // Complete JSON parsed successfully!
      const resolve = this.pendingRequests.shift();
      if (resolve) resolve(payload);
      
      // Clear the buffer for the next command response
      this.buffer = "";
    } catch (e) {
      // JSON cannot be parsed yet, wait for more chunks.
      // E.g., SyntaxError: Unexpected end of JSON input
    }
  }

  async sendCmd(payload: Record<string, any>): Promise<ReplResponse> {
    return new Promise((resolve) => {
      this.pendingRequests.push(resolve);
      this.proc.stdin.write(JSON.stringify(payload) + "\n\n");
    });
  }

  kill() {
    this.proc.kill("SIGKILL");
    this.proc.stdout.destroy();
    this.proc.stderr.destroy();
    this.proc.stdin.destroy();
  }
}
