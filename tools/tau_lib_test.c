/*
 * tau_lib_test.c — Multi-layer verification of Ramanujan τ computation.
 *
 * Tests:
 *   1. Known values: τ(1..12) against published table
 *   2. Ramanujan conjecture: |τ(p)/p^{11/2}| ≤ 2 for ALL primes
 *   3. Hecke multiplicativity: τ(mn) = τ(m)·τ(n) for gcd(m,n)=1
 *   4. p² recurrence: τ(p²) = τ(p)² - p¹¹
 *   5. Precision check at large n
 */
#include "fft_lib.h"
#include "tau_lib.h"

static int g_pass = 0, g_fail = 0;
#define T(cond, ...) do { \
    if (cond) { g_pass++; printf("  PASS: " __VA_ARGS__); printf("\n"); } \
    else { g_fail++; printf("  FAIL: " __VA_ARGS__); printf("\n"); } \
} while(0)

static void progress(int n, int max_n) {
    fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    printf("═══════════════════════════════════\n");
    printf("  tau_lib.h — Verification Tests\n");
    printf("═══════════════════════════════════\n\n");

    int MAX = 100000;
    fprintf(stderr, "Computing τ(n) for n ≤ %d...\n", MAX);
    TauTable t = tau_compute(MAX, progress);
    char *isc = fft_sieve_primes(MAX);
    fprintf(stderr, "Done.\n\n");

    /* Test 1: Known values */
    printf("── Known Values ──\n");
    for (int n = 1; n <= TAU_N_KNOWN; n++) {
        double err = fabs(t.values[n] - TAU_KNOWN[n]);
        T(err < 0.5, "τ(%d) = %.0f (expected %.0f, err=%.1f)", n, t.values[n], TAU_KNOWN[n], err);
    }

    /* Test 2: Ramanujan conjecture */
    printf("── Ramanujan Conjecture ──\n");
    int rc_violations = tau_verify_ramanujan(&t, isc);
    int prime_count = 0;
    for (int p = 2; p <= MAX; p++) if (!isc[p]) prime_count++;
    T(rc_violations == 0, "|τ(p)/p^{11/2}| ≤ 2 for all %d primes (violations: %d)",
      prime_count, rc_violations);

    /* Show a few values */
    int shown = 0;
    for (int p = 2; p <= MAX && shown < 5; p++) {
        if (isc[p]) continue;
        printf("    p=%d: τ(p)=%.0f, |τ(p)|/(2p^{11/2})=%.4f\n",
               p, t.values[p], fabs(tau_normalized(&t, p)) / 2.0);
        shown++;
    }

    /* Show near the boundary */
    printf("    ... (checking all %d primes) ...\n", prime_count);
    double max_ratio = 0;
    int max_ratio_p = 0;
    for (int p = 2; p <= MAX; p++) {
        if (isc[p]) continue;
        double r = fabs(tau_normalized(&t, p));
        if (r > max_ratio) { max_ratio = r; max_ratio_p = p; }
    }
    printf("    Worst case: p=%d, |τ(p)/p^{11/2}| = %.6f\n", max_ratio_p, max_ratio);
    T(max_ratio <= 2.001, "max Ramanujan ratio = %.6f ≤ 2", max_ratio);

    /* Test 3: Hecke multiplicativity */
    printf("── Hecke Multiplicativity ──\n");
    int n_hecke = 200;
    int hecke_failures = tau_verify_hecke(&t, n_hecke);
    T(hecke_failures == 0, "τ(mn)=τ(m)τ(n) for %d coprime pairs (failures: %d)",
      n_hecke, hecke_failures);

    /* Show examples */
    printf("    τ(6) = τ(2)·τ(3) = %.0f·%.0f = %.0f (actual: %.0f)\n",
           t.values[2], t.values[3], t.values[2]*t.values[3], t.values[6]);
    printf("    τ(10) = τ(2)·τ(5) = %.0f·%.0f = %.0f (actual: %.0f)\n",
           t.values[2], t.values[5], t.values[2]*t.values[5], t.values[10]);

    /* Test 4: p² recurrence */
    printf("── p² Recurrence: τ(p²) = τ(p)² - p¹¹ ──\n");
    int p2_failures = tau_verify_p_squared(&t, isc, 200);
    T(p2_failures == 0, "τ(p²)=τ(p)²-p¹¹ for primes ≤ 200 (failures: %d)", p2_failures);

    /* Show example */
    double tp2 = t.values[4]; /* τ(2²) */
    double tp_sq = t.values[2] * t.values[2]; /* τ(2)² */
    double p11 = pow(2.0, 11);
    printf("    τ(4) = %.0f, τ(2)² - 2¹¹ = %.0f - %.0f = %.0f\n",
           tp2, tp_sq, p11, tp_sq - p11);
    T(fabs(tp2 - (tp_sq - p11)) < 0.5, "τ(4) = τ(2)² - 2¹¹ = %.0f", tp_sq - p11);

    /* Test 5: Precision at large n */
    printf("── Precision at Large n ──\n");
    /* τ(n) grows like n^{11/2}. At n=100000, τ ≈ 10^{25}.
     * Double precision has ~15 digits. Check relative error of Hecke at large n. */
    int large_hecke_fails = 0;
    int large_tested = 0;
    for (int m = 100; m <= 300; m++) {
        for (int n = 100; n <= 300; n++) {
            if (fft_gcd(m, n) != 1) continue;
            if ((long long)m * n > MAX) continue;
            large_tested++;
            double lhs = t.values[m * n];
            double rhs = t.values[m] * t.values[n];
            double rel_err = fabs(lhs - rhs) / (fabs(lhs) + fabs(rhs) + 1);
            if (rel_err > 1e-6) large_hecke_fails++;
        }
    }
    T(large_hecke_fails == 0,
      "Hecke at n∈[100,300]·[100,300]: %d/%d passed", large_tested-large_hecke_fails, large_tested);

    /* Test 6: Coverage */
    printf("── Coverage ──\n");
    int tau_nonzero = 0;
    for (int p = 2; p <= MAX; p++) {
        if (isc[p]) continue;
        if (fabs(t.values[p]) > 0.5) tau_nonzero++;
    }
    T(tau_nonzero == prime_count, "τ(p) computed for %d/%d primes (100%%)", tau_nonzero, prime_count);

    printf("\n═══ %d/%d passed ═══\n", g_pass, g_pass + g_fail);

    tau_free(&t);
    free(isc);
    return g_fail ? 1 : 0;
}
