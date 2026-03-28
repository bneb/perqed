/*
 * verify_liu_ren.c — Verify the Liu-Ren 2012 bound empirically.
 *
 * Liu-Ren proved: Σ_{n≤N} Λ(n)·a_f(n)·e(nα) ≪_f N·exp(-c·√(logN))
 * for any holomorphic cusp form f on SL₂(ℤ), uniformly in α.
 *
 * This uses Deligne's theorem (proved 1974), NOT the unproven GRH.
 *
 * Test: Does sup|S_τ|/(N/logN) fit exp(-c√logN) or N^β better?
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void prog(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int MAX_N = 500001;
    fprintf(stderr, "Init...\n");
    char *isc = fft_sieve_primes(MAX_N);
    TauTable tau = tau_compute(MAX_N, prog);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    int test_Ns[] = {5000, 10000, 20000, 50000, 100000, 200000, 350000, 500000, 0};

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Liu-Ren Bound Verification\n");
    printf("  Predicted: sup|S_τ| ≈ N · exp(-c·√logN)\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    double logN_a[10], logE_a[10], sqrtlogN_a[10], logE_plain_a[10];
    int npts = 0;

    printf("  %8s | %8s | %8s | %10s | %10s\n",
           "N", "E_τ", "E_plain", "log(E_τ)", "√logN");

    for (int ni = 0; test_Ns[ni]; ni++) {
        int N = test_Ns[ni];
        if (N > MAX_N - 1) break;
        double norm = (double)N / log((double)N);

        /* Compute weights for tau and plain */
        double *w_tau = calloc(N + 1, 8);
        double *w_plain = calloc(N + 1, 8);
        for (int n = 2; n <= N; n++) {
            if (isc[n]) continue;
            w_plain[n] = log((double)n);
            w_tau[n] = log((double)n) * tau_normalized(&tau, n);
        }

        double sup_tau = fft_minor_arc_sup(w_tau, N, FIXED_Q);
        double sup_plain = fft_minor_arc_sup(w_plain, N, FIXED_Q);

        double E_tau = sup_tau / norm;
        double E_plain = sup_plain / norm;

        logN_a[npts] = log((double)N);
        sqrtlogN_a[npts] = sqrt(log((double)N));
        logE_a[npts] = log(E_tau);
        logE_plain_a[npts] = log(E_plain);

        printf("  %8d | %8.4f | %8.4f | %10.4f | %10.4f\n",
               N, E_tau, E_plain, log(E_tau), sqrt(log((double)N)));
        fflush(stdout);

        free(w_tau); free(w_plain);
        npts++;
    }

    /* Fit 1: E ~ N^β (power law) */
    double beta_tau, beta_plain;
    {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=logE_a[i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE_a[i];}
        beta_tau=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
    }
    {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=logE_plain_a[i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE_plain_a[i];}
        beta_plain=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
    }

    /* Fit 2: log(E) = a - c·√logN (Liu-Ren form) */
    double c_lr, a_lr;
    {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=sqrtlogN_a[i];sy+=logE_a[i];sxx+=sqrtlogN_a[i]*sqrtlogN_a[i];sxy+=sqrtlogN_a[i]*logE_a[i];}
        double slope=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        c_lr = -slope;
        a_lr = (sy - slope*sx)/npts;
    }

    /* Compare SSR */
    double ssr_pow = 0, ssr_lr = 0;
    double a_pow = 0;
    {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=logE_a[i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE_a[i];}
        double slope=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        a_pow=(sy-slope*sx)/npts;
        for(int i=0;i<npts;i++){
            double pred=a_pow+slope*logN_a[i];
            ssr_pow+=(logE_a[i]-pred)*(logE_a[i]-pred);
        }
    }
    for(int i=0;i<npts;i++){
        double pred=a_lr-c_lr*sqrtlogN_a[i];
        ssr_lr+=(logE_a[i]-pred)*(logE_a[i]-pred);
    }

    printf("\n═══ Model Comparison ═══\n");
    printf("  Power law:   E_τ ~ N^{%.4f}      SSR = %.6f\n", beta_tau, ssr_pow);
    printf("  Liu-Ren:     log(E_τ) = %.3f - %.3f·√logN  SSR = %.6f\n", a_lr, c_lr, ssr_lr);
    printf("  Better fit:  %s\n", ssr_lr < ssr_pow ? "★ Liu-Ren" : "★ Power law");
    printf("  Plain:       E ~ N^{%.4f}\n", beta_plain);

    printf("\n═══ Implications ═══\n");
    printf("  If Liu-Ren bound holds (c=%.3f):\n", c_lr);
    printf("  sup|S_τ| ≤ (N/logN) · exp(-%.3f·√logN)\n", c_lr);
    printf("  At N=10⁸:  exp(-%.3f·√18.4) = exp(-%.2f) = %.4f\n",
           c_lr, c_lr*sqrt(18.4), exp(-c_lr*sqrt(18.4)));
    printf("  At N=10¹²: exp(-%.3f·√27.6) = exp(-%.2f) = %.6f\n",
           c_lr, c_lr*sqrt(27.6), exp(-c_lr*sqrt(27.6)));
    printf("  At N=10¹⁸: exp(-%.3f·√41.4) = exp(-%.2f) = %.8f\n",
           c_lr, c_lr*sqrt(41.4), exp(-c_lr*sqrt(41.4)));

    printf("\n  The exp(-c√logN) factor → 0 faster than any N^{-ε}.\n");
    printf("  Combined with Cauchy-Schwarz:\n");
    printf("  E(N) ≤ N^{1-δ_plain} · exp(-c√logN) → 0 as N → ∞\n");

    tau_free(&tau); free(isc);
    return 0;
}
