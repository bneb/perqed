/*
 * vaughan_tau_hybrid.c — Branch [D]: Apply τ twist to Vaughan Type I piece.
 *
 * From our findings:
 *   - Vaughan: S = S_small + S_typeI + S_typeII
 *   - S_small: β=-0.37 (fine)
 *   - S_typeII: β=+0.02 (flat, manageable)
 *   - S_typeI: β=+0.07 (THE BOTTLENECK, largest sup)
 *   - τ twist of full S: β=-0.32 (genuine cancellation)
 *
 * Test: Replace S_typeI with S_typeI_τ = Σ Λ₂(n)·τ̃(n)·e(nα)
 * Then: S_hybrid = S_small + S_typeI_τ + S_typeII
 *
 * Questions:
 *   1. Does S_typeI_τ have β < 0? (minor arc improvement)
 *   2. Does r_hybrid(E) correlate with r(E)? (counting viability)
 *
 * Also test [G]: Weighted Goldbach cross term.
 *   r_cross(E) = Σ_{p+q=E} log(p)·log(q)·[τ̃(p)+τ̃(q)]
 *   This is the first-order correction in ν=(1+ε·τ̃)².
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    if (n % 20000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int MAX_N = 200001;
    fprintf(stderr, "Init...\n");
    char *isc = fft_sieve_primes(MAX_N);
    int8_t *mu = fft_sieve_mobius(MAX_N);
    TauTable tau = tau_compute(MAX_N, progress);
    fprintf(stderr, "Done.\n\n");

    /* Self-tests */
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }
    printf("Self-tests: ✓\n\n");

    /* ═══ Part 1: Vaughan × τ Hybrid Minor Arc Scaling ═══ */
    int test_Ns[] = {10000, 20000, 40000, 75000, 100000, 150000, 200000, 0};

    printf("═══════════════════════════════════════════════════════\n");
    printf("  [D] Vaughan × τ Hybrid — τ twist on Type I only\n");
    printf("═══════════════════════════════════════════════════════\n\n");
    printf("  %8s | %8s | %8s | %8s | %8s | %8s\n",
           "N", "E_full", "E_typeI", "E_tI·τ", "E_hybrid", "E_τ_full");

    double logN_a[20], logE_f[20], logE_t1[20], logE_t1t[20], logE_h[20], logE_tf[20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx]; idx++) {
        int N = test_Ns[idx];
        if (N > MAX_N - 1) break;
        int U = (int)sqrt((double)N);
        double norm = (double)N / log((double)N);
        int M = fft_next_pow2(4 * N);

        fprintf(stderr, "  N=%d, U=%d...\n", N, U);

        /* Build Λ, Λ₁ (small), Λ₂ (Type I) */
        double *Lambda = calloc(N+1, 8);
        double *L1 = calloc(N+1, 8);
        double *L2 = calloc(N+1, 8);

        for (int n = 2; n <= N; n++)
            if (!isc[n]) Lambda[n] = log((double)n);
        for (int n = 2; n <= U; n++) L1[n] = Lambda[n];
        for (int d = 1; d <= U; d++) {
            if (mu[d] == 0) continue;
            for (int m = 1; (long long)d*m <= N; m++) {
                int n = d * m;
                if (n <= U) continue;
                L2[n] += mu[d] * log((double)m);
            }
        }

        /* Λ₃ = Λ - Λ₁ - Λ₂ (Type II) */
        double *L3 = calloc(N+1, 8);
        for (int n = 1; n <= N; n++) L3[n] = Lambda[n] - L1[n] - L2[n];

        /* Type I × τ: Λ₂(n)·τ̃(n) */
        double *L2_tau = calloc(N+1, 8);
        for (int n = 1; n <= N; n++)
            L2_tau[n] = L2[n] * tau_normalized(&tau, n);

        /* Hybrid: S_small + S_typeI_τ + S_typeII */
        double *hybrid = calloc(N+1, 8);
        for (int n = 1; n <= N; n++)
            hybrid[n] = L1[n] + L2_tau[n] + L3[n];

        /* Full τ twist for comparison */
        double *full_tau = calloc(N+1, 8);
        for (int n = 1; n <= N; n++)
            full_tau[n] = Lambda[n] * tau_normalized(&tau, n);

        /* Measure minor arc sups */
        double sup_f  = fft_minor_arc_sup(Lambda, N, FIXED_Q);
        double sup_t1 = fft_minor_arc_sup(L2, N, FIXED_Q);
        double sup_t1t= fft_minor_arc_sup(L2_tau, N, FIXED_Q);
        double sup_h  = fft_minor_arc_sup(hybrid, N, FIXED_Q);
        double sup_tf = fft_minor_arc_sup(full_tau, N, FIXED_Q);

        logN_a[npts] = log((double)N);
        logE_f[npts]   = log(sup_f / norm);
        logE_t1[npts]  = log(sup_t1 / norm);
        logE_t1t[npts] = log(sup_t1t / norm);
        logE_h[npts]   = log(sup_h / norm);
        logE_tf[npts]  = log(sup_tf / norm);

        printf("  %8d | %8.4f | %8.4f | %8.4f | %8.4f | %8.4f\n",
               N, sup_f/norm, sup_t1/norm, sup_t1t/norm, sup_h/norm, sup_tf/norm);
        fflush(stdout);

        free(Lambda);free(L1);free(L2);free(L3);free(L2_tau);free(hybrid);free(full_tau);
        npts++;
    }

    /* Power-law fits */
    printf("\n  ═══ Power-Law Fits ═══\n");
    const char *names[] = {"Full S", "Type I", "Type I×τ", "Hybrid", "Full τ"};
    double *arrs[] = {logE_f, logE_t1, logE_t1t, logE_h, logE_tf};
    double betas[5];
    for (int m = 0; m < 5; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=arrs[m][i];
            sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];}
        betas[m]=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        const char *v=(betas[m]<-0.10)?"★★★":(betas[m]<-0.05)?"★★":
                      (betas[m]<-0.01)?"★":(betas[m]<0.05)?"~":"✗";
        printf("  %-12s | β = %8.4f | %s\n", names[m], betas[m], v);
    }

    /* ═══ Part 2: Branch [G] — Weighted Goldbach Cross Term ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  [G] Weighted Goldbach: Cross Term Test\n");
    printf("  r_cross(E) = Σ_{p+q=E} log(p)log(q)[τ̃(p)+τ̃(q)]\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    int MAX_E = 20000;
    int cross_pos = 0, cross_neg = 0, total = 0;
    double cmin = 1e30, cmax = -1e30;
    int cmin_E = 0, cmax_E = 0;

    printf("  %8s | %12s | %12s | %10s | status\n", "E", "r(E)", "r_cross(E)", "ratio");

    for (int E = 4; E <= MAX_E; E += 2) {
        double r_plain = 0, r_cross = 0;
        for (int p = 2; p <= E-2; p++) {
            if (isc[p]) continue;
            int q = E - p;
            if (q < 2 || isc[q]) continue;
            double lp = log((double)p), lq = log((double)q);
            r_plain += lp * lq;
            r_cross += lp * lq * (tau_normalized(&tau, p) + tau_normalized(&tau, q));
        }
        total++;
        if (r_cross > 0) cross_pos++; else cross_neg++;
        if (r_plain > 0.01) {
            double ratio = r_cross / r_plain;
            if (ratio < cmin) { cmin = ratio; cmin_E = E; }
            if (ratio > cmax) { cmax = ratio; cmax_E = E; }
        }
        if (E <= 24 || E % 4000 == 0)
            printf("  %8d | %12.2f | %12.2f | %10.4f | %s\n",
                   E, r_plain, r_cross,
                   (fabs(r_plain)>0.01) ? r_cross/r_plain : 0,
                   r_cross > 0 ? "+" : "−");
    }

    printf("\n  Cross term positive: %d/%d (%.1f%%)\n", cross_pos, total, 100.0*cross_pos/total);
    printf("  Ratio range: [%.4f, %.4f]\n", cmin, cmax);
    printf("  If cross term > 0 for most E, ν=(1+ε·τ̃)² boosts the main term.\n");

    tau_free(&tau); free(mu); free(isc);
    return 0;
}
