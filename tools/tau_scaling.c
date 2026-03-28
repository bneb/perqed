/*
 * tau_scaling.c — Definitive τ scaling test with phantom result guards.
 *
 * Uses verified fft_lib.h and tau_lib.h.
 *
 * Experiments (all with same infrastructure):
 *   1. PLAIN:   S(α) = Σ log(p)·e(pα)           — baseline
 *   2. TAU:     S_τ(α) = Σ log(p)·(τ(p)/p^{11/2})·e(pα) — the test
 *   3. CONTROL: S_r(α) = Σ log(p)·r(p)·e(pα)    — r(p) = deterministic ±1
 *   4. NULL:    S_1(α) = Σ log(p)·1·e(pα) = S(α) — should match PLAIN exactly
 *
 * If β_TAU < -0.05 AND β_CONTROL ≈ 0 AND β_NULL ≈ β_PLAIN:
 *   → Result is genuine, not a phantom.
 *
 * Data points: 9 values ≥ 10K. Slope fit: all points.
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

int main(void) {
    int TAU_MAX = 500001;

    fprintf(stderr, "═══ Initialization ═══\n");
    fprintf(stderr, "Sieving primes to %d...\n", TAU_MAX);
    char *isc = fft_sieve_primes(TAU_MAX);
    fprintf(stderr, "Computing τ(n) for n ≤ %d...\n", TAU_MAX);
    TauTable tau = tau_compute(TAU_MAX, progress);
    fprintf(stderr, "Done.\n\n");

    /* ═══ Self-tests at startup ═══ */
    printf("═══ Startup Self-Tests ═══\n");
    int fail = 0;

    /* FFT round-trip */
    double re[16]={1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0}, im[16]={0};
    double orig[8]; memcpy(orig,re,64);
    fft_transform(re,im,16,1); fft_transform(re,im,16,-1);
    double fft_err=0;
    for(int i=0;i<8;i++){double e=fabs(re[i]-orig[i]);if(e>fft_err)fft_err=e;}
    printf("  FFT round-trip: err=%.2e %s\n", fft_err, fft_err<1e-10?"✓":"✗");
    if(fft_err>=1e-10) fail++;

    /* τ known values */
    int tau_kv = tau_verify_known(&tau);
    printf("  τ known values: %d failures %s\n", tau_kv, tau_kv==0?"✓":"✗");
    if(tau_kv) fail++;

    /* Ramanujan conjecture */
    int rc = tau_verify_ramanujan(&tau, isc);
    printf("  Ramanujan conjecture: %d violations %s\n", rc, rc==0?"✓":"✗");
    if(rc) fail++;

    /* Hecke */
    int hk = tau_verify_hecke(&tau, 500);
    printf("  Hecke multiplicativity: %d failures %s\n", hk, hk==0?"✓":"✗");
    if(hk) fail++;

    if (fail) { printf("\n✗ SELF-TESTS FAILED — aborting.\n"); return 1; }
    printf("  All self-tests passed ✓\n\n");

    /* ═══ Main experiment ═══ */
    int test_Ns[] = {10000, 20000, 40000, 75000, 100000, 150000,
                     200000, 350000, 500000, 0};

    printf("═══════════════════════════════════════════════════════════\n");
    printf("  DEFINITIVE τ Scaling Test (N ≥ 10K, 9 points)\n");
    printf("  Control: deterministic ±1 twist (should be FLAT)\n");
    printf("  Null: constant twist = 1 (should match PLAIN)\n");
    printf("═══════════════════════════════════════════════════════════\n\n");

    printf("  %10s | %10s | %10s | %10s | %10s\n",
           "N", "E_plain", "E_tau", "E_control", "E_null");

    double logN_a[20], logE_p[20], logE_t[20], logE_c[20], logE_n[20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx] != 0; idx++) {
        int N = test_Ns[idx];
        if (N > TAU_MAX - 1) break;

        fprintf(stderr, "  N=%d...\n", N);
        double norm = (double)N / log((double)N);

        double *w_plain   = calloc(N+1, 8);
        double *w_tau     = calloc(N+1, 8);
        double *w_control = calloc(N+1, 8);
        double *w_null    = calloc(N+1, 8);

        for (int n = 2; n <= N; n++) {
            if (isc[n]) continue;
            double lp = log((double)n);

            w_plain[n] = lp;
            w_tau[n]   = lp * tau_normalized(&tau, n);
            /* Control: deterministic ±1 based on p mod 4 */
            w_control[n] = lp * ((n % 4 == 1) ? 1.0 : -1.0);
            w_null[n]  = lp * 1.0;  /* Should exactly equal plain */
        }

        double sup_p = fft_minor_arc_sup(w_plain, N, FIXED_Q);
        double sup_t = fft_minor_arc_sup(w_tau, N, FIXED_Q);
        double sup_c = fft_minor_arc_sup(w_control, N, FIXED_Q);
        double sup_n = fft_minor_arc_sup(w_null, N, FIXED_Q);

        logN_a[npts] = log((double)N);
        logE_p[npts] = log(sup_p / norm);
        logE_t[npts] = log(sup_t / norm);
        logE_c[npts] = log(sup_c / norm);
        logE_n[npts] = log(sup_n / norm);

        printf("  %10d | %10.5f | %10.5f | %10.5f | %10.5f\n",
               N, sup_p/norm, sup_t/norm, sup_c/norm, sup_n/norm);
        fflush(stdout);

        free(w_plain); free(w_tau); free(w_control); free(w_null);
        npts++;
    }

    /* ═══ Power-law fits ═══ */
    printf("\n  ═══ Power-Law Fits (all %d points) ═══\n", npts);
    const char *names[] = {"Plain", "τ-twist", "Control(±1)", "Null(=Plain)"};
    double *arrs[] = {logE_p, logE_t, logE_c, logE_n};
    double betas[4];

    for (int m = 0; m < 4; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=arrs[m][i];
            sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];}
        betas[m]=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        const char *v=(betas[m]<-0.10)?"★★★ STRONG DEC":(betas[m]<-0.05)?"★★ DEC":
                      (betas[m]<-0.01)?"★ MILD DEC":(betas[m]<0.05)?"~ FLAT":"✗ INCREASING";
        printf("  %-14s | β = %8.4f | %s\n", names[m], betas[m], v);
    }

    /* ═══ Phantom result checks ═══ */
    printf("\n  ═══ Phantom Result Checks ═══\n");

    /* Check 1: Null should match Plain */
    double null_diff = fabs(betas[3] - betas[0]);
    printf("  [%s] Null β (%.4f) matches Plain β (%.4f), diff=%.4f\n",
           null_diff < 0.02 ? "✓" : "✗", betas[3], betas[0], null_diff);

    /* Check 2: Control should be approximately flat */
    printf("  [%s] Control β = %.4f (expected near 0)\n",
           fabs(betas[2]) < 0.15 ? "✓" : "✗", betas[2]);

    /* Check 3: τ should be negative */
    printf("  [%s] τ β = %.4f (expected < -0.05)\n",
           betas[1] < -0.05 ? "✓" : "✗", betas[1]);

    /* Check 4: Split-half stability */
    if (npts >= 6) {
        int half = npts / 2;
        double sx1=0,sy1=0,sxx1=0,sxy1=0;
        double sx2=0,sy2=0,sxx2=0,sxy2=0;
        for(int i=0;i<half;i++){
            sx1+=logN_a[i];sy1+=logE_t[i];sxx1+=logN_a[i]*logN_a[i];sxy1+=logN_a[i]*logE_t[i];
        }
        for(int i=half;i<npts;i++){
            sx2+=logN_a[i];sy2+=logE_t[i];sxx2+=logN_a[i]*logN_a[i];sxy2+=logN_a[i]*logE_t[i];
        }
        double b1=(half*sxy1-sx1*sy1)/(half*sxx1-sx1*sx1);
        int h2=npts-half;
        double b2=(h2*sxy2-sx2*sy2)/(h2*sxx2-sx2*sx2);
        double split_diff = fabs(b1 - b2);
        printf("  [%s] Split-half: first β=%.4f, second β=%.4f, diff=%.4f\n",
               split_diff < 0.3 ? "✓" : "✗", b1, b2, split_diff);
    }

    /* ═══ Verdict ═══ */
    printf("\n  ═══ VERDICT ═══\n");
    int checks_pass = (null_diff < 0.02) + (fabs(betas[2]) < 0.15) + (betas[1] < -0.05);
    if (checks_pass == 3)
        printf("  ★★★ GENUINE — τ twist achieves power-saving (β=%.4f)\n", betas[1]);
    else if (checks_pass >= 2)
        printf("  ★★ PROMISING — τ twist shows potential (β=%.4f) but %d/3 checks failed\n",
               betas[1], 3-checks_pass);
    else
        printf("  ✗ PHANTOM — result did not survive control checks (%d/3 passed)\n", checks_pass);

    tau_free(&tau);
    free(isc);
    return 0;
}
