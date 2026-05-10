/*
 * Erdős 265: Simultaneous Egyptian Fraction Decomposition
 * Strategy E number-theoretic experiments using GMP exact arithmetic.
 *
 * Tests whether different decomposition strategies can achieve
 * limsup a_k^{1/2^k} > 1 for infinite sequences with both sums rational.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <gmp.h>

typedef struct {
    mpq_t tail1;  /* remaining sum for 1/a_k */
    mpq_t tail2;  /* remaining sum for 1/(a_k-1) */
} TailState;

/* Compute lower bound: max(ceil(1/tail1), ceil(1/tail2) + 1) */
void lower_bound(mpz_t result, const mpq_t tail1, const mpq_t tail2) {
    mpz_t lb1, lb2;
    mpz_init(lb1); mpz_init(lb2);
    
    /* lb1 = ceil(1/tail1) = ceil(q1_den / q1_num) */
    mpq_t inv1; mpq_init(inv1);
    mpq_inv(inv1, tail1);
    mpz_cdiv_q(lb1, mpq_numref(inv1), mpq_denref(inv1));
    mpq_clear(inv1);
    
    /* lb2 = ceil(1/tail2) + 1 */
    mpq_t inv2; mpq_init(inv2);
    mpq_inv(inv2, tail2);
    mpz_cdiv_q(lb2, mpq_numref(inv2), mpq_denref(inv2));
    mpz_add_ui(lb2, lb2, 1);
    mpq_clear(inv2);
    
    /* result = max(lb1, lb2) */
    if (mpz_cmp(lb1, lb2) > 0)
        mpz_set(result, lb1);
    else
        mpz_set(result, lb2);
    
    /* Ensure >= 2 */
    if (mpz_cmp_ui(result, 2) < 0)
        mpz_set_ui(result, 2);
    
    mpz_clear(lb1); mpz_clear(lb2);
}

/* Subtract 1/a from tail1 and 1/(a-1) from tail2. Returns 0 if either goes non-positive. */
int step(mpq_t tail1, mpq_t tail2, const mpz_t a) {
    mpq_t frac1, frac2, am1;
    mpq_init(frac1); mpq_init(frac2); mpq_init(am1);
    
    /* frac1 = 1/a */
    mpq_set_ui(frac1, 1, 1);
    mpz_set(mpq_denref(frac1), a);
    mpq_canonicalize(frac1);
    
    /* frac2 = 1/(a-1) */
    mpz_t a_minus_1; mpz_init(a_minus_1);
    mpz_sub_ui(a_minus_1, a, 1);
    mpq_set_ui(frac2, 1, 1);
    mpz_set(mpq_denref(frac2), a_minus_1);
    mpq_canonicalize(frac2);
    
    mpq_sub(tail1, tail1, frac1);
    mpq_sub(tail2, tail2, frac2);
    
    int ok = (mpq_sgn(tail1) > 0) && (mpq_sgn(tail2) > 0);
    
    mpq_clear(frac1); mpq_clear(frac2); mpq_clear(am1);
    mpz_clear(a_minus_1);
    return ok;
}

void run_strategy(const char *name, int multiplier, int max_steps,
                  unsigned long t1_num, unsigned long t1_den,
                  unsigned long t2_num, unsigned long t2_den,
                  int oscillate) {
    mpq_t tail1, tail2;
    mpq_init(tail1); mpq_init(tail2);
    mpq_set_ui(tail1, t1_num, t1_den);
    mpq_set_ui(tail2, t2_num, t2_den);
    
    mpz_t a, lb;
    mpz_init(a); mpz_init(lb);
    
    printf("\n=== Strategy: %s (mult=%d) ===\n", name, multiplier);
    
    int n = 0;
    for (int N = 0; N < max_steps; N++) {
        if (mpq_sgn(tail1) <= 0 || mpq_sgn(tail2) <= 0) break;
        
        lower_bound(lb, tail1, tail2);
        
        int m = multiplier;
        if (oscillate && (N % 2 == 1)) m = 1;  /* small on odd steps */
        
        mpz_mul_ui(a, lb, m);
        if (mpz_cmp_ui(a, 2) < 0) mpz_set_ui(a, 2);
        
        /* Compute log(a)/2^N for limsup indicator */
        double log_a = mpz_sizeinbase(a, 2) * log(2.0); /* approx log(a) */
        double indicator = log_a / pow(2.0, N);
        size_t digits = mpz_sizeinbase(a, 10);
        
        if (N < 15 || N % 5 == 0) {
            printf("  N=%2d: a has %6zu digits, log(a)/2^N = %.6f", N, digits, indicator);
            if (indicator > log(2.0))
                printf("  [limsup > 2]");
            else if (indicator > 0.01)
                printf("  [limsup > 1]");
            printf("\n");
        }
        
        if (!step(tail1, tail2, a)) {
            printf("  TERMINATED at N=%d (tail went non-positive)\n", N);
            break;
        }
        n++;
    }
    
    printf("  Total terms: %d\n", n);
    if (mpq_sgn(tail1) > 0) {
        double t1 = mpq_get_d(tail1);
        double t2 = mpq_get_d(tail2);
        printf("  Remaining tail1 ≈ %.2e, tail2 ≈ %.2e\n", t1, t2);
    } else {
        printf("  Tails reached 0 (finite decomposition)\n");
    }
    
    mpq_clear(tail1); mpq_clear(tail2);
    mpz_clear(a); mpz_clear(lb);
}

int main(void) {
    printf("Erdős 265: Simultaneous Egyptian Fraction Experiments (GMP)\n");
    printf("============================================================\n");
    
    /* Target: sum 1/a_k = 3/4, sum 1/(a_k-1) = 5/4 */
    
    /* Greedy (Sylvester-like) */
    run_strategy("Greedy", 1, 50, 3, 4, 5, 4, 0);
    
    /* Double */
    run_strategy("Double", 2, 50, 3, 4, 5, 4, 0);
    
    /* Triple */
    run_strategy("Triple", 3, 50, 3, 4, 5, 4, 0);
    
    /* 5x */
    run_strategy("5x", 5, 50, 3, 4, 5, 4, 0);
    
    /* 10x */
    run_strategy("10x", 10, 50, 3, 4, 5, 4, 0);
    
    /* 100x */
    run_strategy("100x", 100, 50, 3, 4, 5, 4, 0);
    
    /* Oscillate: big (2x) on even, greedy on odd */
    run_strategy("Oscillate 2x/1x", 2, 50, 3, 4, 5, 4, 1);
    
    /* Oscillate: big (10x) on even, greedy on odd */
    run_strategy("Oscillate 10x/1x", 10, 50, 3, 4, 5, 4, 1);
    
    printf("\n============================================================\n");
    printf("KEY: log(a)/2^N is the limsup indicator.\n");
    printf("If it stays bounded away from 0, limsup a_k^{1/2^k} > 1.\n");
    printf("If it decays to 0, limsup = 1 (ceiling conjecture holds).\n");
    
    return 0;
}
