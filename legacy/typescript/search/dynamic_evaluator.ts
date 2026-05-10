/**
 * dynamic_evaluator.ts — Runtime C++ JIT compilation & Bun FFI linkage.
 *
 * Writes a C++ energy evaluator to disk, compiles it to a shared library
 * via clang++, and loads it via bun:ffi — enabling sub-nanosecond energy
 * evaluation for arbitrary graph constraints without restarting perqed.
 */
import { dlopen, FFIType, suffix } from "bun:ffi";
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface CompiledEvaluator {
  /** Evaluate energy for a flat uint8 adjacency matrix. */
  evaluate: (matrix: Uint8Array, size: number) => number;
  /** Release the shared library handle. */
  cleanup: () => void;
}

/**
 * C++ stub: a simple array-sum evaluator useful for FFI pipeline validation.
 * Returns the sum of all bytes in the matrix — deterministic and testable.
 */
export const STUB_CPP_SUM = `
#include <cstdint>

extern "C" {
  int32_t calculate_energy(const uint8_t* matrix, int32_t size) {
    int32_t sum = 0;
    for (int32_t i = 0; i < size; i++) {
      sum += matrix[i];
    }
    return sum;
  }
}
`;

/**
 * C++ Ramsey energy evaluator stub (AVX-friendly, no SIMD intrinsics for portability).
 * Counts K_r cliques + K_s independent sets via bitmask enumeration.
 */
export const STUB_CPP_RAMSEY = `
#include <cstdint>
#include <cstring>

extern "C" {
  int32_t calculate_energy(const uint8_t* matrix, int32_t n) {
    // Count K_4 cliques in adjacency matrix (simplified bitmask)
    int32_t cliques = 0;
    for (int i = 0; i < n; i++)
      for (int j = i+1; j < n; j++) {
        if (!matrix[i*n+j]) continue;
        for (int k = j+1; k < n; k++) {
          if (!matrix[i*n+k] || !matrix[j*n+k]) continue;
          for (int l = k+1; l < n; l++) {
            if (matrix[i*n+l] && matrix[j*n+l] && matrix[k*n+l]) cliques++;
          }
        }
      }
    // Count K_6 independent sets
    int32_t indep = 0;
    for (int i = 0; i < n; i++)
      for (int j = i+1; j < n; j++) {
        if (matrix[i*n+j]) continue;
        for (int k = j+1; k < n; k++) {
          if (matrix[i*n+k] || matrix[j*n+k]) continue;
          for (int l = k+1; l < n; l++) {
            if (matrix[i*n+l] || matrix[j*n+l] || matrix[k*n+l]) continue;
            for (int m = l+1; m < n; m++) {
              if (matrix[i*n+m]||matrix[j*n+m]||matrix[k*n+m]||matrix[l*n+m]) continue;
              for (int p = m+1; p < n; p++) {
                if (!matrix[i*n+p]&&!matrix[j*n+p]&&!matrix[k*n+p]&&!matrix[l*n+p]&&!matrix[m*n+p]) indep++;
              }
            }
          }
        }
      }
    return cliques + indep;
  }
}
`;

/**
 * Compile a C++ evaluator and load it via bun:ffi.
 *
 * @param runName   Unique run identifier (used for artifact paths)
 * @param cppSource Raw C++ source. Must export `calculate_energy(uint8_t*, int32_t) -> int32_t`.
 * @returns         A CompiledEvaluator ready for immediate use
 * @throws          If clang++ is not found or compilation fails
 */
export async function buildAndLoadEvaluator(
  runName: string,
  cppSource: string
): Promise<CompiledEvaluator> {
  const runDir = `agent_workspace/runs/${runName}`;
  await mkdir(runDir, { recursive: true });

  const srcPath = join(runDir, "eval.cpp");
  const libPath = join(runDir, `libeval.${suffix}`);

  // Write source
  await Bun.write(srcPath, cppSource);

  // JIT Compile
  const compileResult = await $`clang++ -O3 -march=native -shared -fPIC -o ${libPath} ${srcPath}`.nothrow();
  if (compileResult.exitCode !== 0) {
    throw new Error(
      `C++ compilation failed for run '${runName}':\n${compileResult.stderr.toString()}`
    );
  }

  // Bind via Bun FFI
  const lib = dlopen(libPath, {
    calculate_energy: {
      args: [FFIType.ptr, FFIType.i32],
      returns: FFIType.i32,
    },
  });

  return {
    evaluate: (matrix: Uint8Array, size: number): number => {
      return lib.symbols.calculate_energy(matrix, size) as number;
    },
    cleanup: () => lib.close(),
  };
}
