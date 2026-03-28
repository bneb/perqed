/*
 * sieve_signed.c — SIGNED weight functions (ν(n) can be negative).
 *
 * The uncertainty principle says: ν ≥ 0 ⟹ ν̂ can't have compact support.
 * By allowing ν < 0 at some composites, we can directly control the
 * Fourier spectrum — potentially zeroing out minor arc components.
 *
 * Approaches:
 * 1. BandLimit: ν = prime indicator convolved with sinc (compact FT support)
 * 2. FourierProj: FFT prime indicator, zero minor arcs, IFFT back
 * 3. SignedSieve: Selberg sieve but WITHOUT squaring (allows negative)
 * 4. MajorOnly: project onto major arc Fourier space
 *
 * Key metric: E = sup_{minor} |ν̂(α)| / (N/logN)
 * If E ≈ 0 by construction, we verify that ν still "sees" the primes:
 *   Correlation = Σ_p ν(p) / Σ_p 1
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   5000001
#define FIXED_Q 10
#define PI      3.14159265358979323846
#define SLOPE_MIN_N 50000

static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    for (int i=2;i<=max_n;i++) if(sp[i]==0) for(int j=i;j<=max_n;j+=i) if(sp[j]==0)sp[j]=i;
    mu_cache[1]=1;
    for(int n=2;n<=max_n;n++){int p=sp[n];if((n/p)%p==0)mu_cache[n]=0;else mu_cache[n]=-mu_cache[n/p];}
    free(sp);
}
static void compute_primes(int max_n) {
    is_composite = calloc(max_n + 1, 1);
    is_composite[0]=is_composite[1]=1;
    for(long long i=2;i*i<=max_n;i++) if(!is_composite[i]) for(long long j=i*i;j<=max_n;j+=i) is_composite[j]=1;
}

static void fft(double *re, double *im, int n, int dir) {
    for(int i=1,j=0;i<n;i++){int b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;
        if(i<j){double t;t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(int l=2;l<=n;l<<=1){double a=2.0*PI/l*dir,wR=cos(a),wI=sin(a);
        for(int i=0;i<n;i+=l){double cR=1,cI=0;
            for(int j=0;j<l/2;j++){int u=i+j,v=i+j+l/2;
                double tR=cR*re[v]-cI*im[v],tI=cR*im[v]+cI*re[v];
                re[v]=re[u]-tR;im[v]=im[u]-tI;re[u]+=tR;im[u]+=tI;
                double nR=cR*wR-cI*wI;cI=cR*wI+cI*wR;cR=nR;}}}
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

typedef struct {
    double sup_minor;
    double prime_corr;   /* Σ_p ν(p) / π(N) — measures if ν "sees" primes */
    double neg_frac;     /* fraction of n where ν(n) < 0 */
} Result;

static Result analyze(double *w, int N, int Q) {
    int M = next_pow2(2*N);
    double *re=calloc(M,8),*im=calloc(M,8);
    for(int n=1;n<=N;n++) re[n]=w[n];
    fft(re,im,M,1);

    double sup=0;
    for(int k=0;k<M;k++){
        if(is_major(k,M,Q,N))continue;
        double m=sqrt(re[k]*re[k]+im[k]*im[k]);
        if(m>sup)sup=m;
    }
    free(re);free(im);

    double corr=0; int pc=0;
    for(int n=2;n<=N;n++) if(!is_composite[n]){corr+=w[n];pc++;}
    double neg=0;
    for(int n=1;n<=N;n++) if(w[n]<0) neg++;

    Result r = {sup, (pc>0)?corr/pc:0, neg/N};
    return r;
}

/* ═══ SIGNED WEIGHT CONSTRUCTIONS ═══ */

/* 1. BandLimit: convolve prime indicator with sinc of bandwidth h
 *    ν(n) = Σ_p log(p) · sinc(π(n-p)/h)
 *    FT: ν̂(α) = S(α) · rect(hα) — exactly zero for |α| > 1/(2h) */
static void wt_bandlimit(double *w, int N, int bandwidth) {
    int h = bandwidth;
    for (int n = 1; n <= N; n++) {
        double sum = 0;
        /* Only sum over primes within ~3h of n (sinc decays) */
        int lo = (n - 3*h > 2) ? n - 3*h : 2;
        int hi = (n + 3*h < N) ? n + 3*h : N;
        for (int p = lo; p <= hi; p++) {
            if (is_composite[p]) continue;
            double x = PI * (double)(n - p) / h;
            double sinc = (fabs(x) < 1e-10) ? 1.0 : sin(x) / x;
            sum += log((double)p) * sinc;
        }
        w[n] = sum;
    }
}

/* 2. FourierProj: FFT prime indicator, zero out minor arcs, IFFT back
 *    By construction: sup_minor |ν̂| = 0 (exactly!)
 *    Question: does Σ_p ν(p) remain positive? */
static void wt_fourier_proj(double *w, int N, int Q) {
    int M = next_pow2(2*N);
    double *re=calloc(M,8),*im=calloc(M,8);
    /* Prime indicator weighted by log */
    for(int n=2;n<=N;n++) if(!is_composite[n]) re[n]=log((double)n);
    fft(re,im,M,1);
    /* Zero out minor arcs */
    for(int k=0;k<M;k++){
        if(!is_major(k,M,Q,N)){re[k]=0;im[k]=0;}
    }
    /* IFFT back */
    fft(re,im,M,-1);
    for(int n=1;n<=N;n++) w[n]=re[n];
    free(re);free(im);
}

/* 3. SignedSieve: Selberg linear form WITHOUT squaring
 *    ν(n) = Σ_{d|n, d≤R} μ(d)·(1-log(d)/log(R))
 *    Can be negative! But has better Fourier behavior. */
static void wt_signed_sieve(double *w, int N) {
    int R = (int)(sqrt((double)N) / log((double)N));
    if (R < 2) R = 2;
    double logR = log((double)R);
    for (int d = 1; d <= R; d++) {
        if (mu_cache[d] == 0) continue;
        double t = log((double)d) / logR;
        double lam = mu_cache[d] * ((t<=1.0)?(1.0-t):0.0);
        for (int n = d; n <= N; n += d) w[n] += lam;
    }
}

/* 4. SquaredSieve (baseline — positive) */
static void wt_squared_sieve(double *w, int N) {
    wt_signed_sieve(w, N);
    for (int n = 1; n <= N; n++) w[n] = w[n] * w[n];
}

/* 5. AdaptiveBand: use prime density to set local bandwidth
 *    Wider kernel in prime deserts, narrow near twin primes */
static void wt_adaptive(double *w, int N) {
    /* Precompute local prime density in windows */
    int win = 50;
    for (int n = 1; n <= N; n++) {
        int lo = (n-win > 2) ? n-win : 2;
        int hi = (n+win < N) ? n+win : N;
        int cnt = 0;
        for (int k = lo; k <= hi; k++) if (!is_composite[k]) cnt++;
        double density = (double)cnt / (hi - lo + 1);
        /* bandwidth inversely proportional to density */
        int h = (density > 0.01) ? (int)(5.0 / density) : 500;
        if (h < 5) h = 5;
        if (h > 500) h = 500;

        /* Gaussian kernel convolution */
        double sum = 0, wsum = 0;
        for (int p = lo; p <= hi; p++) {
            if (is_composite[p]) continue;
            double dx = (double)(n - p) / h;
            double kern = exp(-dx * dx / 2.0);
            sum += log((double)p) * kern;
            wsum += kern;
        }
        w[n] = (wsum > 0) ? sum / wsum : 0;
    }
}

int main(void) {
    srand(42);
    fprintf(stderr, "Sieving to %d...\n", MAX_N);
    compute_mobius(MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {1000, 5000, 10000, 50000, 100000, 500000, 1000000, 0};

    printf("══════════════════════════════════════════════════════════\n");
    printf("  SIGNED WEIGHTS — Bypassing Uncertainty Principle\n");
    printf("══════════════════════════════════════════════════════════\n\n");

    /* For each N, test all approaches */
    printf("  %8s | Method        | %10s | %10s | %8s | %8s\n",
           "N", "E_value", "sup_minor", "corr", "neg%%");

    double logN_a[20], logE_a[6][20]; /* up to 6 methods */
    int npts = 0;

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > MAX_N - 1) break;
        fprintf(stderr, "  N=%d...\n", N);
        double norm = (double)N / log((double)N);
        logN_a[npts] = log((double)N);

        /* Method 0: Squared sieve (positive baseline) */
        {
            double *w = calloc(N+1, 8);
            wt_squared_sieve(w, N);
            Result r = analyze(w, N, FIXED_Q);
            double E = r.sup_minor / norm;
            logE_a[0][npts] = log(E);
            printf("  %8d | SquaredSieve  | %10.5f | %10.2f | %8.3f | %7.1f%%\n",
                   N, E, r.sup_minor, r.prime_corr, r.neg_frac*100);
            free(w);
        }

        /* Method 1: Signed sieve (no squaring) */
        {
            double *w = calloc(N+1, 8);
            wt_signed_sieve(w, N);
            Result r = analyze(w, N, FIXED_Q);
            double E = r.sup_minor / norm;
            logE_a[1][npts] = log(E);
            printf("  %8s | SignedSieve   | %10.5f | %10.2f | %8.3f | %7.1f%%\n",
                   "", E, r.sup_minor, r.prime_corr, r.neg_frac*100);
            free(w);
        }

        /* Method 2: Fourier projection (minor arcs zeroed by construction) */
        {
            double *w = calloc(N+1, 8);
            wt_fourier_proj(w, N, FIXED_Q);
            Result r = analyze(w, N, FIXED_Q);
            double E = r.sup_minor / norm;
            logE_a[2][npts] = (E > 1e-30) ? log(E) : -70;
            printf("  %8s | FourierProj   | %10.5f | %10.2f | %8.3f | %7.1f%%\n",
                   "", E, r.sup_minor, r.prime_corr, r.neg_frac*100);
            free(w);
        }

        /* Method 3: Band-limited kernel (h = logN) */
        if (N <= 100000) {  /* O(N·h) cost */
            double *w = calloc(N+1, 8);
            int h = (int)(log((double)N) * 5);
            wt_bandlimit(w, N, h);
            Result r = analyze(w, N, FIXED_Q);
            double E = r.sup_minor / norm;
            logE_a[3][npts] = (E > 1e-30) ? log(E) : -70;
            printf("  %8s | BandLimit(h=%d) | %10.5f | %10.2f | %8.3f | %7.1f%%\n",
                   "", h, E, r.sup_minor, r.prime_corr, r.neg_frac*100);
            free(w);
        } else {
            logE_a[3][npts] = -70;
            printf("  %8s | BandLimit     | %10s | %10s | %8s | (skipped — O(N·h))\n",
                   "", "-", "-", "-");
        }

        printf("\n");
        npts++;
    }

    /* Fit slopes for N ≥ 50K */
    printf("  ═══ Power-Law Fits (N ≥ %d) ═══\n", SLOPE_MIN_N);
    const char *names[] = {"SquaredSieve", "SignedSieve", "FourierProj", "BandLimit"};
    for (int m = 0; m < 4; m++) {
        double sx=0,sy=0,sxx=0,sxy=0; int cnt=0;
        for(int i=0;i<npts;i++){
            if(test_Ns[i]<SLOPE_MIN_N)continue;
            if(logE_a[m][i]<-50)continue;
            sx+=logN_a[i];sy+=logE_a[m][i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE_a[m][i];cnt++;
        }
        if(cnt<2){printf("  %-14s | insufficient data\n",names[m]);continue;}
        double b=(cnt*sxy-sx*sy)/(cnt*sxx-sx*sx);
        const char *v = (b<-0.05)?"★★ STRONGLY DECREASING":(b<-0.01)?"★ DECREASING":(b<0.05)?"~ FLAT":"✗ INCREASING";
        printf("  %-14s | β = %8.4f | %s\n", names[m], b, v);
    }

    free(mu_cache); free(is_composite);
    return 0;
}
