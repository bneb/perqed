/*
 * goldbach_amplifier_compare.c
 * ============================
 * Compare different amplifier choices for the off-diagonal bound.
 * Tests max|S(h)|/S(0) for each amplifier type.
 *
 * Caches the Möbius function to /tmp/mobius_cache.bin to avoid
 * recomputation across runs.
 *
 * Amplifiers tested:
 *   1. Selberg:     a_n = μ(n) · log(N/n)/log(N)
 *   2. Sharp:       a_n = μ(n)  (no taper)
 *   3. Smooth:      a_n = μ(n) · (1 - n/N)²  (quadratic taper)
 *   4. Cosine:      a_n = μ(n) · cos(πn/(2N))  (Beurling-Selberg style)
 *   5. LogSmooth:   a_n = μ(n) · (log(N/n)/log(N))²  (squared Selberg)
 *   6. PrimeTwist:  a_n = μ(n) · Λ(n)  (von Mangoldt twist — only primes)
 *   7. Ramanujan:   a_n = μ(n) / n^{1/4}  (arithmetic weighting)
 *   8. SmoothBump:  a_n = μ(n) · exp(-n²/(N/2)²)  (Gaussian bump)
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <errno.h>

#define MAX_N 50001

static int8_t *mu_cache = NULL;
static const char *CACHE_FILE = "/tmp/mobius_cache.bin";

/* Load or compute Möbius function with file caching */
static void load_or_compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);

    /* Try loading from cache */
    FILE *f = fopen(CACHE_FILE, "rb");
    if (f) {
        int cached_n;
        if (fread(&cached_n, sizeof(int), 1, f) == 1 && cached_n >= max_n) {
            if (fread(mu_cache, 1, max_n + 1, f) == (size_t)(max_n + 1)) {
                fclose(f);
                printf("[Cache] Loaded Möbius from %s (n≤%d)\n", CACHE_FILE, cached_n);
                return;
            }
        }
        fclose(f);
    }

    /* Compute from scratch */
    printf("[Sieve] Computing Möbius function up to %d...\n", max_n);
    int8_t *sp = calloc(max_n + 1, 1);
    for (int i = 2; i <= max_n; i++) {
        if (sp[i] == 0) {
            for (int j = i; j <= max_n; j += i)
                if (sp[j] == 0) sp[j] = i;
        }
    }
    mu_cache[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = sp[n];
        if ((n / p) % p == 0) mu_cache[n] = 0;
        else mu_cache[n] = -mu_cache[n / p];
    }
    free(sp);

    /* Save to cache */
    f = fopen(CACHE_FILE, "wb");
    if (f) {
        fwrite(&max_n, sizeof(int), 1, f);
        fwrite(mu_cache, 1, max_n + 1, f);
        fclose(f);
        printf("[Cache] Saved Möbius to %s\n", CACHE_FILE);
    }
}

/* Check if n is a prime power, return log(p) if so, 0 otherwise */
static double von_mangoldt(int n) {
    if (n < 2) return 0;
    /* Find smallest prime factor */
    int p = 0;
    for (int d = 2; d * d <= n; d++) {
        if (n % d == 0) { p = d; break; }
    }
    if (p == 0) return log((double)n); /* n is prime */
    /* Check if n = p^k */
    int m = n;
    while (m % p == 0) m /= p;
    return (m == 1) ? log((double)p) : 0.0;
}

typedef void (*amplifier_fn)(double *a, int N);

static void amp_selberg(double *a, int N) {
    double logN = log((double)N);
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        double w = log((double)N / (double)n) / logN;
        a[n] = (w > 0) ? mu_cache[n] * w : 0;
    }
}

static void amp_sharp(double *a, int N) {
    for (int n = 1; n <= N; n++)
        a[n] = mu_cache[n];
}

static void amp_smooth_quad(double *a, int N) {
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        double t = 1.0 - (double)n / (double)N;
        a[n] = mu_cache[n] * t * t;
    }
}

static void amp_cosine(double *a, int N) {
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        a[n] = mu_cache[n] * cos(M_PI * n / (2.0 * N));
    }
}

static void amp_log_squared(double *a, int N) {
    double logN = log((double)N);
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        double w = log((double)N / (double)n) / logN;
        a[n] = (w > 0) ? mu_cache[n] * w * w : 0;
    }
}

static void amp_prime_twist(double *a, int N) {
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        double L = von_mangoldt(n);
        a[n] = mu_cache[n] * (L > 0 ? L : 0.1);
    }
}

static void amp_ramanujan(double *a, int N) {
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        a[n] = mu_cache[n] / pow((double)n, 0.25);
    }
}

static void amp_gaussian(double *a, int N) {
    double sigma = (double)N / 2.0;
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        a[n] = mu_cache[n] * exp(-(double)n * n / (sigma * sigma));
    }
}

typedef struct {
    const char *name;
    amplifier_fn fn;
} AmpDef;

static AmpDef amplifiers[] = {
    {"Selberg",    amp_selberg},
    {"Sharp",      amp_sharp},
    {"SmoothQuad", amp_smooth_quad},
    {"Cosine",     amp_cosine},
    {"LogSquared", amp_log_squared},
    {"PrimeTwist", amp_prime_twist},
    {"Ramanujan",  amp_ramanujan},
    {"Gaussian",   amp_gaussian},
};
#define N_AMPS (sizeof(amplifiers) / sizeof(amplifiers[0]))

/* Compute max|S(h)|/S(0) and avg|S(h)|/S(0) for given amplifier */
static void analyze_amplifier(double *a, int N, double *max_ratio, double *avg_ratio) {
    double S0 = 0;
    for (int n = 1; n <= N; n++) S0 += a[n] * a[n];
    if (S0 < 1e-15) { *max_ratio = 0; *avg_ratio = 0; return; }

    double max_Sh = 0;
    double sum_abs = 0;
    for (int h = 1; h < N; h++) {
        double Sh = 0;
        for (int n = 1; n + h <= N; n++) Sh += a[n] * a[n + h];
        double absSh = fabs(Sh);
        if (absSh > max_Sh) max_Sh = absSh;
        sum_abs += absSh;
    }
    *max_ratio = max_Sh / S0;
    *avg_ratio = (sum_abs / (N - 1)) / S0;
}

int main(void) {
    printf("=== Amplifier Comparison for Off-Diagonal Bound ===\n\n");

    load_or_compute_mobius(MAX_N);

    int test_N[] = {100, 500, 1000, 5000};
    int n_tests = sizeof(test_N) / sizeof(test_N[0]);

    for (int tn = 0; tn < n_tests; tn++) {
        int N = test_N[tn];
        printf("\n─── N = %d ───\n", N);
        printf("%-14s %-14s %-14s %-14s\n",
               "Amplifier", "max|S(h)|/S(0)", "avg|S(h)|/S(0)", "Verdict");

        for (int ai = 0; ai < (int)N_AMPS; ai++) {
            double *a = calloc(N + 1, sizeof(double));
            amplifiers[ai].fn(a, N);

            double max_r, avg_r;
            analyze_amplifier(a, N, &max_r, &avg_r);

            const char *verdict = (max_r < 0.10) ? "✓ GOOD" :
                                  (max_r < 0.20) ? "~ OK" : "✗ BAD";
            printf("%-14s %-14.6f %-14.6f %-14s\n",
                   amplifiers[ai].name, max_r, avg_r, verdict);

            free(a);
        }
    }

    /* Detailed scaling for the best amplifiers */
    printf("\n\n=== Scaling Analysis (best candidates) ===\n");
    printf("%-14s ", "N");
    for (int ai = 0; ai < (int)N_AMPS; ai++)
        printf("%-12s ", amplifiers[ai].name);
    printf("\n");

    int scale_N[] = {50, 100, 200, 500, 1000, 2000, 5000, 7500};
    int n_scale = sizeof(scale_N) / sizeof(scale_N[0]);
    for (int sn = 0; sn < n_scale; sn++) {
        int N = scale_N[sn];
        printf("%-14d ", N);
        for (int ai = 0; ai < (int)N_AMPS; ai++) {
            double *a = calloc(N + 1, sizeof(double));
            amplifiers[ai].fn(a, N);
            double max_r, avg_r;
            analyze_amplifier(a, N, &max_r, &avg_r);
            printf("%-12.6f ", max_r);
            free(a);
        }
        printf("\n");
    }

    printf("\n--- Key ---\n");
    printf("max|S(h)|/S(0) must → 0 as N → ∞ for the amplifier to work\n");
    printf("✓ GOOD: ratio < 0.10 (decaying)\n");
    printf("~ OK:   ratio 0.10-0.20 (borderline)\n");
    printf("✗ BAD:  ratio > 0.20 (persistent correlation)\n");

    free(mu_cache);
    return 0;
}
