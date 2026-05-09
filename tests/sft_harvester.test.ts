import { describe, test, expect, mock } from "bun:test";
import { SFTHarvester, type TelemetryEventStream } from "../src/scripts/harvest_sft";
import * as fs from "node:fs";

describe("SFTHarvester Event-Driven Telemetry", () => {
  test("emits SFT pair as a structured event to the registered telemetry stream", () => {
    // 1. Setup mock telemetry stream
    const mockStream: TelemetryEventStream = {
      emit: mock(),
    };

    // 2. Register it with the harvester
    SFTHarvester.setTelemetryStream(mockStream);

    // 3. Emit a pair
    SFTHarvester.emitSftPair("⊢ n + m = m + n", "omega");

    // 4. Assert it was called with the correct structured event
    expect(mockStream.emit).toHaveBeenCalledTimes(1);
    const callArgs = (mockStream.emit as any).mock.calls[0][0];
    
    expect(callArgs).toMatchObject({
      eventType: "SFT_TRAINING_PAIR",
      payload: {
        state: "⊢ n + m = m + n",
        tactic: "omega"
      }
    });
    expect(callArgs.timestamp).toBeDefined();

    // Reset
    SFTHarvester.setTelemetryStream(undefined);
  });
});
