/*
 * sieve_radical.c — RADICAL weight functions from unrelated math branches.
 *
 * Key insight: μ(d) dominates Fourier behavior. These approaches try to
 * bypass μ entirely or use fundamentally different constructions.
 *
 * 1. OptFlat: ν(n) = 1 + c·𝟙_prime(n) — trivial majorant, maximally smooth
 * 2. LogFlat: ν(n) = log(n)·𝟙_prime(n) + ε — von Mangoldt + floor
 * 3. Chebyshev: ν(n) = ψ(n)/n — normalized Chebyshev, exploits PNT
 * 4. RandomMult: μ(d) → random ±1 on primes — Monte Carlo average
 * 5. RamTau: Ramanujan τ-inspired multiplicative weights
 * 6. HarmonicSieve: λ_d = μ(d)/d — harmonic Möbius decay
 * 7. SmoothIndicator: ν(n) = exp(-1/(1-(n/N)²)) smoothed prime indicator
 * 8. WavePacket: ν(n) = Σ_p cos(2π·p·log(n)/log(N)) — spectral from primes
 *
 * Slope fit ignores N < 50000 per user request.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   5000001
#define FIXED_Q 10
#define PI      3.14159265358979323846
#define SLOPE_MIN_N 50000  /* Only fit slope for N ≥ this */

static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    for (int i = 2; i <= max_n; i++)
        if (sp[i] == 0) for (int j = i; j <= max_n; j += i) if (sp[j] == 0) sp[j] = i;
    mu_cache[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = sp[n]; if ((n/p)%p==0) mu_cache[n]=0; else mu_cache[n]=-mu_cache[n/p];
    }
    free(sp);
}

static void compute_primes(int max_n) {
    is_composite = calloc(max_n + 1, 1);
    is_composite[0] = is_composite[1] = 1;
    for (long long i = 2; i*i <= max_n; i++)
        if (!is_composite[i]) for (long long j = i*i; j <= max_n; j += i) is_composite[j] = 1;
}

static void fft(double *re, double *im, int n, int dir) {
    for (int i=1,j=0; i<n; i++) {
        int bit=n>>1; for(;j&bit;bit>>=1)j^=bit; j^=bit;
        if(i<j){double t;t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}
    }
    for (int len=2;len<=n;len<<=1) {
        double ang=2.0*PI/len*dir,wR=cos(ang),wI=sin(ang);
        for(int i=0;i<n;i+=len){double cR=1,cI=0;
            for(int j=0;j<len/2;j++){int u=i+j,v=i+j+len/2;
                double tR=cR*re[v]-cI*im[v],tI=cR*im[v]+cI*re[v];
                re[v]=re[u]-tR;im[v]=im[u]-tI;re[u]+=tR;im[u]+=tI;
                double nR=cR*wR-cI*wI;cI=cR*wI+cI*wR;cR=nR;}}
    }
    if(dir==-1) for(int i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
static int next_pow2(int n){int p=1;while(p<n)p<<=1;return p;}
static int gcd(int a,int b){while(b){int t=b;b=a%b;a=t;}return a;}
static int is_major(int k,int M,int Q,int N){
    double a=(double)k/M;
    for(int q=1;q<=Q;q++){double t=(double)Q/((double)q*N);
        for(int i=0;i<=q;i++){if(i>0&&i<q&&gcd(i,q)!=1)continue;
            double d=fabs(a-(double)i/q);if(d>0.5)d=1-d;if(d<t)return 1;}}
    return 0;
}
static double minor_sup(double*w,int N,int Q){
    int M=next_pow2(2*N);double*re=calloc(M,8),*im=calloc(M,8);
    for(int n=1;n<=N;n++)re[n]=w[n];fft(re,im,M,1);
    double s=0;for(int k=0;k<M;k++){if(is_major(k,M,Q,N))continue;
        double m=sqrt(re[k]*re[k]+im[k]*im[k]);if(m>s)s=m;}
    free(re);free(im);return s;
}

/* ═══ RADICAL WEIGHT FUNCTIONS ═══ */

typedef void (*WeightFn)(double *w, int N);

/* 1. OptFlat: ν(n) = 1 for composites, 2 for primes
 * Trivially majorizes prime indicator. Maximally smooth. */
static void wt_optflat(double *w, int N) {
    for (int n = 1; n <= N; n++)
        w[n] = is_composite[n] ? 1.0 : 2.0;
}

/* 2. LogFlat: ν(n) = log(n) for primes, 1 for composites
 * Matches the von Mangoldt weight at primes, flat floor elsewhere */
static void wt_logflat(double *w, int N) {
    for (int n = 1; n <= N; n++)
        w[n] = (!is_composite[n] && n >= 2) ? log((double)n) : 1.0;
}

/* 3. Chebyshev: ν(n) = Σ_{p≤n} log(p) / n ≈ 1 by PNT
 * Smooth, monotone, encodes cumulative prime distribution */
static void wt_chebyshev(double *w, int N) {
    double psi = 0;
    for (int n = 1; n <= N; n++) {
        if (!is_composite[n] && n >= 2) psi += log((double)n);
        w[n] = psi / (double)n;
    }
}

/* 4. RandomMult: average over K random multiplicative functions
 * f(p) = ±1 uniformly, f(mn) = f(m)f(n), ν(n) = (Σ_{d|n,d≤R} f(d))²
 * Harper (2013): random mult functions have better L² cancellation */
static void wt_randmult(double *w, int N) {
    int R = (int)(sqrt((double)N) / log((double)N));
    if (R < 2) R = 2;
    int K = 20; /* average over K trials */

    memset(w, 0, (N + 1) * sizeof(double));

    for (int trial = 0; trial < K; trial++) {
        /* Generate random multiplicative function */
        int8_t *f = calloc(R + 1, 1);
        f[1] = 1;
        for (int p = 2; p <= R; p++) {
            if (is_composite[p]) continue;
            int sign = (rand() % 2) ? 1 : -1;
            for (int pk = p; pk <= R; pk *= p)
                for (int m = 1; m * pk <= R; m++)
                    if (gcd(m, p) == 1 && f[m] != 0)
                        f[m * pk] = f[m] * sign;
        }
        /* Fix: simpler approach - just assign random ±1 to squarefree */
        memset(f, 0, (R + 1) * sizeof(int8_t));
        f[1] = 1;
        for (int d = 2; d <= R; d++) {
            if (mu_cache[d] == 0) continue;
            f[d] = (rand() % 2) ? 1 : -1;
        }

        /* Build weights */
        double *linear = calloc(N + 1, sizeof(double));
        double logR = log((double)R);
        for (int d = 1; d <= R; d++) {
            if (f[d] == 0) continue;
            double t = log((double)d) / logR;
            double P = (t <= 1.0) ? (1.0 - t) : 0.0;
            double lam = f[d] * P;
            for (int n = d; n <= N; n += d) linear[n] += lam;
        }
        for (int n = 1; n <= N; n++) w[n] += linear[n] * linear[n];
        free(linear);
        free(f);
    }
    for (int n = 1; n <= N; n++) w[n] /= K;
}

/* 5. HarmonicMob: λ_d = μ(d)/d — harmonic decay kills high-freq oscillation of μ */
static void wt_harmonic(double *w, int N) {
    int R = (int)(sqrt((double)N) / log((double)N));
    if (R < 2) R = 2;
    double *linear = calloc(N + 1, sizeof(double));
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) continue;
        double lam = (double)mu_cache[d] / (double)d;
        for (int n = d; n <= N; n += d) linear[n] += lam;
    }
    for (int n = 1; n <= N; n++) w[n] = linear[n] * linear[n];
    free(linear);
}

/* 6. WavePacket: ν(n) = (Σ_{p≤√N} cos(2π·log(n)/log(p)))²
 * Uses prime harmonics as a basis — spectral decomposition over primes */
static void wt_wavepacket(double *w, int N) {
    /* Collect small primes */
    int maxP = (int)sqrt((double)N);
    int *primes = calloc(maxP + 1, sizeof(int));
    int nPrimes = 0;
    for (int p = 2; p <= maxP; p++)
        if (!is_composite[p]) primes[nPrimes++] = p;

    for (int n = 1; n <= N; n++) {
        double sum = 0;
        double logn = log((double)n);
        for (int i = 0; i < nPrimes && i < 30; i++) { /* cap at 30 primes */
            sum += cos(2 * PI * logn / log((double)primes[i]));
        }
        w[n] = sum * sum / (30.0 * 30.0); /* normalize */
    }
    free(primes);
}

/* 7. EllipticCurve: weights from point counts of E: y²=x³-x over F_p
 * a_p = p + 1 - #E(F_p), satisfies |a_p| ≤ 2√p (Hasse bound)
 * Sato-Tate distributed, modular form coefficients */
static void wt_elliptic(double *w, int N) {
    for (int n = 1; n <= N; n++) {
        if (n < 2 || is_composite[n]) { w[n] = 1.0; continue; }
        /* For y² = x³ - x, compute #E(F_p) by brute force for small p */
        int p = n;
        if (p > 10000) { w[n] = 1.0; continue; } /* too expensive for large p */
        int count = 1; /* point at infinity */
        for (int x = 0; x < p; x++) {
            long long rhs = ((long long)x * x % p * x % p - x + p) % p;
            /* Count solutions y² ≡ rhs mod p */
            if (rhs == 0) { count++; continue; }
            /* Euler criterion: rhs^((p-1)/2) ≡ 1 mod p means QR */
            long long base = rhs, exp = (p - 1) / 2, result = 1;
            base %= p;
            while (exp > 0) {
                if (exp & 1) result = result * base % p;
                exp >>= 1; base = base * base % p;
            }
            if (result == 1) count += 2;
        }
        double a_p = (double)(p + 1 - count);
        /* Use (1 + a_p/(2√p))² as weight — centered near 1 */
        w[n] = 1.0 + a_p / (2.0 * sqrt((double)p));
        w[n] = w[n] * w[n];
    }
}

/* 8. Selberg (baseline for comparison) */
static void wt_selberg(double *w, int N) {
    int R = (int)(sqrt((double)N) / log((double)N));
    if (R < 2) R = 2;
    double logR = log((double)R);
    double *linear = calloc(N + 1, sizeof(double));
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) continue;
        double t = log((double)d) / logR;
        double lam = mu_cache[d] * ((t <= 1.0) ? (1.0 - t) : 0.0);
        for (int n = d; n <= N; n += d) linear[n] += lam;
    }
    for (int n = 1; n <= N; n++) w[n] = linear[n] * linear[n];
    free(linear);
}

typedef struct { const char *name; WeightFn fn; } WtDef;
static WtDef weights[] = {
    {"Selberg",    wt_selberg},
    {"OptFlat",    wt_optflat},
    {"LogFlat",    wt_logflat},
    {"Chebyshev",  wt_chebyshev},
    {"RandMult",   wt_randmult},
    {"Harmonic",   wt_harmonic},
    {"WavePkt",    wt_wavepacket},
    {"Elliptic",   wt_elliptic},
};
#define N_WT (sizeof(weights)/sizeof(weights[0]))

int main(void) {
    srand(42);
    fprintf(stderr, "Sieving to %d...\n", MAX_N);
    compute_mobius(MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 0};

    printf("══════════════════════════════════════════════════════\n");
    printf("  RADICAL WEIGHTS — Minor Arc Scaling (Q=%d)\n", FIXED_Q);
    printf("  Slope fit uses N ≥ %d only\n", SLOPE_MIN_N);
    printf("══════════════════════════════════════════════════════\n\n");

    double logN_all[20], logE_all[N_WT][20];
    int n_pts = 0;

    printf("  %8s", "N");
    for (int a = 0; a < (int)N_WT; a++) printf(" | %10s", weights[a].name);
    printf(" | %10s\n", "Prime");

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > MAX_N - 1) break;

        fprintf(stderr, "  N=%d...\n", N);
        double norm = (double)N / log((double)N);
        logN_all[n_pts] = log((double)N);

        printf("  %8d", N);
        for (int a = 0; a < (int)N_WT; a++) {
            double *w = calloc(N + 1, sizeof(double));
            weights[a].fn(w, N);
            double s = minor_sup(w, N, FIXED_Q);
            double E = s / norm;
            logE_all[a][n_pts] = (E > 1e-30) ? log(E) : -70;
            printf(" | %10.4f", E);
            free(w);
        }
        double *pw = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= N; n++) if (!is_composite[n]) pw[n] = log((double)n);
        printf(" | %10.4f", minor_sup(pw, N, FIXED_Q) / norm);
        free(pw);

        printf("\n"); fflush(stdout);
        n_pts++;
    }

    /* Fit slope only for N ≥ SLOPE_MIN_N */
    printf("\n  ═══ Power-Law Fits (N ≥ %d only) ═══\n", SLOPE_MIN_N);
    printf("  %-12s | %8s | %8s | %s\n", "Weight", "β", "C", "Verdict");

    double best_beta = 999;
    const char *best_name = NULL;

    for (int a = 0; a < (int)N_WT; a++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        int cnt = 0;
        for (int i = 0; i < n_pts; i++) {
            int N = test_Ns[i];
            if (N < SLOPE_MIN_N) continue;
            if (logE_all[a][i] < -50) continue;
            sx += logN_all[i]; sy += logE_all[a][i];
            sxx += logN_all[i]*logN_all[i]; sxy += logN_all[i]*logE_all[a][i];
            cnt++;
        }
        if (cnt < 3) { printf("  %-12s | %8s | %8s | insufficient data\n", weights[a].name, "-", "-"); continue; }
        double beta = (cnt*sxy - sx*sy) / (cnt*sxx - sx*sx);
        double C = exp((sy - beta*sx) / cnt);

        const char *v = (beta < -0.05) ? "★★ STRONGLY DECREASING" :
                        (beta < -0.01) ? "★ DECREASING" :
                        (beta < 0.05)  ? "~ FLAT" : "✗ INCREASING";
        printf("  %-12s | %8.4f | %8.4f | %s\n", weights[a].name, beta, C, v);
        if (beta < best_beta) { best_beta = beta; best_name = weights[a].name; }
    }

    printf("\n  Best: %s with β = %.4f\n", best_name, best_beta);
    if (best_beta < -0.05)
        printf("  ★★ BREAKTHROUGH — %s achieves strong power-saving!\n", best_name);
    else if (best_beta < -0.01)
        printf("  ★ PROMISING — %s shows mild power-saving, worth investigating.\n", best_name);
    else
        printf("  Wall persists across all radical constructions.\n");

    free(mu_cache); free(is_composite);
    return 0;
}
