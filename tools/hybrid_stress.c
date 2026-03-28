/*
 * hybrid_stress.c — Stress test branch [D] at larger N + counting viability.
 *
 * Two critical tests:
 * 1. Push hybrid scaling to N=500K with 9 data points ≥ 10K
 * 2. Compute r_hybrid(E) vs r(E) to check if hybrid preserves Goldbach count
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

/* Build Vaughan decomposition at cutoff U */
static void vaughan_decompose(double *Lambda, int8_t *mu, int N, int U,
                              double *L1, double *L2, double *L3) {
    memset(L1, 0, (N+1)*sizeof(double));
    memset(L2, 0, (N+1)*sizeof(double));
    memset(L3, 0, (N+1)*sizeof(double));

    for (int n = 2; n <= U; n++) L1[n] = Lambda[n];
    for (int d = 1; d <= U; d++) {
        if (mu[d] == 0) continue;
        for (int m = 1; (long long)d*m <= N; m++) {
            int n = d*m;
            if (n <= U) continue;
            L2[n] += mu[d] * log((double)m);
        }
    }
    for (int n = 1; n <= N; n++) L3[n] = Lambda[n] - L1[n] - L2[n];
}

int main(void) {
    int TAU_MAX = 500001;
    fprintf(stderr, "Init (τ to %d)...\n", TAU_MAX);
    char *isc = fft_sieve_primes(TAU_MAX);
    int8_t *mu = fft_sieve_mobius(TAU_MAX);
    TauTable tau = tau_compute(TAU_MAX, progress);
    fprintf(stderr, "Done.\n\n");

    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* ═══ Part 1: Scaling to N=500K ═══ */
    int test_Ns[] = {10000, 20000, 40000, 75000, 100000, 150000,
                     200000, 350000, 500000, 0};

    printf("═══════════════════════════════════════════════════════\n");
    printf("  [D] Hybrid Scaling — N up to 500K, 9 points\n");
    printf("═══════════════════════════════════════════════════════\n\n");
    printf("  %8s | %8s | %8s | %8s\n", "N", "E_full", "E_hybrid", "E_τ_full");

    double logN_a[20], logE_f[20], logE_h[20], logE_t[20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx]; idx++) {
        int N = test_Ns[idx];
        if (N > TAU_MAX - 1) break;
        int U = (int)sqrt((double)N);
        double norm = (double)N / log((double)N);

        fprintf(stderr, "  N=%d...\n", N);

        double *Lambda = calloc(N+1, 8);
        for (int n = 2; n <= N; n++) if (!isc[n]) Lambda[n] = log((double)n);

        double *L1 = calloc(N+1,8), *L2 = calloc(N+1,8), *L3 = calloc(N+1,8);
        vaughan_decompose(Lambda, mu, N, U, L1, L2, L3);

        /* Hybrid = L1 + L2*τ + L3 */
        double *hybrid = calloc(N+1, 8);
        double *full_tau = calloc(N+1, 8);
        for (int n = 1; n <= N; n++) {
            hybrid[n] = L1[n] + L2[n] * tau_normalized(&tau, n) + L3[n];
            full_tau[n] = Lambda[n] * tau_normalized(&tau, n);
        }

        double sup_f = fft_minor_arc_sup(Lambda, N, FIXED_Q);
        double sup_h = fft_minor_arc_sup(hybrid, N, FIXED_Q);
        double sup_t = fft_minor_arc_sup(full_tau, N, FIXED_Q);

        logN_a[npts] = log((double)N);
        logE_f[npts] = log(sup_f/norm);
        logE_h[npts] = log(sup_h/norm);
        logE_t[npts] = log(sup_t/norm);

        printf("  %8d | %8.4f | %8.4f | %8.4f\n", N, sup_f/norm, sup_h/norm, sup_t/norm);
        fflush(stdout);

        free(Lambda);free(L1);free(L2);free(L3);free(hybrid);free(full_tau);
        npts++;
    }

    printf("\n  ═══ Power-Law Fits ═══\n");
    const char *names[] = {"Full S", "Hybrid", "Full τ"};
    double *arrs[] = {logE_f, logE_h, logE_t};
    double betas[3];
    for (int m = 0; m < 3; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=arrs[m][i];
            sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];}
        betas[m]=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        const char *v=(betas[m]<-0.10)?"★★★":(betas[m]<-0.05)?"★★":
                      (betas[m]<-0.01)?"★":(betas[m]<0.05)?"~":"✗";
        printf("  %-10s | β = %8.4f | %s\n", names[m], betas[m], v);
    }

    /* Split-half stability for hybrid */
    if (npts >= 6) {
        int h = npts/2;
        double sx1=0,sy1=0,sxx1=0,sxy1=0;
        double sx2=0,sy2=0,sxx2=0,sxy2=0;
        for(int i=0;i<h;i++){sx1+=logN_a[i];sy1+=logE_h[i];sxx1+=logN_a[i]*logN_a[i];sxy1+=logN_a[i]*logE_h[i];}
        for(int i=h;i<npts;i++){sx2+=logN_a[i];sy2+=logE_h[i];sxx2+=logN_a[i]*logN_a[i];sxy2+=logN_a[i]*logE_h[i];}
        double b1=(h*sxy1-sx1*sy1)/(h*sxx1-sx1*sx1);
        int h2=npts-h;
        double b2=(h2*sxy2-sx2*sy2)/(h2*sxx2-sx2*sx2);
        printf("\n  Split-half: first β=%.4f, second β=%.4f, diff=%.4f\n", b1, b2, fabs(b1-b2));
    }

    /* ═══ Part 2: Counting Viability ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  [D] Counting Viability: r_hybrid(E) vs r(E)\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    int MAX_E = 10000;
    /* Build hybrid weights for small N */
    int CE = MAX_E;
    double *Lam = calloc(CE+1, 8);
    for (int n = 2; n <= CE; n++) if (!isc[n]) Lam[n] = log((double)n);

    int UE = (int)sqrt((double)CE);
    double *cL1=calloc(CE+1,8), *cL2=calloc(CE+1,8), *cL3=calloc(CE+1,8);
    vaughan_decompose(Lam, mu, CE, UE, cL1, cL2, cL3);

    double *hw = calloc(CE+1, 8);
    for (int n = 1; n <= CE; n++)
        hw[n] = cL1[n] + cL2[n] * tau_normalized(&tau, n) + cL3[n];

    int r_pos = 0, rh_pos = 0, agree = 0, disagree = 0, total = 0;
    double ratio_sum = 0, ratio_min = 1e30, ratio_max = -1e30;
    int ratio_cnt = 0;

    printf("  %8s | %12s | %12s | %10s | status\n", "E", "r(E)", "r_hybrid(E)", "ratio");

    for (int E = 4; E <= MAX_E; E += 2) {
        double r_plain = 0, r_hyb = 0;
        for (int p = 2; p <= E-2; p++) {
            if (isc[p]) continue;
            int q = E - p;
            if (q < 2 || isc[q]) continue;
            r_plain += Lam[p] * Lam[q];
            r_hyb   += hw[p] * hw[q];
        }
        total++;
        if (r_plain > 0) r_pos++;
        if (r_hyb > 0) rh_pos++;
        if ((r_plain > 0) == (r_hyb > 0)) agree++; else disagree++;

        if (r_plain > 0.01) {
            double ratio = r_hyb / r_plain;
            ratio_sum += ratio; ratio_cnt++;
            if (ratio < ratio_min) ratio_min = ratio;
            if (ratio > ratio_max) ratio_max = ratio;
        }

        if (E <= 24 || E % 2000 == 0)
            printf("  %8d | %12.2f | %12.2f | %10.4f | %s\n",
                   E, r_plain, r_hyb,
                   (fabs(r_plain)>0.01)?r_hyb/r_plain:0,
                   (r_plain>0 && r_hyb>0)?"✓ both +":(r_plain>0&&r_hyb<=0)?"✗ FAIL":"?");
    }

    printf("\n  ═══ Counting Summary ═══\n");
    printf("  r(E) > 0:       %d/%d\n", r_pos, total);
    printf("  r_hybrid(E) > 0: %d/%d (%.1f%%)\n", rh_pos, total, 100.0*rh_pos/total);
    printf("  Sign agree:      %d/%d (%.1f%%)\n", agree, total, 100.0*agree/total);
    printf("  Sign disagree:   %d\n", disagree);
    if (ratio_cnt > 0) {
        printf("  Ratio range:     [%.4f, %.4f]\n", ratio_min, ratio_max);
        printf("  Mean ratio:      %.4f\n", ratio_sum / ratio_cnt);
    }
    printf("\n  %s\n", disagree == 0 ? "★★★ PERFECT — hybrid preserves all Goldbach representations!" :
           (100.0*disagree/total < 1) ? "★★ NEARLY PERFECT — very few disagreements" :
           (100.0*disagree/total < 10) ? "★ PROMISING — some disagreements" :
           "✗ TOO MANY disagreements");

    free(Lam);free(cL1);free(cL2);free(cL3);free(hw);
    tau_free(&tau); free(mu); free(isc);
    return 0;
}
