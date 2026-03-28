/*
 * algebraic_a1.c — A1: Vaughan Decomposition
 *
 * Split the prime generating function S(α) into pieces using Vaughan's
 * identity. Measure which piece carries the minor arc obstruction.
 *
 * Vaughan's identity (simplified): For cutoff U,
 *   Λ(n) = Λ₁(n) + Λ₂(n) + Λ₃(n)
 * where:
 *   Λ₁(n) = Λ(n)·𝟙(n ≤ U)    — "small" primes
 *   Λ₂(n) = Σ_{d|n,d≤U} μ(d)·log(n/d)·𝟙(n>U) — Type I (div structure)
 *   Λ₃(n) = Λ(n) - Λ₁(n) - Λ₂(n)  — Type II residual (bilinear)
 *
 * We compute S_k(α) = Σ Λ_k(n)·e(nα) and measure:
 *   sup_{minor} |S_k|     — which piece has largest minor arc presence
 *   sup_{minor} |S_k²|    — which squared piece dominates
 *   sup_{minor} |S_i·S_j| — cross terms
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   2000001
#define FIXED_Q 10
#define PI      3.14159265358979323846

static int8_t *mu_cache = NULL;
static char *is_composite = NULL;

static void compute_mobius(int max_n) {
    mu_cache = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int));
    for(int i=2;i<=max_n;i++) if(sp[i]==0) for(int j=i;j<=max_n;j+=i) if(sp[j]==0) sp[j]=i;
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

static double minor_sup_arr(double *re, double *im, int M, int Q, int N) {
    double s=0;
    for(int k=0;k<M;k++){if(is_major(k,M,Q,N))continue;
        double m=sqrt(re[k]*re[k]+im[k]*im[k]);if(m>s)s=m;}
    return s;
}

int main(void) {
    fprintf(stderr, "Sieving to %d...\n", MAX_N);
    compute_mobius(MAX_N);
    compute_primes(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {1000, 5000, 10000, 50000, 100000, 500000, 1000000, 0};

    printf("═══════════════════════════════════════════════════════════\n");
    printf("  A1: Vaughan Decomposition — Where Is the Obstruction?\n");
    printf("═══════════════════════════════════════════════════════════\n\n");

    printf("  Part 1: Linear pieces — sup |S_k(α)| on minor arcs\n\n");
    printf("  %8s | %6s | %10s | %10s | %10s | %10s\n",
           "N", "U", "S_full", "S_small", "S_typeI", "S_typeII");

    double logN_a[20];
    double logE_full[20], logE_small[20], logE_t1[20], logE_t2[20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx] != 0; idx++) {
        int N = test_Ns[idx];
        if (N > MAX_N - 1) break;

        int U = (int)sqrt((double)N);  /* Vaughan cutoff */
        int M = next_pow2(4 * N);
        double norm = (double)N / log((double)N);

        fprintf(stderr, "  N=%d, U=%d, M=%d...\n", N, U, M);

        /* Λ(n) — full von Mangoldt */
        double *Lambda = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= N; n++)
            if (!is_composite[n]) Lambda[n] = log((double)n);
        /* TODO: add prime powers Λ(p^k) = log(p) */

        /* Λ₁(n) = Λ(n)·𝟙(n ≤ U) — small primes */
        double *L1 = calloc(N + 1, sizeof(double));
        for (int n = 2; n <= U; n++) L1[n] = Lambda[n];

        /* Λ₂(n) = Σ_{d|n, d≤U} μ(d)·log(n/d), for n > U — Type I */
        double *L2 = calloc(N + 1, sizeof(double));
        for (int d = 1; d <= U; d++) {
            if (mu_cache[d] == 0) continue;
            for (int m = 1; (long long)d * m <= N; m++) {
                int n = d * m;
                if (n <= U) continue;  /* only n > U */
                L2[n] += mu_cache[d] * log((double)m);
            }
        }

        /* Λ₃(n) = Λ(n) - Λ₁(n) - Λ₂(n) — Type II residual */
        double *L3 = calloc(N + 1, sizeof(double));
        for (int n = 1; n <= N; n++) L3[n] = Lambda[n] - L1[n] - L2[n];

        /* Verify: Λ₁ + Λ₂ + Λ₃ = Λ */
        double maxerr = 0;
        for (int n = 1; n <= N; n++) {
            double err = fabs(L1[n] + L2[n] + L3[n] - Lambda[n]);
            if (err > maxerr) maxerr = err;
        }
        if (maxerr > 1e-8)
            fprintf(stderr, "    WARNING: decomposition error = %.2e\n", maxerr);

        /* FFT each piece */
        double *fRe = calloc(M,8), *fIm = calloc(M,8);  /* full */
        double *s1Re = calloc(M,8), *s1Im = calloc(M,8); /* small */
        double *s2Re = calloc(M,8), *s2Im = calloc(M,8); /* type I */
        double *s3Re = calloc(M,8), *s3Im = calloc(M,8); /* type II */

        for(int n=1;n<=N;n++) fRe[n]=Lambda[n];
        for(int n=1;n<=N;n++) s1Re[n]=L1[n];
        for(int n=1;n<=N;n++) s2Re[n]=L2[n];
        for(int n=1;n<=N;n++) s3Re[n]=L3[n];

        fft(fRe,fIm,M,1);
        fft(s1Re,s1Im,M,1);
        fft(s2Re,s2Im,M,1);
        fft(s3Re,s3Im,M,1);

        double sup_full  = minor_sup_arr(fRe,fIm,M,FIXED_Q,N);
        double sup_small = minor_sup_arr(s1Re,s1Im,M,FIXED_Q,N);
        double sup_t1    = minor_sup_arr(s2Re,s2Im,M,FIXED_Q,N);
        double sup_t2    = minor_sup_arr(s3Re,s3Im,M,FIXED_Q,N);

        double E_full  = sup_full / norm;
        double E_small = sup_small / norm;
        double E_t1    = sup_t1 / norm;
        double E_t2    = sup_t2 / norm;

        logN_a[npts] = log((double)N);
        logE_full[npts]  = log(E_full);
        logE_small[npts] = log(E_small);
        logE_t1[npts]    = log(E_t1);
        logE_t2[npts]    = log(E_t2);

        printf("  %8d | %6d | %10.4f | %10.4f | %10.4f | %10.4f\n",
               N, U, E_full, E_small, E_t1, E_t2);
        fflush(stdout);

        free(Lambda); free(L1); free(L2); free(L3);
        free(fRe);free(fIm);free(s1Re);free(s1Im);free(s2Re);free(s2Im);free(s3Re);free(s3Im);
        npts++;
    }

    /* Part 2: Which SQUARED piece dominates on minor arcs? */
    printf("\n  Part 2: Squared pieces — where does S² live on minor arcs?\n\n");
    printf("  %8s | %10s | %10s | %10s | %10s | %10s\n",
           "N", "S²_full", "S²_small", "S²_typeI", "S²_typeII", "cross");

    for (int idx = 0; test_Ns[idx] != 0; idx++) {
        int N = test_Ns[idx];
        if (N > MAX_N - 1) break;
        if (N > 200000) break; /* memory limit for squared spectra */

        int U = (int)sqrt((double)N);
        int M = next_pow2(4 * N);
        double norm2 = ((double)N / log((double)N)) * ((double)N / log((double)N));

        double *Lambda = calloc(N+1, sizeof(double));
        double *L1 = calloc(N+1, sizeof(double));
        double *L2 = calloc(N+1, sizeof(double));
        for (int n=2;n<=N;n++) if(!is_composite[n]) Lambda[n]=log((double)n);
        for (int n=2;n<=U;n++) L1[n]=Lambda[n];
        for (int d=1;d<=U;d++){if(mu_cache[d]==0)continue;
            for(int m=1;(long long)d*m<=N;m++){int n=d*m;if(n<=U)continue;
                L2[n]+=mu_cache[d]*log((double)m);}}

        /* FFT */
        double *fR=calloc(M,8),*fI=calloc(M,8);
        double *s1R=calloc(M,8),*s1I=calloc(M,8);
        double *s2R=calloc(M,8),*s2I=calloc(M,8);
        for(int n=1;n<=N;n++){fR[n]=Lambda[n];s1R[n]=L1[n];s2R[n]=L2[n];}
        fft(fR,fI,M,1); fft(s1R,s1I,M,1); fft(s2R,s2I,M,1);

        /* Compute |S_full|², |S_small|², |S_typeI|², and cross term */
        double sup_f2=0, sup_s12=0, sup_s22=0, sup_cross=0;
        for(int k=0;k<M;k++){
            if(is_major(k,M,FIXED_Q,N))continue;
            double mf = fR[k]*fR[k]+fI[k]*fI[k];
            double m1 = s1R[k]*s1R[k]+s1I[k]*s1I[k];
            double m2 = s2R[k]*s2R[k]+s2I[k]*s2I[k];
            /* Cross = 2·Re(S_small · conj(S_typeI)) */
            double cross = 2*fabs(s1R[k]*s2R[k]+s1I[k]*s2I[k]);
            if(mf>sup_f2) sup_f2=mf;
            if(m1>sup_s12) sup_s12=m1;
            if(m2>sup_s22) sup_s22=m2;
            if(cross>sup_cross) sup_cross=cross;
        }

        printf("  %8d | %10.4f | %10.4f | %10.4f | %10.4f | %10.4f\n",
               N, sup_f2/norm2, sup_s12/norm2, sup_s22/norm2,
               /* Type II = full - small - typeI - cross ≈ residual */
               (sup_f2-sup_s12-sup_s22)/norm2, sup_cross/norm2);

        free(Lambda);free(L1);free(L2);
        free(fR);free(fI);free(s1R);free(s1I);free(s2R);free(s2I);
    }

    /* Power law fits */
    printf("\n  ═══ Power-Law Fits (N ≥ 5000) ═══\n");
    const char *names[] = {"S_full", "S_small", "S_typeI", "S_typeII"};
    double *arrs[] = {logE_full, logE_small, logE_t1, logE_t2};
    for (int m = 0; m < 4; m++) {
        double sx=0,sy=0,sxx=0,sxy=0; int cnt=0;
        for(int i=0;i<npts;i++){
            if(test_Ns[i]<5000)continue;
            sx+=logN_a[i];sy+=arrs[m][i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];cnt++;
        }
        if(cnt<2)continue;
        double beta=(cnt*sxy-sx*sy)/(cnt*sxx-sx*sx);
        const char *v=(beta<-0.05)?"★★ DECREASING":(beta<-0.01)?"★ MILD DEC":(beta<0.05)?"~ FLAT":"✗ INCREASING";
        printf("  %-12s | β = %8.4f | %s\n", names[m], beta, v);
    }

    printf("\n  Key insight: whichever piece has the LARGEST sup AND the WORST β\n");
    printf("  is where the minor arc obstruction lives.\n");

    free(mu_cache); free(is_composite);
    return 0;
}
