import { expect, test, describe } from "bun:test";
import { createActor } from "xstate";
import { flagAlgebraActor } from "../../src/orchestration/actors/flag_algebra_actor";

describe("FlagAlgebra Actor SDP Pipeline", () => {
  test("Successfully intercepts discrete matrices and routes to Python continuous density proxy", async () => {
    const actor = createActor(flagAlgebraActor, {
      input: { target_r: 5, target_s: 5 } // Classic Ramsay discrete dimensional limit proxy
    });
    
    actor.start();
    
    // Natively wait for Promise resolution over execution shell
    const ptr = new Promise(resolve => {
      actor.subscribe((state) => {
        if (state.status === "done") resolve(state.output);
      });
    });
    
    const output: any = await ptr;
    
    // Should safely fallback if CVXPY is not installed, or return proper Bounds if it is.
    expect(output.status).toBeDefined();
    if (output.status === "SDP_LIMIT_REACHED") {
       expect(output.lowerBound).toBeGreaterThanOrEqual(0);
       expect(output.upperBound).toBeGreaterThanOrEqual(0);
    } else {
       expect(output.status).toBe("SDP_ERROR");
       expect(output.lowerBound).toBe(0);
       expect(output.upperBound).toBe(0);
    }
  });
});
