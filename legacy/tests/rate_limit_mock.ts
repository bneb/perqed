import { ATBClient } from "../src/net/atb_client";

async function runMockTest() {
  console.log("Starting Strict Token Bucket API Mock Server...");

  // Mock server token bucket state
  let serverTokens = 2;
  const SERVER_RATE = 2.0; // 2 requests per second allowed
  let lastRefill = Date.now() / 1000;

  const server = Bun.serve({
    port: 3004,
    fetch(req) {
      const now = Date.now() / 1000;
      serverTokens = Math.min(2, serverTokens + (now - lastRefill) * SERVER_RATE);
      lastRefill = now;

      if (serverTokens >= 1) {
        serverTokens -= 1;
        return new Response("OK", { status: 200 });
      } else {
        return new Response("Too Many Requests", { status: 429 });
      }
    },
  });

  console.log(`Mock server running at http://localhost:${server.port}`);

  // Create an ATB client that starts blindly, and should dynamically adapt to the SERVER_RATE
  const client = new ATBClient({
    bucketSize: 2,
    initialRate: 5.0, // starts aggressively
    minRate: 0.5,
    delta: 0.2,
    alpha: 1.1,
    beta: 1.1,
  });

  console.log("\nInitiating burst of 10 requests...");
  let successes = 0;
  let t0 = Date.now();

  for (let i = 0; i < 10; i++) {
    const res = await client.fetch(`http://localhost:${server.port}`);
    if (res.status === 200) successes++;
    console.log(`[Req ${i + 1}/10] Completed with status ${res.status} at +${Date.now() - t0}ms`);
  }

  server.stop();
  console.log(`\nTest Complete: ${successes}/10 successful responses. Time taken: ${Date.now() - t0}ms`);
  console.log("If ATB works correctly, it should have gracefully stretched the 10 requests across ~4 seconds without throwing exceptions.");
}

runMockTest().catch(console.error);
