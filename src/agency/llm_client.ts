/**
 * PerqedLLM — Centralized GoogleGenAI Client
 * 
 * Provides a resilient API layer for the multi-agent swarm. All interactions 
 * with the Gemini API route through this client to inherit unified limits,
 * exponential backoff, and robust quota handling gracefully without crashing nodes.
 */

import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

export class PerqedLLM {
  private readonly ai: GoogleGenAI;

  constructor(apiKey?: string | { apiKey: string }) {
    let key: string;
    
    // Support both direct string or options object for compatibility
    if (typeof apiKey === 'object' && apiKey !== null) {
      key = apiKey.apiKey;
    } else {
      key = apiKey as string;
    }

    key = key || process.env.GEMINI_API_KEY || "";
    
    if (!key) {
      throw new Error("PerqedLLM requires a Gemini API key. Set it in GEMINI_API_KEY env or pass it explicitly.");
    }
    
    this.ai = new GoogleGenAI({ apiKey: key });
  }

  get models() {
    return {
      generateContent: (params: GenerateContentParameters) => this.safeGenerateContent(params)
    };
  }

  private async safeGenerateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    let retries = 5;
    while (retries > 0) {
      try {
        return await this.ai.models.generateContent(params);
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        
        const status = err?.response?.status || err?.status;
        const msg = err?.message || "";
        
        const isQuota = status === 429 || status === 503 || msg.includes("429") || msg.includes("503") || msg.includes("quota");
        const logMsg = isQuota ? "Gemini API capacity/quota spike detected" : `Gemini API error (${msg})`;
        
        console.warn(`[PerqedLLM] ${logMsg}. Retries left: ${retries}. Sleeping 5 seconds...`);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    throw new Error("PerqedLLM exhausted all retries.");
  }
}
