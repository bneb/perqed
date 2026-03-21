/*
 * goldbach_amplifier_fft.c
 * ========================
 * FFT-based amplifier comparison for the off-diagonal bound.
 * Uses the convolution theorem: autocorrelation = IFFT(|FFT(a)|²)
 *
 * SELF-TESTS run first to verify:
 *   1. Möbius function correctness (known values)
 *   2. FFT round-trip (FFT then IFFT recovers input)
 *   3. FFT autocorrelation matches direct computation at small N
 *   4. Selberg coefficients sanity check
 *
 * Caches Möbius to /tmp/mobius_cache.bin.
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N 150001
#define PI 3.14159265358979323846

/* ─── Möbius sieve ─── */

static int8_t *mu_cache = NULL;
static const char *CACHE_FILE = "/tmp/mobius_cache.bin";

static void load_or_compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    FILE *f = fopen(CACHE_FILE, "rb");
    if (f) {
        int cached_n;
        if (fread(&cached_n, sizeof(int), 1, f) == 1 && cached_n >= max_n) {
            if (fread(mu_cache, 1, max_n + 1, f) == (size_t)(max_n + 1)) {
                fclose(f);
                return;
            }
        }
        fclose(f);
    }
    /* Use int for smallest prime factor — int8_t overflows for p > 127 */
    int *sp = calloc(max_n + 1, sizeof(int));
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
    f = fopen(CACHE_FILE, "wb");
    if (f) {
        fwrite(&max_n, sizeof(int), 1, f);
        fwrite(mu_cache, 1, max_n + 1, f);
        fclose(f);
    }
}


/* ─── In-place radix-2 Cooley-Tukey FFT ─── */
/* re[0..n-1], im[0..n-1], n must be power of 2, dir=1 forward, dir=-1 inverse */

static void fft(double *re, double *im, int n, int dir) {
    /* Bit-reversal permutation */
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            double t;
            t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
    /* Butterfly */
    for (int len = 2; len <= n; len <<= 1) {
        double ang = 2.0 * PI / len * dir;
        double wRe = cos(ang), wIm = sin(ang);
        for (int i = 0; i < n; i += len) {
            double curRe = 1.0, curIm = 0.0;
            for (int j = 0; j < len / 2; j++) {
                int u = i + j, v = i + j + len / 2;
                double tRe = curRe * re[v] - curIm * im[v];
                double tIm = curRe * im[v] + curIm * re[v];
                re[v] = re[u] - tRe;
                im[v] = im[u] - tIm;
                re[u] += tRe;
                im[u] += tIm;
                double newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
    if (dir == -1) {
        for (int i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
}

static int next_pow2(int n) {
    int p = 1;
    while (p < n) p <<= 1;
    return p;
}

/* ─── Autocorrelation via FFT ───
 * Input:  a[0..N] (a[0] unused, coefficients at 1..N)
 * Output: S[0..N-1] where S[h] = ∑_{n=1}^{N-h} a[n]*a[n+h]
 * S[0] is the self-correlation ∑ a[n]².
 */
static void autocorrelation_fft(const double *a, int N, double *S) {
    int fft_n = next_pow2(2 * N);
    double *re = calloc(fft_n, sizeof(double));
    double *im = calloc(fft_n, sizeof(double));

    /* Pack a[1..N] into re[0..N-1] */
    for (int i = 1; i <= N; i++) re[i - 1] = a[i];

    /* Forward FFT */
    fft(re, im, fft_n, 1);

    /* |FFT|² */
    for (int i = 0; i < fft_n; i++) {
        double mag2 = re[i] * re[i] + im[i] * im[i];
        re[i] = mag2;
        im[i] = 0;
    }

    /* Inverse FFT */
    fft(re, im, fft_n, -1);

    /* S[h] = re[h] for h = 0..N-1 */
    for (int h = 0; h < N; h++) S[h] = re[h];

    free(re);
    free(im);
}

/* ─── Direct (O(N²)) autocorrelation for verification ─── */
static void autocorrelation_direct(const double *a, int N, double *S) {
    for (int h = 0; h < N; h++) {
        double sum = 0;
        for (int n = 1; n + h <= N; n++) sum += a[n] * a[n + h];
        S[h] = sum;
    }
}

/* ─── Amplifier definitions ─── */

static void amp_selberg(double *a, int N) {
    double logN = log((double)N);
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        double w = log((double)N / (double)n) / logN;
        a[n] = (w > 0) ? mu_cache[n] * w : 0;
    }
}

static void amp_sharp(double *a, int N) {
    for (int n = 1; n <= N; n++) a[n] = mu_cache[n];
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
        a[n] = mu_cache[n] * cos(PI * n / (2.0 * N));
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

/* Smooth Beurling-Selberg majorant style */
static void amp_beurling(double *a, int N) {
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0) { a[n] = 0; continue; }
        /* sinc²-inspired taper: (sin(πn/N)/(πn/N))² */
        double x = PI * (double)n / (double)N;
        double sinc = (x > 1e-10) ? sin(x) / x : 1.0;
        a[n] = mu_cache[n] * sinc * sinc;
    }
}

typedef struct { const char *name; void (*fn)(double *, int); } AmpDef;

static AmpDef amplifiers[] = {
    {"Selberg",    amp_selberg},
    {"Sharp",      amp_sharp},
    {"SmoothQuad", amp_smooth_quad},
    {"Cosine",     amp_cosine},
    {"LogSquared", amp_log_squared},
    {"Ramanujan",  amp_ramanujan},
    {"Gaussian",   amp_gaussian},
    {"Beurling",   amp_beurling},
};
#define N_AMPS (sizeof(amplifiers) / sizeof(amplifiers[0]))

/* ═══════════════════════════════════════════════════════
 *  SELF-TESTS — run before any analysis
 * ═══════════════════════════════════════════════════════ */

static int test_count = 0, test_pass = 0;
#define ASSERT(cond, msg) do { \
    test_count++; \
    if (!(cond)) { printf("  FAIL: %s\n", msg); } \
    else { test_pass++; } \
} while(0)

static void test_mobius(void) {
    printf("Test 1: Möbius function known values\n");
    /* μ(1)=1, μ(2)=-1, μ(3)=-1, μ(4)=0, μ(5)=-1, μ(6)=1,
       μ(7)=-1, μ(8)=0, μ(9)=0, μ(10)=1, μ(30)=-1 */
    int expected[] = {0, 1, -1, -1, 0, -1, 1, -1, 0, 0, 1};
    for (int i = 1; i <= 10; i++) {
        char msg[64];
        snprintf(msg, sizeof(msg), "μ(%d) = %d, got %d", i, expected[i], mu_cache[i]);
        ASSERT(mu_cache[i] == expected[i], msg);
    }
    ASSERT(mu_cache[30] == -1, "μ(30) = -1");
    ASSERT(mu_cache[12] == 0,  "μ(12) = 0 (4|12)");
    ASSERT(mu_cache[105] == -1, "μ(105) = μ(3·5·7) = (-1)^3 = -1");

    /* Mertens function check: M(n) = ∑_{k=1}^{n} μ(k) */
    /* Known: M(1)=1, M(10)=-1, M(100)=1, M(1000)=2 */
    int M = 0;
    for (int k = 1; k <= 1000; k++) M += mu_cache[k];
    ASSERT(M == 2, "M(1000) = 2 (Mertens function)");

    M = 0;
    for (int k = 1; k <= 10; k++) M += mu_cache[k];
    ASSERT(M == -1, "M(10) = -1");
}

static void test_fft_roundtrip(void) {
    printf("Test 2: FFT round-trip (forward + inverse = identity)\n");
    int n = 16;
    double re[16] = {1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0};
    double im[16] = {0};
    double orig[8];
    memcpy(orig, re, 8 * sizeof(double));

    fft(re, im, n, 1);   /* forward */
    fft(re, im, n, -1);  /* inverse */

    double max_err = 0;
    for (int i = 0; i < 8; i++) {
        double err = fabs(re[i] - orig[i]);
        if (err > max_err) max_err = err;
    }
    char msg[128];
    snprintf(msg, sizeof(msg), "FFT round-trip max error = %.2e (need < 1e-10)", max_err);
    ASSERT(max_err < 1e-10, msg);

    /* Check that imaginary parts are ~0 */
    double max_im = 0;
    for (int i = 0; i < n; i++)
        if (fabs(im[i]) > max_im) max_im = fabs(im[i]);
    snprintf(msg, sizeof(msg), "FFT round-trip max imag = %.2e (need < 1e-10)", max_im);
    ASSERT(max_im < 1e-10, msg);
}

static void test_autocorrelation_fft_vs_direct(void) {
    printf("Test 3: FFT autocorrelation vs direct (N=100, Selberg)\n");
    int N = 100;
    double *a = calloc(N + 1, sizeof(double));
    amp_selberg(a, N);

    double *S_fft = calloc(N, sizeof(double));
    double *S_dir = calloc(N, sizeof(double));

    autocorrelation_fft(a, N, S_fft);
    autocorrelation_direct(a, N, S_dir);

    double max_err = 0;
    int worst_h = 0;
    for (int h = 0; h < N; h++) {
        double err = fabs(S_fft[h] - S_dir[h]);
        if (err > max_err) { max_err = err; worst_h = h; }
    }

    char msg[128];
    snprintf(msg, sizeof(msg),
        "S(0): FFT=%.6f, direct=%.6f, diff=%.2e",
        S_fft[0], S_dir[0], fabs(S_fft[0] - S_dir[0]));
    ASSERT(fabs(S_fft[0] - S_dir[0]) < 1e-8, msg);

    snprintf(msg, sizeof(msg),
        "Max |S_fft(h) - S_dir(h)| = %.2e at h=%d (need < 1e-6)", max_err, worst_h);
    ASSERT(max_err < 1e-6, msg);

    /* Check a specific shift */
    snprintf(msg, sizeof(msg),
        "S(1): FFT=%.6f, direct=%.6f", S_fft[1], S_dir[1]);
    ASSERT(fabs(S_fft[1] - S_dir[1]) < 1e-8, msg);

    snprintf(msg, sizeof(msg),
        "S(15): FFT=%.6f, direct=%.6f (15 is the worst shift for Selberg)",
        S_fft[15], S_dir[15]);
    ASSERT(fabs(S_fft[15] - S_dir[15]) < 1e-8, msg);

    free(a); free(S_fft); free(S_dir);
}

static void test_autocorrelation_all_amplifiers(void) {
    printf("Test 4: FFT vs direct for ALL amplifiers (N=50)\n");
    int N = 50;
    for (int ai = 0; ai < (int)N_AMPS; ai++) {
        double *a = calloc(N + 1, sizeof(double));
        amplifiers[ai].fn(a, N);

        double *S_fft = calloc(N, sizeof(double));
        double *S_dir = calloc(N, sizeof(double));

        autocorrelation_fft(a, N, S_fft);
        autocorrelation_direct(a, N, S_dir);

        double max_err = 0;
        for (int h = 0; h < N; h++) {
            double err = fabs(S_fft[h] - S_dir[h]);
            if (err > max_err) max_err = err;
        }

        char msg[128];
        snprintf(msg, sizeof(msg), "%-12s max|FFT-direct| = %.2e",
                 amplifiers[ai].name, max_err);
        ASSERT(max_err < 1e-6, msg);

        free(a); free(S_fft); free(S_dir);
    }
}

static void test_selberg_coeffs(void) {
    printf("Test 5: Selberg coefficient sanity\n");
    int N = 100;
    double *a = calloc(N + 1, sizeof(double));
    amp_selberg(a, N);

    /* a[1] = μ(1)·log(100/1)/log(100) = 1·1 = 1.0 */
    char msg[128];
    snprintf(msg, sizeof(msg), "a[1] = %.6f (expect 1.0)", a[1]);
    ASSERT(fabs(a[1] - 1.0) < 1e-10, msg);

    /* a[N] = μ(N)·log(1)/log(N) = 0 (log(1)=0) */
    snprintf(msg, sizeof(msg), "a[N] = %.6f (expect 0.0)", a[N]);
    ASSERT(fabs(a[N]) < 1e-10, msg);

    /* a[4] = 0 (μ(4) = 0 since 4 = 2²) */
    snprintf(msg, sizeof(msg), "a[4] = %.6f (expect 0, μ(4)=0)", a[4]);
    ASSERT(fabs(a[4]) < 1e-10, msg);

    /* a[2] = μ(2)·log(50)/log(100) = -1 · log(50)/log(100) */
    double expected = -1.0 * log(50.0) / log(100.0);
    snprintf(msg, sizeof(msg), "a[2] = %.6f (expect %.6f)", a[2], expected);
    ASSERT(fabs(a[2] - expected) < 1e-10, msg);

    /* All a[n] for n with μ(n)=0 should be 0 */
    int nonzero_count = 0;
    for (int n = 1; n <= N; n++) {
        if (mu_cache[n] == 0 && fabs(a[n]) > 1e-15) nonzero_count++;
    }
    snprintf(msg, sizeof(msg), "All a[n] zero when μ(n)=0: violations=%d", nonzero_count);
    ASSERT(nonzero_count == 0, msg);

    free(a);
}

static int run_tests(void) {
    printf("╔══════════════════════════════════════╗\n");
    printf("║     SELF-TESTS (must all pass)       ║\n");
    printf("╚══════════════════════════════════════╝\n\n");

    test_mobius();
    test_fft_roundtrip();
    test_autocorrelation_fft_vs_direct();
    test_autocorrelation_all_amplifiers();
    test_selberg_coeffs();

    printf("\n═══ Results: %d/%d tests passed ═══\n\n", test_pass, test_count);
    if (test_pass != test_count) {
        printf("ABORTING: %d test(s) failed. Fix before trusting results.\n", test_count - test_pass);
        return 1;
    }
    printf("All tests passed. Proceeding to analysis.\n\n");
    return 0;
}

/* ═══════════════════════════════════════════════════════
 *  MAIN ANALYSIS
 * ═══════════════════════════════════════════════════════ */

int main(void) {
    load_or_compute_mobius(MAX_N);

    if (run_tests()) return 1;

    printf("══════════════════════════════════════════════════════\n");
    printf("  AMPLIFIER OFF-DIAGONAL SCALING (FFT, up to N=50000)\n");
    printf("══════════════════════════════════════════════════════\n\n");

    printf("%-14s ", "N");
    for (int ai = 0; ai < (int)N_AMPS; ai++)
        printf("%-12s ", amplifiers[ai].name);
    printf("\n");

    int scale_N[] = {50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000};
    int n_scale = sizeof(scale_N) / sizeof(scale_N[0]);

    for (int sn = 0; sn < n_scale; sn++) {
        int N = scale_N[sn];
        if (N > MAX_N - 1) break;
        printf("%-14d ", N);
        fflush(stdout);

        for (int ai = 0; ai < (int)N_AMPS; ai++) {
            double *a = calloc(N + 1, sizeof(double));
            amplifiers[ai].fn(a, N);

            double *S = calloc(N, sizeof(double));
            autocorrelation_fft(a, N, S);

            double S0 = S[0];
            double max_Sh = 0;
            for (int h = 1; h < N; h++) {
                if (fabs(S[h]) > max_Sh) max_Sh = fabs(S[h]);
            }

            printf("%-12.6f ", (S0 > 1e-15) ? max_Sh / S0 : 0.0);
            fflush(stdout);

            free(a); free(S);
        }
        printf("\n");
    }

    printf("\n--- Key: max|S(h>0)|/S(0), lower is better ---\n");
    printf("Need this ratio → 0 as N → ∞ for off_diagonal_bound\n");

    free(mu_cache);
    return 0;
}
