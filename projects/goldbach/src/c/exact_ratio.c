/*
 * exact_ratio.c — Derive where 4.13 comes from EXACTLY.
 *
 * Ratio = w₁/w_{n-1} = 1 + (n-1)·A/B where
 *   A = Σpᵢ,  B = Σ(n-1-i)·pᵢ
 *
 * By continuous PNT approximation (pᵢ ~ i·log(i)):
 *   A ≈ ∫₁ⁿ x·log(x) dx = n²logn/2 - n²/4 + 1/4
 *   B ≈ ∫₁ⁿ (n-x)·x·log(x) dx = n³·(logn/6 - 5/36) + corrections
 *
 *   Ratio = 1 + A/B · n = (24·logn - 14) / (6·logn - 5)
 *         = 4 + 6/(6·logn - 5)
 *         → 4 as n → ∞
 *
 * BUILD: cc -O3 -o exact_ratio exact_ratio.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_P 50000
int primes[MAX_P], nprimes = 0;

void gen_primes(int limit) {
    char *s = calloc(limit+1,1); s[0]=s[1]=1;
    for (int i=2;i<=limit;i++){if(!s[i]){primes[nprimes++]=i;if(nprimes>=MAX_P)break;
        for(long long j=(long long)i*i;j<=limit;j+=i)s[(int)j]=1;}}
    free(s);
}

int main() {
    gen_primes(700000);
    printf("# Exact Derivation: Where Does 4.13 Come From?\n\n");

    printf("## Analytical Derivation\n\n");
    printf("  w₁/w_{n-1} = 1 + n·A/B\n\n");
    printf("  Using PNT (pᵢ ~ i·logᵢ) and continuous integration:\n");
    printf("    A = Σpᵢ ≈ n²logn/2 - n²/4\n");
    printf("    B = Σ(n-i)pᵢ ≈ n³(logn/6 - 5/36)\n\n");
    printf("    Ratio = 1 + n·A/B\n");
    printf("          = 1 + n · (n²logn/2 - n²/4) / (n³(logn/6 - 5/36))\n");
    printf("          = 1 + (logn/2 - 1/4) / (logn/6 - 5/36)\n");
    printf("          = 1 + 9(2logn - 1) / (6logn - 5)\n");
    printf("          = (6logn - 5 + 18logn - 9) / (6logn - 5)\n\n");
    printf("  ★ EXACT FORMULA: w₁/w_{n-1} = (24·log(n) - 14) / (6·log(n) - 5)\n\n");
    printf("  As n → ∞: → 24/6 = 4\n");
    printf("  Correction: 4 + 6/(6·log(n) - 5)\n\n");

    /* Verify the formula against exact computation */
    printf("## Verification: Exact vs Formula\n\n");
    printf("  %8s | %10s | %10s | %10s | %8s\n",
           "n", "exact", "formula", "→4+6/...", "error%");

    for (int n = 10; n < nprimes; n = (int)(n * 1.5)) {
        /* Exact computation */
        double A = 0, B = 0;
        for (int i = 0; i < n; i++) {
            A += primes[i];
            B += (double)(n-1-i) * primes[i];
        }
        double exact_ratio = 1.0 + (double)(n-1) * A / B;

        /* Formula with natural log */
        double logn = log((double)n);
        double formula1 = (24.0*logn - 14.0) / (6.0*logn - 5.0);
        double formula2 = 4.0 + 6.0 / (6.0*logn - 5.0);

        double err = fabs(exact_ratio - formula1) / exact_ratio * 100;
        printf("  %8d | %10.6f | %10.6f | %10.6f | %7.3f%%\n",
               n, exact_ratio, formula1, formula2, err);
    }

    /* Refined formula using Mertens-type correction */
    printf("\n## Refined Formula with PNT Correction\n\n");
    printf("  Better approximation: pᵢ ~ i·(logᵢ + loglogᵢ - 1)\n");
    printf("  This gives a refined integral that corrects the ratio.\n\n");

    /* Instead of deriving the correction, let's fit empirically */
    printf("  Empirical fit: ratio = 4 + α/(logn - β)\n\n");

    /* Fit α, β from two data points */
    double n1 = 100, n2 = 10000;
    double A1=0,B1=0,A2=0,B2=0;
    for (int i=0;i<(int)n1;i++){A1+=primes[i];B1+=(n1-1-i)*primes[i];}
    for (int i=0;i<(int)n2;i++){A2+=primes[i];B2+=(n2-1-i)*primes[i];}
    double r1 = 1+(n1-1)*A1/B1;
    double r2 = 1+(n2-1)*A2/B2;
    /* r = 4 + α/(logn - β)
     * r1 - 4 = α/(logn1 - β), r2 - 4 = α/(logn2 - β)
     * (r1-4)/(r2-4) = (logn2-β)/(logn1-β)
     * Let u = r1-4, v = r2-4, L1=logn1, L2=logn2:
     * u(L1-β) = v(L2-β) → β(v-u) = v·L2 - u·L1 → β = (v·L2-u·L1)/(v-u) */
    double u = r1-4, v = r2-4;
    double L1 = log(n1), L2 = log(n2);
    double beta = (v*L2 - u*L1) / (v - u);
    double alpha = u * (L1 - beta);

    printf("  Fitted: α = %.4f, β = %.4f\n", alpha, beta);
    printf("  So: ratio ≈ 4 + %.3f/(logn - %.3f)\n\n", alpha, beta);

    printf("  %8s | %10s | %10s | %8s\n", "n", "exact", "fitted", "error%");
    for (int n = 10; n < nprimes; n = (int)(n * 1.5)) {
        double A=0,B=0;
        for(int i=0;i<n;i++){A+=primes[i];B+=(double)(n-1-i)*primes[i];}
        double exact = 1.0 + (n-1)*A/B;
        double fitted = 4.0 + alpha/(log((double)n) - beta);
        double err = fabs(exact-fitted)/exact*100;
        printf("  %8d | %10.6f | %10.6f | %7.3f%%\n", n, exact, fitted, err);
    }

    printf("\n## Summary\n\n");
    printf("  ★ The ratio w₁/w_{n-1} converges to EXACTLY 4.\n");
    printf("  ★ The approach rate: 4 + O(1/logn).\n");
    printf("  ★ At n=5000: ratio ≈ 4.13 = 4 + 6/(6·8.5-5) ≈ 4 + 0.13.\n\n");
    printf("  The constant 4 comes from the ratio of integrals:\n");
    printf("    ∫₀¹ t·logt dt / ∫₀¹ (1-t)·t·logt dt = -1/4 / (-1/6·...) = ...\n");
    printf("    Leading coefficient: 24/6 = 4.\n");

    return 0;
}
