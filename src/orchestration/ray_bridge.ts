import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as readline from "node:readline";

/**
 * Singleton proxy bridging local Single-Threaded XState pipelines into 
 * massively scalable Ray execution farms via IPC streaming.
 */
export class RayOrchestrator {
  private static instance: RayOrchestrator;
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private requestQueue: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private reqIdCounter = 0;
  
  public isHealthy: boolean = false;

  private constructor() {
    this.bootIPC();
  }

  public static getInstance(): RayOrchestrator {
    if (!RayOrchestrator.instance) {
      RayOrchestrator.instance = new RayOrchestrator();
    }
    return RayOrchestrator.instance;
  }

  private bootIPC() {
    const pythonScript = path.join(__dirname, "../python/ray_cluster_manager.py");
    this.child = spawn("python3", [pythonScript]);

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("[Ray Bridge] CRITICAL: Failed to mount IPC Pipes.");
    }

    this.rl = readline.createInterface({
      input: this.child.stdout,
      terminal: false,
    });

    this.rl.on("line", (line) => {
      try {
        const payload = JSON.parse(line);
        const reqId = payload.reqId;
        
        if (reqId !== undefined && this.requestQueue.has(reqId)) {
          const { resolve, reject } = this.requestQueue.get(reqId)!;
          this.requestQueue.delete(reqId);
          
          if (payload.status === "ERROR" || payload.status === "FATAL_ERROR") {
             reject(new Error(payload.message || payload.trace));
          } else {
             resolve(payload);
          }
        } else if (reqId === undefined) {
             // System broadcast
             console.log(`[Ray Manager] System broadcast: ${line}`);
        }
      } catch (e) {
        // Parsing error or noise
      }
    });

    this.child.on("close", (code) => {
      this.isHealthy = false;
      console.warn(`[Ray Bridge] Ray IPC Link Closed (Code ${code}). Will automatically attempt to re-boot on next payload.`);
      this.child = null;
    });

    this.child.on("error", (err) => {
      this.isHealthy = false;
      console.error(`[Ray Bridge] FATAL Daemon Fault:`, err);
    });
    
    this.isHealthy = true;
  }

  /**
   * Dispatches a raw JSON instruction strictly mapped over stdin queues.
   */
  private async dispatch(commandObj: any): Promise<any> {
    if (!this.isHealthy || !this.child || !this.child.stdin) {
       console.log("[Ray Bridge] Connection severed. Rebooting Daemon...");
       this.bootIPC();
       await new Promise(r => setTimeout(r, 500)); // Grace delay
    }
    
    return new Promise((resolve, reject) => {
      const reqId = this.reqIdCounter++;
      this.requestQueue.set(reqId, { resolve, reject });
      
      const payload = JSON.stringify({ reqId, ...commandObj }) + "\n";
      this.child!.stdin!.write(payload, (error) => {
        if (error) {
           this.requestQueue.delete(reqId);
           reject(error);
        }
      });
    });
  }

  /**
   * Offloads `optimizeThroughFunnel` array logic from the single-threaded Node loop onto parallel Ray edge instances.
   */
  public async dispatchFunnel(flatMatrix: string, n: number, neighbors: number = 500, maxFlips: number = 3): Promise<{ bestMatrixRaw: string, bestEnergy: number } | null> {
    try {
        const ping = await this.dispatch({ command: "ping" });
        if (ping.status === "RAY_UNAVAILABLE") {
            // Provide a clean, boolean fallback layer out cleanly
            return null;
        }
        
        const response = await this.dispatch({
            command: "dispatch_funnel",
            flat_matrix: flatMatrix,
            n: n,
            neighbors: neighbors,
            max_flips: maxFlips,
            ray_chunks: 10
        });
        
        if (response.status === "SUCCESS") {
            return {
                bestMatrixRaw: response.bestMatrixRaw,
                bestEnergy: response.bestEnergy
            };
        }
        return null;
    } catch(e) {
        console.warn(`[Ray Bridge] IPC Routing Error: ${e}`);
        return null;
    }
  }

  /**
   * Kills child securely cleanly to prevent zombie nodes natively.
   */
  public destroy() {
     if (this.child) {
        this.child.kill();
     }
  }
}
