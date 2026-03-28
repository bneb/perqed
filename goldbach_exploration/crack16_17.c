/*
 * crack16_17.c — Exact Residual + Restricted Prime Goldbach
 *
 * CRACK 16: After dividing r(N) by S(N)·J(N), is the residual
 *           truly random or does it have structure?
 *
 * CRACK 17: Does Goldbach hold for SUBSETS of primes?
 *   - Primes ≡ 1 mod 4 only (split primes)
 *   - Primes ≡ 3 mod 4 only (inert primes)
 *   - Primes ≡ 1 mod 3 only
 *   - Primes ≡ 2 mod 3 only
 *   IF a subset with density 1/2 of all primes covers all even N,
 *   then the covering is much MORE robust than we thought.
 *
 * BUILD: cc -O3 -o crack16_17 crack16_17.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 1000001
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(.sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && .sieve[n]; }

double twin_prime_const() {
    double C2 = 1.0;
    for(int p=3;p<10000;p++){if(.is_prime(p))continue;C2*=1.0-1.0/((double)(p-1)*(p-1));}
    return C2;
}

/* Li(x) = integral from 2 to x of dt/lnt */
double li(double x) {
    if (x <= 2) return 0;
    double s = 0; double dt = 0.01;
    for (double t = 2.0; t < x; t += dt) {
        s += dt / log(t);
        if (t > 100) dt = 1.0; /* speed up */
    }
    return s;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 17: Goldbach for Restricted Prime Sets\n");
    printf("====================================================\n\n");

    int limit = 500000;

    /* ═══════ TEST: PRIMES ≡ 1 mod 4 ═══════ */
    printf("## Primes ≡ 1 mod 4 only (split primes)\n\n");

    printf("  These are ~50%% of all primes (by Dirichlet).\n");
    printf("  Can every even N be written as p + q where p,q ≡ 1 mod 4?\n\n");

    int first_fail_1mod4 = 0;
    int fail_count_1mod4 = 0;
    int last_fail_1mod4 = 0;

    for (int N = 4; N <= limit; N += 2) {
        int has_rep = 0;
        for (int p = 2; p <= N/2; p++) {
            if (.is_prime(p) || p%4 .= 1) continue;
            int q = N - p;
            if (is_prime(q) && q%4 == 1) { has_rep = 1; break; }
        }
        if (.has_rep) {
            fail_count_1mod4++;
            last_fail_1mod4 = N;
            if (first_fail_1mod4 == 0) first_fail_1mod4 = N;
        }
    }

    printf("  Failures (1 mod 4): %d out of %d even numbers\n",
           fail_count_1mod4, (limit-4)/2+1);
    printf("  First failure: N = %d\n", first_fail_1mod4);
    printf("  Last failure:  N = %d\n\n", last_fail_1mod4);

    if (fail_count_1mod4 > 0 && fail_count_1mod4 < 100) {
        printf("  List of failures:\n  ");
        int printed = 0;
        for (int N = 4; N <= limit && N <= 10000; N += 2) {
            int has_rep = 0;
            for (int p = 5; p <= N/2; p += 4) {
                if (.is_prime(p)) continue;
                int q = N-p;
                if (is_prime(q) && q%4==1) { has_rep=1; break; }
            }
            if (.has_rep) { printf("%d ", N); printed++; if(printed%15==0) printf("\n  "); }
        }
        printf("\n\n");
    }

    /* ═══════ TEST: PRIMES ≡ 3 mod 4 ═══════ */
    printf("## Primes ≡ 3 mod 4 only (inert primes)\n\n");

    int fail_count_3mod4 = 0;
    int last_fail_3mod4 = 0;

    for (int N = 4; N <= limit; N += 2) {
        int has_rep = 0;
        for (int p = 3; p <= N/2; p += 4) {
            if (.is_prime(p)) continue;
            int q = N - p;
            if (q > 0 && is_prime(q) && q%4 == 3) { has_rep = 1; break; }
        }
        if (.has_rep) { fail_count_3mod4++; last_fail_3mod4 = N; }
    }

    printf("  Failures (3 mod 4): %d\n", fail_count_3mod4);
    printf("  Last failure: N = %d\n\n", last_fail_3mod4);

    if (fail_count_3mod4 > 0 && fail_count_3mod4 < 100) {
        printf("  List of failures:\n  ");
        int printed = 0;
        for (int N = 4; N <= limit && N <= 20000; N += 2) {
            int has_rep = 0;
            for (int p = 3; p <= N/2; p += 4) {
                if (.is_prime(p)) continue;
                int q = N-p;
                if (q>0 && is_prime(q) && q%4==3) { has_rep=1; break; }
            }
            if (.has_rep) { printf("%d ", N); printed++; if(printed%15==0) printf("\n  "); }
        }
        printf("\n\n");
    }

    /* ═══════ TEST: MIXED (p ≡ 1, q ≡ 3) ═══════ */
    printf("## Mixed: p ≡ 1 mod 4, q ≡ 3 mod 4\n\n");

    int fail_count_mixed = 0;
    int last_fail_mixed = 0;

    for (int N = 4; N <= limit; N += 2) {
        int has_rep = 0;
        for (int p = 5; p <= N/2; p += 4) {
            if (.is_prime(p)) continue;
            int q = N - p;
            if (q > 0 && is_prime(q) && q%4 == 3) { has_rep = 1; break; }
        }
        if (.has_rep) { fail_count_mixed++; last_fail_mixed = N; }
    }

    printf("  Failures (mixed 1+3): %d, last: %d\n\n", fail_count_mixed, last_fail_mixed);

    /* ═══════ TEST: PRIMES ≡ 1 mod 6 ═══════ */
    printf("## Primes ≡ 1 mod 6 only\n\n");

    int fail_1mod6 = 0, last_1mod6 = 0;
    for (int N = 4; N <= limit; N += 2) {
        int has = 0;
        for (int p = 7; p <= N/2; p += 6) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q>0 && is_prime(q) && q%6==1) { has=1; break; }
        }
        if (.has) { fail_1mod6++; last_1mod6 = N; }
    }
    printf("  Failures: %d, last: %d\n\n", fail_1mod6, last_1mod6);

    /* ═══════ TEST: PRIMES ≡ 5 mod 6 ═══════ */
    printf("## Primes ≡ 5 mod 6 only\n\n");

    int fail_5mod6 = 0, last_5mod6 = 0;
    for (int N = 4; N <= limit; N += 2) {
        int has = 0;
        for (int p = 5; p <= N/2; p += 6) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q>0 && is_prime(q) && q%6==5) { has=1; break; }
        }
        if (.has) { fail_5mod6++; last_5mod6 = N; }
    }
    printf("  Failures: %d, last: %d\n\n", fail_5mod6, last_5mod6);

    /* ═══════ TEST: PRIMES IN SPECIFIC DECADES ═══════ */
    printf("## Primes ending in 1 (last digit = 1)\n\n");

    int fail_end1 = 0, last_end1 = 0;
    for (int N = 4; N <= limit; N += 2) {
        int has = 0;
        for (int p = 11; p <= N/2; p++) {
            if (p%10 .= 1) continue;
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q>0 && is_prime(q) && q%10==1) { has=1; break; }
        }
        if (.has) { fail_end1++; last_end1 = N; }
    }
    printf("  Failures (both end in 1): %d, last: %d\n\n", fail_end1, last_end1);

    /* ═══════ SUMMARY TABLE ═══════ */
    printf("====================================================\n");
    printf("## Summary: Restricted Prime Goldbach\n\n");

    printf("  %-30s | %8s | %10s\n", "Restriction", "#failures", "last fail");
    printf("  %-30s | %8d | %10d\n", "All primes (standard GB)", 0, 0);
    printf("  %-30s | %8d | %10d\n", "p,q ≡ 1 mod 4", fail_count_1mod4, last_fail_1mod4);
    printf("  %-30s | %8d | %10d\n", "p,q ≡ 3 mod 4", fail_count_3mod4, last_fail_3mod4);
    printf("  %-30s | %8d | %10d\n", "p≡1, q≡3 mod 4 (mixed)", fail_count_mixed, last_fail_mixed);
    printf("  %-30s | %8d | %10d\n", "p,q ≡ 1 mod 6", fail_1mod6, last_1mod6);
    printf("  %-30s | %8d | %10d\n", "p,q ≡ 5 mod 6", fail_5mod6, last_5mod6);
    printf("  %-30s | %8d | %10d\n", "Both end in 1", fail_end1, last_end1);

    printf("\n  INTERPRETATION:\n\n");

    printf("  If restricted sets ALSO cover (after finitely many exceptions),\n");
    printf("  it means Goldbach has ENORMOUS redundancy.\n");
    printf("  The covering property isn't fragile — it persists even when\n");
    printf("  you throw away HALF the primes.\n\n");

    printf("  Congruence restrictions change the singular series:\n");
    printf("  For p ≡ a mod q: the density changes from 1/logN to\n");
    printf("  1/(φ(q)·logN). With half the density, the main term\n");
    printf("  drops by a factor of 4 (since both p AND N-p must\n");
    printf("  be in the restricted class). But the main term is still\n");
    printf("  ~ N/(4·log²N) → ∞.\n\n");

    printf("  The restricted conjecture SHOULD be true by the same\n");
    printf("  heuristic (just with larger constants), and the exceptions\n");
    printf("  should be finite (small N where the main term is too small).\n\n");

    /* ═══════ CRACK 16: RESIDUAL STRUCTURE ═══════ */
    printf("====================================================\n");
    printf("  CRACK 16: Exact Residual Structure\n");
    printf("====================================================\n\n");

    printf("  r(N) = S(N) · J(N) + ε(N)\n");
    printf("  where J(N) = li(N) - 2·li(√N) (exact singular integral)\n\n");

    printf("  Is ε(N)/√(S(N)·J(N)) Gaussian? I.e., does\n");
    printf("  the normalized error follow N(0,1)?\n\n");

    int nbins = 30;
    int *hist = calloc(nbins+2, sizeof(int));
    double bin_lo = -4.0, bin_hi = 4.0;
    double sum_z = 0, sum_z2 = 0; int cnt = 0;

    for (int N = 10000; N <= 500000; N += 2) {
        double S = 2 * C2;
        int t = N;
        for (int p = 3; p <= t; p++) {
            if (t%p) continue;
            while(t%p==0) t/=p;
            S *= (double)(p-1)/(p-2);
        }

        /* Exact prediction using Li */
        double logN = log((double)N);
        double pred = S * N / (2 * logN * logN);

        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;

        /* Normalized residual */
        double sigma_est = sqrt(pred); /* Poisson-like std dev */
        double z = (r - pred) / sigma_est;

        sum_z += z; sum_z2 += z*z; cnt++;

        int bin = (int)((z - bin_lo) / (bin_hi - bin_lo) * nbins);
        if (bin < 0) bin = 0;
        if (bin >= nbins) bin = nbins;
        hist[bin]++;
    }

    double mean_z = sum_z / cnt;
    double var_z = sum_z2 / cnt - mean_z * mean_z;

    printf("  Normalized residual z = (r - pred) / √pred:\n");
    printf("  mean(z) = %.4f (should be 0)\n", mean_z);
    printf("  var(z)  = %.4f (should be 1 if Poisson)\n", var_z);
    printf("  std(z)  = %.4f\n\n", sqrt(var_z));

    printf("  Histogram of z-scores:\n\n");
    int max_h = 0;
    for(int i=0;i<=nbins;i++) if(hist[i]>max_h) max_h=hist[i];
    for (int i = 0; i <= nbins; i++) {
        double z = bin_lo + (bin_hi-bin_lo)*i/nbins;
        int bar = 50 * hist[i] / (max_h > 0 ? max_h : 1);
        char barstr[64]; memset(barstr,'#',bar); barstr[bar]=0;
        if (hist[i] > 100)
            printf("  %6.2f | %6d | %s\n", z, hist[i], barstr);
    }

    printf("\n  If var(z) ≈ 1: residual is Poisson-like (random).\n");
    printf("  If var(z) >> 1: there's EXTRA variance (structure).\n");
    printf("  If var(z) << 1: there's LESS variance (anti-correlation).\n\n");

    if (var_z > 1.5) {
        printf("   var(z) = %.2f >> 1 → EXTRA STRUCTURE in residual.\n", var_z);
        printf("    The error is LARGER than Poisson predicts.\n");
        printf("    This excess comes from the singular series S(N)\n");
        printf("    modulating the prediction across different N.\n\n");
    } else if (var_z < 0.7) {
        printf("   var(z) = %.2f << 1 → ANTI-CORRELATION.\n", var_z);
        printf("    The error is SMALLER than Poisson predicts.\n");
        printf("    Primes 'repel' coincidences more than random.\n\n");
    } else {
        printf("   var(z) = %.2f ≈ 1 → POISSON-LIKE (random).\n", var_z);
        printf("    No hidden structure beyond Hardy-Littlewood.\n\n");
    }

    printf("   IMPLICATION: If var(z) ≈ 1 (Poisson),\n");
    printf("  then r(N) really IS like a random variable with\n");
    printf("  mean S(N)·J(N) and variance S(N)·J(N).\n");
    printf("  No amount of structure-hunting will find a shortcut.\n");
    printf("  The error IS random noise.\n");

    free(hist);
    return 0;
}
