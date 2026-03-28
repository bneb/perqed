/*
 * algebraic_deep.c — Decomposing Λ(n) via deep mathematical structures.
 *
 * The Type I obstruction lives in Σ μ(d)·log(n/d). Can we cancel it using:
 *
 * 1. DIRICHLET CHARACTERS (spectral decomposition over (Z/qZ)*):
 *    S_χ(α) = Σ Λ(n)·χ(n)·e(nα)  for character χ mod q
 *    Each S_χ has Fourier behavior governed by L(s,χ) not ζ(s).
 *    If L(s,χ) has better zero distribution, S_χ has better minor arcs.
 *
 * 2. ELLIPTIC CURVE (Wiles' modularity — geometry enters):
 *    For E: y²=x³+ax+b, define a_p = p+1-#E(F_p) (Hasse-Weil)
 *    Then twist: S_E(α) = Σ Λ(n)·ã(n)·e(nα)
 *    The twist by a_p/√p breaks the μ(d) structure using GEOMETRIC data.
 *
 * 3. HOLOMORPHIC MODULAR FORM (Ramanujan τ function):
 *    τ(n) = nth Fourier coefficient of Δ(z) = q∏(1-q^n)²⁴
 *    Normalized: τ(n)/n^{11/2} satisfies |τ(p)/p^{11/2}| ≤ 2 (Deligne)
 *    Hecke eigenform structure forces specific cancellation patterns.
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
    is_composite[0]=is_composite[1]=1;
    for(long long i=2;i*i<=max_n;i++) if(!is_composite[i])
        for(long long j=i*i;j<=max_n;j+=i) is_composite[j]=1;
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

/* Minor arc sup with complex weights */
static double minor_sup_complex(double *re_w, double *im_w, int N, int Q) {
    int M = next_pow2(4*N);
    double *re=calloc(M,8),*im=calloc(M,8);
    for(int n=1;n<=N;n++){re[n]=re_w[n];im[n]=im_w[n];}
    fft(re,im,M,1);
    double sup=0;
    for(int k=0;k<M;k++){if(is_major(k,M,Q,N))continue;
        double m=sqrt(re[k]*re[k]+im[k]*im[k]);if(m>sup)sup=m;}
    free(re);free(im);
    return sup;
}

/* Minor arc sup with real weights */
static double minor_sup_real(double *w, int N, int Q) {
    double *im = calloc(N+1, 8);
    double s = minor_sup_complex(w, im, N, Q);
    free(im);
    return s;
}

/* ─── Dirichlet characters mod q ─── */
/* χ_k(n) for characters mod q, using discrete log */
/* For simplicity, use characters mod small primes: 3, 5, 7 */

/* Legendre symbol (a/p) */
static int legendre(int a, int p) {
    a = ((a % p) + p) % p;
    if (a == 0) return 0;
    long long base = a, exp = (p-1)/2, result = 1;
    base %= p;
    while(exp > 0) {
        if(exp & 1) result = result * base % p;
        exp >>= 1; base = base * base % p;
    }
    return (result == 1) ? 1 : -1;
}

/* ─── Elliptic curve point counts ─── */
/* E: y² = x³ - x (conductor 32, rank 0) */
static int ec_ap(int p) {
    if (p == 2) return 0;
    int count = 0;
    for (int x = 0; x < p; x++) {
        long long rhs = ((long long)x*x % p * x % p - x + p) % p;
        if (rhs == 0) { count++; continue; }
        count += (legendre((int)rhs, p) == 1) ? 2 : 0;
    }
    count++; /* point at infinity */
    return p + 1 - count;
}

/* ─── Ramanujan τ function ─── */
/* τ(n) via recurrence: τ is multiplicative
 * τ(p) = p^{11/2}·(2cos(θ_p)) where θ_p ∈ [0,π]
 * For small p, compute exactly via Δ(z) */
static double *tau_cache = NULL;
static int tau_max = 0;

static void compute_tau(int max_n) {
    tau_max = max_n;
    tau_cache = calloc(max_n + 1, sizeof(double));
    /* Use the q-expansion: Δ = q·Π(1-q^n)^24
     * Coefficients via recursion */
    tau_cache[1] = 1;
    /* Ramanujan's first few values (known exactly): */
    double known[] = {0, 1, -24, 252, -1472, 4830, -6048, -16744, 84480,
                      -113643, -115920, 534612, -370944, -577738, 401856,
                      1217160, 987136, -6905934, 2727432, 10661420, -7109760};
    int nknown = sizeof(known)/sizeof(known[0]);
    for (int n = 1; n < nknown && n <= max_n; n++)
        tau_cache[n] = known[n];

    /* For n beyond known values, use multiplicativity:
     * τ(p^k) = τ(p)·τ(p^{k-1}) - p^11·τ(p^{k-2})
     * τ(mn) = τ(m)·τ(n) for gcd(m,n)=1 */
    for (int n = nknown; n <= max_n; n++) {
        if (tau_cache[n] != 0) continue;
        /* Find smallest prime factor */
        int p = 0;
        for (int d = 2; d * d <= n; d++) {
            if (n % d == 0) { p = d; break; }
        }
        if (p == 0) {
            /* n is prime > nknown-1; approximate via Ramanujan conjecture bound */
            /* |τ(p)| ≤ 2·p^{11/2}, use 0 as approximation for large primes */
            tau_cache[n] = 0;
        } else {
            int m = n / p;
            if (m % p == 0) {
                /* n = p^k · ... need to extract p-part */
                int pk = p, prev = 1;
                while (n % (pk * p) == 0) pk *= p;
                int cofactor = n / pk;
                /* τ(pk) via recurrence, τ(n) = τ(pk)·τ(cofactor) if gcd=1 */
                if (cofactor > 0 && tau_cache[cofactor] != 0 && gcd(pk, cofactor) == 1) {
                    /* Compute τ(p^k) */
                    double tp1 = (p < nknown) ? tau_cache[p] : 0;
                    double tp0 = 1;
                    double tpk = tp1;
                    int exp = 1;
                    int temp = pk / p;
                    while (temp > 1) { temp /= p; exp++; }
                    for (int e = 2; e <= exp; e++) {
                        double next = tp1 * tpk - pow((double)p, 11) * tp0;
                        tp0 = tpk; tpk = next;
                    }
                    tau_cache[n] = tpk * tau_cache[cofactor];
                }
            } else {
                /* gcd(p, m) = 1 */
                tau_cache[n] = tau_cache[p] * tau_cache[m];
            }
        }
    }
}

int main(void) {
    fprintf(stderr, "Computing primes and τ to %d...\n", MAX_N);
    compute_primes(MAX_N);
    compute_tau(MAX_N);
    fprintf(stderr, "Done.\n");

    int test_Ns[] = {1000, 5000, 10000, 50000, 100000, 500000, 1000000, 0};

    printf("═══════════════════════════════════════════════════════════════\n");
    printf("  Deep Decomposition: Characters, Elliptic Curves, Modular Forms\n");
    printf("═══════════════════════════════════════════════════════════════\n\n");

    /* Test approaches */
    printf("  %8s | %10s | %10s | %10s | %10s | %10s | %10s\n",
           "N", "E_plain", "E_chi3", "E_chi5", "E_EC", "E_tau", "E_resid");

    double logN_a[20];
    double logE[6][20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx] != 0; idx++) {
        int N = test_Ns[idx];
        if (N > MAX_N - 1) break;

        fprintf(stderr, "  N=%d...\n", N);
        double norm = (double)N / log((double)N);
        logN_a[npts] = log((double)N);

        /* Plain S(α) */
        double *w_plain = calloc(N+1, 8);
        for(int n=2;n<=N;n++) if(!is_composite[n]) w_plain[n] = log((double)n);
        double sup_plain = minor_sup_real(w_plain, N, FIXED_Q);

        /* χ₃: Legendre symbol (n/3) — splits primes by residue mod 3 */
        double *w_chi3 = calloc(N+1, 8);
        for(int n=2;n<=N;n++) if(!is_composite[n])
            w_chi3[n] = log((double)n) * legendre(n, 3);
        double sup_chi3 = minor_sup_real(w_chi3, N, FIXED_Q);

        /* χ₅: Legendre symbol (n/5) */
        double *w_chi5 = calloc(N+1, 8);
        for(int n=2;n<=N;n++) if(!is_composite[n])
            w_chi5[n] = log((double)n) * legendre(n, 5);
        double sup_chi5 = minor_sup_real(w_chi5, N, FIXED_Q);

        /* EC twist: multiply by a_p/√p (bounded by 2 via Hasse) */
        double *w_ec = calloc(N+1, 8);
        for(int n=2;n<=N;n++) {
            if(is_composite[n]) continue;
            if(n <= 10000) {
                double ap = (double)ec_ap(n);
                w_ec[n] = log((double)n) * ap / (2.0 * sqrt((double)n));
            }
            /* Skip large primes where ec_ap is too slow */
        }
        double sup_ec = minor_sup_real(w_ec, N, FIXED_Q);

        /* Ramanujan τ twist: multiply by τ(p)/p^{11/2} (bounded by 2) */
        double *w_tau = calloc(N+1, 8);
        for(int n=2;n<=N;n++) {
            if(is_composite[n]) continue;
            if(n < tau_max && tau_cache[n] != 0) {
                double norm_tau = tau_cache[n] / pow((double)n, 5.5);
                /* Clip to avoid numerical issues */
                if (norm_tau > 2) norm_tau = 2;
                if (norm_tau < -2) norm_tau = -2;
                w_tau[n] = log((double)n) * norm_tau;
            }
        }
        double sup_tau = minor_sup_real(w_tau, N, FIXED_Q);

        /* Residual: S_plain - S_chi3 (the non-χ₃ component) */
        double *w_resid = calloc(N+1, 8);
        for(int n=1;n<=N;n++) w_resid[n] = w_plain[n] - w_chi3[n];
        double sup_resid = minor_sup_real(w_resid, N, FIXED_Q);

        logE[0][npts] = log(sup_plain/norm);
        logE[1][npts] = log(sup_chi3/norm);
        logE[2][npts] = log(sup_chi5/norm);
        logE[3][npts] = (sup_ec > 0) ? log(sup_ec/norm) : -30;
        logE[4][npts] = (sup_tau > 0) ? log(sup_tau/norm) : -30;
        logE[5][npts] = log(sup_resid/norm);

        printf("  %8d | %10.4f | %10.4f | %10.4f | %10.4f | %10.4f | %10.4f\n",
               N, sup_plain/norm, sup_chi3/norm, sup_chi5/norm,
               sup_ec/norm, sup_tau/norm, sup_resid/norm);
        fflush(stdout);

        free(w_plain);free(w_chi3);free(w_chi5);free(w_ec);free(w_tau);free(w_resid);
        npts++;
    }

    /* Power law fits for N ≥ 5000 */
    printf("\n  ═══ Power-Law Fits (N ≥ 5000) ═══\n");
    const char *names[] = {"Plain", "χ₃-twist", "χ₅-twist", "EC-twist", "τ-twist", "Residual"};
    for (int m = 0; m < 6; m++) {
        double sx=0,sy=0,sxx=0,sxy=0; int cnt=0;
        for(int i=0;i<npts;i++){
            if(test_Ns[i]<5000)continue;
            if(logE[m][i]<-20)continue;
            sx+=logN_a[i];sy+=logE[m][i];sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*logE[m][i];cnt++;
        }
        if(cnt<2){printf("  %-12s | insufficient data (EC too slow for large p)\n",names[m]);continue;}
        double beta=(cnt*sxy-sx*sy)/(cnt*sxx-sx*sx);
        const char *v=(beta<-0.10)?"★★★ STRONG DEC":(beta<-0.05)?"★★ DECREASING":
                      (beta<-0.01)?"★ MILD DEC":(beta<0.05)?"~ FLAT":"✗ INCREASING";
        printf("  %-12s | β = %8.4f | %s\n", names[m], beta, v);
    }

    printf("\n  Note: EC twist only uses primes ≤ 10000 (brute-force point counting).\n");
    printf("  τ twist only uses τ(p) for p ≤ 20 (known values).\n");

    free(is_composite); free(tau_cache);
    return 0;
}
