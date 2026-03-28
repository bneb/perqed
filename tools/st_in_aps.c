/*
 * st_in_aps.c — Verify Sato-Tate independence from arithmetic progressions.
 *
 * Key hypothesis for the parity impossibility theorem:
 *   Σ_{p≡a(q)} f(τ̃(p))·log(p) ≈ μ_ST(f) · N/φ(q)
 *
 * If this holds, then f(τ̃(p)) carries no information about p mod q,
 * and positive f-weighting cannot improve the minor arc bound.
 *
 * Tests:
 * 1. For q = 3,5,7,11,13: compute the ratio per residue class
 * 2. For several f (constant, τ̃², |τ̃|, exp(-τ̃)): check uniformity
 * 3. Quantify the deviation from uniformity
 */
#include "fft_lib.h"
#include "tau_lib.h"
#include <math.h>

static void prog(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

static int euler_phi(int n) {
    int r = n;
    for (int p = 2; p*p <= n; p++)
        if (n%p==0) { while(n%p==0) n/=p; r -= r/p; }
    if (n>1) r -= r/n;
    return r;
}

int main(void) {
    int N = 200000;
    fprintf(stderr, "Init (N=%d)...\n", N);
    char *isc = fft_sieve_primes(N);
    TauTable tau = tau_compute(N, prog);
    fprintf(stderr, "Done.\n\n");

    int test_qs[] = {3, 5, 7, 11, 13, 17, 19, 23, 0};

    /* Weight functions to test */
    typedef struct { const char *name; } WF;
    WF wfs[] = {
        {"1 (constant)"},
        {"τ̃²"},
        {"|τ̃|"},
        {"exp(-τ̃)"},
        {"max(0, τ̃)"},
        {NULL}
    };

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Sato-Tate Independence from APs\n");
    printf("  N = %d\n", N);
    printf("═══════════════════════════════════════════════════════\n\n");

    for (int wi = 0; wfs[wi].name; wi++) {
        printf("  ─── Weight: %s ───\n", wfs[wi].name);

        /* Compute global average */
        double total_w = 0;
        int total_primes = 0;
        for (int p = 2; p <= N; p++) {
            if (isc[p]) continue;
            double t = tau_normalized(&tau, p);
            double w;
            switch(wi) {
                case 0: w = 1.0; break;
                case 1: w = t*t; break;
                case 2: w = fabs(t); break;
                case 3: w = exp(-t); break;
                case 4: w = t > 0 ? t : 0; break;
                default: w = 1.0;
            }
            total_w += w;
            total_primes++;
        }
        double global_avg = total_w / total_primes;

        printf("  Global avg f(τ̃(p)): %.6f  (over %d primes)\n\n", global_avg, total_primes);
        printf("  %4s | %5s | %8s | %8s | %8s\n",
               "q", "a", "avg_f", "ratio", "dev%");

        double max_dev = 0;
        int n_tests = 0;

        for (int qi = 0; test_qs[qi]; qi++) {
            int q = test_qs[qi];
            int phi_q = euler_phi(q);

            for (int a = 1; a < q; a++) {
                if (fft_gcd(a, q) != 1) continue;

                double sum_w = 0;
                int cnt = 0;
                for (int p = 2; p <= N; p++) {
                    if (isc[p] || p % q != a) continue;
                    double t = tau_normalized(&tau, p);
                    double w;
                    switch(wi) {
                        case 0: w = 1.0; break;
                        case 1: w = t*t; break;
                        case 2: w = fabs(t); break;
                        case 3: w = exp(-t); break;
                        case 4: w = t > 0 ? t : 0; break;
                        default: w = 1.0;
                    }
                    sum_w += w;
                    cnt++;
                }
                double avg = (cnt > 0) ? sum_w / cnt : 0;
                double ratio = avg / global_avg;
                double dev = fabs(ratio - 1.0) * 100;
                if (dev > max_dev) max_dev = dev;
                n_tests++;

                /* Only print a few representative rows */
                if (a <= 2 || a == q-1) {
                    printf("  %4d | %5d | %8.4f | %8.4f | %7.2f%%\n",
                           q, a, avg, ratio, dev);
                }
            }
        }

        printf("  ...\n");
        printf("  Max deviation across %d (q,a) pairs: %.2f%%\n\n", n_tests, max_dev);
    }

    printf("═══════════════════════════════════════════════════════\n");
    printf("  INTERPRETATION\n");
    printf("═══════════════════════════════════════════════════════\n\n");
    printf("  If max deviation is small (< 5%%), then f(τ̃(p)) is\n");
    printf("  independent of p mod q — the key hypothesis HOLDS.\n\n");
    printf("  This means: positive f-weighting cannot exploit the\n");
    printf("  modular arithmetic of primes. The only way to get\n");
    printf("  cancellation is through NEGATIVE values of f,\n");
    printf("  which destroy counting viability.\n");

    tau_free(&tau); free(isc);
    return 0;
}
