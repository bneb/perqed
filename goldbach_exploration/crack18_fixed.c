/*
 * crack18_fixed.c — Rerun of Cracks 16 & 18 with CORRECT S(N)
 *
 * BUG FIX: Ensure t%2==0 is divided out before testing p=3,4,5...
 *
 * RE-RUNNING:
 * 1. Exact integral ratio r/(S*∫)
 * 2. Stratified var(z) for N mod 6, 30, 210
 * 3. Autocorrelation of normalized residuals z(N)
 *
 * BUILD: cc -O3 -o crack18_fixed crack18_fixed.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 500001
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(.sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && .sieve[n]; }

double twin_prime_const() {
    double C2 = 1.0;
    for(int p=3;p<10000;p++){if(.is_prime(p))continue;C2*=1.0-1.0/((double)(p-1)*(p-1));}
    return C2;
}

double singular_series_correct(int N, double C2) {
    double S = 2*C2;
    int t=N; 
    while(t%2==0) t/=2; /* BUG FIX HERE */
    for(int p=3;p<=t;p++){
        if(t%p)continue;
        while(t%p==0)t/=p;
        S*=(double)(p-1)/(p-2);
    }
    return S;
}

double exact_integral(int N, int steps) {
    double sum = 0;
    double lo = 2.5, hi = N/2.0 - 0.5; /* avoid endpoints */
    double dt = (hi - lo) / steps;
    for (int i = 0; i < steps; i++) {
        double t = lo + (i + 0.5) * dt;
        sum += dt / (log(t) * log(N - t));
    }
    return sum;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 18 (FIXED): Re-running Corrupted Analyses\n");
    printf("====================================================\n\n");

    /* ═══════ 1. EXACT INTEGRAL RATIO ═══════ */
    printf("## 1. Corrected Exact Integral Ratio\n\n");
    printf("  Does r(N) / (S(N) * ∫) really converge to 1.0 now?\n\n");
    
    printf("  %10s | %8s | %10s | %10s | %8s | %8s\n",
           "N", "r(N)", "S·∫", "S·crude", "r/(S·∫)", "r/(S·c)");

    int Ns[] = {1000, 5000, 10000, 50000, 100000, 200000, 500000, 0};
    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double S = singular_series_correct(N, C2);
        double integ = exact_integral(N, 10000);
        double cr = (double)N / (2.0 * log(N) * log(N));

        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;

        printf("  %10d | %8d | %10.2f | %10.2f | %8.4f | %8.4f\n",
               N, r, S*integ, S*cr, r/(S*integ), r/(S*cr));
    }
    printf("\n");

    /* ═══════ 2. STRATIFIED VAR(Z) ═══════ */
    printf("## 2. Corrected var(z) vs Stratification Modulus\n\n");

    printf("  Using S(N) * exact_integral.\n\n");
    printf("  %10s | %10s | %10s\n", "modulus", "avg var(z)", "# classes");

    int moduli[] = {2, 6, 30, 210, 0};
    for (int mi = 0; moduli[mi]; mi++) {
        int m = moduli[mi];
        double total_var = 0; int nclass = 0;

        for (int r = 0; r < m; r += 2) {
            double sum_z=0, sum_z2=0; int cnt=0;
            for (int N = 50000 + r; N <= 200000; N += m) {
                if (N%2) continue;
                double S = singular_series_correct(N, C2);
                double pred = S * exact_integral(N, 1000);
                int rr = 0;
                for (int p = 2; p <= N/2; p++)
                    if (is_prime(p) && is_prime(N-p)) rr++;
                double z = (rr - pred) / sqrt(pred > 0 ? pred : 1);
                sum_z += z; sum_z2 += z*z; cnt++;
            }
            if (cnt > 10) {
                double mean_z = sum_z/cnt;
                double var_z = sum_z2/cnt - mean_z*mean_z;
                total_var += var_z; nclass++;
            }
        }

        printf("  %10d | %10.3f | %10d\n", m, total_var/nclass, nclass);
    }
    printf("\n");

    /* ═══════ 3. AUTOCORRELATION ═══════ */
    printf("## 3. Corrected Autocorrelation of z-scores\n\n");

    int lo = 50000, hi = 100000;
    int nvals = (hi - lo) / 2 + 1;
    double *resid = malloc(nvals * sizeof(double));

    for (int i = 0; i < nvals; i++) {
        int N = lo + 2*i;
        double S = singular_series_correct(N, C2);
        double pred = S * exact_integral(N, 1000);

        int r = 0;
        for (int p = 2; p <= N/2; p++) if (is_prime(p) && is_prime(N-p)) r++;

        resid[i] = (r - pred) / sqrt(pred > 0 ? pred : 1);
    }

    double mean = 0, var = 0;
    for (int i = 0; i < nvals; i++) mean += resid[i];
    mean /= nvals;
    for (int i = 0; i < nvals; i++) var += (resid[i]-mean)*(resid[i]-mean);
    var /= nvals;

    printf("  z-score var(z) over all N: %.3f\n\n", var);

    printf("  %6s | %10s | %s\n", "lag", "corr", "bar");
    for (int lag = 1; lag <= 20; lag++) {
        double cov = 0; int cnt = 0;
        for (int i = 0; i < nvals - lag; i++) {
            cov += (resid[i]-mean) * (resid[i+lag]-mean);
            cnt++;
        }
        double corr = (cov/cnt) / var;
        int bar = (int)(fabs(corr) * 50);
        if(bar>50) bar=50; char bs[64]; memset(bs, corr>0?'+':'-',bar); bs[bar]=0;
        printf("  %6d | %+10.4f | %s\n", lag, corr, bs);
    }

    free(resid);
    return 0;
}
