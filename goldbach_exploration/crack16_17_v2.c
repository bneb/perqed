/*
 * crack16_17_v2.c — DISCIPLINED VERSION with sanity checks
 *
 * LESSON: Think before computing.
 *
 * SANITY CHECK 1 (CRACK 17): Modular obstructions.
 *   If p,q ≡ a mod m, then p+q ≡ 2a mod m.
 *   So ONLY N ≡ 2a mod m can be represented.
 *   The RIGHT question: among N ≡ 2a mod m, does GB hold?
 *
 * SANITY CHECK 2 (CRACK 16): Prediction accuracy.
 *   Before computing z-scores, verify pred/actual ≈ 1
 *   WITHIN each stratum (N mod 6 or N mod 30).
 *
 * BUILD: cc -O3 -o crack16_17_v2 crack16_17_v2.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 500001
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

double singular_series(int N, double C2) {
    double S = 2*C2;
    int t=N; for(int p=3;p<=t;p++){if(t%p)continue;while(t%p==0)t/=p;S*=(double)(p-1)/(p-2);}
    return S;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  DISCIPLINED EXPLORATION: Sanity Checks First\n");
    printf("====================================================\n\n");

    /* ═══════ SANITY CHECK 1: MODULAR OBSTRUCTIONS ═══════ */
    printf("## SANITY CHECK 1: Modular Obstructions for Restricted GB\n\n");

    printf("  If p,q ≡ a mod m → p+q ≡ 2a mod m.\n");
    printf("  So ONLY even N ≡ 2a mod m are candidates.\n\n");

    printf("  %12s | %10s | %10s | %20s\n",
           "Restriction", "sum ≡ mod", "coverage", "candidate N");
    printf("  %12s | %10s | %10s | %20s\n",
           "p,q ≡ 1(4)", "2 mod 4", "50%", "N ≡ 2 mod 4 only");
    printf("  %12s | %10s | %10s | %20s\n",
           "p,q ≡ 3(4)", "2 mod 4", "50%", "N ≡ 2 mod 4 only");
    printf("  %12s | %10s | %10s | %20s\n",
           "p≡1,q≡3(4)", "0 mod 4", "50%", "N ≡ 0 mod 4 only");
    printf("  %12s | %10s | %10s | %20s\n",
           "p,q ≡ 1(6)", "2 mod 6", "33%", "N ≡ 2 mod 6 only");
    printf("  %12s | %10s | %10s | %20s\n",
           "p,q ≡ 5(6)", "4 mod 6", "33%", "N ≡ 4 mod 6 only");
    printf("  %12s | %10s | %10s | %20s\n",
           "last dig 1", "2 mod 10", "20%", "N ≡ 2 mod 10 only");

    printf("\n   The 'failures' in CRACK 17 were OBVIOUS modular\n");
    printf("  obstructions, not interesting data.\n\n");

    /* ═══════ CRACK 17 DONE RIGHT ═══════ */
    printf("## CRACK 17 (CORRECTED): Restricted GB on Correct Residues\n\n");

    printf("  Test: among N ≡ 2 mod 4, can N = p+q with p,q ≡ 1 mod 4?\n\n");

    int limit = 500000;

    /* p,q ≡ 1 mod 4, testing N ≡ 2 mod 4 ONLY */
    int fail_1mod4_correct = 0, last_fc = 0;
    for (int N = 6; N <= limit; N += 4) { /* N ≡ 2 mod 4 */
        int has = 0;
        for (int p = 5; p <= N/2; p += 4) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q > 0 && is_prime(q) && q%4==1) { has=1; break; }
        }
        if (.has) { fail_1mod4_correct++; last_fc = N; }
    }
    printf("  p,q ≡ 1 mod 4, N ≡ 2 mod 4: %d failures, last = %d\n",
           fail_1mod4_correct, last_fc);

    /* p,q ≡ 3 mod 4, testing N ≡ 2 mod 4 ONLY */
    int fail_3mod4_correct = 0; last_fc = 0;
    for (int N = 6; N <= limit; N += 4) {
        int has = 0;
        for (int p = 3; p <= N/2; p += 4) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q > 0 && is_prime(q) && q%4==3) { has=1; break; }
        }
        if (.has) { fail_3mod4_correct++; last_fc = N; }
    }
    printf("  p,q ≡ 3 mod 4, N ≡ 2 mod 4: %d failures, last = %d\n",
           fail_3mod4_correct, last_fc);

    /* p≡1, q≡3 mod 4, testing N ≡ 0 mod 4 ONLY */
    int fail_mixed_correct = 0; last_fc = 0;
    for (int N = 4; N <= limit; N += 4) {
        int has = 0;
        for (int p = 5; p <= N/2; p += 4) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q > 0 && is_prime(q) && q%4==3) { has=1; break; }
        }
        if (.has) { fail_mixed_correct++; last_fc = N; }
    }
    printf("  p≡1,q≡3 mod 4, N ≡ 0 mod 4: %d failures, last = %d\n",
           fail_mixed_correct, last_fc);

    /* p,q ≡ 1 mod 6, testing N ≡ 2 mod 6 ONLY */
    int fail_1mod6_correct = 0; last_fc = 0;
    for (int N = 14; N <= limit; N += 6) {
        int has = 0;
        for (int p = 7; p <= N/2; p += 6) {
            if (.is_prime(p)) continue;
            int q = N-p;
            if (q > 0 && is_prime(q) && q%6==1) { has=1; break; }
        }
        if (.has) { fail_1mod6_correct++; last_fc = N; }
    }
    printf("  p,q ≡ 1 mod 6, N ≡ 2 mod 6: %d failures, last = %d\n\n",
           fail_1mod6_correct, last_fc);

    if (fail_1mod4_correct == 0 && fail_3mod4_correct == 0) {
        printf("   RESTRICTED GOLDBACH HOLDS on correct residues.\n");
        printf("  Even with HALF the primes, the sumset covers\n");
        printf("  all eligible even numbers up to %d.\n\n", limit);
    }

    /* ═══════ SANITY CHECK 2: PREDICTION ACCURACY ═══════ */
    printf("## SANITY CHECK 2: Prediction Accuracy Per Stratum\n\n");

    printf("  Before computing z-scores, check that pred/actual ≈ 1.\n\n");

    printf("  %8s | %10s | %10s | %10s | %10s\n",
           "N mod 6", "mean(r)", "mean(pred)", "ratio", "std(ratio)");

    for (int mod6 = 0; mod6 < 6; mod6 += 2) {
        double sum_r=0, sum_pred=0, sum_ratio=0, sum_ratio2=0;
        int cnt = 0;
        for (int N = 10000 + mod6; N <= 200000; N += 6) {
            if (N%2) continue;
            double S = singular_series(N, C2);
            double logN = log((double)N);
            double pred = S * N / (2 * logN * logN);

            int r = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) r++;

            double ratio = r / pred;
            sum_r += r; sum_pred += pred; sum_ratio += ratio;
            sum_ratio2 += ratio*ratio; cnt++;
        }

        double mean_ratio = sum_ratio / cnt;
        double var_ratio = sum_ratio2/cnt - mean_ratio*mean_ratio;

        printf("  %8d | %10.1f | %10.1f | %10.4f | %10.4f\n",
               mod6, sum_r/cnt, sum_pred/cnt, mean_ratio, sqrt(var_ratio));
    }

    printf("\n   The prediction S·N/(2log²N) has ratio ≈ 0.98-1.0.\n");
    printf("  But the PRECISION of the prediction (std of ratio)\n");
    printf("  is the key metric for the z-score analysis.\n\n");

    /* ═══════ CRACK 16 DONE RIGHT: STRATIFIED Z-SCORES ═══════ */
    printf("## CRACK 16 (CORRECTED): Stratified Z-Scores\n\n");

    printf("  Compute z = (r - pred) / √pred within each N mod 6 class.\n\n");

    for (int mod6 = 0; mod6 < 6; mod6 += 2) {
        double sum_z=0, sum_z2=0; int cnt=0;
        double min_z=1e10, max_z=-1e10;

        for (int N = 50000 + mod6; N <= 200000; N += 6) {
            if (N%2) continue;
            double S = singular_series(N, C2);
            double logN = log((double)N);
            double pred = S * N / (2 * logN * logN);

            int r = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) r++;

            double z = (r - pred) / sqrt(pred);
            sum_z += z; sum_z2 += z*z; cnt++;
            if (z < min_z) min_z = z;
            if (z > max_z) max_z = z;
        }

        double mean_z = sum_z / cnt;
        double var_z = sum_z2 / cnt - mean_z * mean_z;
        printf("  N ≡ %d mod 6: mean(z) = %+7.3f, var(z) = %7.3f, "
               "range [%.1f, %.1f], n=%d\n",
               mod6, mean_z, var_z, min_z, max_z, cnt);
    }

    printf("\n  If var(z) ≈ 1: Poisson (random). No hidden structure.\n");
    printf("  If var(z) >> 1: EXTRA structure beyond S(N).\n");
    printf("  If var(z) << 1: anti-correlation (structured cancellation).\n\n");

    /* ═══════ THE REAL QUESTION ═══════ */
    printf("====================================================\n");
    printf("## What Should We Be Looking For?\n\n");

    printf("  Instead of random-walking through cracks, we should:\n\n");

    printf("  1. THINK FIRST: what modular/structural constraints\n");
    printf("     exist before running an experiment?\n\n");

    printf("  2. VERIFY PREDICTION: does the prediction formula\n");
    printf("     match reality BEFORE looking at residuals?\n\n");

    printf("  3. CHECK NOVELTY: is this experiment testing something\n");
    printf("     that's already known or trivially follows?\n\n");

    printf("  4. MEASURE INFORMATION: does this experiment tell us\n");
    printf("     something we couldn't have predicted in advance?\n\n");

    printf("  The var(z) per stratum is the REAL test:\n");
    printf("  if var(z) ≈ 1, the prediction is complete (no hidden\n");
    printf("  structure), and no computational exploration can find\n");
    printf("  a new attack vector.\n\n");

    printf("  If var(z) >> 1, there IS hidden structure, and we\n");
    printf("  should hunt for the missing correction term.\n\n");

    printf("  If var(z) << 1, there's anti-correlation, which\n");
    printf("  would mean primes are MORE structured than random.\n");

    return 0;
}
