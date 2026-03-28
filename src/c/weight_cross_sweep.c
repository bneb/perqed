/*
 * weight_cross_sweep.c — Search for positive weight functions w(p) that
 * give a NEGATIVE cross term, improving the fourth moment.
 *
 * Tests various non-Hecke weight families:
 *   1. Linear decay: w(p) = 2 - p/N
 *   2. Exponential: w(p) = exp(-p/(2N))
 *   3. Bump away from N: w(p) = 1 + cos(π·p/N) (peaks at p=0, trough at p=N)
 *   4. Modular: w(p) = 1 + ε·cos(2πp/q)
 *   5. Inverse-log: w(p) = log(N)/log(p)
 *   6. Power decay: w(p) = (N/p)^δ
 *
 * BUILD: cc -O3 -o weight_cross_sweep weight_cross_sweep.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_SIEVE 200001

static char is_composite[MAX_SIEVE];
static int primes[20000];
static int num_primes = 0;

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

/* Compute cross term and fourth moment for a weight function.
 *
 * cross = Σ_{p1+p4=p2+p3} L1·L2·L3·L4·(w4 - μ_w)
 *       = Σ_s ff[s] · fw[s]  where fw uses (w-μ)
 *
 * We compute:
 *   ff[s] = Σ_{p1+p2=s} log(p1)·log(p2)      (plain convolution)
 *   fw[s] = Σ_{p3+p4=s} log(p3)·log(p4)·(w(p4)-μ)  (weighted conv)
 *   cross = Σ_s ff[s]·fw[s]
 *   fourth = Σ_s ff[s]²
 *
 * Also compute the actual improvement ratio:
 *   ∫|S_w|⁴ / (μ²·∫|S|⁴) vs 1
 *   If < 1, we have a genuine improvement.
 */
typedef struct {
    const char *name;
    double (*weight)(int p, int N);
} WeightFunc;

/* Weight functions */
double w_linear(int p, int N) { return 2.0 - (double)p / N; }
double w_exp(int p, int N) { return exp(-(double)p / (2.0 * N)); }
double w_cos(int p, int N) { return 1.0 + 0.5 * cos(M_PI * (double)p / N); }
double w_invlog(int p, int N) { return log((double)N) / log((double)p); }
double w_sqrt(int p, int N) { return sqrt((double)N / p); }
double w_pow01(int p, int N) { return pow((double)N / p, 0.1); }
double w_pow02(int p, int N) { return pow((double)N / p, 0.2); }
double w_bump_low(int p, int N) {
    /* Peaks for small p, decays for large p */
    double x = (double)p / N;
    return (x < 0.5) ? 2.0 - 2.0 * x : 2.0 * x;  /* V-shape, min at N/2 */
}
double w_bump_mid(int p, int N) {
    /* Peaks at N/2, decays at extremes */
    double x = (double)p / N - 0.5;
    return 1.0 + exp(-8.0 * x * x);
}
double w_step(int p, int N) {
    /* Step function: w=2 for p < N/2, w=1 for p ≥ N/2 */
    return (p < N / 2) ? 2.0 : 1.0;
}
double w_triangular(int p, int N) {
    /* Triangular peaking at p=1 */
    return fmax(0.1, 2.0 * (1.0 - (double)p / N));
}
double w_mod3(int p, int N) {
    /* Modular weight: boosts p ≡ 1 mod 3 */
    (void)N;
    if (p % 3 == 1) return 1.5;
    if (p % 3 == 2) return 0.8;
    return 1.0;
}
double w_mod5(int p, int N) {
    (void)N;
    double vals[] = {1.0, 1.4, 0.9, 0.9, 1.2};
    return vals[p % 5];
}

int main(int argc, char **argv) {
    int N = 20000;
    if (argc > 1) N = atoi(argv[1]);
    if (N > MAX_SIEVE - 1) N = MAX_SIEVE - 1;

    sieve(N);
    int np = 0;
    while (np < num_primes && primes[np] <= N) np++;

    printf("# Non-Hecke Weight Cross Term Search, N=%d, π(N)=%d\n\n", N, np);

    /* Build plain convolution ff[s] */
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
    double fourth = 0;
    for (int s = 0; s < sz; s++) fourth += ff[s] * ff[s];

    WeightFunc weights[] = {
        {"linear 2-p/N",     w_linear},
        {"exp(-p/2N)",       w_exp},
        {"1+0.5cos(πp/N)",   w_cos},
        {"log(N)/log(p)",    w_invlog},
        {"√(N/p)",           w_sqrt},
        {"(N/p)^0.1",        w_pow01},
        {"(N/p)^0.2",        w_pow02},
        {"V-shape(min@N/2)", w_bump_low},
        {"bump(max@N/2)",    w_bump_mid},
        {"step(2 if p<N/2)", w_step},
        {"triangular",       w_triangular},
        {"mod3",             w_mod3},
        {"mod5",             w_mod5},
        {NULL, NULL}
    };

    printf("# %-22s | %10s | %12s | %12s | %12s | %s\n",
           "weight", "μ_w", "cross/(μ²·4th)", "∫|Sw|⁴/μ⁴·4th", "improvement", "sign");
    printf("#------------------------+------------+--------------+--------------+--------------+------\n");

    for (int wi = 0; weights[wi].name; wi++) {
        /* Compute μ_w = average of w over primes */
        double mu = 0;
        for (int i = 0; i < np; i++)
            mu += weights[wi].weight(primes[i], N);
        mu /= np;

        /* Build weighted convolution fw[s] = Σ log(p3)·log(p4)·(w(p4)-μ) */
        double *fw = calloc(sz, sizeof(double));
        for (int i = 0; i < np; i++) {
            double lp_i = log((double)primes[i]);
            for (int j = 0; j < np; j++) {
                int s = primes[i] + primes[j];
                if (s < sz) {
                    double lp_j = log((double)primes[j]);
                    double dw = weights[wi].weight(primes[j], N) - mu;
                    fw[s] += lp_i * lp_j * dw;
                }
            }
        }

        /* Cross term = Σ_s ff[s]·fw[s] */
        double cross = 0;
        for (int s = 0; s < sz; s++) cross += ff[s] * fw[s];

        /* Full weighted fourth moment:
         * Build ww[s] = Σ log(p1)·w(p1)·log(p2)·w(p2) for p1+p2=s
         * ∫|S_w|⁴ = Σ_s ww[s]²
         */
        double *ww = calloc(sz, sizeof(double));
        for (int i = 0; i < np; i++) {
            double lw_i = log((double)primes[i]) * weights[wi].weight(primes[i], N);
            for (int j = 0; j < np; j++) {
                int s = primes[i] + primes[j];
                if (s < sz)
                    ww[s] += lw_i * log((double)primes[j]) * weights[wi].weight(primes[j], N);
            }
        }
        double fourth_w = 0;
        for (int s = 0; s < sz; s++) fourth_w += ww[s] * ww[s];

        /* The ratio that matters: ∫|S_w|⁴ / (μ_w² · ∫|S|⁴) vs 1 */
        double ratio = fourth_w / (mu * mu * fourth);
        double improvement = 1.0 - ratio;  /* positive = better */

        printf("  %-22s | %10.4f | %12.4e | %12.6f | %+12.6f | %s\n",
               weights[wi].name, mu,
               cross / (mu * mu * fourth),
               ratio, improvement,
               (ratio < 1.0) ? "BETTER ✓" : "worse ✗");

        free(fw);
        free(ww);
    }

    free(ff);
    printf("\n# INTERPRETATION:\n");
    printf("# improvement > 0 means ∫|S_w|⁴/(μ²∫|S|⁴) < 1\n");
    printf("# This would give E(N) < ∫|S|⁴/M² (better exceptional set)\n");

    return 0;
}
