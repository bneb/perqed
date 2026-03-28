/*
 * sieve_minor_arc_fft.c — FFT-accelerated minor arc scaling test.
 *
 * Reuses the FFT + Möbius infrastructure from goldbach_amplifier_fft.c.
 * Computes sup_{minor arcs} |S_ν(α)| for sieve weights ν at various N,
 * and compares to prime indicator baseline.
 *
 * The FFT gives us S_ν(k/M) for k=0..M-1 in O(M log M) time,
 * where M is the FFT size. We classify each k as major/minor arc
 * and take the sup over minor arcs.
 *
 * Self-tests run first.
 *
 * Usage: ./sieve_minor_arc_fft
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define PI 3.14159265358979323846

/* ─── Möbius sieve ─── */
static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    for (int i = 2; i <= max_n; i++) {
        if (sp[i] == 0)
            for (int j = i; j <= max_n; j += i)
                if (sp[j] == 0) sp[j] = i;
    }
    mu_cache[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = sp[n];
        if ((n / p) % p == 0) mu_cache[n] = 0;
        else mu_cache[n] = -mu_cache[n / p];
    }
    free(sp);
}

static void compute_primes(int max_n) {
    is_composite = calloc(max_n + 1, 1);
    is_composite[0] = is_composite[1] = 1;
    for (int i = 2; (long long)i * i <= max_n; i++)
        if (!is_composite[i])
            for (int j = i * i; j <= max_n; j += i)
                is_composite[j] = 1;
}

/* ─── Radix-2 Cooley-Tukey FFT ─── */
static void fft(double *re, double *im, int n, int dir) {
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
    if (dir == -1)
        for (int i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

static int next_pow2(int n) {
    int p = 1;
    while (p < n) p <<= 1;
    return p;
}

/* ─── GCD ─── */
static int gcd(int a, int b) {
    while (b) { int t = b; b = a % b; a = t; }
    return a;
}

/* ─── Is k/M on a major arc? ─── */
/* Major arc: |k/M - a/q| < Q/(qN) for some a/q, gcd(a,q)=1, q ≤ Q */
static int is_major_arc(int k, int M, int Q, int N) {
    double alpha = (double)k / M;
    for (int q = 1; q <= Q; q++) {
        double threshold = (double)Q / (q * N);
        for (int a = 0; a <= q; a++) {
            if (a > 0 && a < q && gcd(a, q) != 1) continue;
            double center = (double)a / q;
            double dist = fabs(alpha - center);
            if (dist > 0.5) dist = 1.0 - dist;
            if (dist < threshold) return 1;
        }
    }
    return 0;
}

typedef struct {
    double sup_minor;     /* sup |S(α)| on minor arcs */
    double sum_weights;   /* Σ w(n) */
    double sum_sq_weights;/* Σ w(n)² */
    int minor_count;
    int total_count;
} FourierResult;

/* Compute Fourier transform via FFT and measure minor arc sup */
FourierResult analyze_weights(double *weights, int N, int Q) {
    int M = next_pow2(4 * N);  /* oversample 4x for resolution */
    double *re = calloc(M, sizeof(double));
    double *im = calloc(M, sizeof(double));

    /* Pack weights into FFT input */
    double sum_w = 0, sum_w2 = 0;
    for (int n = 1; n <= N; n++) {
        re[n] = weights[n];
        sum_w += weights[n];
        sum_w2 += weights[n] * weights[n];
    }

    /* Forward FFT: gives S(k/M) = Σ w(n) · e(2πi·n·k/M) */
    fft(re, im, M, 1);

    FourierResult result = {0, sum_w, sum_w2, 0, M};

    for (int k = 0; k < M; k++) {
        double mag = sqrt(re[k] * re[k] + im[k] * im[k]);
        if (!is_major_arc(k, M, Q, N)) {
            if (mag > result.sup_minor) result.sup_minor = mag;
            result.minor_count++;
        }
    }

    /* Parseval check */
    double parseval_lhs = 0;
    for (int k = 0; k < M; k++)
        parseval_lhs += (re[k] * re[k] + im[k] * im[k]);
    parseval_lhs /= M;  /* divide by M because FFT is unnormalized */
    double parseval_err = fabs(parseval_lhs - sum_w2) / (sum_w2 + 1e-15);
    if (parseval_err > 0.01)
        fprintf(stderr, "  WARNING: Parseval error = %.4f at N=%d\n", parseval_err, N);

    free(re);
    free(im);
    return result;
}

/* ═══ Self-tests ═══ */
static int test_count = 0, test_pass = 0;
#define TEST(cond, msg) do { \
    test_count++; \
    if (!(cond)) { printf("  FAIL: %s\n", msg); } \
    else { test_pass++; printf("  PASS: %s\n", msg); } \
} while(0)

static int run_tests(int max_n) {
    printf("═══ Self-Tests ═══\n");

    /* Test Möbius */
    TEST(mu_cache[1] == 1, "μ(1)=1");
    TEST(mu_cache[2] == -1, "μ(2)=-1");
    TEST(mu_cache[4] == 0, "μ(4)=0");
    TEST(mu_cache[6] == 1, "μ(6)=1");
    TEST(mu_cache[30] == -1, "μ(30)=-1");

    /* Test FFT round-trip */
    int n = 16;
    double re[16] = {1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0};
    double im[16] = {0};
    double orig[8]; memcpy(orig, re, 8*sizeof(double));
    fft(re, im, n, 1);
    fft(re, im, n, -1);
    double max_err = 0;
    for (int i = 0; i < 8; i++) {
        double err = fabs(re[i] - orig[i]);
        if (err > max_err) max_err = err;
    }
    char msg[128];
    snprintf(msg, sizeof(msg), "FFT round-trip err=%.2e", max_err);
    TEST(max_err < 1e-10, msg);

    /* Test minor arc classification */
    /* α=0 should be on major arc (a=0, q=1) */
    TEST(is_major_arc(0, 1000, 5, 500), "α=0 is on major arc");
    /* Fix: k=0 gives α=0.0, which is center of a=0/q=1. Check threshold: Q/(1*N) = 5/500 = 0.01 */
    /* α=0.5 = 1/2, center of a=1/q=2. threshold = Q/(2*N) = 5/1000 = 0.005 */
    int k_half = 500; /* k=500 out of M=1000 → α=0.5 */
    TEST(is_major_arc(k_half, 1000, 5, 500), "α=0.5 on major arc");
    /* α=0.123 should be on minor arc (far from small rationals) */
    int k_minor = 123; /* α ≈ 0.123 */
    TEST(!is_major_arc(k_minor, 1000, 5, 500), "α=0.123 on minor arc");

    /* Test Parseval via FFT */
    double *w = calloc(101, sizeof(double));
    for (int i = 1; i <= 100; i++) w[i] = 1.0;
    FourierResult fr = analyze_weights(w, 100, 3);
    snprintf(msg, sizeof(msg), "Flat weights: sup_minor=%.2f (should be > 0)", fr.sup_minor);
    TEST(fr.sup_minor > 0, msg);
    snprintf(msg, sizeof(msg), "Minor fraction = %.3f", (double)fr.minor_count / fr.total_count);
    TEST((double)fr.minor_count / fr.total_count > 0.5, "Minor arcs > 50%");
    free(w);

    printf("\n═══ %d/%d tests passed ═══\n\n", test_pass, test_count);
    return (test_pass != test_count);
}

/* ═══ Main Analysis ═══ */
int main(void) {
    int max_n = 200001;
    fprintf(stderr, "Computing Möbius + primes up to %d...\n", max_n);
    compute_mobius(max_n);
    compute_primes(max_n);
    fprintf(stderr, "Done.\n");

    if (run_tests(max_n)) {
        fprintf(stderr, "TESTS FAILED\n");
        return 1;
    }

    printf("═══════════════════════════════════════════════\n");
    printf("  Minor Arc Scaling: Sieve vs Prime (FFT)\n");
    printf("═══════════════════════════════════════════════\n\n");
    printf("  %8s | %10s | %10s | %8s | %10s | %10s | %8s\n",
           "N", "sup_sieve", "sup_prime", "ratio", "E_sieve", "E_prime", "E_ratio");

    int test_Ns[] = {100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 0};

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > max_n - 1) break;

        int Q = (int)(0.1 * sqrt((double)N));
        if (Q < 2) Q = 2;

        /* Sieve weights: ν(n) = (Σ_{d|n, d≤R} μ(d)·(1-log(d)/log(R)))² */
        double logR = log(sqrt((double)N) / log((double)N));
        int R = (int)(sqrt((double)N) / log((double)N));
        if (R < 2) R = 2;

        double *sieve_w = calloc(N + 1, sizeof(double));
        /* First compute the linear sum, then square */
        double *sieve_linear = calloc(N + 1, sizeof(double));
        for (int d = 1; d <= R; d++) {
            if (mu_cache[d] == 0) continue;
            double t = log((double)d) / logR;
            double P = 1.0 - t;
            double lambda_d = mu_cache[d] * P;
            for (int n = d; n <= N; n += d)
                sieve_linear[n] += lambda_d;
        }
        for (int n = 1; n <= N; n++)
            sieve_w[n] = sieve_linear[n] * sieve_linear[n];
        free(sieve_linear);

        /* Prime weights: Λ(n) = log(n) if n is prime */
        double *prime_w = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= N; n++)
            if (!is_composite[n]) prime_w[n] = log((double)n);

        FourierResult sieve_r = analyze_weights(sieve_w, N, Q);
        FourierResult prime_r = analyze_weights(prime_w, N, Q);

        double normalizer = (double)N / log((double)N);
        double E_sieve = sieve_r.sup_minor / normalizer;
        double E_prime = prime_r.sup_minor / normalizer;
        double ratio = (prime_r.sup_minor > 0) ? sieve_r.sup_minor / prime_r.sup_minor : 0;

        printf("  %8d | %10.2f | %10.2f | %8.4f | %10.5f | %10.5f | %8.4f\n",
               N, sieve_r.sup_minor, prime_r.sup_minor, ratio,
               E_sieve, E_prime, E_sieve / E_prime);

        free(sieve_w);
        free(prime_w);
    }

    printf("\n  Key: E = sup_minor / (N/logN). Lower = better.\n");
    printf("  E_ratio < 1 means sieve beats primes. E → 0 means approach works.\n");

    free(mu_cache);
    free(is_composite);
    return 0;
}
