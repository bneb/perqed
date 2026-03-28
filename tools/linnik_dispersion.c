/*
 * linnik_dispersion.c — Branch [I]: τ-enhanced level of distribution.
 *
 * The Bombieri-Vinogradov theorem says primes are well-distributed
 * in arithmetic progressions up to level Q ≤ √N ("level of distribution θ=½").
 *
 * Binary Goldbach needs θ > ½ (the Elliott-Halberstam conjecture).
 *
 * Test: Does τ-weighting improve the effective level of distribution?
 * If Σ_{q≤Q} Σ_a |θ_τ(N;q,a) - expected|² stays small past Q = √N,
 * the τ twist bypasses the BV barrier.
 *
 * Why it might work: L(Δ⊗χ, s) has NO Siegel zeros (unlike L(χ,s)).
 * Siegel zeros are the main obstruction to θ > ½.
 *
 * BV error = (1/N) · Σ_{q≤Q} Σ_{gcd(a,q)=1} |θ(N;q,a) - N/φ(q)|²/(N/φ(q))
 *
 * For level θ: BV error ≤ C·(logN)^(-A) when Q ≤ N^θ.
 */
#include "fft_lib.h"
#include "tau_lib.h"

static void progress(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

/* Euler's totient */
static int euler_phi(int n) {
    int result = n;
    for (int p = 2; p * p <= n; p++) {
        if (n % p == 0) {
            while (n % p == 0) n /= p;
            result -= result / p;
        }
    }
    if (n > 1) result -= result / n;
    return result;
}

int main(void) {
    int N = 200000;
    fprintf(stderr, "Init (N=%d)...\n", N);
    char *isc = fft_sieve_primes(N);
    TauTable tau = tau_compute(N, progress);
    fprintf(stderr, "Done.\n\n");

    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* Precompute prime sums */
    double total_theta = 0;      /* Σ log(p) for p ≤ N */
    double total_theta_tau = 0;  /* Σ log(p)·τ̃(p) for p ≤ N */
    int prime_count = 0;
    for (int p = 2; p <= N; p++) {
        if (isc[p]) continue;
        total_theta += log((double)p);
        total_theta_tau += log((double)p) * tau_normalized(&tau, p);
        prime_count++;
    }

    printf("═══════════════════════════════════════════════════════\n");
    printf("  [I] Level of Distribution: Plain vs τ-Weighted\n");
    printf("  N = %d, √N = %d, π(N) = %d\n", N, (int)sqrt((double)N), prime_count);
    printf("═══════════════════════════════════════════════════════\n\n");

    /* Test at various Q levels */
    int test_Qs[] = {10, 20, 50, 100, 200, 300, 400, 500, 0};
    int sqrtN = (int)sqrt((double)N);

    printf("  %6s | %8s | %12s | %12s | %10s | %s\n",
           "Q", "Q/√N", "BV_plain", "BV_tau", "ratio τ/p", "level");

    for (int qi = 0; test_Qs[qi]; qi++) {
        int Q = test_Qs[qi];
        double bv_plain = 0;  /* BV error for plain primes */
        double bv_tau = 0;    /* BV error for τ-weighted primes */
        int n_progressions = 0;

        for (int q = 1; q <= Q; q++) {
            int phi_q = euler_phi(q);
            double expected_plain = total_theta / phi_q;

            for (int a = 1; a <= q; a++) {
                if (fft_gcd(a, q) != 1) continue;
                n_progressions++;

                /* Count primes in progression a mod q */
                double sum_plain = 0;
                double sum_tau = 0;

                for (int p = 2; p <= N; p++) {
                    if (isc[p]) continue;
                    if (p % q != a) continue;
                    double lp = log((double)p);
                    sum_plain += lp;
                    sum_tau += lp * tau_normalized(&tau, p);
                }

                /* Error for plain: |θ(N;q,a) - θ(N)/φ(q)|² / (N/φ(q)) */
                double err_p = sum_plain - expected_plain;
                bv_plain += err_p * err_p / (total_theta / phi_q);

                /* For τ-weighted: the expected value is total_theta_tau/φ(q) */
                double expected_tau = total_theta_tau / phi_q;
                double err_t = sum_tau - expected_tau;
                bv_tau += err_t * err_t / (fabs(total_theta_tau / phi_q) + 1);
            }
        }

        /* Normalize by N */
        bv_plain /= total_theta;
        bv_tau /= (fabs(total_theta_tau) + 1);

        double ratio_level = (double)Q / sqrtN;
        const char *level = (ratio_level < 0.5) ? "below √N" :
                            (ratio_level < 1.0) ? "near √N" :
                            (ratio_level < 1.5) ? "AT √N" : "ABOVE √N";

        printf("  %6d | %8.3f | %12.6f | %12.6f | %10.4f | %s\n",
               Q, ratio_level, bv_plain, bv_tau, bv_tau/(bv_plain+1e-20), level);
        fflush(stdout);
    }

    /* ═══ Detailed scaling: how does BV error grow with Q? ═══ */
    printf("\n  ═══ BV Error Scaling ═══\n");
    printf("  If BV_error ~ Q^α, we need α < 1 for level θ > ½.\n\n");

    double logQ_a[20], logBV_p[20], logBV_t[20];
    int npts = 0;

    for (int qi = 0; test_Qs[qi]; qi++) {
        int Q = test_Qs[qi];
        if (Q < 20) continue; /* skip very small */

        double bv_p = 0, bv_t = 0;
        for (int q = 1; q <= Q; q++) {
            int phi_q = euler_phi(q);
            double exp_p = total_theta / phi_q;
            double exp_t = total_theta_tau / phi_q;

            for (int a = 1; a <= q; a++) {
                if (fft_gcd(a, q) != 1) continue;
                double sp = 0, st = 0;
                for (int p = 2; p <= N; p++) {
                    if (isc[p] || p%q != a) continue;
                    double lp = log((double)p);
                    sp += lp;
                    st += lp * tau_normalized(&tau, p);
                }
                double ep = sp - exp_p, et = st - exp_t;
                bv_p += ep*ep / (exp_p + 1);
                bv_t += et*et / (fabs(exp_t) + 1);
            }
        }
        bv_p /= total_theta;
        bv_t /= (fabs(total_theta_tau) + 1);

        logQ_a[npts] = log((double)Q);
        logBV_p[npts] = log(bv_p);
        logBV_t[npts] = log(bv_t);
        npts++;
    }

    /* Fit BV_error ~ Q^α */
    for (int m = 0; m < 2; m++) {
        double *arr = (m == 0) ? logBV_p : logBV_t;
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logQ_a[i];sy+=arr[i];
            sxx+=logQ_a[i]*logQ_a[i];sxy+=logQ_a[i]*arr[i];}
        double alpha=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        printf("  %s: BV_error ~ Q^{%.4f}\n", m==0?"Plain":"τ-wt", alpha);
    }

    printf("\n  BV theorem predicts: plain α ≈ 2 (Q² growth after √N barrier).\n");
    printf("  If τ α < plain α: τ-weighting extends level of distribution.\n");

    tau_free(&tau); free(isc);
    return 0;
}
