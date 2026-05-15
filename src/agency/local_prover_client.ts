import * as net from "node:net";

const SOCKET_PATH = "/tmp/tactic.sock";

/**
 * Local Prover IPC Bridge.
 * Replaces high-latency external HTTP LLM queries with sub-millisecond memory-mapped UNIX Socket calls.
 */
export class LocalProverClient {
  /**
   * Directly invokes the python native tactic daemon over an IPC pipe.
   */
  public static async queryTacticDaemon(prompt: string, mode: "generation" | "error_correction" = "generation"): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ path: SOCKET_PATH }, () => {
        const payload = JSON.stringify({ prompt, mode }) + "\x00";
        client.write(payload);
      });

      let responseBuffer = Buffer.alloc(0);

      client.on("data", (data) => {
        responseBuffer = Buffer.concat([responseBuffer, Buffer.from(data)]);
        // Check for null terminator indicating packet completion
        if (responseBuffer.includes(0x00)) {
            client.end();
            const packet = responseBuffer.subarray(0, responseBuffer.indexOf(0x00)).toString('utf-8');
            try {
                const jsonPayload = JSON.parse(packet);
                if (jsonPayload.status === "error") {
                    reject(new Error(jsonPayload.error));
                } else {
                    resolve(jsonPayload.response);
                }
            } catch (e) {
                resolve(packet); // raw string response
            }
        }
      });

      client.on("error", (err) => {
        reject(new Error(`Failed to bind to Local Tactic Server. Is tactic_server.py running? ${err.message}`));
      });
    });
  }

  /**
   * Mocks the GoogleGenAI interface specifically to support existing legacy agent bounds
   * gracefully degrading the codebase requirements.
   */
  public static createMockGenAI() {
     return {
         models: {
             generateContent: async ({ contents }: any) => {
                 let promptStr = "";
                 if (typeof contents === "string") {
                     promptStr = contents;
                 } else if (contents.parts) {
                     promptStr = contents.parts.map((p: any) => p.text).join(" ");
                 } else {
                     promptStr = JSON.stringify(contents);
                 }
                 
                 const textResponse = await LocalProverClient.queryTacticDaemon(promptStr, "error_correction");
                 return {
                     text: textResponse
                 };
             }
         }
     }
  }
}
