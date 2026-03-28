/*
 * exceptional_set.c — Improve the exceptional set exponent δ.
 *
 * The exceptional set E(N) = |{even E ≤ N : E ≠ p+q}| ≤ C·N^{1-δ}.
 * Best known: δ ≈ 0.121 (Montgomery-Vaughan / Pintz improvements).
 *
 * The bound comes from: E(N) ≤ ∫_{minor} |S(α)|⁴ dα / (min M(E))²
 *
 * Key test: Does the fourth-moment ∫|S|⁴ on minor arcs decrease faster
 * when we mix in τ information?
 *
 * We compute:
 *   1. ∫_{minor} |S|⁴ (plain fourth moment)
 *   2. ∫_{minor} |S_τ|⁴ (τ-weighted fourth moment)
 *   3. ∫_{minor} |S|²·|S_τ|² (mixed: Cauchy-Schwarz with τ)
 *   4. Distribution of r(E)/M(E) — how concentrated is the count?
 *
 * If the mixed moment grows slower than |S|⁴ alone, τ provides
 * additional cancellation that tightens the exceptional set bound.
 */
#include "fft_lib.h"
#include "tau_lib.h"

#define FIXED_Q 10

static void progress(int n, int max_n) {
    if (n % 50000 == 0)
        fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
}

/* Hardy-Littlewood singular series constant for even E */
static double singular_series(int E, const char *isc, int max_p) {
    /* S₂(E) = 2·C₂ · Π_{p|E, p>2} (p-1)/(p-2) */
    /* C₂ = Π_{p>2} (1 - 1/(p-1)²) ≈ 0.6601618 (twin prime constant) */
    double C2 = 1.0;
    for (int p = 3; p <= max_p && p <= 200; p++) {
        if (isc[p]) continue;
        C2 *= 1.0 - 1.0/((double)(p-1)*(p-1));
    }

    double product = 1.0;
    for (int p = 3; p <= E && p <= 200; p++) {
        if (isc[p]) continue;
        if (E % p == 0)
            product *= (double)(p-1) / (p-2);
    }

    return 2.0 * C2 * product;
}

int main(void) {
    int MAX_N = 200001;
    fprintf(stderr, "Init...\n");
    char *isc = fft_sieve_primes(MAX_N);
    TauTable tau = tau_compute(MAX_N, progress);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* ═══ Part 1: Fourth moment scaling ═══ */
    int test_Ns[] = {10000, 20000, 50000, 100000, 200000, 0};

    printf("═══════════════════════════════════════════════════════\n");
    printf("  Exceptional Set: Fourth Moment Analysis\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    printf("  %8s | %12s | %12s | %12s\n",
           "N", "∫|S|⁴", "∫|S_τ|⁴", "∫|S|²|S_τ|²");

    double logN[10], logM4_p[10], logM4_t[10], logM4_m[10];
    int npts = 0;

    for (int ni = 0; test_Ns[ni]; ni++) {
        int N = test_Ns[ni];
        if (N > MAX_N) break;
        int M = fft_next_pow2(4*N);

        fprintf(stderr, "  N=%d...\n", N);

        double *s_re=calloc(M,8),*s_im=calloc(M,8);
        double *t_re=calloc(M,8),*t_im=calloc(M,8);

        for (int n = 2; n <= N; n++) {
            if (isc[n]) continue;
            double lp = log((double)n);
            s_re[n] = lp;
            t_re[n] = lp * tau_normalized(&tau, n);
        }
        fft_transform(s_re, s_im, M, 1);
        fft_transform(t_re, t_im, M, 1);

        double m4_p = 0, m4_t = 0, m4_m = 0;
        for (int k = 0; k < M; k++) {
            if (fft_is_major_arc(k, M, FIXED_Q, N)) continue;
            double ps2 = s_re[k]*s_re[k] + s_im[k]*s_im[k];
            double pt2 = t_re[k]*t_re[k] + t_im[k]*t_im[k];
            m4_p += ps2 * ps2;          /* |S|⁴ */
            m4_t += pt2 * pt2;          /* |S_τ|⁴ */
            m4_m += ps2 * pt2;          /* |S|²·|S_τ|² */
        }
        m4_p /= M; m4_t /= M; m4_m /= M;

        /* Normalize by N⁴/(logN)⁴ (the expected scale) */
        double norm4 = pow((double)N / log((double)N), 4);
        double nm4_p = m4_p / norm4;
        double nm4_t = m4_t / norm4;
        double nm4_m = m4_m / norm4;

        logN[npts] = log((double)N);
        logM4_p[npts] = log(nm4_p);
        logM4_t[npts] = log(nm4_t);
        logM4_m[npts] = log(nm4_m);

        printf("  %8d | %12.6f | %12.6f | %12.6f\n", N, nm4_p, nm4_t, nm4_m);
        fflush(stdout);

        free(s_re);free(s_im);free(t_re);free(t_im);
        npts++;
    }

    /* Fit power laws */
    printf("\n  ═══ Fourth Moment Scaling ═══\n");
    printf("  E(N) ≤ ∫|S|⁴ / M² → exponent δ = -(β₄)/2\n\n");

    const char *names4[] = {"∫|S|⁴", "∫|S_τ|⁴", "∫|S|²|S_τ|²"};
    double *arrs4[] = {logM4_p, logM4_t, logM4_m};
    for (int m = 0; m < 3; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN[i];sy+=arrs4[m][i];
            sxx+=logN[i]*logN[i];sxy+=logN[i]*arrs4[m][i];}
        double beta=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        double delta = -beta / 2;
        printf("  %-16s | β₄ = %8.4f | implied δ = %8.4f | %s\n",
               names4[m], beta, delta,
               delta > 0.15 ? "★★★ BETTER THAN KNOWN" :
               delta > 0.12 ? "★★ COMPETITIVE" :
               delta > 0.05 ? "★" : "~");
    }

    /* ═══ Part 2: Residual distribution ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  Residual Distribution: r(E) vs Hardy-Littlewood M(E)\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    int MAX_E = 50000;
    /* Compute r(E) for all even E */
    double *r_E = calloc(MAX_E+1, 8);
    for (int E = 4; E <= MAX_E; E += 2) {
        double r = 0;
        for (int p = 2; p <= E-2; p++) {
            if (isc[p]) continue;
            int q = E - p;
            if (q < 2 || isc[q]) continue;
            r += log((double)p) * log((double)q);
        }
        r_E[E] = r;
    }

    /* Compute distribution of r(E)/M(E) at various scales */
    int scales[] = {1000, 5000, 10000, 20000, 50000, 0};
    printf("  %8s | %8s | %8s | %8s | %8s | %8s\n",
           "E_max", "min r/M", "mean r/M", "std r/M", "r<0.5M%", "r<0.1M%");

    for (int si = 0; scales[si]; si++) {
        int E_max = scales[si];
        if (E_max > MAX_E) break;
        double sum_ratio = 0, sum_ratio2 = 0;
        double min_ratio = 1e30;
        int below_half = 0, below_tenth = 0, count = 0;

        for (int E = 100; E <= E_max; E += 2) {
            double M = singular_series(E, isc, 200) * (double)E / (log((double)E)*log((double)E));
            if (M < 1) continue;
            double ratio = r_E[E] / M;
            sum_ratio += ratio;
            sum_ratio2 += ratio * ratio;
            if (ratio < min_ratio) min_ratio = ratio;
            if (ratio < 0.5) below_half++;
            if (ratio < 0.1) below_tenth++;
            count++;
        }

        double mean = sum_ratio / count;
        double std = sqrt(sum_ratio2/count - mean*mean);
        printf("  %8d | %8.4f | %8.4f | %8.4f | %7.2f%% | %7.2f%%\n",
               E_max, min_ratio, mean, std,
               100.0*below_half/count, 100.0*below_tenth/count);
    }

    /* ═══ Part 3: How fast does min(r/M) grow with E? ═══ */
    printf("\n  ═══ Minimum r(E)/M(E) by Scale ═══\n");
    printf("  (If min grows → exceptions become rarer → better δ)\n\n");

    int bin_size = 5000;
    for (int lo = 100; lo < MAX_E; lo += bin_size) {
        int hi = lo + bin_size;
        if (hi > MAX_E) hi = MAX_E;
        double bmin = 1e30;
        int bmin_E = 0;
        for (int E = lo; E <= hi; E += 2) {
            double M = singular_series(E, isc, 200) * (double)E / (log((double)E)*log((double)E));
            if (M < 1) continue;
            double ratio = r_E[E] / M;
            if (ratio < bmin) { bmin = ratio; bmin_E = E; }
        }
        printf("  E∈[%5d,%5d]: min r/M = %.4f (at E=%d)\n", lo, hi, bmin, bmin_E);
    }

    /* ═══ Part 4: τ-augmented fourth moment — Cauchy-Schwarz trick ═══ */
    printf("\n═══════════════════════════════════════════════════════\n");
    printf("  τ-Augmented Bound via Cauchy-Schwarz\n");
    printf("═══════════════════════════════════════════════════════\n\n");
    printf("  Classical:  E(N) ≤ (∫|S|⁴) / (main)²\n");
    printf("  τ-augment:  E(N) ≤ (∫|S|²|S_τ|²)^{1/2} · (∫|S|⁴)^{1/2} / (main)²\n");
    printf("  The τ-mixed moment ∫|S|²|S_τ|² may be smaller than ∫|S|⁴,\n");
    printf("  giving a geometric-mean improvement.\n\n");

    /* Already computed above. Compare the implied δ values */
    printf("  See fourth moment fits above for implied δ values.\n");
    printf("  If δ_mixed > δ_plain, τ provides improvement.\n");

    free(r_E);
    tau_free(&tau); free(isc);
    return 0;
}
