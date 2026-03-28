/*
 * goldbach_amplified_moment.c
 * ===========================
 * Numerically compute the amplified second moment of L(1/2, χ)
 * for Dirichlet characters χ mod q, with the Selberg-type amplifier.
 *
 * For each prime q, we compute:
 *   A(χ) = ∑_{n≤N} a_n · χ(n)    where a_n = μ(n)·log(N/n)/log(N)
 *   L(1/2, χ) ≈ ∑_{n=1}^{T} χ(n)/√n · smoothing
 *   Moment = ∑_χ |A(χ)|² · |L(1/2, χ)|²
 *
 * We compare Moment to φ(q)·(diagonal prediction) and check that
 * the quadratic character term |A(χ_quad)|²·|L(1/2,χ_quad)|² is
 * much smaller than the total moment.
 *
 * This is the numerical verification of the amplified moment
 * inequality needed to close the Siegel zero gap.
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <complex.h>
#include <string.h>

#define MAX_Q    5000
#define L_TERMS  50000   /* terms in L-function partial sum */

/* Sieve for μ(n) */
static int8_t mu[L_TERMS + 1];
static uint8_t is_prime_arr[L_TERMS + 1];

static void compute_mobius(int max_n) {
    memset(mu, 0, sizeof(mu));
    memset(is_prime_arr, 0, sizeof(is_prime_arr));
    mu[1] = 1;
    for (int i = 2; i <= max_n; i++) is_prime_arr[i] = 1;

    for (int i = 2; i <= max_n; i++) {
        if (!is_prime_arr[i]) continue;
        /* i is prime */
        for (int j = i; j <= max_n; j += i) {
            if (j > i) is_prime_arr[j] = 0;
        }
        /* Apply μ: μ(n·p) = -μ(n) if p∤n, else 0 */
    }

    /* Compute μ via factorization */
    static int8_t smallest_prime[L_TERMS + 1];
    memset(smallest_prime, 0, sizeof(smallest_prime));
    for (int i = 2; i <= max_n; i++) {
        if (is_prime_arr[i]) {
            for (int j = i; j <= max_n; j += i) {
                if (smallest_prime[j] == 0) smallest_prime[j] = i;
            }
        }
    }

    mu[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = smallest_prime[n];
        if (n % ((long)p * p) == 0) {
            mu[n] = 0;
        } else {
            mu[n] = -mu[n / p];
        }
    }
}

/* Find a primitive root mod q (q prime) */
static int primitive_root(int q) {
    for (int g = 2; g < q; g++) {
        int ok = 1;
        long x = 1;
        for (int j = 1; j < q - 1; j++) {
            x = (x * g) % q;
            if (x == 1) { ok = 0; break; }
        }
        if (ok) return g;
    }
    return -1;
}

/* Compute discrete logarithm table: dlog[g^k mod q] = k */
static void build_dlog(int q, int g, int *dlog) {
    memset(dlog, -1, q * sizeof(int));
    long x = 1;
    for (int k = 0; k < q - 1; k++) {
        dlog[(int)x] = k;
        x = (x * g) % q;
    }
}

/* Character χ_j(n) = exp(2πi·j·dlog[n]/(q-1)) for gcd(n,q)=1 */
static double complex chi(int n, int j, int q, int *dlog) {
    int nmod = ((n % q) + q) % q;
    if (nmod == 0) return 0.0;
    int dl = dlog[nmod];
    if (dl < 0) return 0.0; /* shouldn't happen for n coprime to q */
    double angle = 2.0 * M_PI * (double)j * (double)dl / (double)(q - 1);
    return cos(angle) + I * sin(angle);
}

/* Legendre symbol (n/q) for odd prime q */
static int legendre(int n, int q) {
    int nmod = ((n % q) + q) % q;
    if (nmod == 0) return 0;
    /* Euler criterion: (n/q) = n^((q-1)/2) mod q */
    long result = 1;
    long base = nmod;
    int exp = (q - 1) / 2;
    while (exp > 0) {
        if (exp % 2 == 1) result = (result * base) % q;
        base = (base * base) % q;
        exp /= 2;
    }
    return (result == 1) ? 1 : -1;
}

int main(void) {
    printf("=== Amplified Second Moment of L(1/2, χ) ===\n\n");

    compute_mobius(L_TERMS);
    printf("Möbius function computed up to %d\n", L_TERMS);

    /* Test for several primes q */
    int test_primes[] = {11, 23, 47, 97, 199, 397, 797, 1597, 3191};
    int n_tests = sizeof(test_primes) / sizeof(test_primes[0]);

    printf("\n%-8s %-8s %-14s %-14s %-14s %-10s %-10s\n",
           "q", "N_amp", "Moment", "Diagonal", "M/D ratio",
           "|A(quad)|²", "Quad/Mom");

    for (int t = 0; t < n_tests; t++) {
        int q = test_primes[t];

        /* Amplifier length: N = q^{1/4} (rounded) */
        int N_amp = (int)(pow((double)q, 0.25) + 0.5);
        if (N_amp < 2) N_amp = 2;
        double logN = log((double)N_amp);

        /* Selberg-type amplifier coefficients */
        double *a = calloc(N_amp + 1, sizeof(double));
        for (int n = 1; n <= N_amp; n++) {
            if (mu[n] == 0) continue;
            a[n] = (double)mu[n] * log((double)N_amp / (double)n) / logN;
        }

        /* Build character table */
        int g = primitive_root(q);
        int *dlog = calloc(q, sizeof(int));
        build_dlog(q, g, dlog);

        /* Quadratic character index: j = (q-1)/2 */
        int j_quad = (q - 1) / 2;

        /* For each character j = 0..q-2, compute A(χ_j) and L(1/2, χ_j) */
        double moment = 0.0;
        double diagonal_pred = 0.0;
        double A_quad_sq = 0.0;
        double L_quad_sq = 0.0;
        double max_ratio = 0.0;

        /* Precompute diagonal prediction: φ(q) · ∑_n |a_n|²/n */
        double diag_sum = 0.0;
        for (int n = 1; n <= N_amp; n++) {
            diag_sum += a[n] * a[n] / (double)n;
        }
        diagonal_pred = (double)(q - 1) * diag_sum;

        /* Number of L-function terms: min(L_TERMS, 10*q) */
        int T = L_TERMS;
        if (T > 10 * q) T = 10 * q;
        if (T > L_TERMS) T = L_TERMS;

        for (int j = 0; j < q - 1; j++) {
            /* Compute A(χ_j) */
            double complex Aj = 0.0;
            for (int n = 1; n <= N_amp; n++) {
                if (fabs(a[n]) < 1e-15) continue;
                Aj += a[n] * chi(n, j, q, dlog);
            }

            /* Compute L(1/2, χ_j) with smoothed partial sum */
            double complex Lj = 0.0;
            for (int n = 1; n <= T; n++) {
                /* Smooth cutoff: exp(-(n/T)^2) to help convergence */
                double smooth = exp(-(double)n * n / ((double)T * T));
                Lj += chi(n, j, q, dlog) / sqrt((double)n) * smooth;
            }

            double Aj_sq = creal(Aj) * creal(Aj) + cimag(Aj) * cimag(Aj);
            double Lj_sq = creal(Lj) * creal(Lj) + cimag(Lj) * cimag(Lj);

            double term = Aj_sq * Lj_sq;
            moment += term;

            if (j == j_quad) {
                A_quad_sq = Aj_sq;
                L_quad_sq = Lj_sq;
            }

            if (Aj_sq > 1e-10) {
                double r = term / moment;
                if (r > max_ratio) max_ratio = r;
            }
        }

        double quad_term = A_quad_sq * L_quad_sq;
        printf("%-8d %-8d %-14.2f %-14.2f %-14.4f %-10.4f %-10.6f\n",
               q, N_amp, moment, diagonal_pred, moment / diagonal_pred,
               A_quad_sq, quad_term / moment);

        free(a);
        free(dlog);
    }

    printf("\n--- Interpretation ---\n");
    printf("M/D ratio ≈ 1 means the diagonal dominates (off-diagonal small)\n");
    printf("Quad/Mom << 1 means the quadratic character term is negligible\n");
    printf("  → this is exactly what the amplified moment inequality requires\n");
    printf("If Quad/Mom → 0 as q → ∞, the inequality holds asymptotically\n");

    return 0;
}
