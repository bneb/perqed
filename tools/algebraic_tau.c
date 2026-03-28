/*
 * algebraic_tau.c — Full τ(n) computation + minor arc test.
 *
 * Computes Ramanujan's τ(n) for ALL n ≤ N via:
 *   Δ(z) = η(z)^24 = q · Π_{n≥1}(1-q^n)^24
 *
 * Step 1: Compute Π(1-q^n) up to degree N using Euler's pentagonal theorem
 *   Π(1-q^n) = Σ (-1)^k · q^{k(3k±1)/2}  (sparse! O(√N) terms)
 *
 * Step 2: Raise to 24th power via repeated convolution
 *   f^24 = (f^3)^8 = ((f^3)^2)^4 = (((f^3)^2)^2)^2
 *   7 polynomial multiplications, each O(N log N) via FFT
 *
 * Step 3: Multiply by q (shift index by 1)
 *
 * This gives τ(n) for ALL n ≤ N in O(N log N) time. GRH-free (uses Deligne).
 *
 * Then: test S_τ(α) = Σ log(p)·(τ(p)/p^{11/2})·e(pα) with FULL coverage.
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define MAX_N   200001
#define FIXED_Q 10
#define PI      3.14159265358979323846

static char *is_composite = NULL;

static void compute_primes(int max_n) {
    is_composite = calloc(max_n + 1, 1);
    is_composite[0]=is_composite[1]=1;
    for(long long i=2;i*i<=max_n;i++) if(!is_composite[i])
        for(long long j=i*i;j<=max_n;j+=i) is_composite[j]=1;
}

/* ─── Polynomial multiplication via schoolbook (fine for our sizes) ─── */
/* Result goes into out[0..n-1], inputs are a[0..n-1] and b[0..n-1] */
/* Actually, let's use the direct approach since N≤1.5M and we need
 * 7 multiplications. Each mult is O(N²) naively but we can truncate. */

/* For large N, use the Euler pentagonal directly to build η^24 */

/* ─── Compute τ(n) via direct expansion of Π(1-q^n)^24 ─── */
/* Strategy: compute coefficients of f(q) = Π_{n=1}^{N} (1-q^n)^24
 *
 * Use the identity: log f = 24 · Σ log(1-q^n) = -24 · Σ_{n,k} q^{nk}/k
 *   = -24 · Σ_{m≥1} σ_{-1}(m) · q^m  where σ_{-1}(m) = Σ_{d|m} 1/d
 *
 * Then f = exp(-24 · Σ σ_{-1}(m) q^m)
 *
 * But computing exp of a power series is also O(N²) naively.
 * Better: use the Newton recurrence for Π(1-q^n)^24.
 *
 * The recurrence (from the divisor sum formula):
 *   n · a(n) = -24 · Σ_{k=1}^{n} σ₁(k) · a(n-k)
 *
 * where σ₁(k) = Σ_{d|k} d and a(0) = 1.
 * Then τ(n) = a(n-1) (shift by q factor).
 *
 * This is O(N · d(N)) ≈ O(N^{1.5}) which is perfectly feasible!
 */

static double *compute_tau_full(int max_n) {
    /* σ₁(k) = sum of divisors of k */
    double *sigma1 = calloc(max_n + 2, sizeof(double));
    for (int d = 1; d <= max_n + 1; d++)
        for (int m = d; m <= max_n + 1; m += d)
            sigma1[m] += d;

    /* a(n): coefficients of Π(1-q^k)^24 */
    /* Recurrence: n·a(n) = -24·Σ_{k=1}^{n} σ₁(k)·a(n-k) */
    double *a = calloc(max_n + 2, sizeof(double));
    a[0] = 1.0;

    for (int n = 1; n <= max_n; n++) {
        double sum = 0;
        for (int k = 1; k <= n; k++)
            sum += sigma1[k] * a[n - k];
        a[n] = -24.0 * sum / n;
        if (n % 20000 == 0) fprintf(stderr, "    τ: %d/%d (%.0f%%)\n", n, max_n, 100.0*n/max_n);
    }

    /* τ(n) = a(n-1) because Δ = q · Π(1-q^k)^24 */
    double *tau = calloc(max_n + 1, sizeof(double));
    for (int n = 1; n <= max_n; n++)
        tau[n] = a[n - 1];

    free(sigma1);
    free(a);
    return tau;
}

/* ─── FFT + minor arc infrastructure ─── */
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
static double minor_sup(double *w, int N, int Q) {
    int M=next_pow2(4*N);double*re=calloc(M,8),*im=calloc(M,8);
    for(int n=1;n<=N;n++)re[n]=w[n];fft(re,im,M,1);
    double s=0;for(int k=0;k<M;k++){if(is_major(k,M,Q,N))continue;
        double m=sqrt(re[k]*re[k]+im[k]*im[k]);if(m>s)s=m;}
    free(re);free(im);return s;
}

int main(void) {
    fprintf(stderr, "Computing primes...\n");
    compute_primes(MAX_N);

    fprintf(stderr, "Computing τ(n) for all n ≤ %d via divisor sum recurrence...\n", MAX_N);
    double *tau = compute_tau_full(MAX_N);
    fprintf(stderr, "Done.\n");

    /* Self-tests: verify known τ values */
    printf("═══ τ(n) Self-Tests ═══\n");
    struct { int n; double val; } known[] = {
        {1, 1}, {2, -24}, {3, 252}, {4, -1472}, {5, 4830},
        {6, -6048}, {7, -16744}, {8, 84480}, {9, -113643},
        {10, -115920}, {11, 534612}, {12, -370944}
    };
    int pass = 0, total = 0;
    for (int i = 0; i < 12; i++) {
        total++;
        double err = fabs(tau[known[i].n] - known[i].val);
        if (err < 0.5) {
            pass++;
            printf("  PASS: τ(%d) = %.0f (expected %.0f)\n", known[i].n, tau[known[i].n], known[i].val);
        } else {
            printf("  FAIL: τ(%d) = %.0f (expected %.0f, err=%.1f)\n",
                   known[i].n, tau[known[i].n], known[i].val, err);
        }
    }
    printf("═══ %d/%d passed ═══\n\n", pass, total);
    if (pass != total) { fprintf(stderr, "TESTS FAILED\n"); return 1; }

    /* Check Ramanujan conjecture: |τ(p)| ≤ 2·p^{11/2} */
    printf("Ramanujan conjecture check (first 20 primes):\n");
    int pcount = 0;
    for (int p = 2; p <= MAX_N && pcount < 20; p++) {
        if (is_composite[p]) continue;
        double bound = 2.0 * pow((double)p, 5.5);
        double ratio = fabs(tau[p]) / bound;
        printf("  p=%d: τ(p)=%.0f, |τ(p)|/(2p^{11/2})=%.4f %s\n",
               p, tau[p], ratio, (ratio <= 1.0001) ? "✓" : "✗ VIOLATION!");
        pcount++;
    }

    /* Count τ coverage */
    int tau_nonzero = 0, prime_count = 0;
    for (int p = 2; p <= MAX_N; p++) {
        if (is_composite[p]) continue;
        prime_count++;
        if (fabs(tau[p]) > 0.5) tau_nonzero++;
    }
    printf("\nτ coverage: %d/%d primes have τ(p) computed (%.1f%%)\n\n",
           tau_nonzero, prime_count, 100.0*tau_nonzero/prime_count);

    /* Main test: 9 data points above 10K */
    int test_Ns[] = {10000, 15000, 20000, 30000, 50000, 75000,
                     100000, 125000, 175000, 0};

    printf("══════════════════════════════════════════════════════\n");
    printf("  FULL τ(n) Minor Arc Test (all primes covered)\n");
    printf("══════════════════════════════════════════════════════\n\n");
    printf("  %10s | %10s | %10s\n", "N", "E_plain", "E_tau");

    double logN_a[20], logE_p[20], logE_tau[20];
    int npts = 0;

    for (int idx = 0; test_Ns[idx] != 0; idx++) {
        int N = test_Ns[idx];
        if (N > MAX_N - 1) break;

        fprintf(stderr, "  N=%d...\n", N);
        double norm = (double)N / log((double)N);

        double *w_plain = calloc(N+1, 8);
        double *w_tau = calloc(N+1, 8);

        for(int n=2;n<=N;n++) {
            if(is_composite[n]) continue;
            w_plain[n] = log((double)n);
            /* τ(p)/p^{11/2} ∈ [-2, 2] by Deligne */
            double norm_tau = tau[n] / pow((double)n, 5.5);
            w_tau[n] = log((double)n) * norm_tau;
        }

        double E_p   = minor_sup(w_plain, N, FIXED_Q) / norm;
        double E_tau = minor_sup(w_tau, N, FIXED_Q) / norm;

        logN_a[npts] = log((double)N);
        logE_p[npts]  = log(E_p);
        logE_tau[npts] = log(E_tau);

        printf("  %10d | %10.5f | %10.5f\n", N, E_p, E_tau);
        fflush(stdout);
        free(w_plain); free(w_tau);
        npts++;
    }

    /* Power law */
    printf("\n  ═══ Power-Law Fits ═══\n");
    const char *names[] = {"Plain", "τ-twist(FULL)"};
    double *arrs[] = {logE_p, logE_tau};
    for (int m = 0; m < 2; m++) {
        double sx=0,sy=0,sxx=0,sxy=0;
        for(int i=0;i<npts;i++){sx+=logN_a[i];sy+=arrs[m][i];
            sxx+=logN_a[i]*logN_a[i];sxy+=logN_a[i]*arrs[m][i];}
        double beta=(npts*sxy-sx*sy)/(npts*sxx-sx*sx);
        const char *v=(beta<-0.10)?"★★★ STRONG DEC":(beta<-0.05)?"★★ DEC":
                      (beta<-0.01)?"★ MILD DEC":(beta<0.05)?"~ FLAT":"✗ INCREASING";
        printf("  %-14s | β = %8.4f | %d pts | %s\n", names[m], beta, npts, v);
    }

    free(tau);
    free(is_composite);
    return 0;
}
