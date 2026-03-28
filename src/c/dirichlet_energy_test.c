/*
 * dirichlet_energy_test.c — THE KEY TEST.
 *
 * Does high multiplicative energy → smaller ||F||₆ for Dirichlet polynomials?
 *
 * We compute:
 *   F(t) = Σ_{n∈S} n^{-1/2-it}  (Dirichlet polynomial at σ=1/2)
 *
 * And measure ||F||₆ = (∫|F(t)|⁶ dt)^{1/6}
 * for various support sets S with different energy profiles.
 *
 * If S has high multiplicative energy → ||F||₆ smaller
 * → this validates the key conjecture for the N-way case split.
 *
 * BUILD: cc -O3 -o dirichlet_energy_test dirichlet_energy_test.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define M_PIl 3.141592653589793238

int gcd(int a, int b) { while(b){int t=b;b=a%b;a=t;} return a; }

/* Compute ||F||_p^p = ∫₀ᵀ |F(1/2+it)|^p dt for F = Σ_{n∈S} n^{-s} */
double dirichlet_Lp(int *S, int M, int p, double T) {
    int nsteps = 2000;
    double dt = T / nsteps;
    double integral = 0;

    for (int j = 0; j < nsteps; j++) {
        double t = (j + 0.5) * dt;
        double re = 0, im = 0;
        for (int i = 0; i < M; i++) {
            double logn = log((double)S[i]);
            double phase = -t * logn;
            double amp = 1.0 / sqrt((double)S[i]);
            re += amp * cos(phase);
            im += amp * sin(phase);
        }
        double absF2 = re*re + im*im;
        double absFp = pow(absF2, p/2.0);
        integral += absFp * dt;
    }
    return integral;
}

/* Compute multiplicative energy with direct counting */
long long mult_energy_direct(int *S, int M) {
    /* Hash-based: count product collisions mod prime */
    int P = 499979;
    int *cnt = calloc(P, sizeof(int));
    for (int i=0;i<M;i++) for(int j=0;j<M;j++)
        cnt[(int)((long long)S[i]*S[j]%P)]++;
    long long E=0;
    for(int h=0;h<P;h++) E+=(long long)cnt[h]*cnt[h];
    free(cnt);
    return E;
}

long long add_energy_direct(int *S, int M, int N) {
    int *cnt = calloc(4*N+2, sizeof(int));
    for(int i=0;i<M;i++) for(int j=0;j<M;j++) cnt[S[i]+S[j]]++;
    long long E=0; for(int s=0;s<=4*N;s++) E+=(long long)cnt[s]*cnt[s];
    free(cnt);
    return E;
}

int main() {
    printf("# KEY TEST: Does High Mult Energy → Smaller ||F||₆?\n\n");

    int N = 2000;
    int M = 150;
    double T = 500.0;
    unsigned rng = 42;

    printf("  Parameters: N=%d, M=%d, T=%.0f\n\n", N, M, T);
    printf("  %18s | %8s %8s | %10s %10s | %8s\n",
           "Support set", "α_add", "α_mul", "||F||₆⁶/T", "||F||₂²/T",
           "ratio");

    double logM = log((double)M);

    typedef struct {
        const char *name;
        double L6, L2;
        double alpha_add, alpha_mul;
    } Result;
    Result results[20];
    int nresults = 0;

    int *S = malloc(M * sizeof(int));

    /* Set 1: Random subsets (baseline) */
    for (int trial = 0; trial < 5; trial++) {
        char *used = calloc(N+1,1); int c=0;
        while(c<M){rng=rng*1103515245+12345;int v=N+(rng%N);
            if(!used[v-N]){used[v-N]=1;S[c++]=v;}} free(used);

        double L6 = dirichlet_Lp(S, M, 6, T);
        double L2 = dirichlet_Lp(S, M, 2, T);
        long long Ea = add_energy_direct(S, M, 2*N);
        long long Em = mult_energy_direct(S, M);
        double aa = log((double)Ea)/logM;
        double am = log((double)Em)/logM;

        if (trial < 3)
            printf("  %18s | %8.3f %8.3f | %10.2f %10.2f | %8.4f\n",
                   trial==0?"Random":"", aa, am, L6/T, L2/T, L6/T/(L2/T));

        results[nresults++] = (Result){"Random", L6/T, L2/T, aa, am};
    }

    /* Set 2: Arithmetic progressions (high additive energy) */
    for (int trial = 0; trial < 3; trial++) {
        int d = N/M + trial;
        for(int i=0;i<M;i++) S[i] = N + i*d;

        double L6 = dirichlet_Lp(S, M, 6, T);
        double L2 = dirichlet_Lp(S, M, 2, T);
        long long Ea = add_energy_direct(S, M, 2*N);
        long long Em = mult_energy_direct(S, M);
        double aa = log((double)Ea)/logM;
        double am = log((double)Em)/logM;

        printf("  %18s | %8.3f %8.3f | %10.2f %10.2f | %8.4f\n",
               trial==0?"AP":"", aa, am, L6/T, L2/T, L6/T/(L2/T));

        results[nresults++] = (Result){"AP", L6/T, L2/T, aa, am};
    }

    /* Set 3: Smooth numbers (high multiplicative energy) */
    {
        int c = 0;
        for (int n=N; n<=2*N && c<M; n++) {
            int m=n, smooth=1;
            for(int p=2;p<=23;p++) while(m%p==0) m/=p;
            if(m==1) S[c++]=n;
        }
        if (c < M) { /* fill */
            for(int n=N;n<=2*N&&c<M;n++){
                int m=n; for(int p=2;p<=37;p++) while(m%p==0) m/=p;
                if(m==1) S[c++]=n;
            }
        }
        int actual_M = c < M ? c : M;
        double L6 = dirichlet_Lp(S, actual_M, 6, T);
        double L2 = dirichlet_Lp(S, actual_M, 2, T);
        long long Ea = add_energy_direct(S, actual_M, 2*N);
        long long Em = mult_energy_direct(S, actual_M);
        double aa = log((double)Ea)/log((double)actual_M);
        double am = log((double)Em)/log((double)actual_M);

        printf("  %18s | %8.3f %8.3f | %10.2f %10.2f | %8.4f  [M=%d]\n",
               "Smooth (≤23)", aa, am, L6/T, L2/T, L6/T/(L2/T), actual_M);
        results[nresults++] = (Result){"Smooth", L6/T, L2/T, aa, am};
    }

    /* Set 4: Primes (pseudo-random) */
    {
        char *sieve = calloc(2*N+1,1); sieve[0]=sieve[1]=1;
        for(int i=2;i*i<=2*N;i++) if(!sieve[i]) for(int j=i*i;j<=2*N;j+=i) sieve[j]=1;
        int c=0;
        for(int n=N;n<=2*N&&c<M;n++) if(!sieve[n]) S[c++]=n;
        free(sieve);
        int actual_M = c < M ? c : M;
        double L6 = dirichlet_Lp(S, actual_M, 6, T);
        double L2 = dirichlet_Lp(S, actual_M, 2, T);
        long long Ea = add_energy_direct(S, actual_M, 2*N);
        long long Em = mult_energy_direct(S, actual_M);
        double aa = log((double)Ea)/log((double)actual_M);
        double am = log((double)Em)/log((double)actual_M);

        printf("  %18s | %8.3f %8.3f | %10.2f %10.2f | %8.4f\n",
               "Primes", aa, am, L6/T, L2/T, L6/T/(L2/T));
        results[nresults++] = (Result){"Primes", L6/T, L2/T, aa, am};
    }

    /* Set 5: Multiples of a single prime (extreme mult structure) */
    for (int p = 7; p <= 13; p += 6) {
        int c = 0;
        for (int n=N; n<=2*N && c<M; n++) if (n%p==0) S[c++]=n;
        int actual_M = c < M ? c : M;
        double L6 = dirichlet_Lp(S, actual_M, 6, T);
        double L2 = dirichlet_Lp(S, actual_M, 2, T);
        long long Ea = add_energy_direct(S, actual_M, 2*N);
        long long Em = mult_energy_direct(S, actual_M);
        double aa = log((double)Ea)/log((double)actual_M);
        double am = log((double)Em)/log((double)actual_M);

        char name[32]; snprintf(name, 32, "Multiples of %d", p);
        printf("  %18s | %8.3f %8.3f | %10.2f %10.2f | %8.4f  [M=%d]\n",
               name, aa, am, L6/T, L2/T, L6/T/(L2/T), actual_M);
        results[nresults++] = (Result){"Multiples", L6/T, L2/T, aa, am};
    }

    /* Analysis */
    printf("\n## ANALYSIS: Correlation between α_mul and ||F||₆\n\n");
    printf("  If the conjecture holds: higher α_mul → lower ||F||₆⁶/T.\n\n");

    /* Sort by alpha_mul */
    for (int i=0;i<nresults;i++) for(int j=i+1;j<nresults;j++)
        if (results[j].alpha_mul > results[i].alpha_mul) {
            Result tmp = results[i]; results[i]=results[j]; results[j]=tmp;
        }

    printf("  Sorted by α_mul (descending):\n");
    printf("  %12s | %8s | %10s | %s\n", "set", "α_mul", "||F||₆⁶/T", "conjecture?");
    for (int i=0;i<nresults;i++) {
        printf("  %12s | %8.3f | %10.2f | %s\n",
               results[i].name, results[i].alpha_mul, results[i].L6,
               (i > 0 && results[i].L6 > results[i-1].L6) ? "✓ higher α_mul → lower ||F||₆" :
               (i > 0) ? "✗ VIOLATION" : "—");
    }

    free(S);
    return 0;
}
