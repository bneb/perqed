/*
 * crack24_compaction.c — Topological Compaction & The Limit Measure
 *
 * HYPOTHESIS: The circle S^1 is compact. The set of probability measures is
 * weak-* compact (Prokhorov's Theorem).
 * Let dμ_N(α) = |S_N(α)|^2 / π(N) dα.
 * By Parseval, ∫_0^1 dμ_N(α) = 1.
 * Thus μ_N is a sequence of probability measures on a compact space.
 * By compactness, there must exist a weakly convergent subsequence to μ_∞.
 *
 * What is the CDF of μ_N? F_N(x) = ∫_0^x dμ_N(α).
 * If μ_∞ is purely atomic supported on the rational numbers ℚ, then F_∞(x)
 * will be a fractal "Devil's Staircase" with jumps exactly at a/q proportional
 * to the Hardy-Littlewood singular series density.
 *
 * If we can prove F_∞(x) is singular (atomic), then any sequence of counterexamples
 * M_k where ∫_0^1 e(-M_k α) dμ_k(α) = 0 must force the M_k-th Fourier coefficient
 * of the limit measure to behave anomalously.
 *
 * Let's empirically compute F_N(x) for increasing N (from 10K to 100K) and see
 * if the CDF converges to a rigid, purely atomic staircase. If it does, the
 * minor arcs topologically vanish in the limit measure, meaning Goldbach is
 * a property of the limit measure itself.
 *
 * BUILD: cc -O3 -o crack24 crack24_compaction.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200001
static char sieve[MAX_N];
static int primes[MAX_N];
static int nprimes = 0;

void init(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0] = sieve[1] = 1;
    for(int i = 2; (long long)i * i < MAX_N; i++)
        if(.sieve[i]) 
            for(int j = i * i; j < MAX_N; j += i) sieve[j] = 1;
    for(int i = 2; i < MAX_N; i++)
        if(.sieve[i]) primes[nprimes++] = i;
}

int is_prime(int n) { return n>=2 && n<MAX_N && .sieve[n]; }

/* S_N(α) = Σ_{p≤N} e(2πi*p*α) -- Note: UNWEIGHTED to match Parseval exactly */
double S_N_abs2(int N, double alpha) {
    double re = 0, im = 0;
    for (int i = 0; i < nprimes && primes[i] <= N; i++) {
        double phase = 2.0 * M_PI * primes[i] * alpha;
        re += cos(phase);
        im += sin(phase);
    }
    return re*re + im*im;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 24: Topological Compaction & Limit Measure\n");
    printf("====================================================\n\n");

    printf("  Computing CDF F_N(x) = ∫_0^x |S_N(α)|² / π(N) dα \n");
    printf("  If F_N(x) converges to a step function, μ_∞ is atomic at ℚ.\n\n");

    int N_vals[] = {10000, 20000, 50000, 100000, 0};
    int resolution = 2000;
    double dx = 1.0 / resolution;

    /* To track exactly how much mass is concentrated at major rational cusps */
    double mass_at_0   = 0;
    double mass_at_1_2 = 0;
    double mass_at_1_3 = 0;

    for (int idx = 0; N_vals[idx]; idx++) {
        int N = N_vals[idx];
        int pi_N = 0;
        for (int i=0; i<nprimes && primes[i]<=N; i++) pi_N++;

        double cdf = 0;
        
        double m0 = 0, m12 = 0, m13 = 0;
        
        /* We integrate over [0, 0.5] as it is symmetric */
        printf("  Evaluating N = %d (π(N) = %d)...\n", N, pi_N);
        
        for (int i = 0; i <= resolution/2; i++) {
            double alpha = i * dx;
            double val = S_N_abs2(N, alpha);
            double dEnergy = (val / pi_N) * dx;
            
            cdf += dEnergy;
            
            /* Measure mass localized near major cusps (within dx=0.01) */
            if (alpha < 0.01) m0 += dEnergy;
            if (fabs(alpha - 0.5) < 0.01) m12 += dEnergy;
            if (fabs(alpha - 0.3333) < 0.01) m13 += dEnergy;
        }

        /* Print CDF profile at coarse intervals */
        if (N == 100000) {
            printf("\n  CDF Staircase Profile for N=100000 (x in [0, 0.5]):\n");
            double cdf_print = 0;
            for (int i = 0; i <= resolution/2; i++) {
                double alpha = i * dx;
                double val = S_N_abs2(N, alpha);
                cdf_print += (val / pi_N) * dx;
                if (i % (resolution/20) == 0) {
                    int bars = (int)(cdf_print * 2.0 * 50); // *2 because we only do half circle
                    if(bars>50) bars=50;
                    char bstr[64]; memset(bstr, '#', bars); bstr[bars]=0;
                    printf("    x=%5.3f | F(x)=%5.3f | %s\n", alpha, cdf_print*2.0, bstr);
                }
            }
        }
        
        /* MASS CONCENTRATION */
        /* Note: because we only integrate to 0.5, total mass is 0.5. So 2 * cdf should ≈ 1.0 */
        printf("  → Mass localized at α=0:    %.3f %%\n", m0 * 2.0 * 100);
        printf("  → Mass localized at α=1/2:  %.3f %%\n", m12 * 2.0 * 100);
        printf("  → Mass localized at α=1/3:  %.3f %%\n", m13 * 2.0 * 100);
        printf("  → Total mass accounted for: %.3f %%\n\n", (m0 + m12*0.5 + m13) * 2.0 * 100); 
    }

    printf("   TOPOLOGICAL CONCLUSION \n");
    printf("  If the mass concentrated strictly at the rational cusps\n");
    printf("  converges to 100%%, the limit measure μ_∞ is purely atomic.\n");
    printf("  If it decreases, the minor arcs (the bulk) 'escape' into\n");
    printf("  the continuum (Lebesgue measure). Let's see the trend.\n\n");
    
    return 0;
}
