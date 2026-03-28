/*
 * algebraic_a5.c — A5: Third Variable Injection
 *
 * Core question: Does adding a trivial third variable to the binary sum
 * give ternary-like minor arc cancellation?
 *
 * Binary Goldbach: r₂(E) = Σ_{p+q=E} Λ(p)Λ(q) = ∫ S(α)² e(-Eα) dα
 * Ternary Goldbach: r₃(E) = ∫ S(α)³ e(-Eα) dα   ← THIS works (Helfgott)
 *
 * Injected ternary approaches:
 *   T1: r(E) = Σ_{p+q+m=E} Λ(p)Λ(q)·1     = ∫ S²·T e(-Eα) dα  (T=Σe(nα))
 *   T2: r(E) = Σ_{p+q+m=E} Λ(p)Λ(q)·Λ(m)/Λ(m)  (weighted third)
 *   T3: r(E) = Σ_{p+q+m²=E} Λ(p)Λ(q)       = ∫ S²·Q e(-Eα) dα  (Q=Σe(m²α))
 *   T4: r(E) = Σ_{p+q+2k=E} Λ(p)Λ(q)       = ∫ S²·D e(-Eα) dα  (D=Σe(2kα))
 *
 * We measure E_k = sup_{minor} |S^k · X| / normalizer for each.
 * If β < 0 for any injected version while β > 0 for pure binary, that's a breakthrough.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   2000001
#define FIXED_Q 10
#define PI      3.14159265358979323846

static char *is_composite = NULL;

static void compute_primes(int max_n) {
    is_composite = calloc(max_n + 1, 1);
    is_composite[0] = is_composite[1] = 1;
    for (long long i = 2; i*i <= max_n; i++)
        if (!is_composite[i]) for (long long j = i*i; j <= max_n; j += i) is_composite[j] = 1;
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

/* Compute FFT of a weight sequence, return complex spectrum */
static void compute_spectrum(double *w, int N, int M, double *re, double *im) {
    memset(re, 0, M * sizeof(double));
    memset(im, 0, M * sizeof(double));
    for (int n = 1; n <= N; n++) re[n] = w[n];
    fft(re, im, M, 1);
}

/* Measure sup_{minor} of a complex spectrum */
static double minor_sup_spectrum(double *re, double *im, int M, int Q, int N) {
    double sup = 0;
    for (int k = 0; k < M; k++) {
        if (is_major(k, M, Q, N)) continue;
        double mag = sqrt(re[k]*re[k] + im[k]*im[k]);
        if (mag > sup) sup = mag;
    }
    return sup;
}

/* Complex multiply: (a+bi)(c+di) = (ac-bd) + (ad+bc)i */
static void cmul(double *outR, double *outI, 
                 const double *aR, const double *aI,
                 const double *bR, const double *bI, int M) {
    for (int k = 0; k < M; k++) {
        outR[k] = aR[k]*bR[k] - aI[k]*bI[k];
        outI[k] = aR[k]*bI[k] + aI[k]*bR[k];
    }
}

int main(void) {
    fprintf(stderr, "Computing primes to %d...\n", MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {500, 1000, 2000, 5000, 10000, 20000, 50000, 
                     100000, 200000, 500000, 1000000, 0};

    printf("════════════════════════════════════════════════════════════════\n");
    printf("  A5: Third Variable Injection — Binary vs Ternary Scaling\n");
    printf("════════════════════════════════════════════════════════════════\n\n");
    printf("  %8s | %10s | %10s | %10s | %10s | %10s | %10s\n",
           "N", "E(S²)", "E(S³)", "E(S²·T)", "E(S²·Q)", "E(S²·D)", "E(S²·P)");

    double logN_a[20];
    double logE_s2[20], logE_s3[20], logE_s2t[20], logE_s2q[20], logE_s2d[20], logE_s2p[20];
    int npts = 0;

    for (int i = 0; test_Ns[i] != 0; i++) {
        int N = test_Ns[i];
        if (N > MAX_N - 1) break;

        int M = next_pow2(4 * N);
        fprintf(stderr, "  N=%d (M=%d)...\n", N, M);

        /* S(α) = Σ_{p≤N} log(p) · e(pα) — prime generating function */
        double *Sre = calloc(M, 8), *Sim = calloc(M, 8);
        for (int n = 2; n <= N; n++)
            if (!is_composite[n]) Sre[n] = log((double)n);
        fft(Sre, Sim, M, 1);

        /* T(α) = Σ_{n=1}^{N} e(nα) — ALL integers */
        double *Tre = calloc(M, 8), *Tim = calloc(M, 8);
        for (int n = 1; n <= N; n++) Tre[n] = 1.0;
        fft(Tre, Tim, M, 1);

        /* Q(α) = Σ_{m²≤N} e(m²α) — squares */
        double *Qre = calloc(M, 8), *Qim = calloc(M, 8);
        for (int m = 1; m*m <= N; m++) Qre[m*m] = 1.0;
        fft(Qre, Qim, M, 1);

        /* D(α) = Σ_{k=1}^{N/2} e(2kα) — even numbers */
        double *Dre = calloc(M, 8), *Dim = calloc(M, 8);
        for (int k = 1; 2*k <= N; k++) Dre[2*k] = 1.0;
        fft(Dre, Dim, M, 1);

        /* P(α) = S(α) itself — third variable is ALSO a prime */
        /* (This is genuine ternary Goldbach's S³) */

        /* Compute products */
        /* S² */
        double *S2r = calloc(M, 8), *S2i = calloc(M, 8);
        cmul(S2r, S2i, Sre, Sim, Sre, Sim, M);

        /* S³ = S² · S */
        double *S3r = calloc(M, 8), *S3i = calloc(M, 8);
        cmul(S3r, S3i, S2r, S2i, Sre, Sim, M);

        /* S² · T (inject all integers) */
        double *S2Tr = calloc(M, 8), *S2Ti = calloc(M, 8);
        cmul(S2Tr, S2Ti, S2r, S2i, Tre, Tim, M);

        /* S² · Q (inject squares) */
        double *S2Qr = calloc(M, 8), *S2Qi = calloc(M, 8);
        cmul(S2Qr, S2Qi, S2r, S2i, Qre, Qim, M);

        /* S² · D (inject evens) */
        double *S2Dr = calloc(M, 8), *S2Di = calloc(M, 8);
        cmul(S2Dr, S2Di, S2r, S2i, Dre, Dim, M);

        /* S² · P = S³ (inject primes — same as ternary) */

        /* Measure sup on minor arcs */
        double sup_s2  = minor_sup_spectrum(S2r, S2i, M, FIXED_Q, N);
        double sup_s3  = minor_sup_spectrum(S3r, S3i, M, FIXED_Q, N);
        double sup_s2t = minor_sup_spectrum(S2Tr, S2Ti, M, FIXED_Q, N);
        double sup_s2q = minor_sup_spectrum(S2Qr, S2Qi, M, FIXED_Q, N);
        double sup_s2d = minor_sup_spectrum(S2Dr, S2Di, M, FIXED_Q, N);

        /* Normalizers */
        double piN = (double)N / log((double)N);  /* π(N) ≈ N/logN */
        double norm_s2  = piN * piN;               /* S² ~ (N/logN)² */
        double norm_s3  = piN * piN * piN;          /* S³ ~ (N/logN)³ */
        double norm_s2t = piN * piN * N;            /* S²·T ~ (N/logN)²·N */
        double norm_s2q = piN * piN * sqrt((double)N); /* S²·Q ~ (N/logN)²·√N */
        double norm_s2d = piN * piN * N / 2;        /* S²·D ~ (N/logN)²·N/2 */

        double E_s2  = sup_s2  / norm_s2;
        double E_s3  = sup_s3  / norm_s3;
        double E_s2t = sup_s2t / norm_s2t;
        double E_s2q = sup_s2q / norm_s2q;
        double E_s2d = sup_s2d / norm_s2d;
        double E_s2p = E_s3;  /* S²·P = S³ */

        logN_a[npts] = log((double)N);
        logE_s2[npts]  = log(E_s2);
        logE_s3[npts]  = log(E_s3);
        logE_s2t[npts] = log(E_s2t);
        logE_s2q[npts] = log(E_s2q);
        logE_s2d[npts] = log(E_s2d);
        logE_s2p[npts] = log(E_s2p);

        printf("  %8d | %10.5f | %10.5f | %10.5f | %10.5f | %10.5f | %10.5f\n",
               N, E_s2, E_s3, E_s2t, E_s2q, E_s2d, E_s2p);
        fflush(stdout);

        free(Sre);free(Sim);free(Tre);free(Tim);free(Qre);free(Qim);
        free(Dre);free(Dim);free(S2r);free(S2i);free(S3r);free(S3i);
        free(S2Tr);free(S2Ti);free(S2Qr);free(S2Qi);free(S2Dr);free(S2Di);
        npts++;
    }

    /* Power law fits for N ≥ 5000 */
    printf("\n  ═══ Power-Law Fits (N ≥ 5000) ═══\n");
    const char *names[] = {"S²(binary)", "S³(ternary)", "S²·T(all int)", 
                           "S²·Q(squares)", "S²·D(evens)", "S²·P(primes)"};
    double *logE_arr[] = {logE_s2, logE_s3, logE_s2t, logE_s2q, logE_s2d, logE_s2p};

    for (int m = 0; m < 6; m++) {
        double sx=0,sy=0,sxx=0,sxy=0; int cnt=0;
        for (int i = 0; i < npts; i++) {
            if (test_Ns[i] < 5000) continue;
            sx += logN_a[i]; sy += logE_arr[m][i];
            sxx += logN_a[i]*logN_a[i]; sxy += logN_a[i]*logE_arr[m][i];
            cnt++;
        }
        if (cnt < 2) continue;
        double beta = (cnt*sxy - sx*sy) / (cnt*sxx - sx*sx);
        const char *v = (beta < -0.15) ? "★★★ STRONG DECREASE" :
                        (beta < -0.05) ? "★★ DECREASING" :
                        (beta < -0.01) ? "★ MILD DECREASE" :
                        (beta < 0.05)  ? "~ FLAT" : "✗ INCREASING";
        printf("  %-18s | β = %8.4f | %s\n", names[m], beta, v);
    }

    free(is_composite);
    return 0;
}
