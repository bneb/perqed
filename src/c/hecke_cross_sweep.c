/*
 * hecke_cross_sweep.c — Sweep Sym^k for k=1..K_MAX to find negative cross terms.
 *
 * For each k, the Sym^k eigenvalue at prime p is U_k(τ̃(p)/2),
 * where U_k is the Chebyshev polynomial of the 2nd kind.
 *
 * We compute the cross term:
 *   C_k(N) = Σ_{p1+p4=p2+p3} log(p1)log(p2)log(p3)log(p4)·U_k(τ̃(p4)/2)
 *
 * and also try linear combinations of Sym^k to search for any f
 * that gives a negative cross term.
 *
 * BUILD: cc -O3 -o hecke_cross_sweep hecke_cross_sweep.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_SIEVE 200001
#define K_MAX 20

static char is_composite[MAX_SIEVE];
static int primes[20000];
static int num_primes = 0;
static long long tau_table[MAX_SIEVE];

void sieve(int limit) {
    memset(is_composite, 0, limit + 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; (long long)i * i <= limit; i++)
        if (!is_composite[i])
            for (int j = i * i; j <= limit; j += i)
                is_composite[j] = 1;
    for (int i = 2; i <= limit; i++)
        if (!is_composite[i])
            primes[num_primes++] = i;
}

void compute_tau(int limit) {
    double *coeff = calloc(limit + 2, sizeof(double));
    coeff[0] = 1.0;
    for (int n = 1; n <= limit; n++) {
        for (int rep = 0; rep < 24; rep++) {
            for (int k = limit; k >= n; k--)
                coeff[k] -= coeff[k - n];
        }
    }
    tau_table[0] = 0;
    for (int n = 1; n <= limit; n++)
        tau_table[n] = (long long)round(coeff[n - 1]);
    free(coeff);
}

double tau_norm(int p) {
    if (p >= MAX_SIEVE) return 0.0;
    return (double)tau_table[p] / pow((double)p, 5.5);
}

/* Chebyshev U_k(x) of the 2nd kind.
 * U_0(x)=1, U_1(x)=2x, U_{k+1}(x)=2x·U_k(x)-U_{k-1}(x) */
double chebyU(int k, double x) {
    if (k == 0) return 1.0;
    if (k == 1) return 2.0 * x;
    double u_prev = 1.0, u_curr = 2.0 * x;
    for (int i = 2; i <= k; i++) {
        double u_next = 2.0 * x * u_curr - u_prev;
        u_prev = u_curr;
        u_curr = u_next;
    }
    return u_curr;
}

int main(int argc, char **argv) {
    int N = 20000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_SIEVE - 1) N = MAX_SIEVE - 1;

    sieve(N);
    compute_tau(N);

    printf("# Hecke Cross Term Sweep: Sym^k for k=1..%d, N=%d\n", K_MAX, N);
    printf("# π(N)=%d primes\n\n", num_primes);

    /* Verify tau */
    printf("τ check: τ(2)=%lld τ(3)=%lld τ(5)=%lld τ(7)=%lld\n",
           tau_table[2], tau_table[3], tau_table[5], tau_table[7]);

    /* For each prime p, precompute τ̃(p)/2 */
    int np = 0;
    while (np < num_primes && primes[np] <= N) np++;

    double *tau_half = malloc(np * sizeof(double));
    for (int i = 0; i < np; i++)
        tau_half[i] = tau_norm(primes[i]) / 2.0;

    /* Build the sum-convolution ff[s] = Σ_{p1+p2=s} log(p1)·log(p2)
     * for the plain exponential sum. */
    int sz = 2 * N + 2;
    double *ff = calloc(sz, sizeof(double));

    for (int i = 0; i < np; i++) {
        double lp1 = log((double)primes[i]);
        for (int j = 0; j < np; j++) {
            int s = primes[i] + primes[j];
            if (s < sz)
                ff[s] += lp1 * log((double)primes[j]);
        }
    }

    /* Fourth moment for normalization: Σ_s ff[s]² */
    double fourth = 0;
    for (int s = 0; s < sz; s++) fourth += ff[s] * ff[s];

    printf("\n# Fourth moment ∫|S|⁴ = %.6e\n\n", fourth);
    printf("# %4s | %15s | %12s | %s\n", "k", "cross_term_k", "ratio", "sign");
    printf("#------+-----------------+--------------+------\n");

    /* For each k, build fg_k[s] = Σ_{p3+p4=s} log(p3)·log(p4)·U_k(τ̃(p4)/2) */
    double cross_terms[K_MAX + 1];

    for (int k = 0; k <= K_MAX; k++) {
        double *fg = calloc(sz, sizeof(double));

        for (int i = 0; i < np; i++) {
            double lp_i = log((double)primes[i]);
            for (int j = 0; j < np; j++) {
                int s = primes[i] + primes[j];
                if (s < sz) {
                    double lp_j = log((double)primes[j]);
                    double uk = chebyU(k, tau_half[j]);
                    fg[s] += lp_i * lp_j * uk;
                }
            }
        }

        double cross = 0;
        for (int s = 0; s < sz; s++) cross += ff[s] * fg[s];

        cross_terms[k] = cross;
        double ratio = (fourth > 0) ? cross / fourth : 0;

        printf("  %4d | %15.4e | %12.6f | %s\n",
               k, cross, ratio,
               (cross < 0) ? "NEG ✓" : "pos ✗");

        free(fg);
    }

    /* Now search for linear combinations c_0·U_0 + c_1·U_1 + ... + c_K·U_K
     * with the constraint that f(x) = Σ c_k U_k(x/2) ≥ 0 on [-2,2]
     * and Σ c_k · cross_k < 0.
     *
     * The simplest: try f(x) = 1 + ε·U_k(x/2) for small ε.
     * Need 1 + ε·U_k(x/2) ≥ 0 on [-2,2].
     * Since |U_k(x/2)| ≤ k+1 on [-1,1] (i.e., x ∈ [-2,2]),
     * we need |ε| ≤ 1/(k+1).
     *
     * Cross term for f = 1 + ε·U_k:
     *   cross_0 + ε·cross_k
     * Want this < 0, so ε < -cross_0/cross_k (if cross_k > 0)
     * or ε > -cross_0/cross_k (if cross_k < 0).
     * Need |ε| ≤ 1/(k+1).
     */
    printf("\n# Linear combination search: f = 1 + ε·U_k\n");
    printf("# Need: |ε| ≤ 1/(k+1) AND cross_0 + ε·cross_k < 0\n");
    printf("# %4s | %12s | %12s | %12s | %s\n",
           "k", "ε_needed", "ε_max", "ε_needed/max", "feasible?");

    for (int k = 1; k <= K_MAX; k++) {
        if (fabs(cross_terms[k]) < 1e-10) continue;
        double eps_needed = -cross_terms[0] / cross_terms[k];
        double eps_max = 1.0 / (k + 1);
        double ratio = fabs(eps_needed) / eps_max;

        int feasible = (fabs(eps_needed) <= eps_max);
        /* Also need sign: if cross_k > 0, need ε < 0 (so eps_needed < 0 OK)
         * and f = 1 + ε·U_k ≥ 0 requires ε ≥ -1/(k+1). */

        printf("  %4d | %12.6f | %12.6f | %12.4f | %s\n",
               k, eps_needed, eps_max, ratio,
               feasible ? "YES ✓✓✓" : "no");
    }

    free(tau_half);
    free(ff);

    return 0;
}
