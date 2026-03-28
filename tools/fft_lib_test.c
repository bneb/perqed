/*
 * fft_lib_test.c — Comprehensive unit tests for fft_lib.h
 */
#include "fft_lib.h"

static int g_pass = 0, g_fail = 0;
#define T(cond, ...) do { \
    if (cond) { g_pass++; printf("  PASS: " __VA_ARGS__); printf("\n"); } \
    else { g_fail++; printf("  FAIL: " __VA_ARGS__); printf("\n"); } \
} while(0)

/* ═══ FFT Tests ═══ */
static void test_fft_roundtrip(void) {
    printf("── FFT Round-Trip ──\n");
    double re[16] = {1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0};
    double im[16] = {0};
    double orig[8]; memcpy(orig, re, 64);

    fft_transform(re, im, 16, 1);
    fft_transform(re, im, 16, -1);

    double maxerr = 0;
    for (int i = 0; i < 8; i++) {
        double e = fabs(re[i] - orig[i]);
        if (e > maxerr) maxerr = e;
    }
    T(maxerr < 1e-10, "round-trip max error = %.2e", maxerr);
}

static void test_fft_delta(void) {
    printf("── FFT of Delta Function ──\n");
    /* δ at position 0 → constant spectrum */
    double re[8] = {1,0,0,0,0,0,0,0}, im[8] = {0};
    fft_transform(re, im, 8, 1);

    int all_one = 1;
    for (int k = 0; k < 8; k++)
        if (fabs(re[k] - 1.0) > 1e-10 || fabs(im[k]) > 1e-10) all_one = 0;
    T(all_one, "δ(0) → constant spectrum");
}

static void test_fft_constant(void) {
    printf("── FFT of Constant ──\n");
    /* Constant 1 → δ at k=0 scaled by N */
    double re[8] = {1,1,1,1,1,1,1,1}, im[8] = {0};
    fft_transform(re, im, 8, 1);

    T(fabs(re[0] - 8.0) < 1e-10, "DC component = 8");
    double maxother = 0;
    for (int k = 1; k < 8; k++) {
        double m = sqrt(re[k]*re[k] + im[k]*im[k]);
        if (m > maxother) maxother = m;
    }
    T(maxother < 1e-10, "non-DC components = 0 (max=%.2e)", maxother);
}

static void test_fft_parseval(void) {
    printf("── Parseval's Identity ──\n");
    int N = 256;
    double *re = calloc(N, 8), *im = calloc(N, 8);
    /* Random-ish input */
    for (int i = 0; i < N; i++) re[i] = sin(i * 0.37) + cos(i * 1.23);

    double time_energy = 0;
    for (int i = 0; i < N; i++) time_energy += re[i] * re[i];

    fft_transform(re, im, N, 1);

    double freq_energy = 0;
    for (int k = 0; k < N; k++) freq_energy += re[k]*re[k] + im[k]*im[k];
    freq_energy /= N; /* Parseval: Σ|x|² = (1/N)·Σ|X|² */

    double ratio = freq_energy / time_energy;
    T(fabs(ratio - 1.0) < 1e-10, "Parseval ratio = %.12f", ratio);
    free(re); free(im);
}

static void test_fft_convolution(void) {
    printf("── Convolution Theorem ──\n");
    int N = 16;
    double a_re[16]={1,2,3,0,0,0,0,0,0,0,0,0,0,0,0,0}, a_im[16]={0};
    double b_re[16]={1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0}, b_im[16]={0};

    /* Direct convolution: c[k] = Σ a[j]·b[k-j] */
    /* c[0]=1·1=1, c[1]=2·1+1·1=3, c[2]=3·1+2·1=5, c[3]=3·1=3 */
    double expected[] = {1, 3, 5, 3};

    fft_transform(a_re, a_im, N, 1);
    fft_transform(b_re, b_im, N, 1);

    /* Pointwise multiply */
    double c_re[16], c_im[16];
    for (int k = 0; k < N; k++) {
        c_re[k] = a_re[k]*b_re[k] - a_im[k]*b_im[k];
        c_im[k] = a_re[k]*b_im[k] + a_im[k]*b_re[k];
    }

    fft_transform(c_re, c_im, N, -1);

    double maxerr = 0;
    for (int i = 0; i < 4; i++) {
        double e = fabs(c_re[i] - expected[i]);
        if (e > maxerr) maxerr = e;
    }
    T(maxerr < 1e-10, "convolution error = %.2e", maxerr);
}

/* ═══ Möbius Tests ═══ */
static void test_mobius(void) {
    printf("── Möbius Function ──\n");
    int8_t *mu = fft_sieve_mobius(100);
    T(mu[1] == 1,   "μ(1)=1");
    T(mu[2] == -1,  "μ(2)=-1");
    T(mu[3] == -1,  "μ(3)=-1");
    T(mu[4] == 0,   "μ(4)=0 (4=2²)");
    T(mu[6] == 1,   "μ(6)=1 (6=2·3)");
    T(mu[30] == -1, "μ(30)=-1 (30=2·3·5)");
    T(mu[12] == 0,  "μ(12)=0 (12=4·3)");

    /* Summatory check: Σ_{d|n} μ(d) = [n=1] */
    int sum6 = 0;
    for (int d = 1; d <= 6; d++) if (6 % d == 0) sum6 += mu[d];
    T(sum6 == 0, "Σ_{d|6} μ(d) = 0");

    int sum1 = mu[1];
    T(sum1 == 1, "Σ_{d|1} μ(d) = 1");
    free(mu);
}

/* ═══ Prime Sieve Tests ═══ */
static void test_primes(void) {
    printf("── Prime Sieve ──\n");
    char *isc = fft_sieve_primes(100);
    T(!isc[2], "2 is prime");
    T(!isc[97], "97 is prime");
    T(isc[4], "4 is composite");
    T(isc[100], "100 is composite");

    /* Count primes ≤ 100 = 25 */
    int cnt = 0;
    for (int i = 2; i <= 100; i++) if (!isc[i]) cnt++;
    T(cnt == 25, "π(100) = %d (expected 25)", cnt);
    free(isc);
}

/* ═══ Minor Arc Tests ═══ */
static void test_minor_arcs(void) {
    printf("── Minor Arc Classification ──\n");
    int Q = 10, N = 1000, M = 4096;

    T(fft_is_major_arc(0, M, Q, N), "α=0 is major");
    T(fft_is_major_arc(M/2, M, Q, N), "α=1/2 is major");

    /* Count minor arc fraction — should be between 20% and 95% */
    int major = 0;
    for (int k = 0; k < M; k++)
        if (fft_is_major_arc(k, M, Q, N)) major++;
    double frac = 1.0 - (double)major / M;
    T(frac > 0.2 && frac < 0.95, "minor arc fraction = %.3f (in [0.2, 0.95])", frac);
}

static void test_minor_arc_sup(void) {
    printf("── Minor Arc Sup ──\n");
    int N = 500;
    char *isc = fft_sieve_primes(N);

    /* Prime indicator should have positive minor arc sup */
    double *w = calloc(N+1, 8);
    for (int n = 2; n <= N; n++) if (!isc[n]) w[n] = log((double)n);
    double sup = fft_minor_arc_sup(w, N, 10);
    T(sup > 0, "prime indicator sup = %.2f > 0", sup);

    /* Constant function: sup on minor arcs should be near 0 */
    for (int n = 1; n <= N; n++) w[n] = 1.0;
    double sup_const = fft_minor_arc_sup(w, N, 10);
    /* Constant → DFT is delta at k=0. Minor arc sup should be small
     * but not exactly 0 due to windowing */
    T(sup_const < sup / 2, "constant sup = %.2f < prime sup/2", sup_const);

    free(w); free(isc);
}

int main(void) {
    printf("═══════════════════════════════════\n");
    printf("  fft_lib.h — Unit Tests\n");
    printf("═══════════════════════════════════\n\n");

    test_fft_roundtrip();
    test_fft_delta();
    test_fft_constant();
    test_fft_parseval();
    test_fft_convolution();
    test_mobius();
    test_primes();
    test_minor_arcs();
    test_minor_arc_sup();

    printf("\n═══ %d/%d passed ═══\n", g_pass, g_pass + g_fail);
    return g_fail ? 1 : 0;
}
