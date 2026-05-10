import { expect, test, describe, mock, afterEach } from "bun:test";
import { SurrogateClient } from "../src/search/surrogate_client";

describe("SurrogateClient", () => {
  afterEach(() => {
    // Restore fetch after each test
    (global as any).fetch = undefined;
  });

  test("checkHealth returns true when server responds ok", async () => {
    (global as any).fetch = async (_url: string) => ({
      ok: true,
      json: async () => ({ status: "ok", device: "cpu" }),
    });
    const client = new SurrogateClient();
    expect(await client.checkHealth()).toBe(true);
  });

  test("checkHealth returns false when server returns non-ok status", async () => {
    (global as any).fetch = async () => ({ ok: false, json: async () => ({}) });
    const client = new SurrogateClient();
    expect(await client.checkHealth()).toBe(false);
  });

  test("checkHealth returns false on connection error", async () => {
    (global as any).fetch = async () => { throw new Error("ECONNREFUSED"); };
    const client = new SurrogateClient();
    expect(await client.checkHealth()).toBe(false);
  });

  test("predict POSTs matrix_flat and returns numeric energy", async () => {
    const expectedEnergy = 210;
    (global as any).fetch = async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string);
      expect(body.matrix_flat).toBeTypeOf("string");
      return {
        ok: true,
        json: async () => ({ energy: expectedEnergy }),
      };
    };
    const client = new SurrogateClient();
    const flat = "0".repeat(595);
    const result = await client.predict(flat);
    expect(result).toBe(expectedEnergy);
  });

  test("predict uses custom base URL when configured", async () => {
    let capturedUrl = "";
    (global as any).fetch = async (url: string, _opts: RequestInit) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({ energy: 0 }) };
    };
    const client = new SurrogateClient("http://custom-host:9999");
    await client.predict("0".repeat(595));
    expect(capturedUrl).toContain("custom-host:9999");
  });

  test("predict throws on server error response", async () => {
    (global as any).fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Invalid input" }),
    });
    const client = new SurrogateClient();
    await expect(client.predict("0".repeat(595))).rejects.toThrow();
  });
});
