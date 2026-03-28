/*
 * sieve_all_amplifiers.c — Test ALL weight functions for minor arc power saving.
 *
 * Tests 8 amplifier families from goldbach_amplifier_fft.c:
 *   Selberg, Sharp, SmoothQuad, Cosine, LogSquared, Ramanujan, Gaussian, Beurling
 *
 * For each: compute ν(n) = (Σ_{d|n} λ_d)², measure sup|ν̂| on minor arcs,
 * fit power law E ∝ N^β. If β < 0 for ANY amplifier, that's a GO.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   5000001
#define FIXED_Q 10
#define PI      3.14159265358979323846

static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    for (int i = 2; i <= max_n; i++)
        if (sp[i] == 0) for (int j = i; j <= max_n; j += i) if (sp[j] == 0) sp[j] = i;
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

/* ─── FFT ─── */
static void fft(double *re, double *im, int n, int dir) {
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { double t; t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; }
    }
    for (int len = 2; len <= n; len <<= 1) {
        double ang = 2.0*PI/len*dir, wRe=cos(ang), wIm=sin(ang);
        for (int i = 0; i < n; i += len) {
            double cR=1,cI=0;
            for (int j = 0; j < len/2; j++) {
                int u=i+j, v=i+j+len/2;
                double tR=cR*re[v]-cI*im[v], tI=cR*im[v]+cI*re[v];
                re[v]=re[u]-tR; im[v]=im[u]-tI; re[u]+=tR; im[u]+=tI;
                double nR=cR*wRe-cI*wIm; cI=cR*wIm+cI*wRe; cR=nR;
            }
        }
    }
    if(dir==-1) for(int i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
static int next_pow2(int n){int p=1;while(p<n)p<<=1;return p;}
static int gcd(int a,int b){while(b){int t=b;b=a%b;a=t;}return a;}

static int is_major_arc(int k, int M, int Q, int N) {
    double alpha = (double)k / M;
    for (int q = 1; q <= Q; q++) {
        double thr = (double)Q / ((double)q * N);
        for (int a = 0; a <= q; a++) {
            if (a > 0 && a < q && gcd(a, q) != 1) continue;
            double d = fabs(alpha - (double)a/q);
            if (d > 0.5) d = 1.0 - d;
            if (d < thr) return 1;
        }
    }
    return 0;
}

static double minor_arc_sup(double *weights, int N, int Q) {
    int M = next_pow2(2 * N);
    double *re = calloc(M, sizeof(double));
    double *im = calloc(M, sizeof(double));
    for (int n = 1; n <= N; n++) re[n] = weights[n];
    fft(re, im, M, 1);
    double sup = 0;
    for (int k = 0; k < M; k++) {
        if (is_major_arc(k, M, Q, N)) continue;
        double mag = sqrt(re[k]*re[k] + im[k]*im[k]);
        if (mag > sup) sup = mag;
    }
    free(re); free(im);
    return sup;
}

/* ─── Amplifier definitions (λ_d weights, before squaring) ─── */
typedef void (*AmpFn)(double *lambda, int R, int N);

/* Each function fills lambda[1..R] with the sieve-like coefficients */
static void amp_selberg(double *lam, int R, int N) {
    double logR = log((double)R);
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double t = log((double)d) / logR;
        lam[d] = mu_cache[d] * ((t <= 1.0) ? (1.0 - t) : 0.0);
    }
}

static void amp_sharp(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) lam[d] = mu_cache[d];
}

static void amp_smooth_quad(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double t = (double)d / R;
        lam[d] = mu_cache[d] * (1.0 - t) * (1.0 - t);
    }
}

static void amp_cosine(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        lam[d] = mu_cache[d] * cos(PI * d / (2.0 * R));
    }
}

static void amp_log_squared(double *lam, int R, int N) {
    double logR = log((double)R);
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double t = log((double)d) / logR;
        lam[d] = (t <= 1.0) ? mu_cache[d] * (1.0-t)*(1.0-t) : 0.0;
    }
}

static void amp_ramanujan(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        lam[d] = mu_cache[d] / pow((double)d, 0.25);
    }
}

static void amp_gaussian(double *lam, int R, int N) {
    double sigma = (double)R / 2.0;
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        lam[d] = mu_cache[d] * exp(-(double)d*d/(sigma*sigma));
    }
}

static void amp_beurling(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double x = PI * (double)d / R;
        double sinc = (x > 1e-10) ? sin(x)/x : 1.0;
        lam[d] = mu_cache[d] * sinc * sinc;
    }
}

/* ─── HYPERBOLIC amplifiers ─── */

/* Sech: λ_d = μ(d) · sech(πd/(2R))
 * FT of sech is sech — self-dual, exponential decay in frequency domain */
static void amp_sech(double *lam, int R, int N) {
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        lam[d] = mu_cache[d] / cosh(PI * d / (2.0 * R));
    }
}

/* Tanh step: λ_d = μ(d) · (1 - tanh((d-R/2)/(R/8)))
 * Smooth sigmoid cutoff at d=R/2 */
static void amp_tanh(double *lam, int R, int N) {
    double center = R / 2.0, width = R / 8.0;
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        lam[d] = mu_cache[d] * 0.5 * (1.0 - tanh((d - center) / width));
    }
}

/* Lorentzian/Cauchy: λ_d = μ(d) / (1 + (d/σ)²)
 * FT is exponential: e^{-2πσ|ξ|} */
static void amp_lorentz(double *lam, int R, int N) {
    double sigma = R / 3.0;
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double x = (double)d / sigma;
        lam[d] = mu_cache[d] / (1.0 + x * x);
    }
}

/* Sech²: λ_d = μ(d) · sech²(d/σ)
 * Derivative of tanh — sharper than sech, still exponential FT decay */
static void amp_sech2(double *lam, int R, int N) {
    double sigma = R / 2.0;
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) { lam[d] = 0; continue; }
        double c = cosh((double)d / sigma);
        lam[d] = mu_cache[d] / (c * c);
    }
}

typedef struct { const char *name; AmpFn fn; } AmpDef;
static AmpDef amps[] = {
    {"Selberg",    amp_selberg},
    {"Sharp",      amp_sharp},
    {"SmoothQuad", amp_smooth_quad},
    {"Cosine",     amp_cosine},
    {"LogSq",      amp_log_squared},
    {"Ramanujan",  amp_ramanujan},
    {"Gaussian",   amp_gaussian},
    {"Beurling",   amp_beurling},
    {"Sech",       amp_sech},
    {"Tanh",       amp_tanh},
    {"Lorentz",    amp_lorentz},
    {"Sech2",      amp_sech2},
};
#define N_AMPS (sizeof(amps)/sizeof(amps[0]))

/* Build ν(n) = (Σ_{d|n, d≤R} λ_d)² from amplifier-defined λ */
static void build_sieve_weights(double *weights, int N, int R, AmpFn fn) {
    double *lam = calloc(R + 1, sizeof(double));
    fn(lam, R, N);

    memset(weights, 0, (N + 1) * sizeof(double));
    for (int d = 1; d <= R; d++) {
        if (lam[d] == 0) continue;
        for (int n = d; n <= N; n += d)
            weights[n] += lam[d];
    }
    for (int n = 1; n <= N; n++)
        weights[n] = weights[n] * weights[n];

    free(lam);
}

int main(void) {
    fprintf(stderr, "Sieving to %d...\n", MAX_N);
    compute_mobius(MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 0};

    printf("══════════════════════════════════════════════════════════\n");
    printf("  ALL AMPLIFIERS — Minor Arc Scaling (Q=%d fixed)\n", FIXED_Q);
    printf("══════════════════════════════════════════════════════════\n\n");

    /* For each amplifier, collect (logN, logE) for power-law fit */
    double logN_all[20];
    double logE_all[N_AMPS][20];
    int n_pts = 0;

    /* Header */
    printf("  %8s", "N");
    for (int a = 0; a < (int)N_AMPS; a++) printf(" | %10s", amps[a].name);
    printf(" | %10s\n", "Prime");

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > MAX_N - 1) break;

        int R = (int)(sqrt((double)N) / log((double)N));
        if (R < 2) R = 2;

        fprintf(stderr, "  N=%d (R=%d)...\n", N, R);
        double normalizer = (double)N / log((double)N);
        logN_all[n_pts] = log((double)N);

        printf("  %8d", N);

        for (int a = 0; a < (int)N_AMPS; a++) {
            double *w = calloc(N + 1, sizeof(double));
            build_sieve_weights(w, N, R, amps[a].fn);
            double sup = minor_arc_sup(w, N, FIXED_Q);
            double E = sup / normalizer;
            logE_all[a][n_pts] = (E > 0) ? log(E) : -30;
            printf(" | %10.4f", E);
            free(w);
        }

        /* Prime baseline */
        double *pw = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= N; n++) if (!is_composite[n]) pw[n] = log((double)n);
        double sup_p = minor_arc_sup(pw, N, FIXED_Q);
        printf(" | %10.4f", sup_p / normalizer);
        free(pw);

        printf("\n");
        fflush(stdout);
        n_pts++;
    }

    /* Fit power laws */
    printf("\n  ═══ Power-Law Fits: E ≈ C · N^β ═══\n");
    printf("  %-12s | %8s | %8s | %s\n", "Amplifier", "β", "C", "Verdict");

    double best_beta = 999;
    const char *best_name = NULL;

    for (int a = 0; a < (int)N_AMPS; a++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<n_pts;i++){
            sx+=logN_all[i]; sy+=logE_all[a][i];
            sxx+=logN_all[i]*logN_all[i]; sxy+=logN_all[i]*logE_all[a][i];
        }
        double beta = (n_pts*sxy - sx*sy) / (n_pts*sxx - sx*sx);
        double C = exp((sy - beta*sx) / n_pts);

        const char *verdict = (beta < -0.01) ? "★ DECREASING" :
                              (beta < 0.05)  ? "~ FLAT" : "✗ INCREASING";
        printf("  %-12s | %8.4f | %8.4f | %s\n", amps[a].name, beta, C, verdict);

        if (beta < best_beta) { best_beta = beta; best_name = amps[a].name; }
    }

    printf("\n  Best: %s with β = %.4f\n", best_name, best_beta);
    if (best_beta < -0.01)
        printf("  ★ GO — %s achieves power-saving cancellation!\n", best_name);
    else
        printf("  ✗ NO-GO — No amplifier achieves power-saving.\n");

    free(mu_cache);
    free(is_composite);
    return 0;
}
