/*
 * crack16_deep.c — Chase the Missing Prediction Terms
 *
 * var(z) = 34-67 with pred = S(N)·N/(2log²N).
 * HYPOTHESIS: the crude approximation N/(2log²N) is bad.
 *
 * The EXACT Hardy-Littlewood prediction is:
 *   r(N) ≈ S(N) · ∫₂^{N/2} dt / (log t · log(N-t))
 *
 * This integral has corrections from:
 *   (a) log(N-t) ≠ logN for t near N/2
 *   (b) The density 1/log(t) varies across [2, N/2]
 *
 * STEP 1: Compute exact integral numerically.
 * STEP 2: Recompute z-scores with exact prediction.
 * STEP 3: If var(z) still >> 1, hunt for higher-order terms.
 *
 * BUILD: cc -O3 -o crack16_deep crack16_deep.c -lm
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

/* EXACT singular integral: ∫₂^{N/2} dt / (log(t) · log(N-t)) */
double exact_integral(int N) {
    double sum = 0;
    int steps = 1000;
    double lo = 2.0, hi = N/2.0;
    double dt = (hi - lo) / steps;
    for (int i = 0; i < steps; i++) {
        double t = lo + (i + 0.5) * dt;
        double val = 1.0 / (log(t) * log(N - t));
        sum += val * dt;
    }
    return sum;
}

/* CRUDE approximation: N / (2·log²N) */
double crude_approx(int N) {
    double logN = log((double)N);
    return (double)N / (2.0 * logN * logN);
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 16 DEEP: Exact vs Crude Prediction\n");
    printf("====================================================\n\n");

    /* ═══════ STEP 1: COMPARE INTEGRALS ═══════ */
    printf("## STEP 1: Exact Integral vs Crude N/(2log²N)\n\n");

    printf("  %10s | %12s | %12s | %10s\n",
           "N", "exact ∫", "N/(2log²N)", "ratio");

    int sample_N[] = {100,1000,10000,50000,100000,500000,0};
    for (int i = 0; sample_N[i]; i++) {
        int N = sample_N[i];
        double exact = exact_integral(N);
        double crude = crude_approx(N);
        printf("  %10d | %12.4f | %12.4f | %10.4f\n",
               N, exact, crude, exact/crude);
    }

    printf("\n   If ratio ≈ 1, the approximation is good.\n");
    printf("  If ratio ≠ 1, the correction is significant.\n\n");

    /* ═══════ STEP 2: Z-SCORES WITH EXACT PREDICTION ═══════ */
    printf("## STEP 2: Z-Scores with EXACT Prediction\n\n");

    printf("  Comparing three predictions:\n");
    printf("  (a) Crude: S(N) · N/(2log²N)\n");
    printf("  (b) Exact: S(N) · ∫₂^{N/2} dt/(logt·log(N-t))\n");
    printf("  (c) Li-based: S(N) · (Li(N) - 2Li(√N))\n\n");

    /* Compute z-scores per stratum with both predictions */
    for (int pred_type = 0; pred_type < 2; pred_type++) {
        char *name = pred_type == 0 ? "CRUDE" : "EXACT";
        printf("  --- %s prediction ---\n", name);

        for (int mod6 = 0; mod6 < 6; mod6 += 2) {
            double sum_z=0, sum_z2=0; int cnt=0;
            double sum_ratio=0;

            for (int N = 50000 + mod6; N <= 200000; N += 6) {
                if (N%2) continue;
                double S = singular_series(N, C2);
                double pred;
                if (pred_type == 0) {
                    pred = S * crude_approx(N);
                } else {
                    pred = S * exact_integral(N);
                }

                int r = 0;
                for (int p = 2; p <= N/2; p++)
                    if (is_prime(p) && is_prime(N-p)) r++;

                sum_ratio += r/pred;
                double z = (r - pred) / sqrt(pred > 0 ? pred : 1);
                sum_z += z; sum_z2 += z*z; cnt++;
            }

            double mean_z = sum_z / cnt;
            double var_z = sum_z2 / cnt - mean_z * mean_z;
            printf("    N≡%d mod 6: mean(z)=%+7.3f var(z)=%8.3f mean(r/p)=%.4f n=%d\n",
                   mod6, mean_z, var_z, sum_ratio/cnt, cnt);
        }
        printf("\n");
    }

    /* ═══════ STEP 3: STRATIFY MORE FINELY ═══════ */
    printf("## STEP 3: Stratify by N mod 30 (finer structure)\n\n");

    printf("  Using EXACT integral prediction.\n\n");
    printf("  %8s | %8s | %8s | %8s | %8s\n",
           "N mod 30", "mean(z)", "var(z)", "mean r/p", "n");

    for (int mod30 = 0; mod30 < 30; mod30 += 2) {
        double sum_z=0, sum_z2=0, sum_ratio=0; int cnt=0;

        for (int N = 50000 + mod30; N <= 200000; N += 30) {
            if (N%2) continue;
            double S = singular_series(N, C2);
            double pred = S * exact_integral(N);

            int r = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) r++;

            sum_ratio += r/pred;
            double z = (r - pred) / sqrt(pred > 0 ? pred : 1);
            sum_z += z; sum_z2 += z*z; cnt++;
        }

        if (cnt > 0) {
            double mean_z = sum_z/cnt, var_z = sum_z2/cnt - mean_z*mean_z;
            printf("  %8d | %+8.3f | %8.3f | %8.4f | %8d\n",
                   mod30, mean_z, var_z, sum_ratio/cnt, cnt);
        }
    }

    /* ═══════ STEP 4: STRATIFY BY N MOD 210 ═══════ */
    printf("\n## STEP 4: Is mod 30 fine enough? Check var(z) vs modulus\n\n");

    printf("  %10s | %10s | %10s\n", "modulus", "avg var(z)", "# classes");

    int moduli[] = {6, 30, 210, 0};
    for (int mi = 0; moduli[mi]; mi++) {
        int m = moduli[mi];
        double total_var = 0; int nclass = 0;

        for (int r = 0; r < m; r += 2) {
            double sum_z=0, sum_z2=0; int cnt=0;
            for (int N = 50000 + r; N <= 200000; N += m) {
                if (N%2) continue;
                double S = singular_series(N, C2);
                double pred = S * exact_integral(N);
                int rr = 0;
                for (int p = 2; p <= N/2; p++)
                    if (is_prime(p) && is_prime(N-p)) rr++;
                double z = (rr - pred) / sqrt(pred > 0 ? pred : 1);
                sum_z += z; sum_z2 += z*z; cnt++;
            }
            if (cnt > 10) {
                double var_z = sum_z2/cnt - (sum_z/cnt)*(sum_z/cnt);
                total_var += var_z; nclass++;
            }
        }

        printf("  %10d | %10.3f | %10d\n",
               m, total_var/nclass, nclass);
    }

    printf("\n  If avg var(z) decreases as modulus increases,\n");
    printf("  the excess variance IS from arithmetic structure\n");
    printf("  at scales finer than our stratification.\n\n");

    printf("  If avg var(z) stabilizes, the remaining variance\n");
    printf("  is genuinely random (not arithmetic).\n");

    return 0;
}
