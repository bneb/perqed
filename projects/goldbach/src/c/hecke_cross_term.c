/*
 * hecke_cross_term.c — Test whether the Hecke cross term is negative.
 *
 * Computes the cross term:
 *   C(N) = Σ_{p1+p4=p2+p3, all ≤N} log(p1)log(p2)log(p3)log(p4) · τ̃(p4)
 *
 * where τ̃(p) = τ(p)/p^{11/2} is the normalized Ramanujan τ.
 *
 * This is equivalent to ∫₀¹ |S(α)|² · Re(S̄(α) · E₁(α)) dα
 * where S = Σ log(p)e(pα) and E₁ = Σ log(p)τ̃(p)e(pα).
 *
 * If C(N) < 0, the Hecke-weighted fourth moment is SMALLER than
 * μ⁴∫|S|⁴, potentially improving the exceptional set bound.
 *
 * BUILD: cc -O3 -o hecke_cross_term hecke_cross_term.c -lm
 * USAGE: ./hecke_cross_term [max_N]
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <complex.h>

#define MAX_SIEVE 2000001

static char is_composite[MAX_SIEVE];
static int primes[200000];
static int num_primes = 0;

/* Ramanujan tau values (precomputed for small n).
 * τ(n) are the Fourier coefficients of Δ(z) = q∏(1-q^n)^24.
 * We compute them via the recurrence from the product formula. */
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

/* Compute Ramanujan tau function via the product formula.
 * Δ(q) = q · ∏_{n≥1} (1-q^n)^24 = Σ τ(n)q^n
 *
 * We compute the coefficients of ∏(1-q^n)^24 up to degree limit,
 * then shift by 1 (since Δ = q · product).
 */
void compute_tau(int limit) {
    /* coefficients of ∏(1-q^n)^24 */
    /* Start with (1-q)^24, then multiply by (1-q^2)^24, etc. */
    
    /* Use double array for intermediate computation (tau values fit in long long) */
    double *coeff = calloc(limit + 2, sizeof(double));
    coeff[0] = 1.0;
    
    /* Multiply by (1 - q^n)^24 for n = 1, 2, ..., limit */
    for (int n = 1; n <= limit; n++) {
        /* (1-q^n)^24: expand using binomial, but it's easier to
         * multiply by (1-q^n) twenty-four times. */
        for (int rep = 0; rep < 24; rep++) {
            /* Multiply polynomial by (1 - q^n) */
            for (int k = limit; k >= n; k--) {
                coeff[k] -= coeff[k - n];
            }
        }
    }
    
    /* τ(n) = coeff[n-1] (since Δ = q · product, so τ(n) is coeff of q^n = coeff[n-1] of product) */
    tau_table[0] = 0;
    for (int n = 1; n <= limit; n++) {
        tau_table[n] = (long long)round(coeff[n - 1]);
    }
    
    free(coeff);
}

/* Normalized tau: τ̃(p) = τ(p) / p^{11/2} */
double tau_norm(int p) {
    if (p >= MAX_SIEVE) return 0.0;
    return (double)tau_table[p] / pow((double)p, 5.5);
}

int main(int argc, char **argv) {
    int max_N = 50000;
    if (argc > 1) max_N = atoi(argv[1]);
    if (max_N > MAX_SIEVE - 1) max_N = MAX_SIEVE - 1;
    
    printf("# Hecke Cross Term Computation\n");
    printf("# Testing: is ∫|S|²Re(S̄E₁) < 0?\n\n");
    
    sieve(max_N);
    printf("Sieve complete: %d primes up to %d\n", num_primes, max_N);
    
    compute_tau(max_N);
    
    /* Verify tau values */
    printf("\nRamanujan tau spot check:\n");
    printf("  τ(1)=%lld (expect 1)\n", tau_table[1]);
    printf("  τ(2)=%lld (expect -24)\n", tau_table[2]);
    printf("  τ(3)=%lld (expect 252)\n", tau_table[3]);
    printf("  τ(5)=%lld (expect 4830)\n", tau_table[5]);
    printf("  τ(7)=%lld (expect -16744)\n", tau_table[7]);
    printf("  τ(11)=%lld (expect 534612)\n", tau_table[11]);
    printf("  τ(13)=%lld (expect -577738)\n", tau_table[13]);
    
    /* Compute the cross term for various N:
     *
     * ∫₀¹ |S(α)|² S̄(α) E₁(α) dα
     *   = Σ_{p1+p4=p2+p3} log(p1)log(p2)log(p3)log(p4)·τ̃(p4)
     *
     * where all primes ≤ N.
     *
     * Equivalently via Parseval: sum over all additive quadruples.
     * This is O(π(N)³) naively but we can do it via convolution.
     *
     * Let A[m] = Σ_{p≤N, p prime} log(p) · δ(m=p)      [plain]
     * Let B[m] = Σ_{p≤N, p prime} log(p) · τ̃(p) · δ(m=p) [tau-weighted]
     *
     * Then |S|² = (Σ Aₚ e(pα))(Σ Aq e(-qα)) = Σ_d (Σ_{p-q=d} Ap·Aq) e(dα)
     *
     * The cross term = Σ_s (convolution of A with itself at s) · (convolution of A with B at s)
     *
     * Actually: ∫ |S|² S̄ E₁ = Σ_{p1-p2+p4-p3=0} Ap1·Ap2·Ap3·Bp4
     *         = Σ_{s} (Σ_{p1-p2=s} Ap1·Ap2) · (Σ_{p3-p4=s} Ap3·Bp4)
     *
     * Wait, let me re-derive. Define:
     * S(α) = Σ_p A[p] e(pα),  E₁(α) = Σ_p B[p] e(pα)
     *
     * |S|² S̄ E₁ = S · S̄ · S̄ · E₁ = S · |S̄|² · E₁ ... no.
     *
     * |S(α)|² = S(α)·S̄(α) = (Σ A[p1]e(p1α))(Σ A[p2]e(-p2α))
     * S̄(α) = Σ A[p3]e(-p3α)
     * E₁(α) = Σ B[p4]e(p4α)
     *
     * Product = Σ A[p1]A[p2]A[p3]B[p4] e((p1-p2-p3+p4)α)
     *
     * Integral ∫₀¹ = Σ with p1-p2-p3+p4=0, i.e., p1+p4=p2+p3.
     * 
     * So cross_term = Σ_{p1+p4=p2+p3, all prime ≤N} log(p1)log(p2)log(p3)log(p4)·τ̃(p4)
     *
     * We compute this via the convolution approach:
     * Let f[m] = Σ_{p, prime, p≤N, m=p} log(p) for m=0,...,2N
     * Let g[m] = Σ_{p, prime, p≤N, m=p} log(p)·τ̃(p)
     *
     * Then the "sum convolution":
     * C_plain[s] = Σ_{p1+p2=s} f[p1]·f[p2] = (f ∗ f)[s]  (for s = p1+p2)
     * C_mixed[s] = Σ_{p3+p4=s} f[p3]·g[p4] = (f ∗ g)[s]
     *
     * Wait, the condition is p1+p4 = p2+p3, which means:
     *   Let s = p1+p4 = p2+p3. Then s ranges over possible sums.
     * 
     * cross_term = Σ_s (Σ_{p2+p3=s} f[p2]·f[p3]) · (Σ_{p1+p4=s} f[p1]·g[p4])
     *            = Σ_s (f∗f)[s] · (f∗g)[s]
     *
     * This is a dot product of two convolutions. We can compute f∗f and f∗g
     * directly (O(N²) each, or O(NlogN) with FFT).
     */
    
    printf("\n# Cross term ∫|S|²Re(S̄E₁) for various N\n");
    printf("# %8s | %15s | %15s | %10s | %s\n",
           "N", "cross_term", "fourth_moment", "ratio", "sign");
    printf("#---------+-----------------+-----------------+------------+-----\n");
    
    int test_Ns[] = {100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 0};
    
    for (int ti = 0; test_Ns[ti] != 0 && test_Ns[ti] <= max_N; ti++) {
        int N = test_Ns[ti];
        
        /* Build f[m] and g[m] arrays */
        int sz = 2 * N + 2;
        double *f = calloc(sz, sizeof(double));
        double *g = calloc(sz, sizeof(double));
        
        for (int i = 0; i < num_primes && primes[i] <= N; i++) {
            int p = primes[i];
            double lp = log((double)p);
            f[p] = lp;
            g[p] = lp * tau_norm(p);
        }
        
        /* Compute convolutions f∗f and f∗g (sum convolution) */
        /* f∗f[s] = Σ_{a+b=s} f[a]·f[b] */
        /* f∗g[s] = Σ_{a+b=s} f[a]·g[b] */
        double *ff = calloc(sz, sizeof(double));
        double *fg = calloc(sz, sizeof(double));
        
        /* Direct O(π(N)²) computation */
        for (int i = 0; i < num_primes && primes[i] <= N; i++) {
            int p1 = primes[i];
            double lp1 = log((double)p1);
            for (int j = 0; j < num_primes && primes[j] <= N; j++) {
                int p2 = primes[j];
                double lp2 = log((double)p2);
                int s = p1 + p2;
                if (s < sz) {
                    ff[s] += lp1 * lp2;
                    fg[s] += lp1 * (lp2 * tau_norm(p2));
                }
            }
        }
        
        /* Cross term = Σ_s ff[s] · fg[s] */
        double cross = 0.0;
        double fourth = 0.0;  /* = Σ_s ff[s]² = ∫|S|⁴ */
        for (int s = 0; s < sz; s++) {
            cross += ff[s] * fg[s];
            fourth += ff[s] * ff[s];
        }
        
        /* Also compute Re(cross) — note fg already uses real tau_norm */
        double ratio = (fourth > 0) ? cross / fourth : 0;
        
        printf("  %8d | %15.4f | %15.4f | %10.6f | %s\n",
               N, cross, fourth, ratio,
               (cross < 0) ? "NEGATIVE ✓" : "positive ✗");
        
        free(f); free(g); free(ff); free(fg);
    }
    
    /* Summary */
    printf("\n# INTERPRETATION:\n");
    printf("# If cross_term < 0 consistently, then ∫|S_f|⁴ < μ⁴∫|S|⁴\n");
    printf("# for positive f with μ < 1, giving a BETTER exceptional set bound.\n");
    printf("# This would be a genuine improvement via Hecke eigenvalue structure.\n");
    
    return 0;
}
