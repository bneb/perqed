/*
 * rankin_selberg.c — Verify Rankin-Selberg predictions for the mixed moment.
 *
 * The Rankin-Selberg L-function L(Δ⊗Δ, s) = Σ τ(n)²/n^s controls
 * the fourth moment of S_τ on minor arcs. 
 *
 * Key predictions to verify:
 *   1. Σ_{p≤X} τ̃(p)² ≈ C·X/logX (PNT with Sato-Tate)
 *      Since E[τ̃²] = 1 (Sato-Tate), and π(X) ≈ X/logX
 *
 *   2. Σ_{n≤X} τ̃(n)² ≈ C'·X (Rankin-Selberg with normalization)
 *      The pole at s=1 of L(Δ⊗Δ,s) gives linear growth
 *
 *   3. The mixed moment ∫|S|²|S_τ|² scales as N^{4-2δ'}
 *      with δ' predicted by the zero-free region of L(Δ⊗Δ,s)
 *
 *   4. The variance Σ_E r_τ(E)² grows slower than Σ_E r(E)²
 *      because r_τ is centered at 0 (from our de-twisting test)
 *
 * Also: push the fourth moment to N=500K for tighter scaling fits.
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
    fprintf(stderr, "Init (τ to %d)...\n", MAX_N);
    char *isc = fft_sieve_primes(MAX_N);
    TauTable tau = tau_compute(MAX_N, prog);
    fprintf(stderr, "Done.\n\n");
    if (tau_verify_known(&tau)) { printf("τ FAILED\n"); return 1; }

    /* ═══ Test 1: Rankin-Selberg prediction for Σ τ̃(p)² ═══ */
    printf("═══ Test 1: Rankin-Selberg — Σ τ̃(p)² Growth ═══\n");
    printf("  Sato-Tate predicts: Σ_{p≤X} τ̃(p)² ≈ π(X) (since E[τ̃²]=1)\n\n");
    printf("  %10s | %10s | %10s | %10s\n", "X", "Σ τ̃(p)²", "π(X)", "ratio");

    int checkpoints[] = {1000, 5000, 10000, 50000, 100000, 200000, 500000, 0};
    for (int ci = 0; checkpoints[ci]; ci++) {
        int X = checkpoints[ci];
        if (X > MAX_N) break;
        double sum_tsq = 0;
        int pi_x = 0;
        for (int p = 2; p <= X; p++) {
            if (isc[p]) continue;
            pi_x++;
            double t = tau_normalized(&tau, p);
            sum_tsq += t * t;
        }
        printf("  %10d | %10.1f | %10d | %10.4f\n", X, sum_tsq, pi_x, sum_tsq / pi_x);
    }

    /* ═══ Test 2: Σ τ̃(n)² for ALL n (not just primes) ═══ */
    printf("\n═══ Test 2: Σ_{n≤X} τ̃(n)² — Rankin-Selberg Pole ═══\n");
    printf("  L(Δ⊗Δ,s) has pole at s=1 → Σ τ(n)²/n^{11} ≈ C·logX\n\n");
    printf("  %10s | %10s | %10s | %10s\n", "X", "Σ τ̃²", "X", "Σ/X");

    for (int ci = 0; checkpoints[ci]; ci++) {
        int X = checkpoints[ci];
        if (X > MAX_N) break;
        double sum = 0;
        for (int n = 1; n <= X; n++) {
            double t = tau.values[n] / pow((double)n, 5.5);
            sum += t * t;
        }
        printf("  %10d | %10.2f | %10d | %10.6f\n", X, sum, X, sum/X);
    }

    /* ═══ Test 3: Fourth moment at larger N (up to 500K) ═══ */
    printf("\n═══ Test 3: Fourth Moment — Extended to 500K ═══\n\n");

    int test_Ns[] = {10000, 20000, 50000, 100000, 200000, 350000, 500000, 0};
    double logN[10], logM4_p[10], logM4_t[10], logM4_m[10];
    int npts = 0;

    printf("  %8s | %12s | %12s | %12s | %10s\n",
           "N", "∫|S|⁴ norm", "∫|Sτ|⁴ norm", "∫|S|²|Sτ|²", "mix/plain");

    for (int ni = 0; test_Ns[ni]; ni++) {
        int N = test_Ns[ni];
        if (N > MAX_N - 1) break;
        int M = fft_next_pow2(4*N);
        double norm4 = pow((double)N / log((double)N), 4);

        fprintf(stderr, "  N=%d (M=%d)...\n", N, M);

        double *s_re=calloc(M,8),*s_im=calloc(M,8);
        double *t_re=calloc(M,8),*t_im=calloc(M,8);

        for (int n = 2; n <= N; n++) {
            if (isc[n]) continue;
            s_re[n] = log((double)n);
            t_re[n] = log((double)n) * tau_normalized(&tau, n);
        }
        fft_transform(s_re, s_im, M, 1);
        fft_transform(t_re, t_im, M, 1);

        double m4p=0, m4t=0, m4m=0;
        for (int k = 0; k < M; k++) {
            if (fft_is_major_arc(k, M, FIXED_Q, N)) continue;
            double ps2 = s_re[k]*s_re[k] + s_im[k]*s_im[k];
            double pt2 = t_re[k]*t_re[k] + t_im[k]*t_im[k];
            m4p += ps2*ps2;
            m4t += pt2*pt2;
            m4m += ps2*pt2;
        }
        m4p /= M; m4t /= M; m4m /= M;

        double nm4p = m4p/norm4, nm4t = m4t/norm4, nm4m = m4m/norm4;
        logN[npts] = log((double)N);
        logM4_p[npts] = log(nm4p);
        logM4_t[npts] = log(nm4t);
        logM4_m[npts] = log(nm4m);

        printf("  %8d | %12.8f | %12.8f | %12.8f | %10.4f\n",
               N, nm4p, nm4t, nm4m, nm4m/nm4p);
        fflush(stdout);

        free(s_re);free(s_im);free(t_re);free(t_im);
        npts++;
    }

    /* Power-law fits */
    printf("\n  ═══ Power-Law Fits (all %d points) ═══\n", npts);
    const char *names[] = {"∫|S|⁴", "∫|S_τ|⁴", "∫|S|²|S_τ|²"};
    double *arrs[] = {logM4_p, logM4_t, logM4_m};
    double betas[3], deltas[3];

    for (int m = 0; m < 3; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN[i];sy+=arrs[m][i];
            sxx+=logN[i]*logN[i];sxy+=logN[i]*arrs[m][i];}
        betas[m]=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        deltas[m] = -betas[m] / 2;
        printf("  %-16s | β₄ = %8.4f | δ = %6.4f\n", names[m], betas[m], deltas[m]);
    }

    /* Split-half stability */
    printf("\n  ═══ Split-Half Stability ═══\n");
    for (int m = 0; m < 3; m++) {
        int h = npts/2;
        double sx1=0,sy1=0,sxx1=0,sxy1=0;
        double sx2=0,sy2=0,sxx2=0,sxy2=0;
        for(int i=0;i<h;i++){sx1+=logN[i];sy1+=arrs[m][i];sxx1+=logN[i]*logN[i];sxy1+=logN[i]*arrs[m][i];}
        for(int i=h;i<npts;i++){sx2+=logN[i];sy2+=arrs[m][i];sxx2+=logN[i]*logN[i];sxy2+=logN[i]*arrs[m][i];}
        double b1=(h*sxy1-sx1*sy1)/(h*sxx1-sx1*sx1);
        int h2=npts-h;
        double b2=(h2*sxy2-sx2*sy2)/(h2*sxx2-sx2*sx2);
        printf("  %-16s | 1st half β=%.4f | 2nd half β=%.4f | diff=%.4f\n",
               names[m], b1, b2, fabs(b1-b2));
    }

    /* ═══ Improvement factor ═══ */
    printf("\n  ═══ Exceptional Set Improvement ═══\n");
    printf("  Classical (plain):       δ = %.4f (E(N) ≤ N^{%.4f})\n", deltas[0], 1-deltas[0]);
    printf("  τ-mixed (Cauchy-Schwarz): δ' = (%.4f + %.4f)/2 = %.4f\n",
           deltas[0], deltas[2], (deltas[0]+deltas[2])/2);

    double improvement = (deltas[0]+deltas[2])/2 - deltas[0];
    printf("  Improvement: Δδ = %.4f\n", improvement);
    printf("  This means E(N) ≤ N^{%.4f} instead of N^{%.4f}\n",
           1-(deltas[0]+deltas[2])/2, 1-deltas[0]);

    if (improvement > 0.05)
        printf("\n  ★★★ Substantial improvement — τ mixing gives better δ!\n");
    else
        printf("\n  ~ Marginal improvement.\n");

    tau_free(&tau); free(isc);
    return 0;
}
