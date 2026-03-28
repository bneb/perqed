/*
 * crack18_precise.c — Fix the 18% Bug + Autocorrelation
 *
 * BEFORE COMPUTING: Sanity checks.
 *
 * Q1: WHY does the exact integral overshoot by 18%?
 *   ∫₂^{N/2} dt/(log t · log(N-t)) > N/(2·log²N)
 *   because log t < logN for small t, boosting the integrand.
 *   The ACTUAL prime density follows π(x) ~ Li(x), not x/logx.
 *   Both use 1/logx as density, so the integral SHOULD match.
 *   HYPOTHESIS: the 18% gap is real — the crude formula N/(2log²N)
 *   is just a bad approximation, and the ratio r/(S·∫) ≈ 0.82 means
 *   the HL constant isn't exactly 1.0 but 0.82. OR numerical error.
 *
 * Q2: Should r(N) and r(N+2) be correlated?
 *   YES: both depend on primes in [2, N/2]. A prime gap near N/2
 *   suppresses both. Local clustering boosts both.
 *   Expected: substantial positive autocorrelation.
 *
 * BUILD: cc -O3 -o crack18_precise crack18_precise.c -lm
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

/* High-precision integral using many steps */
double exact_integral(int N, int steps) {
    double sum = 0;
    double lo = 2.5, hi = N/2.0 - 0.5; /* avoid endpoints */
    double dt = (hi - lo) / steps;
    for (int i = 0; i < steps; i++) {
        double t = lo + (i + 0.5) * dt;
        sum += dt / (log(t) * log(N - t));
    }
    return sum;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 18: Fix the 18%% Bug + Noise Autocorrelation\n");
    printf("====================================================\n\n");

    /* ═══════ PART 1: PRECISION CHECK ═══════ */
    printf("## PART 1: Does Integration Precision Fix the 18%%?\n\n");

    int N_test = 100000;
    printf("  N = %d\n\n", N_test);

    printf("  %10s | %12s | %12s\n", "steps", "integral", "change");

    double prev = 0;
    for (int steps = 100; steps <= 100000; steps *= 10) {
        double val = exact_integral(N_test, steps);
        printf("  %10d | %12.6f | %12.6f\n", steps, val,
               prev > 0 ? val - prev : 0.0);
        prev = val;
    }

    /* Direct count for N_test */
    int r_actual = 0;
    for (int p = 2; p <= N_test/2; p++)
        if (is_prime(p) && is_prime(N_test-p)) r_actual++;

    double S = singular_series(N_test, C2);
    double int_hi = exact_integral(N_test, 100000);
    double crude = (double)N_test / (2.0 * log(N_test) * log(N_test));

    printf("\n  Actual r(%d) = %d\n", N_test, r_actual);
    printf("  S(%d) = %.6f\n", N_test, S);
    printf("  S · ∫ (100K steps) = %.4f → ratio = %.4f\n",
           S * int_hi, r_actual / (S * int_hi));
    printf("  S · N/(2log²N)     = %.4f → ratio = %.4f\n\n",
           S * crude, r_actual / (S * crude));

    /* ═══════ TRY DIFFERENT N VALUES ═══════ */
    printf("  Check ratio r/(S·∫) across different N:\n\n");

    printf("  %10s | %8s | %10s | %10s | %8s | %8s\n",
           "N", "r(N)", "S·∫", "S·crude", "r/(S·∫)", "r/(S·c)");

    int Ns[] = {1000, 5000, 10000, 50000, 100000, 200000, 0};
    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double S = singular_series(N, C2);
        double integ = exact_integral(N, 50000);
        double cr = (double)N / (2.0 * log(N) * log(N));

        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;

        printf("  %10d | %8d | %10.2f | %10.2f | %8.4f | %8.4f\n",
               N, r, S*integ, S*cr, r/(S*integ), r/(S*cr));
    }

    printf("\n  If r/(S·∫) converges to some constant c ≠ 1,\n");
    printf("  the HL formula needs a correction factor c.\n");
    printf("  If it converges to 1, the crude approximation was lucky.\n\n");

    /* ═══════ PART 2: AUTOCORRELATION ═══════ */
    printf("====================================================\n");
    printf("## PART 2: Autocorrelation of r(N) Residuals\n\n");

    printf("  SANITY CHECK: r(N) and r(N+2) share the SAME primes\n");
    printf("  in the summing range. A prime gap at N/2 affects both.\n");
    printf("  Expected: positive correlation.\n\n");

    /* Precompute r(N) for N in [50000, 100000] */
    int lo = 50000, hi = 100000;
    int nvals = (hi - lo) / 2 + 1;
    double *resid = malloc(nvals * sizeof(double));

    for (int i = 0; i < nvals; i++) {
        int N = lo + 2*i;
        double S = singular_series(N, C2);
        double logN = log((double)N);
        double pred = S * N / (2 * logN * logN);

        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;

        resid[i] = r - pred;
    }

    /* Compute autocorrelation at lags 1, 2, ..., 20 */
    double var = 0, mean = 0;
    for (int i = 0; i < nvals; i++) { mean += resid[i]; }
    mean /= nvals;
    for (int i = 0; i < nvals; i++) var += (resid[i]-mean)*(resid[i]-mean);
    var /= nvals;

    printf("  Autocorrelation of residual r(N) - S·N/(2log²N):\n");
    printf("  (N ∈ [%d, %d])\n\n", lo, hi);
    printf("  %6s | %10s | %s\n", "lag", "corr", "bar");

    for (int lag = 1; lag <= 30; lag++) {
        double cov = 0;
        int cnt = 0;
        for (int i = 0; i < nvals - lag; i++) {
            cov += (resid[i]-mean) * (resid[i+lag]-mean);
            cnt++;
        }
        cov /= cnt;
        double corr = cov / var;

        int bar = (int)(fabs(corr) * 50);
        if (bar > 50) bar = 50;
        char barstr[64]; memset(barstr, corr > 0 ? '+' : '-', bar); barstr[bar]=0;

        printf("  %6d | %+10.4f | %s\n", lag, corr, barstr);
    }

    printf("\n  lag=1 means r(N) vs r(N+2) (consecutive even numbers).\n");
    printf("  lag=k means r(N) vs r(N+2k).\n\n");

    printf("  If corr(1) >> 0: noise is temporally structured.\n");
    printf("  → Smoothing (averaging nearby N) could reduce variance.\n");
    printf("  → A proof via averaging over N ∈ [X, X+H] might work\n");
    printf("  with smaller H than union-bound suggests.\n\n");

    printf("  If corr(1) ≈ 0: noise is i.i.d. No smoothing benefit.\n\n");

    /* ═══════ PART 3: WHAT CORRELATION MEANS ═══════ */
    printf("## PART 3: If Noise Is Correlated, So What?\n\n");

    printf("  POSITIVE correlation means: if r(N) is large,\n");
    printf("  r(N+2) is likely also large. This is because they\n");
    printf("  share the dependence on LOCAL prime density.\n\n");

    printf("  ATTACK IMPLICATION:\n");
    printf("  If corr(lag) decays like 1/lag (long-range),\n");
    printf("  the effective sample size for averaging over\n");
    printf("  [X, X+H] is H/correlation_length, not H.\n");
    printf("  This means variance reduction is SLOWER than √H.\n\n");

    printf("  If corr(lag) decays exponentially (short-range),\n");
    printf("  averaging over H > correlation_length gives\n");
    printf("  full √H variance reduction.\n\n");

    printf("  The EXCEPTIONAL SET approach works by averaging:\n");
    printf("  |E(X)| ≤ X · Var(r) / E[r]² (by Markov).\n");
    printf("  Correlation affects the effective Var when averaging.\n");

    free(resid);
    return 0;
}
