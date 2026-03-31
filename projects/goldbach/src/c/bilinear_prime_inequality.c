/*
 * bilinear_prime_inequality.c — Hunting for a New Inequality
 *
 * THE STRATEGY: Scientific method for inequality discovery.
 *
 * 1. Compute the bilinear sum B(T) = ∫_T^{2T} |F(σ+it)|² dt
 *    for F(s) = Σ_{p prime} p^{-s}  (prime Dirichlet polynomial)
 * 2. Compare to the generic ℓ² bound: (T + N) Σ p^{-2σ}
 * 3. Look for a MULTIPLICATIVE SAVING: does B(T) < c · (T+N) Σ p^{-2σ}
 *    with c < 1 or with a better T-dependence?
 *
 * If YES: we've found a new inequality. If c depends on σ,
 * this could improve the large values estimate.
 *
 * WHY PRIMES MIGHT GIVE EXTRA CANCELLATION:
 *   |F(σ+it)|² = Σ_{p,q prime} (p/q)^{-it} / (pq)^σ
 *   The off-diagonal (p≠q) terms are:
 *     Σ_{p≠q} (p/q)^{-it} / (pq)^σ
 *   The values log(p/q) for prime p,q are NOT equidistributed —
 *   they cluster around log integers (from ratio p/q ≈ integer).
 *   This NON-EQUIDISTRIBUTION could give extra cancellation or
 *   constructive interference, depending on σ.
 *
 * ALSO: We test the FOURTH moment ∫|F|⁴ and SIXTH moment ∫|F|⁶.
 * If the prime fourth moment is smaller than generic, that directly
 * improves the exponent pair / large values estimate.
 *
 * BUILD: cc -O3 -o bilinear_prime_inequality bilinear_prime_inequality.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 50001
static char sieve[MAX_N];
int primes[6000], nprimes;

void init_sieve(int limit) {
    memset(sieve, 0, limit+1);
    sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<=limit;i++)
        if(!sieve[i]) for(int j=i*i;j<=limit;j+=i) sieve[j]=1;
    for(int i=2;i<=limit;i++) if(!sieve[i]) primes[nprimes++]=i;
}

/* Compute F(σ+it) = Σ a_n n^{-σ-it} */
void eval_F(double sigma, double t, int *ns, double *as, int len,
            double *re_out, double *im_out) {
    double re = 0, im = 0;
    for (int i = 0; i < len; i++) {
        double phase = -t * log(ns[i]);
        double mag = as[i] * pow(ns[i], -sigma);
        re += mag * cos(phase);
        im += mag * sin(phase);
    }
    *re_out = re; *im_out = im;
}

int main() {
    init_sieve(MAX_N-1);
    printf("# Hunting for a New Inequality: Prime vs Generic Bilinear\n\n");

    int N = 5000;  /* use primes up to N */
    int nP = 0;
    for (int i = 0; i < nprimes && primes[i] <= N; i++) nP++;

    printf("  N = %d, π(N) = %d\n\n", N, nP);

    /* Build two sequences:
     * PRIME: a_n = 1 if n prime, 0 otherwise (supported on primes)
     * RANDOM: a_n = ±1 for π(N) random n in [1,N] (generic sequence)
     */

    int *prime_ns = malloc(nP * sizeof(int));
    double *prime_as = malloc(nP * sizeof(double));
    for (int i = 0; i < nP; i++) {
        prime_ns[i] = primes[i];
        prime_as[i] = 1.0;
    }

    /* Random comparison: pick nP random distinct integers in [2,N] */
    srand(42);
    int *rand_ns = malloc(nP * sizeof(int));
    double *rand_as = malloc(nP * sizeof(double));
    char *used = calloc(N+1, 1);
    int nR = 0;
    while (nR < nP) {
        int r = 2 + rand() % (N-1);
        if (!used[r]) { used[r] = 1; rand_ns[nR] = r; rand_as[nR] = 1.0; nR++; }
    }
    free(used);

    /* ═══════════════════════════════════════════ */
    printf("## 1. Second Moment ∫|F|² (Mean Value Theorem)\n\n");

    double sigmas[] = {0.6, 0.7, 0.8, 0.9, 1.0, 0};
    int T = 10000;
    int nsamples = 2000;

    printf("  %5s | %12s | %12s | %12s | %12s | %s\n",
           "σ", "∫|F_P|²", "∫|F_R|²", "ℓ² bound(P)", "ratio P/ℓ²", "saving?");

    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];

        /* Compute ℓ² bound: (T + N) Σ |a_p|²/p^{2σ} */
        double l2_sum_P = 0, l2_sum_R = 0;
        for (int i = 0; i < nP; i++) {
            l2_sum_P += pow(prime_ns[i], -2*sigma);
            l2_sum_R += pow(rand_ns[i], -2*sigma);
        }
        double l2_bound_P = T * l2_sum_P;
        double l2_bound_R = T * l2_sum_R;

        /* Compute numerical integral */
        double int_P = 0, int_R = 0;
        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im;

            eval_F(sigma, t, prime_ns, prime_as, nP, &re, &im);
            int_P += (re*re + im*im) * T / nsamples;

            eval_F(sigma, t, rand_ns, rand_as, nP, &re, &im);
            int_R += (re*re + im*im) * T / nsamples;
        }

        printf("  %5.1f | %12.1f | %12.1f | %12.1f | %12.4f | %s\n",
               sigma, int_P, int_R, l2_bound_P, int_P/l2_bound_P,
               int_P/l2_bound_P < 0.9 ? "YES ★" : "no");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Fourth Moment ∫|F|⁴ (KEY for Large Values)\n\n");

    printf("  The fourth moment controls the large values estimate.\n");
    printf("  If ∫|F_P|⁴ ≪ ∫|F_generic|⁴, primes are 'better behaved.'\n\n");

    printf("  %5s | %14s | %14s | %14s | %s\n",
           "σ", "∫|F_P|⁴", "∫|F_R|⁴", "P/R ratio", "saving?");

    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];
        double int4_P = 0, int4_R = 0;

        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im, mag2;

            eval_F(sigma, t, prime_ns, prime_as, nP, &re, &im);
            mag2 = re*re + im*im;
            int4_P += mag2*mag2 * T / nsamples;

            eval_F(sigma, t, rand_ns, rand_as, nP, &re, &im);
            mag2 = re*re + im*im;
            int4_R += mag2*mag2 * T / nsamples;
        }

        printf("  %5.1f | %14.1f | %14.1f | %14.4f | %s\n",
               sigma, int4_P, int4_R, int4_P/int4_R,
               int4_P/int4_R < 0.8 ? "YES ★" : "no");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Sixth Moment ∫|F|⁶ (GM's Key Exponent)\n\n");

    printf("  GM's A=30/13 comes from the sixth moment µ₃.\n");
    printf("  If ∫|F_P|⁶ is smaller than generic, A could improve.\n\n");

    printf("  %5s | %16s | %16s | %14s | %s\n",
           "σ", "∫|F_P|⁶", "∫|F_R|⁶", "P/R ratio", "saving?");

    for (int si = 0; sigmas[si] > 0; si++) {
        double sigma = sigmas[si];
        double int6_P = 0, int6_R = 0;

        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im, mag2;

            eval_F(sigma, t, prime_ns, prime_as, nP, &re, &im);
            mag2 = re*re + im*im;
            int6_P += mag2*mag2*mag2 * T / nsamples;

            eval_F(sigma, t, rand_ns, rand_as, nP, &re, &im);
            mag2 = re*re + im*im;
            int6_R += mag2*mag2*mag2 * T / nsamples;
        }

        printf("  %5.1f | %16.1f | %16.1f | %14.4f | %s\n",
               sigma, int6_P, int6_R, int6_P/int6_R,
               int6_P/int6_R < 0.7 ? "YES ★" : "no");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 4. The Peak Distribution (Large Values)\n\n");

    printf("  Rather than moments, look at the TAIL:\n");
    printf("  #{t: |F(σ+it)| > V} for prime vs random F.\n\n");

    double sigma = 0.75;
    printf("  σ = %.2f, T = %d:\n\n", sigma, T);
    printf("  %12s | %8s | %8s | %s\n", "V / √(ℓ²)", "N_P(>V)", "N_R(>V)", "P/R");

    /* Compute ℓ² norms */
    double l2_P = 0;
    for (int i = 0; i < nP; i++) l2_P += pow(prime_ns[i], -2*sigma);
    double rms_P = sqrt(l2_P);

    double thresholds[] = {1, 2, 3, 5, 8, 10, 15, 20, 0};
    for (int ti = 0; thresholds[ti] > 0; ti++) {
        double V = thresholds[ti] * rms_P;
        int count_P = 0, count_R = 0;
        for (int k = 0; k < nsamples; k++) {
            double t = T + (double)k/nsamples * T;
            double re, im, mag;

            eval_F(sigma, t, prime_ns, prime_as, nP, &re, &im);
            mag = sqrt(re*re + im*im);
            if (mag > V) count_P++;

            eval_F(sigma, t, rand_ns, rand_as, nP, &re, &im);
            mag = sqrt(re*re + im*im);
            if (mag > V) count_R++;
        }

        printf("  %12.1f | %8d | %8d | %s\n",
               thresholds[ti], count_P, count_R,
               count_P < count_R * 0.8 ? "PRIME BETTER ★" :
               count_P > count_R * 1.2 ? "RANDOM BETTER" : "~same");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 5. Red Team + Interpretation\n\n");

    printf("  We tested three moments and the tail distribution.\n");
    printf("  The critical question: do primes give FEWER large values?\n\n");

    printf("  If ∫|F_P|^{2k} < c_k · ∫|F_R|^{2k} with c_k < 1:\n");
    printf("    This means primes have BETTER cancellation.\n");
    printf("    The saving c_k could translate to A < 30/13.\n\n");

    printf("  If ∫|F_P|^{2k} ≈ ∫|F_R|^{2k}:\n");
    printf("    Primes behave like random sequences for large values.\n");
    printf("    No saving possible from prime structure.\n\n");

    printf("  🔴 RED TEAM NOTES:\n");
    printf("  1. N=5000 is SMALL. Asymptotic behavior may differ.\n");
    printf("  2. The 'random' comparison uses FIXED random set.\n");
    printf("     Should average over many random sets.\n");
    printf("  3. The ℓ² bound is NOT tight — the MVT gives T·ℓ² + N·ℓ².\n");
    printf("     We used T·ℓ² (ignoring N term for T ≫ N).\n");
    printf("  4. GM's result says: for GENERIC F, the bound is TIGHT.\n");
    printf("     If primes beat generic, it's because they're NOT generic.\n");
    printf("     But our approach (i) says: the saving must NOT reduce\n");
    printf("     to ℓ² orthogonality. Does the prime saving use ℓ²?\n");

    free(prime_ns); free(prime_as); free(rand_ns); free(rand_as);
    return 0;
}
