/*
 * sieve_minor_arc_definitive.c — DEFINITIVE scaling test.
 *
 * Fixes from previous version:
 *   1. Q is FIXED at 10 for all N (consistent minor arc region)
 *   2. Pushes to N = 10^7 (10MB Möbius + ~256MB FFT)
 *   3. Fits power law E ∝ N^{-α} to determine asymptotic behavior
 *
 * Self-tests run first.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N     10000001  /* 10^7 */
#define FIXED_Q   10        /* Consistent across all N */
#define PI 3.14159265358979323846

/* ─── Möbius sieve ─── */
static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    if (!sp) { fprintf(stderr, "OOM sp\n"); exit(1); }
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
    for (long long i = 2; i * i <= max_n; i++)
        if (!is_composite[i])
            for (long long j = i * i; j <= max_n; j += i)
                is_composite[j] = 1;
}

/* ─── Radix-2 FFT ─── */
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

/* Major arc: |k/M - a/q| < Q/(qN) for gcd(a,q)=1, q ≤ Q */
static int is_major_arc(int k, int M, int Q, int N) {
    double alpha = (double)k / M;
    for (int q = 1; q <= Q; q++) {
        double threshold = (double)Q / ((double)q * N);
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

/* Compute sup |S(α)| on minor arcs via FFT */
static double minor_arc_sup_fft(double *weights, int N, int Q) {
    int M = next_pow2(2 * N);  /* 2x oversample */
    double *re = calloc(M, sizeof(double));
    double *im = calloc(M, sizeof(double));
    if (!re || !im) { fprintf(stderr, "OOM at N=%d, M=%d\n", N, M); exit(1); }

    for (int n = 1; n <= N; n++) re[n] = weights[n];

    fft(re, im, M, 1);

    double sup = 0;
    for (int k = 0; k < M; k++) {
        if (is_major_arc(k, M, Q, N)) continue;
        double mag = sqrt(re[k] * re[k] + im[k] * im[k]);
        if (mag > sup) sup = mag;
    }

    free(re);
    free(im);
    return sup;
}

/* ═══ Self-tests ═══ */
static int run_tests(void) {
    printf("═══ Self-Tests ═══\n");
    int pass = 0, total = 0;
    #define T(cond, msg) do { total++; if (cond) { pass++; printf("  PASS: %s\n", msg); } \
                              else printf("  FAIL: %s\n", msg); } while(0)

    T(mu_cache[1]==1, "μ(1)=1");
    T(mu_cache[2]==-1, "μ(2)=-1");
    T(mu_cache[4]==0, "μ(4)=0");
    T(mu_cache[30]==-1, "μ(30)=-1");

    /* FFT round-trip */
    double re[16]={1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0}, im[16]={0};
    double orig[8]; memcpy(orig,re,64);
    fft(re,im,16,1); fft(re,im,16,-1);
    double err=0;
    for(int i=0;i<8;i++){double e=fabs(re[i]-orig[i]);if(e>err)err=e;}
    char msg[128];
    snprintf(msg,sizeof(msg),"FFT round-trip err=%.2e",err);
    T(err<1e-10,msg);

    /* Minor arc classification with fixed Q=10, N=500
     * Major arc measure ≈ 2Q²/N = 200/500 = 0.4, so ~60% is minor */
    T(is_major_arc(0, 2000, FIXED_Q, 500), "α=0 is major");
    /* α=0.37 should be minor (far from small rationals with Q=10) */
    T(!is_major_arc(740, 2000, FIXED_Q, 500), "α=0.37 is minor");

    /* Flat weights at N=500: sup should be > 0 on minor arcs */
    double *w = calloc(501, sizeof(double));
    for(int i=1;i<=500;i++) w[i]=1.0;
    double s = minor_arc_sup_fft(w, 500, FIXED_Q);
    snprintf(msg,sizeof(msg),"Flat sup=%.2f > 0 (N=500,Q=%d)",s,FIXED_Q);
    T(s > 0, msg);
    free(w);

    printf("═══ %d/%d passed ═══\n\n", pass, total);
    return pass != total;
    #undef T
}

/* ═══ Main ═══ */
int main(void) {
    fprintf(stderr, "Sieving to %d...\n", MAX_N);
    compute_mobius(MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done. Running tests...\n");

    if (run_tests()) return 1;

    printf("══════════════════════════════════════════════════════\n");
    printf("  DEFINITIVE Minor Arc Scaling (Q=%d fixed)\n", FIXED_Q);
    printf("══════════════════════════════════════════════════════\n\n");
    printf("  %10s | %12s | %12s | %10s | %10s | %10s\n",
           "N", "sup_sieve", "sup_prime", "E_sieve", "E_prime", "ratio");

    int test_Ns[] = {
        500, 1000, 2000, 5000, 10000, 20000,
        50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 0
    };

    /* For power-law fit: collect log(N), log(E_sieve) */
    double logN_arr[20], logE_arr[20];
    int n_points = 0;

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > MAX_N - 1) break;

        fprintf(stderr, "  N=%d...\n", N);

        /* Sieve weights: ν(n) = (Σ_{d|n, d≤R} μ(d)·(1-log(d)/log(R)))² */
        int R = (int)(sqrt((double)N) / log((double)N));
        if (R < 2) R = 2;
        double logR = log((double)R);

        double *sieve_w = calloc(N + 1, sizeof(double));
        double *sieve_linear = calloc(N + 1, sizeof(double));
        for (int d = 1; d <= R; d++) {
            if (mu_cache[d] == 0) continue;
            double t = log((double)d) / logR;
            double P = (t <= 1.0) ? (1.0 - t) : 0.0;
            double lambda_d = mu_cache[d] * P;
            for (int n = d; n <= N; n += d)
                sieve_linear[n] += lambda_d;
        }
        for (int n = 1; n <= N; n++)
            sieve_w[n] = sieve_linear[n] * sieve_linear[n];
        free(sieve_linear);

        /* Prime weights */
        double *prime_w = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= N; n++)
            if (!is_composite[n]) prime_w[n] = log((double)n);

        double sup_sieve = minor_arc_sup_fft(sieve_w, N, FIXED_Q);
        double sup_prime = minor_arc_sup_fft(prime_w, N, FIXED_Q);

        double normalizer = (double)N / log((double)N);
        double E_sieve = sup_sieve / normalizer;
        double E_prime = sup_prime / normalizer;
        double ratio = (E_prime > 0) ? E_sieve / E_prime : 0;

        printf("  %10d | %12.2f | %12.2f | %10.5f | %10.5f | %10.4f\n",
               N, sup_sieve, sup_prime, E_sieve, E_prime, ratio);
        fflush(stdout);

        if (E_sieve > 0) {
            logN_arr[n_points] = log((double)N);
            logE_arr[n_points] = log(E_sieve);
            n_points++;
        }

        free(sieve_w);
        free(prime_w);
    }

    /* Fit power law: log(E) = a + b·log(N) → E ∝ N^b */
    if (n_points >= 3) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<n_points;i++){
            sx+=logN_arr[i]; sy+=logE_arr[i];
            sxx+=logN_arr[i]*logN_arr[i]; sxy+=logN_arr[i]*logE_arr[i];
        }
        double b = (n_points*sxy - sx*sy) / (n_points*sxx - sx*sx);
        double a = (sy - b*sx) / n_points;
        double C = exp(a);

        printf("\n  ═══ Power-Law Fit: E_sieve ≈ %.4f · N^(%.4f) ═══\n", C, b);
        if (b < -0.01) {
            printf("  ★ VERDICT: E_sieve → 0 as N → ∞ (exponent %.4f < 0)\n", b);
            printf("    Sieve majorant achieves power-saving cancellation.\n");
        } else {
            printf("  ✗ VERDICT: E_sieve stays constant or grows (exponent %.4f ≥ 0)\n", b);
            printf("    Sieve approach does not provide power saving.\n");
        }
    }

    free(mu_cache);
    free(is_composite);
    return 0;
}
