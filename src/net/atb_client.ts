/**
 * Adaptive Token Bucket (ATB) Client
 *
 * Implements the client-side optimal rate limiting algorithm as defined in
 * "Rethinking HTTP API Rate Limiting: A Client-Side Approach" (Farkiani et al.)
 *
 * It prevents HTTP 429 floods on shared capacity endpoints by treating the APIs
 * as shared network bottlenecks, dynamically scaling its token generation rate
 * based on success vs 429 failure.
 */

export interface ATBConfig {
  /** Maximum burst capacity */
  bucketSize: number;
  /** Additive increase step (\delta) in tokens/sec */
  delta: number;
  /** Minimum token generation rate (\sigma) in tokens/sec */
  minRate: number;
  /** Multiplicative increase \alpha */
  alpha: number;
  /** Multiplicative increase \beta */
  beta: number;
  /** Initial rate in tokens/sec */
  initialRate: number;
}

export class ATBClient {
  private tokens: number;
  private rate: number;
  private lastUsed: number;
  private lastCongestionRate: number = Infinity;

  constructor(private readonly config: ATBConfig = {
    bucketSize: 2,          // Allow short bursts
    delta: 0.1,             // Add 0.1 tokens/sec on success
    minRate: 0.1,           // Floor at 1 token per 10 seconds
    alpha: 1.2,             // 20% multiplicative increase under congestion
    beta: 1.2,              // 20% multiplicative increase otherwise
    initialRate: 0.33,      // arXiv max limit is exactly 1 req / 3 sec
  }) {
    this.tokens = config.bucketSize;
    this.rate = config.initialRate;
    this.lastUsed = Date.now() / 1000;
  }

  /**
   * Block until the bucket naturally regenerates a token.
   */
  private async acquire(): Promise<void> {
    while (true) {
      const now = Date.now() / 1000;
      this.tokens = Math.min(
        this.config.bucketSize,
        this.tokens + (now - this.lastUsed) * this.rate
      );

      if (this.tokens >= 1) {
        this.tokens -= 1;
        this.lastUsed = Date.now() / 1000;
        return;
      }

      // Calculate time required to reach 1 token (add +10ms buffer to prevent hot loop)
      const deficit = 1 - this.tokens;
      const waitTimeSec = deficit / this.rate;
      this.lastUsed = now; // update lastUsed to prevent compounding jumps during spins
      
      await new Promise(r => setTimeout(r, (waitTimeSec * 1000) + 10));
    }
  }

  private increaseRate(): void {
    if (this.rate < this.lastCongestionRate) {
      this.rate = Math.max(this.rate + this.config.delta, this.rate * this.config.alpha);
    } else {
      this.rate = Math.max(this.rate + this.config.delta, this.rate * this.config.beta);
    }
    // Cap at a reasonable hard max (arXiv won't safely let us stay above 1 req/sec)
    this.rate = Math.min(this.rate, 2);
  }

  private decreaseRate(): void {
    this.lastCongestionRate = this.rate;
    this.tokens = 0; // Drain all accumulated tokens
    
    // Add jitter: rand(-0.25, 0.25) * minRate
    const jitter = (Math.random() - 0.5) * (this.config.minRate * 0.5);
    this.rate = Math.max(this.config.minRate + jitter, this.rate / 2);
  }

  /**
   * Drop-in replacement for fetch(), wrapped in ATB rate limit rules.
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    let attempts = 0;
    while (true) {
      await this.acquire();
      
      attempts++;
      const res = await fetch(url, options);

      if (res.status === 429) {
        console.warn(`[ATB] HTTP 429 Received on attempt ${attempts}. Decreasing rate to ${this.rate / 2}`);
        this.decreaseRate();
        
        // Respect Retry-After if provided
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          const waitTime = parseInt(retryAfter, 10);
          if (!isNaN(waitTime)) {
            await new Promise(r => setTimeout(r, waitTime * 1000));
            this.lastUsed = Date.now() / 1000;
          }
        }
        continue;
      }

      // Success
      this.increaseRate();
      return res;
    }
  }
}

// Global singleton for arXiv to share the token bucket across calls
export const arxivRateLimiter = new ATBClient();
