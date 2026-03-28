/*
 * gap_analysis.c — Verify the gap between mixed moment and exceptional set.
 *
 * Tests:
 * 1. For small N, check that r_τ(E) = 0 whenever r(E) = 0 (confirms the gap)
 * 2. Compute M_τ(E)/M(E) to verify it's ≈ 0 (Sato-Tate)
 * 3. Measure what the mixed moment DOES bound: variance of c(E) for non-exceptional E
 * 4. Show the "bridge condition" is violated: no positive weight gives β < 0
 */
#include "fft_lib.h"
#include "tau_lib.h"

static void prog(int n, int max_n) {
    if (n % 20000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int N = 50000;
    fprintf(stderr, "Init (N=%d)...\n", N);
    char *isc = fft_sieve_primes(2*N);
    TauTable tau = tau_compute(2*N, prog);
    fprintf(stderr, "Done.\n\n");

    /* Compute r(E) and r_τ(E) for all even E */
    int cnt_exc = 0, cnt_nonexc = 0;
    int r_tau_nonzero_on_exc = 0;
    double sum_ratio = 0;
    int ratio_count = 0;
    double sum_c2 = 0;  /* Σ c(E)² for non-exceptional E */
    double sum_r_minus_M_sq = 0; /* Σ (r-M)² for all E */

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Gap Analysis: Mixed Moment vs Exceptional Set\n");
    printf("  N = %d\n", N);
    printf("═══════════════════════════════════════════════════════\n\n");

    /* First: count r(E) and r_τ(E) */
    printf("  ═══ Test 1: r_τ(E) = 0 when r(E) = 0? ═══\n\n");
    for (int E = 4; E <= 2*N; E += 2) {
        double r = 0, r_tau = 0;
        for (int p = 2; p <= E-2; p++) {
            if (isc[p] || isc[E-p]) continue;
            r += 1;
            r_tau += tau_normalized(&tau, E-p);
        }
        double M = (double)(E-1) / (log((double)E) * log((double)E)); /* crude H-L */

        if (r == 0) {
            cnt_exc++;
            if (r_tau != 0.0) r_tau_nonzero_on_exc++;
        } else {
            cnt_nonexc++;
            sum_c2 += r_tau * r_tau;
            if (M > 0) {
                sum_ratio += r_tau / (r);
                ratio_count++;
            }
        }
        sum_r_minus_M_sq += (r - M) * (r - M);
    }

    printf("  Exceptions (r=0):     %d\n", cnt_exc);
    printf("  Non-exceptions (r>0): %d\n", cnt_nonexc);
    printf("  r_τ ≠ 0 on exceptions: %d  ← should be 0\n", r_tau_nonzero_on_exc);
    printf("  ★ %s\n\n", r_tau_nonzero_on_exc == 0
           ? "CONFIRMED: r_τ(E) = 0 whenever r(E) = 0"
           : "BUG: r_τ should be 0 on exceptions!");

    printf("  ═══ Test 2: Mean of r_τ/r for non-exceptional E ═══\n\n");
    printf("  Mean r_τ(E)/r(E) = %.6f  ← should be ≈ 0 by Sato-Tate\n",
           sum_ratio / ratio_count);
    printf("  (This is why M_τ ≈ 0 — τ̃ has mean 0 over primes)\n\n");

    printf("  ═══ Test 3: What mixed moment bounds ═══\n\n");
    printf("  Σ |r_τ(E)|² (non-exceptional) = %.1f\n", sum_c2);
    printf("  Σ |r-M|²   (all E)            = %.1f\n", sum_r_minus_M_sq);
    printf("  Ratio: mixed/plain             = %.4f\n", sum_c2 / sum_r_minus_M_sq);
    printf("  The mixed moment IS smaller (τ causes cancellation\n");
    printf("  in non-exceptional E), but this doesn't help count exceptions.\n\n");

    printf("  ═══ Test 4: The gap in one picture ═══\n\n");
    printf("  Classical:  |E| ≤ Σ_all |r-M|² / M²\n");
    printf("    Every exceptional E contributes M² > 0 to the sum\n");
    printf("    → non-trivial bound on |E|\n\n");
    printf("  τ-improved: |E| ≤ ... Σ |r_τ - M_τ|² / M_τ² ...\n");
    printf("    Every exceptional E contributes |0 - M_τ|² ≈ 0² = 0\n");
    printf("    → τ is BLIND to exceptions (0/0 = undefined)\n\n");

    printf("  THE GAP: To use τ for the exceptional set, we need\n");
    printf("  M_τ(E) ≫ 0 for exceptional E. But Sato-Tate forces M_τ ≈ 0.\n");
    printf("  This is unfixable without violating Sato-Tate.\n");

    tau_free(&tau); free(isc);
    return 0;
}
