import { fromPromise } from "xstate";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FlagAlgebraOutput } from "../types";

const execAsync = promisify(exec);

export const flagAlgebraActor = fromPromise<FlagAlgebraOutput, { target_r: number; target_s: number }>(
  async ({ input }) => {
    try {
      console.log(`\n♾️ [Flag Algebra] Escalating to Continuous Mathematics. Formulating Continuous Constraints for R(${input.target_r}, ${input.target_s})...`);
      
      const { stdout } = await execAsync(`python3 src/python/flag_solver.py --target_r=${input.target_r} --target_s=${input.target_s}`);
      
      // Parse strictly the stdout (which is purely JSON, stderr was handled correctly in Python)
      const parseTarget = stdout.substring(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
      const result = JSON.parse(parseTarget);
      
      if (result.status === "OPTIMAL") {
        console.log(`♾️ [Flag Algebra] SDP Solved. Asymptotic Graph Upper Bounds: [${result.lowerBound.toFixed(4)}, ${result.upperBound.toFixed(4)}]`);
        return {
          status: "SDP_LIMIT_REACHED",
          lowerBound: result.lowerBound,
          upperBound: result.upperBound
        };
      }
      
      return {
        status: "SDP_ERROR",
        lowerBound: 0,
        upperBound: 0
      };
      
    } catch (e: any) {
      console.warn(`[FlagAlgebra] Sub-shell fault. Ensure CVXPY pipeline is solid. Falling back gracefully. Error param: ${e?.message}`);
      return {
        status: "SDP_ERROR",
        lowerBound: 0,
        upperBound: 0
      };
    }
  }
);
