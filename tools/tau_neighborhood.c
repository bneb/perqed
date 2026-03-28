/*
 * tau_neighborhood.c — Search the neighborhood of τ̃ for viable weight functions.
 *
 * Instead of arbitrary positive functions, we modify τ̃ minimally:
 *
 * 1. INTERPOLATION: w = (1-t) + t·τ̃, t ∈ [0, 1]
 *    At t=0: plain (β=+0.09). At t=1: full τ̃ (β=-0.32).
 *    Find the t where β crosses 0 and check how many primes have w<0.
 *
 * 2. CLIPPED: w = max(δ, τ̃) for various δ ∈ [-1.5, 0.5]
 *    Preserves positive τ̃ structure, clips negative tail.
 *
 * 3. POSITIVE HALF: w = max(0, τ̃)
 *    Keeps only primes where τ̃ > 0. Does the positive half still cancel?
 *
 * 4. SIGN-FLIP: w = τ̃ where τ̃ ≥ -c, else +|τ̃|.
 *    Gradually flips negative primes to positive.
 *
 * 5. SOFTENED: w = τ̃ + 2 + ε (shift to make all positive)
 *    Then normalize. Best case for "closest to τ̃ while positive."
 *
 * For each: compute β (2-point), fraction of primes with w≤0,
 * and r_w(E) agreement rate with r(E) for E≤5000.
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

typedef struct {
    char name[64];
    double beta;
    double frac_negative;  /* fraction of primes with w < 0 */
    double counting_agree; /* fraction of E where sign(r_w) = sign(r) */
    double E1, E2;
} Result;

int main(void) {
    int N2 = 200001;
    int N1 = 50000;
    int MAX_E = 5000;
    fprintf(stderr, "Init...\n");
    char *isc = fft_sieve_primes(N2);
    TauTable tau = tau_compute(N2, progress);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    double *tn = calloc(N2+1, 8);
    int prime_count = 0;
    for (int p = 2; p <= N2; p++) {
        if (isc[p]) continue;
        tn[p] = tau_normalized(&tau, p);
        prime_count++;
    }

    double logN1 = log((double)N1), logN2 = log((double)N2);
    double norm1 = (double)N1/log((double)N1), norm2 = (double)N2/log((double)N2);

    Result results[200];
    int nr = 0;

    printf("═══════════════════════════════════════════════════════\n");
    printf("  τ̃ Neighborhood Search\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    /* Helper: compute β, negative fraction, and counting agreement */
    #define TEST_WEIGHT(label, expr_body) do { \
        Result *r = &results[nr]; \
        snprintf(r->name, 64, "%s", label); \
        double *w1 = calloc(N1+1, 8), *w2 = calloc(N2+1, 8); \
        int neg_count = 0; \
        for (int p = 2; p <= N2; p++) { \
            if (isc[p]) continue; \
            double t = tn[p]; \
            double v; \
            expr_body \
            if (p <= N1) w1[p] = log((double)p) * v; \
            w2[p] = log((double)p) * v; \
            if (v < -1e-10) neg_count++; \
        } \
        r->frac_negative = (double)neg_count / prime_count; \
        r->E1 = fft_minor_arc_sup(w1, N1, FIXED_Q) / norm1; \
        r->E2 = fft_minor_arc_sup(w2, N2, FIXED_Q) / norm2; \
        if (r->E1 > 0 && r->E2 > 0) \
            r->beta = (log(r->E2) - log(r->E1)) / (logN2 - logN1); \
        else r->beta = 99; \
        /* Counting check */ \
        int agree = 0, total = 0; \
        for (int E = 4; E <= MAX_E && E <= N2; E += 2) { \
            double rp = 0, rw = 0; \
            for (int pp = 2; pp <= E-2; pp++) { \
                if (isc[pp]) continue; \
                int q = E - pp; \
                if (q < 2 || isc[q]) continue; \
                rp += log((double)pp) * log((double)q); \
                rw += w2[pp] * w2[q]; \
            } \
            total++; \
            if ((rp > 0) == (rw > 0)) agree++; \
        } \
        r->counting_agree = (double)agree / total; \
        free(w1); free(w2); \
        nr++; \
    } while(0)

    /* ═══ Family 1: Interpolation w = (1-t) + t·τ̃ ═══ */
    fprintf(stderr, "Interpolation...\n");
    for (double t = 0.0; t <= 1.001; t += 0.05) {
        char lbl[64]; snprintf(lbl, 64, "interp t=%.2f", t);
        TEST_WEIGHT(lbl, { v = (1.0 - t) + t * t; });
    }
    /* Fix: the inner variable 't' shadows the loop variable. Use param. */

    /* Actually need to redo this properly without shadowing */
    nr = 0; /* reset */
    for (double t_param = 0.0; t_param <= 1.001; t_param += 0.05) {
        char lbl[64]; snprintf(lbl, 64, "interp t=%.2f", t_param);
        double tp = t_param;
        double *w1 = calloc(N1+1, 8), *w2 = calloc(N2+1, 8);
        int neg_count = 0;
        for (int p = 2; p <= N2; p++) {
            if (isc[p]) continue;
            double v = (1.0 - tp) + tp * tn[p];
            if (p <= N1) w1[p] = log((double)p) * v;
            w2[p] = log((double)p) * v;
            if (v < -1e-10) neg_count++;
        }
        Result *r = &results[nr];
        snprintf(r->name, 64, "interp t=%.2f", tp);
        r->frac_negative = (double)neg_count / prime_count;
        r->E1 = fft_minor_arc_sup(w1, N1, FIXED_Q) / norm1;
        r->E2 = fft_minor_arc_sup(w2, N2, FIXED_Q) / norm2;
        r->beta = (log(r->E2) - log(r->E1)) / (logN2 - logN1);
        int agree=0,total=0;
        for(int E=4;E<=MAX_E;E+=2){
            double rp=0,rw=0;
            for(int pp=2;pp<=E-2;pp++){if(isc[pp])continue;int q=E-pp;
                if(q<2||isc[q])continue;
                rp+=log((double)pp)*log((double)q);rw+=w2[pp]*w2[q];}
            total++;if((rp>0)==(rw>0))agree++;
        }
        r->counting_agree=(double)agree/total;
        free(w1);free(w2);
        nr++;
    }

    printf("  ═══ 1. Interpolation: w = (1-t) + t·τ̃ ═══\n");
    printf("  %12s | %8s | %8s | %8s | %8s\n", "t", "β", "neg%", "count%", "E(200K)");
    for (int i = 0; i < nr; i++) {
        const char *star = (results[i].beta<-0.05 && results[i].counting_agree>0.99) ? " ★★★" :
                           (results[i].beta<-0.01 && results[i].counting_agree>0.90) ? " ★★" :
                           (results[i].beta<0 && results[i].counting_agree>0.80) ? " ★" : "";
        printf("  %12s | %8.4f | %7.1f%% | %7.1f%% | %8.4f%s\n",
               results[i].name+8, results[i].beta,
               100*results[i].frac_negative,
               100*results[i].counting_agree,
               results[i].E2, star);
    }

    /* ═══ Family 2: Clipped: w = max(δ, τ̃) ═══ */
    int nr2_start = nr;
    fprintf(stderr, "Clipping...\n");
    double deltas[] = {-1.5, -1.0, -0.5, -0.3, -0.1, 0.0, 0.1, 0.3, 0.5, 999};
    for (int di = 0; deltas[di] < 998; di++) {
        double delta = deltas[di];
        double *w1=calloc(N1+1,8),*w2=calloc(N2+1,8);
        int neg=0;
        for(int p=2;p<=N2;p++){if(isc[p])continue;
            double v=(tn[p]>delta)?tn[p]:delta;
            if(p<=N1)w1[p]=log((double)p)*v;w2[p]=log((double)p)*v;
            if(v<-1e-10)neg++;}
        Result *r=&results[nr];
        snprintf(r->name,64,"clip δ=%.1f",delta);
        r->frac_negative=(double)neg/prime_count;
        r->E1=fft_minor_arc_sup(w1,N1,FIXED_Q)/norm1;
        r->E2=fft_minor_arc_sup(w2,N2,FIXED_Q)/norm2;
        r->beta=(log(r->E2)-log(r->E1))/(logN2-logN1);
        int agree=0,total=0;
        for(int E=4;E<=MAX_E;E+=2){double rp=0,rw=0;
            for(int pp=2;pp<=E-2;pp++){if(isc[pp])continue;int q=E-pp;
                if(q<2||isc[q])continue;rp+=log((double)pp)*log((double)q);rw+=w2[pp]*w2[q];}
            total++;if((rp>0)==(rw>0))agree++;}
        r->counting_agree=(double)agree/total;
        free(w1);free(w2);nr++;
    }

    printf("\n  ═══ 2. Clipped: w = max(δ, τ̃) ═══\n");
    printf("  %12s | %8s | %8s | %8s | %8s\n", "δ", "β", "neg%", "count%", "E(200K)");
    for (int i = nr2_start; i < nr; i++) {
        const char *star = (results[i].beta<-0.05 && results[i].counting_agree>0.99) ? " ★★★" :
                           (results[i].beta<0 && results[i].counting_agree>0.80) ? " ★" : "";
        printf("  %12s | %8.4f | %7.1f%% | %7.1f%% | %8.4f%s\n",
               results[i].name, results[i].beta,
               100*results[i].frac_negative,
               100*results[i].counting_agree,
               results[i].E2, star);
    }

    /* ═══ Family 3: Sign-flip at threshold ═══ */
    int nr3_start = nr;
    fprintf(stderr, "Sign-flip...\n");
    double thresholds[] = {-1.8, -1.5, -1.2, -1.0, -0.7, -0.5, -0.3, -0.1, 0.0, 999};
    for (int ti = 0; thresholds[ti] < 998; ti++) {
        double thr = thresholds[ti];
        double *w1=calloc(N1+1,8),*w2=calloc(N2+1,8);
        int neg=0;
        for(int p=2;p<=N2;p++){if(isc[p])continue;
            double v=(tn[p]>=thr)?tn[p]:fabs(tn[p]);
            if(p<=N1)w1[p]=log((double)p)*v;w2[p]=log((double)p)*v;
            if(v<-1e-10)neg++;}
        Result *r=&results[nr];
        snprintf(r->name,64,"flip c=%.1f",thr);
        r->frac_negative=(double)neg/prime_count;
        r->E1=fft_minor_arc_sup(w1,N1,FIXED_Q)/norm1;
        r->E2=fft_minor_arc_sup(w2,N2,FIXED_Q)/norm2;
        r->beta=(log(r->E2)-log(r->E1))/(logN2-logN1);
        int agree=0,total=0;
        for(int E=4;E<=MAX_E;E+=2){double rp=0,rw=0;
            for(int pp=2;pp<=E-2;pp++){if(isc[pp])continue;int q=E-pp;
                if(q<2||isc[q])continue;rp+=log((double)pp)*log((double)q);rw+=w2[pp]*w2[q];}
            total++;if((rp>0)==(rw>0))agree++;}
        r->counting_agree=(double)agree/total;
        free(w1);free(w2);nr++;
    }

    printf("\n  ═══ 3. Sign-Flip: w = τ̃ if τ̃≥c, else |τ̃| ═══\n");
    printf("  %12s | %8s | %8s | %8s | %8s\n", "c", "β", "neg%", "count%", "E(200K)");
    for (int i = nr3_start; i < nr; i++) {
        const char *star = (results[i].beta<-0.05 && results[i].counting_agree>0.99) ? " ★★★" :
                           (results[i].beta<0 && results[i].counting_agree>0.80) ? " ★" : "";
        printf("  %12s | %8.4f | %7.1f%% | %7.1f%% | %8.4f%s\n",
               results[i].name, results[i].beta,
               100*results[i].frac_negative,
               100*results[i].counting_agree,
               results[i].E2, star);
    }

    /* ═══ Summary ═══ */
    printf("\n  ═══ BEST CANDIDATES (β < 0 AND counting > 80%%) ═══\n");
    printf("  %24s | %8s | %8s | %8s\n", "Name", "β", "neg%", "count%");
    int any = 0;
    for (int i = 0; i < nr; i++) {
        if (results[i].beta < 0 && results[i].counting_agree > 0.80) {
            printf("  %24s | %8.4f | %7.1f%% | %7.1f%%\n",
                   results[i].name, results[i].beta,
                   100*results[i].frac_negative,
                   100*results[i].counting_agree);
            any++;
        }
    }
    if (!any) printf("  (none found)\n");

    /* Find the exact β=0 crossing point for interpolation */
    printf("\n  ═══ β=0 Crossing Analysis ═══\n");
    for (int i = 0; i < nr-1; i++) {
        if (strncmp(results[i].name, "interp", 6) != 0) continue;
        if (results[i].beta >= 0 && results[i+1].beta < 0) {
            printf("  β crosses 0 between %s (β=%.4f) and %s (β=%.4f)\n",
                   results[i].name, results[i].beta,
                   results[i+1].name, results[i+1].beta);
            printf("  At crossing: neg≈%.1f%%, counting≈%.1f%%\n",
                   100*(results[i].frac_negative+results[i+1].frac_negative)/2,
                   100*(results[i].counting_agree+results[i+1].counting_agree)/2);
        }
    }

    tau_free(&tau); free(tn); free(isc);
    return 0;
}
