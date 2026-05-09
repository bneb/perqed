import { spawn, type Subprocess } from "bun";
import { randomUUID } from "node:crypto";

/** Default timeout for the LSP initialize handshake (ms). */
const INIT_TIMEOUT_MS = 60_000;
/** Default timeout for individual LSP request/response round-trips (ms). */
const REQUEST_TIMEOUT_MS = 30_000;
/** Grace period before SIGKILL after SIGTERM during shutdown (ms). */
const SHUTDOWN_GRACE_MS = 3_000;

export interface LeanResult {
  success: boolean;
  isComplete: boolean;
  hasSorry: boolean;
  error?: string;
  rawOutput: string;
}

export class LeanBridge {
  private readonly leanBinary: string;
  private readonly cwd?: string;
  private readonly leanProjectRoot: string;

  public isReady = false;
  private proc?: Subprocess;
  private buffer: Buffer = Buffer.alloc(0);
  private messageId = 1;
  private responseCallbacks = new Map<number, { resolve: Function, reject: Function }>();
  private diagnosticsMap = new Map<string, any[]>();
  private waitProgressMap = new Map<string, Function[]>();
  private _uriCounter = 0;

  constructor(leanBinary?: string, cwd?: string) {
    this.leanBinary = leanBinary ?? `${process.env.HOME}/.elan/bin/lean`;
    this.cwd = cwd ?? process.cwd();
    const sandboxDir = this.cwd!;
    this.leanProjectRoot = sandboxDir.split("/runs/")[0] ?? sandboxDir;
  }

  async initialize(initTimeoutMs: number = INIT_TIMEOUT_MS): Promise<void> {
    if (this.isReady) return;

    const lakeBinary = `${process.env.HOME}/.elan/bin/lake`;
    const leanCmdArgs = ["env", this.leanBinary, "--server"];
    const bwrapBin = process.env.BWRAP_BIN ?? "bwrap";
    const sandboxDir = this.cwd!;

    const macOsProfile = `
      (version 1)
      (deny default)
      (allow file-read*)
      (allow file-write* (subpath "${this.leanProjectRoot}"))
      (allow process-exec (literal "${this.leanBinary}") (literal "${lakeBinary}") (with no-sandbox))
      (allow process-fork)
      (allow network*)
      (allow ipc-posix*)
      (allow ipc-sysv*)
    `;

    const cmd = process.platform === 'darwin' 
      ? ["sandbox-exec", "-p", macOsProfile, lakeBinary, ...leanCmdArgs]
      : [
          bwrapBin,
          "--ro-bind", "/", "/",
          "--dev", "/dev",
          "--proc", "/proc",
          "--bind", sandboxDir, sandboxDir,
          "--ro-bind-try", `${this.leanProjectRoot}/.lake`, `${sandboxDir}/.lake`,
          "--ro-bind-try", `${this.leanProjectRoot}/lakefile.lean`, `${sandboxDir}/lakefile.lean`,
          "--unshare-all",
          "--die-with-parent",
          lakeBinary, ...leanCmdArgs
      ];

    this.proc = spawn(cmd, {
      cwd: this.leanProjectRoot, // Execute from root so `lake env` finds lakefile.lean on Darwin!
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // ── Layer 1+2: Atomic Init Race ──────────────────────────────────────
    // Race the LSP handshake against process death. If lake/lean dies
    // before responding (bad binary, missing lakefile, segfault), we
    // reject immediately instead of waiting for the full timeout.
    this.startReader();

    const initPromise = this.sendRequest("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {}
    }, initTimeoutMs);

    const deathPromise = this.proc.exited.then((code) => {
      if (!this.isReady) {
        throw new Error(
          `[LeanBridge] lean --server exited during init (exit=${code}). ` +
          `Check that 'lake' and 'lean' are installed and the lakefile.lean exists.`
        );
      }
    });

    try {
      await Promise.race([initPromise, deathPromise]);
    } catch (e: any) {
      // Kill the hung/dead process before re-throwing
      this.forceKill();
      throw new Error(
        `[LeanBridge] Init failed: ${e?.message ?? e}`
      );
    }

    this.sendNotification("initialized", {});
    this.isReady = true;
  }

  private async startReader() {
    if (!this.proc) return;
    const reader = (this.proc.stdout as any).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        this.buffer = Buffer.concat([this.buffer, Buffer.from(value)]);
        this.processBuffer();
      }
    } catch(e) {}
  }

  private processBuffer() {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const headerText = this.buffer.subarray(0, headerEnd).toString();
      const match = headerText.match(/Content-Length: (\d+)/i);
      if (match) {
        const contentLength = parseInt(match[1]!, 10);
        const totalLength = headerEnd + 4 + contentLength;
        if (this.buffer.length >= totalLength) {
          const body = this.buffer.subarray(headerEnd + 4, totalLength).toString();
          this.buffer = this.buffer.subarray(totalLength);
          
          try {
            const msg = JSON.parse(body);
            this.handleMessage(msg);
          } catch(e) {}
          continue;
        }
      }
      break;
    }
  }

  private handleMessage(msg: any) {
    if (msg.id !== undefined && !msg.method) {
      const callbacks = this.responseCallbacks.get(msg.id);
      if (callbacks) {
        if (msg.error) callbacks.reject(msg.error);
        else callbacks.resolve(msg.result);
        this.responseCallbacks.delete(msg.id);
      }
    } 
    else if (msg.method) {
      if (msg.method === "textDocument/publishDiagnostics") {
        this.diagnosticsMap.set(msg.params.uri, msg.params.diagnostics);
      } else if (msg.method === "$/lean/fileProgress") {
        if (msg.params.processing.length === 0) {
          const waiters = this.waitProgressMap.get(msg.params.textDocument.uri) || [];
          waiters.forEach(w => w());
          this.waitProgressMap.set(msg.params.textDocument.uri, []);
        }
      }
    }
  }

  private sendRequest(method: string, params: any, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      let settled = false;

      // ── Layer 3: Per-Request Timeout ────────────────────────────────
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.responseCallbacks.delete(id);
          reject(new Error(
            `[LeanBridge] LSP request '${method}' (id=${id}) timed out after ${timeoutMs}ms`
          ));
        }
      }, timeoutMs);

      this.responseCallbacks.set(id, {
        resolve: (result: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        },
        reject: (err: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        }
      });

      const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      this.writePayload(payload);
    });
  }

  private sendNotification(method: string, params: any) {
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params });
    this.writePayload(payload);
  }

  private writePayload(payload: string) {
    if (!this.proc) return;
    // Dead process guard: don't write to a pipe connected to nothing
    if (this.proc.killed || this.proc.exitCode !== null) {
      console.warn(`[LeanBridge] Attempted write to dead lean process (exit=${this.proc.exitCode}). Ignoring.`);
      return;
    }
    const data = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
    try {
      (this.proc.stdin as any).write(data);
    } catch (e: any) {
      console.warn(`[LeanBridge] Write to lean stdin failed: ${e?.message}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.proc) {
      try {
        await this.sendRequest("shutdown", null, 5_000);
        this.sendNotification("exit", null);
        // Give it a moment to exit gracefully
        await Promise.race([
          this.proc.exited,
          new Promise(r => setTimeout(r, SHUTDOWN_GRACE_MS)),
        ]);
      } catch (e) {}
      this.forceKill();
    }
    this.isReady = false;
  }

  /** Unconditionally kill the lean process tree. */
  private forceKill(): void {
    if (!this.proc) return;
    try {
      this.proc.kill(9); // SIGKILL — no negotiation
    } catch {}
    // Drain all pending callbacks so nothing hangs
    for (const [id, cb] of this.responseCallbacks) {
      try { cb.reject(new Error('[LeanBridge] Process killed')); } catch {}
    }
    this.responseCallbacks.clear();
    this.proc = undefined;
  }

  private waitForProgress(uri: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Timeout waiting for Lean syntax verification"));
        }
      }, timeoutMs);

      const waiters = this.waitProgressMap.get(uri) || [];
      waiters.push(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      });
      this.waitProgressMap.set(uri, waiters);
    });
  }

  buildLeanSource(
    theoremName: string,
    signature: string,
    tactics: string[],
    preamble: string = "import Mathlib\nopen Nat\n\n",
  ): string {
    const tacticBlock = tactics.map((t) => `  ${t}`).join("\n");
    return [
      preamble.trimEnd(),
      "",
      `theorem ${theoremName} ${signature} := by`,
      tacticBlock,
      "",
      `def main : IO Unit := IO.println "PROOF_VALID"`,
      "",
    ].join("\n");
  }

  async checkProof(
    theoremName: string,
    signature: string,
    tactics: string[],
    timeoutMs: number = 30_000,
    preamble: string = "import Mathlib\nopen Nat\n\n",
  ): Promise<LeanResult> {
    const source = this.buildLeanSource(theoremName, signature, tactics, preamble);
    return this.executeLean(source, timeoutMs);
  }

  async executeLean(
    source: string,
    timeoutMs: number = 30_000,
  ): Promise<LeanResult> {
    if (!this.isReady) await this.initialize();

    // MACRO EXECUTION DEFENSE: Prevent un-sandboxed Apple Sillicon natively evaluating `#eval` payloads.
    if (this.containsUnsafeMacros(source)) {
       console.error("[LeanBridge] CRITICAL: Dropped payload containing blocked macros (`#eval`, `run_cmd`).");
       return { success: false, isComplete: false, hasSorry: false, rawOutput: "ERROR: Code contains blocked elaboration macros.", error: "Code contains blocked elaboration macros." };
    }

    const uri = `file://${this.leanProjectRoot}/.lean_lsp_exec_${randomUUID().slice(0, 8)}.lean`;
    this.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "lean", version: 1, text: source }
    });

    try {
      await this.waitForProgress(uri, timeoutMs);
    } catch (e: any) {
      this.sendNotification("textDocument/didClose", { textDocument: { uri } });
      return {
        success: false,
        isComplete: false,
        hasSorry: false,
        error: "Lean execution timed out",
        rawOutput: ""
      };
    }

    const diag = this.diagnosticsMap.get(uri) || [];
    this.sendNotification("textDocument/didClose", { textDocument: { uri } });

    let hasHardError = false;
    let hasSorry = false;
    let errorMsg = "";

    for (const d of diag) {
      if (d.severity === 1) {
        hasHardError = true;
        errorMsg += "error: " + d.message + "\n";
      }
      if (d.severity === 2 && (d.message.includes("uses 'sorry'") || d.message.includes("uses `sorry`"))) {
        hasSorry = true;
      }
    }

    const rawOutput = diag.map(d => d.message).join("\n");

    if (hasHardError) {
      return { success: false, isComplete: false, hasSorry: false, error: errorMsg, rawOutput };
    }
    if (hasSorry) {
      return { success: false, isComplete: false, hasSorry: true, error: undefined, rawOutput };
    }

    return { success: true, isComplete: true, hasSorry: false, error: undefined, rawOutput };
  }

  async checkSyntax(signature: string): Promise<boolean> {
    const source = `${signature} := by sorry\n\ndef main : IO Unit := IO.println "SYNTAX_CHECK"\n`;
    const result = await this.executeLean(source, 10_000);
    if (result.error && result.error.includes("error:")) return false;
    return true;
  }

  async isTrivial(theoremName: string, signature: string): Promise<boolean> {
    const trivialTactics = ["rfl", "simp", "omega", "trivial", "decide"];
    for (const tactic of trivialTactics) {
      const result = await this.checkProof(theoremName, signature, [tactic], 5_000);
      if (result.isComplete) return true;
    }
    return false;
  }

  parseGoalCount(leanState: string): number {
    if (!leanState || leanState.trim() === "no goals") return 0;
    const match = leanState.match(/^(\d+)\s+goals/i);
    if (match) return parseInt(match[1]!, 10);
    
    // LSP specific handling for goals
    const unsolvedMatch = leanState.match(/unsolved goals/gi);
    if (unsolvedMatch) return unsolvedMatch.length;
    return 1;
  }

  splitGoals(leanState: string): string[] {
    const count = this.parseGoalCount(leanState);
    if (count <= 1) return [leanState.trim()];
    let parts: string[];
    if (leanState.includes("\ncase ")) {
      parts = leanState.split(/\n(?=case )/);
    } else {
      parts = leanState.split(/\n\n/);
    }
    return parts
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .filter(p => !/^\d+\s+goals$/i.test(p));
  }

  async verifyStructuralSkeleton(
    leanCode: string,
    timeoutMs: number = 30_000,
  ): Promise<{ valid: boolean; sorryGoals: string[] }> {
    if (!this.isReady) await this.initialize();
    
    // MACRO EXECUTION DEFENSE: Prevent un-sandboxed Apple Sillicon natively evaluating `#eval` payloads.
    if (this.containsUnsafeMacros(leanCode)) {
       console.error("[LeanBridge] CRITICAL: Dropped payload containing blocked macros (`#eval`, `run_cmd`).");
       return { valid: false, sorryGoals: [] };
    }

    const uri = `file://${this.leanProjectRoot}/.lean_lsp_temp_${randomUUID().slice(0, 8)}.lean`;
    this.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "lean", version: 1, text: leanCode }
    });

    try {
      await this.waitForProgress(uri, timeoutMs);
    } catch {
      return { valid: false, sorryGoals: [] };
    }

    let symbols: any[] = [];
    try {
      symbols = await this.sendRequest("textDocument/documentSymbol", { textDocument: { uri } });
    } catch (e) {
      console.warn("[LeanBridge] DocumentSymbol request failed, falling back to string matching:", e);
    }

    const diag = this.diagnosticsMap.get(uri) || [];
    this.sendNotification("textDocument/didClose", { textDocument: { uri } });

    let hasHardError = false;
    let hasSorry = false;
    const sorryGoals: string[] = [];

    // Helper to find the narrowest enclosing symbol for a given line
    const findEnclosingSymbol = (syms: any[], line: number): string | null => {
      let bestMatch: any = null;
      for (const s of syms) {
        if (s?.range?.start?.line <= line && s?.range?.end?.line >= line) {
          bestMatch = s;
          if (s.children && s.children.length > 0) {
            const childMatch = findEnclosingSymbol(s.children, line);
            if (childMatch) return childMatch;
          }
        }
      }
      return bestMatch ? bestMatch.name : null;
    };

    for (const d of diag) {
      if (d.severity === 1) {
        hasHardError = true;
      }
      if (d.severity === 2 && (d.message.includes("uses 'sorry'") || d.message.includes("uses `sorry`"))) {
        hasSorry = true;
        
        const enclosingName = findEnclosingSymbol(symbols, d.range.start.line);
        if (enclosingName) {
           // DocumentSymbol often returns the name with trailing signature details or namespaces, 
           // but for simple lemmas the name is just the lemma name. We extract the first word.
           sorryGoals.push(enclosingName.split(/\s+/)[0]!);
        } else {
           // Fallback to string matching if AST lookup fails or doesn't cover the range
           const lineContent = leanCode.split("\n")[d.range.start.line] || "";
           const match = /(?:theorem|def|lemma|instance|class)\s+([^ \({:]+)/.exec(lineContent);
           if (match) {
              sorryGoals.push(match[1]!);
           } else {
              const nameMatch = /warning:\s+(?:declaration\s+)?'([^']+)'\s+uses\s+[`']sorry[`']/g.exec(d.message);
              if (nameMatch) sorryGoals.push(nameMatch[1]!);
           }
        }
      }
    }

    if (hasHardError) return { valid: false, sorryGoals: [] };
    if (!hasSorry) return { valid: false, sorryGoals: [] };

    return { valid: true, sorryGoals };
  }

  /**
   * Evaluates if the source string contains dangerous native execution macros.
   * Blocks `#eval`, `#exec`, `run_cmd`, custom `elab`/`macro` definitions,
   * and access to the Lean compiler internals.
   */
  private containsUnsafeMacros(source: string): boolean {
     const blocklist = [
         /#\s*(?:eval|exec)/,
         /\b(?:run_cmd|elab|macro)\b/,
         /import\s+Lean\b/
     ];
     return blocklist.some(pattern => pattern.test(source));
  }
}
