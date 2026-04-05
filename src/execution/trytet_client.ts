import * as crypto from "crypto";
import { TrytetDaemon } from "./trytet_daemon";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";

export interface TrytetExecutionRequest {
  code: string;
  image: string; // e.g. "python-3.11.wasm"
  timeoutMs?: number;
}

export interface TrytetExecutionResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export class TrytetClient {
  private endpoint: string;
  private publicKeyHex: string;
  private privateKey: crypto.KeyObject;
  private nodeProviderId: string = "local_daemon"; // Default expected by local Tet engine tests

  constructor(endpoint: string = "http://localhost:3000") {
    this.endpoint = endpoint;
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    this.publicKeyHex = pubDer.subarray(pubDer.length - 32).toString('hex');
    this.privateKey = privateKey;
  }

  /**
   * Generates a deterministic Fuel Voucher authorized by the ephemeral Ed25519 agent key.
   */
  private generateFuelVoucher(fuelLimit: number): any {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour valid
    const nonce = crypto.randomUUID();

    // Reconstruct exact Rust signed bytes structure: agent_id + provider_id + fuel(u64) + expiry(u64) + nonce
    const agentBuffer = Buffer.from(this.publicKeyHex, "utf8");
    const providerBuffer = Buffer.from(this.nodeProviderId, "utf8");
    const fuelBuffer = Buffer.alloc(8);
    fuelBuffer.writeBigUInt64BE(BigInt(fuelLimit));
    const expiryBuffer = Buffer.alloc(8);
    expiryBuffer.writeBigUInt64BE(BigInt(expiryTimestamp));
    const nonceBuffer = Buffer.from(nonce, "utf8");

    const signedData = Buffer.concat([agentBuffer, providerBuffer, fuelBuffer, expiryBuffer, nonceBuffer]);
    const signatureBytes = crypto.sign(null, signedData, this.privateKey);

    return {
      agent_id: this.publicKeyHex,
      provider_id: this.nodeProviderId,
      fuel_limit: fuelLimit,
      expiry_timestamp: expiryTimestamp,
      nonce: nonce,
      signature: Array.from(signatureBytes)
    };
  }

  private resolveWasmPayload(imageName: string): number[] {
    const localBinPath = path.join(process.cwd(), ".bin", imageName);
    if (fs.existsSync(localBinPath)) {
      return Array.from(fs.readFileSync(localBinPath));
    }

    // Trytet's test fixture fallback if evaluating Trytet core locally
    const trytetFixturePath = path.join(process.cwd(), "..", "trytet", "tests", "fixtures", "python_mock.wasm");
    if (fs.existsSync(trytetFixturePath)) {
       return Array.from(fs.readFileSync(trytetFixturePath));
    }

    // Since Trytet V3 strictly requires `.wasm` byte payloads but we have no registry, we throw.
    throw new Error(`CRITICAL: Trytet requires a raw Wasm payload for '${imageName}', but it was not found in .bin/${imageName}.`);
  }

  public async executeWasm(req: TrytetExecutionRequest): Promise<TrytetExecutionResponse> {
    await TrytetDaemon.ensureRunning(this.endpoint);

    let wasmPayloadArray: number[];
    try {
       wasmPayloadArray = this.resolveWasmPayload(req.image);
    } catch (e: any) {
       return { exitCode: 1, stdout: "", stderr: `Trytet Client Error: ${e.message}`, timedOut: false };
    }

    return this.executeWithVoucherRefresh(req, wasmPayloadArray, 2); // 2 max attempts
  }

  private async executeWithVoucherRefresh(req: TrytetExecutionRequest, payloadArray: number[], attemptsLeft: number): Promise<TrytetExecutionResponse> {
    // 1. Map to Trytet V3 `TetExecutionRequest` with current known Provider ID
    const fuelVoucher = this.generateFuelVoucher(10_000_000_000);
    const executeReq = {
       payload: payloadArray,
       alias: `agent_${crypto.randomUUID().slice(0, 8)}`,
       env: { "PYTHONPATH": "/workspace" },
       injected_files: { 
          "/workspace/main.py": req.code,
          "/workspace/script.py": req.code 
       },
       allocated_fuel: 10_000_000_000,
       max_memory_mb: 1024,
       call_depth: 0,
       voucher: fuelVoucher,
       target_function: null
    };

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), (req.timeoutMs ?? 30000) + 2000);

    try {
      const response = await fetch(`${this.endpoint}/v1/tet/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(executeReq),
        signal: abortController.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
         const errBody = await response.text();
         // Trytet Engine gracefully parses JSON error boundaries on Axum routes
         return { exitCode: 1, stdout: "", stderr: `Trytet Error HTTP ${response.status}: ${errBody}`, timedOut: false };
      }

      // 2. Parse Trytet V3 `TetExecutionResult`
      const resJson = await response.json() as any;
      const statusObj = resJson.status;
      
      let exitCode = 0;
      let stderrObj = "";
      let isTimeout = false;

      if (typeof statusObj === "string" && statusObj === "Success") {
         exitCode = 0;
      } else if (typeof statusObj === "object" && statusObj.Crash) {
         exitCode = 1;
         stderrObj = `[Crash: ${statusObj.Crash.error_type}] ${statusObj.Crash.message}`;
         
         // --- SELF-HEALING PROVIDER DISCOVERY ---
         if (statusObj.Crash.error_type === "EconomicViolation" && attemptsLeft > 1) {
            const match = stderrObj.match(/but this node is ([\w-]+)/);
            if (match && match[1]) {
                console.warn(`[TrytetClient] Daemon node ID changed to ${match[1]}. Re-signing Fuel Voucher...`);
                this.nodeProviderId = match[1];
                return this.executeWithVoucherRefresh(req, payloadArray, attemptsLeft - 1);
            }
         }
      } else if (typeof statusObj === "string" && statusObj === "OutOfFuel") {
         exitCode = 1;
         stderrObj = "[Crash: EconomicViolation] Out of Fuel";
         isTimeout = true;
      } else {
         exitCode = 1;
         stderrObj = `Unknown Execution Status: ${JSON.stringify(statusObj)}`;
      }

      const telemetry = resJson.telemetry || {};
      const stdoutLines = telemetry.stdout_lines || [];
      const stderrLines = telemetry.stderr_lines || [];

      return {
        exitCode,
        stdout: stdoutLines.join("\n"),
        stderr: stderrLines.length > 0 ? stderrLines.join("\n") : stderrObj,
        timedOut: isTimeout
      };
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
         return { exitCode: 1, stdout: "", stderr: "", timedOut: true };
      }
      return { exitCode: 1, stdout: "", stderr: `Trytet HTTP Error: ${e.message}`, timedOut: false };
    }
  }
}
