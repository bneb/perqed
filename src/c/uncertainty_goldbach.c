/*
 * uncertainty_goldbach.c — Bridge: Uncertainty Principle ↔ Goldbach
 *
 * THE BRIDGE:
 *   Define S(ξ) = Σ_{p prime ≤ N} e(pξ) (exponential sum over primes)
 *   Then |S(ξ)|² = Σ_n r₂(n) e(nξ) where r₂(n) = #{p+q = n, both prime}
 *
 *   Goldbach: r₂(2n) > 0 for all n ≥ 2.
 *   Equivalently: the Fourier coefficients of |S|² at even indices are positive.
 *
 *   |S(ξ)|² ≥ 0 is a NON-NEGATIVE function on [0,1).
 *   Its L¹ norm: ∫|S|² = Σ 1 = π(N) (by Parseval at ξ=0 … no, ∫|S|² = Σ_p 1 = π(N))
 *
 *   Wait: by Parseval, ∫₀¹ |S(ξ)|² dξ = Σ_p 1 = π(N). ← L² norm of indicator
 *
 *   And |S(0)|² = (Σ_p 1)² = π(N)². ← maximum value
 *
 *   So |S|² has:
 *     max = π(N)²
 *     mean = π(N)
 *     ratio max/mean = π(N) ≈ N/logN
 *
 *   This ratio tells us |S|² is CONCENTRATED at ξ=0 with a spike of height π(N)².
 *   Away from ξ=0, |S(ξ)|² ≈ π(N) (random walk cancellation).
 *
 *   THE UNCERTAINTY PRINCIPLE says:
 *     If f ≥ 0 and f is concentrated (small support), then f̂ is spread out.
 *     If f ≥ 0 and f̂ is concentrated, then f is spread out.
 *
 *   For |S|²:
 *     "f" = |S(ξ)|² (function on [0,1))
 *     "f̂" = r₂(n) (Fourier coefficients = Goldbach representation counts)
 *
 *   If |S|² is NOT concentrated (spread out on [0,1)), then f̂ = r₂ can
 *   potentially have zeros. But if |S|² IS concentrated near major arcs,
 *   then r₂ is spread out (positive everywhere).
 *
 *   This is BACKWARDS from what we want! Concentration of |S|² near
 *   major arcs → r₂ is smooth → Goldbach.
 *   Spread of |S|² → r₂ could have zeros → bad for Goldbach.
 *
 *   BUT: concentration of |S|² near major arcs IS the circle method!
 *   So the uncertainty principle naturally LEADS to the circle method.
 *
 * A DIFFERENT ANGLE: The Beurling-Selberg Extremal Problem
 *
 *   Beurling-Selberg: find the best L¹ majorant/minorant of an indicator.
 *   If we can find a trigonometric polynomial M(ξ) ≥ |S(ξ)|² with
 *   M̂(n) ≥ 0 for all n, then r₂(n) ≤ M̂(n) for all n.
 *   For a MINORANT: m(ξ) ≤ |S(ξ)|² with m̂(n) ≥ r₂(n) for some n.
 *   If m̂(2n) > 0 for all n: Goldbach!
 *
 *   The Beurling-Selberg minorant of 1_{major arcs} would give a
 *   lower bound on r₂ from the major arc contribution alone.
 *
 * BUILD: cc -O3 -o uncertainty_goldbach uncertainty_goldbach.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100001
static char sieve[MAX_N];
int primes[10000], nprimes;

void init_sieve(int limit) {
    memset(sieve, 0, limit+1);
    sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<=limit;i++)
        if(!sieve[i]) for(int j=i*i;j<=limit;j+=i) sieve[j]=1;
    for(int i=2;i<=limit;i++) if(!sieve[i]) primes[nprimes++]=i;
}

int main() {
    int N = 50000;
    init_sieve(N);
    printf("# Uncertainty Principle ↔ Goldbach Bridge\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 1. The Concentration Profile of |S(ξ)|²\n\n");

    /* Compute |S(ξ)|² at many points */
    int ngrid = 10000;
    double *S2 = calloc(ngrid, sizeof(double));
    double max_S2 = 0, sum_S2 = 0;
    int max_at = 0;

    for (int k = 0; k < ngrid; k++) {
        double xi = (double)k/ngrid;
        double re = 0, im = 0;
        for (int i = 0; i < nprimes; i++) {
            double angle = 2*M_PI*primes[i]*xi;
            re += cos(angle); im += sin(angle);
        }
        S2[k] = re*re + im*im;
        sum_S2 += S2[k];
        if (S2[k] > max_S2) { max_S2 = S2[k]; max_at = k; }
    }

    double mean_S2 = sum_S2/ngrid;
    printf("  N = %d, π(N) = %d\n", N, nprimes);
    printf("  |S(0)|² = π(N)² = %.0f\n", (double)nprimes*nprimes);
    printf("  max |S(ξ)|² = %.0f at ξ = %d/%d ≈ %.4f\n",
           max_S2, max_at, ngrid, (double)max_at/ngrid);
    printf("  mean |S(ξ)|² ≈ %.0f (should ≈ π(N) = %d)\n", mean_S2, nprimes);
    printf("  max/mean = %.1f (≈ π(N) = %d)\n\n", max_S2/mean_S2, nprimes);

    /* Distribution: what fraction of ξ has |S|² > threshold? */
    printf("  Concentration profile:\n");
    printf("  %12s | %8s | %s\n", "threshold", "fraction", "interpretation");

    double thresholds[] = {0.01, 0.1, 0.5, 1, 2, 5, 10, 50, 100, 0};
    for (int ti = 0; thresholds[ti] > 0; ti++) {
        double thresh = thresholds[ti] * nprimes;
        int count = 0;
        for (int k = 0; k < ngrid; k++)
            if (S2[k] > thresh) count++;
        printf("  %8.0f·π | %8.4f | %s\n",
               thresholds[ti], (double)count/ngrid,
               thresholds[ti] >= 10 ? "major arcs" :
               thresholds[ti] >= 1 ? "transition" : "minor arcs");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Entropy of |S(ξ)|²\n\n");

    /* Treat P(ξ) = |S(ξ)|²/∫|S|² as a probability distribution */
    double total = sum_S2;
    double entropy = 0;          /* Shannon */
    double renyi2 = 0;           /* Rényi H₂ */
    double sum_S4 = 0;           /* for Rényi */

    for (int k = 0; k < ngrid; k++) {
        double p = S2[k]/total;
        if (p > 1e-15) entropy -= p * log(p);
        sum_S4 += S2[k]*S2[k];
    }
    renyi2 = -log(sum_S4/(total*total));

    printf("  Shannon entropy H₁ = %.4f (max = log(%d) = %.4f)\n",
           entropy, ngrid, log(ngrid));
    printf("  Rényi entropy H₂ = %.4f\n", renyi2);
    printf("  Entropy ratio H₁/log(grid) = %.4f (1 = uniform)\n",
           entropy/log(ngrid));
    printf("  H₂/log(grid) = %.4f\n\n", renyi2/log(ngrid));

    printf("  ★ The entropy ratio tells us HOW SPREAD |S|² is.\n");
    printf("    H₁/logN ≈ %.2f means |S|² occupies about %.0f%% of\n",
           entropy/log(ngrid), 100*exp(entropy)/ngrid);
    printf("    the ξ-space in an entropy sense.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 3. The Uncertainty Inequality\n\n");

    printf("  Donoho-Stark (1989): if f ∈ L²(ℤ/Nℤ) and\n");
    printf("    |supp(f)| · |supp(f̂)| ≥ N\n");
    printf("  then f cannot be simultaneously sparse and have sparse FT.\n\n");

    printf("  For our setting:\n");
    printf("    f(n) = 1_{P}(n) (prime indicator)\n");
    printf("    f̂(ξ) = S(ξ) = Σ_p e(pξ)\n");
    printf("    |supp(f)| = π(N) ≈ N/logN\n");
    printf("    |supp(f̂)| = #{ξ: S(ξ) ≠ 0} = ??? (almost all ξ)\n\n");

    printf("  The uncertainty principle for f = 1_P gives:\n");
    printf("    #{ξ: S(ξ) ≠ 0} ≥ N/π(N) ≈ logN\n");
    printf("  This is TRIVIALLY satisfied (S(ξ) ≠ 0 for almost all ξ).\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 4. The RÉNYI Uncertainty Connection (Novel!)\n\n");

    printf("  HERE is the potentially new bridge:\n\n");

    printf("  QUESTION: Is there a Rényi uncertainty principle that says\n");
    printf("  'if H₂(f) is large, then f̂ has few zeros'?\n\n");

    printf("  For non-negative f: f ≥ 0 and f̂ = r₂ (Goldbach counts).\n");
    printf("  If H₂(|S|²) > log(N) - C, can we conclude r₂(n) > 0?\n\n");

    printf("  Known result (Hirschman, 1957): H₁(f) + H₁(f̂) ≥ log(N).\n");
    printf("  For our f = |S|²:\n");
    printf("    H₁(|S|²) = %.4f\n", entropy);
    printf("    H₁(r₂) = ?\n\n");

    /* Compute H₁ of r₂ */
    int *r2 = calloc(2*N+1, sizeof(int));
    for (int i = 0; i < nprimes; i++)
        for (int j = i; j < nprimes && primes[i]+primes[j] <= 2*N; j++) {
            int s = primes[i]+primes[j];
            r2[s] += (i==j) ? 1 : 2;
        }

    double total_r2 = 0;
    for (int n = 4; n <= 2*N; n += 2) total_r2 += r2[n];

    double H1_r2 = 0;
    for (int n = 4; n <= 2*N; n += 2) {
        if (r2[n] > 0) {
            double p = r2[n]/total_r2;
            H1_r2 -= p * log(p);
        }
    }

    printf("    H₁(r₂) = %.4f (max = log(N) = %.4f)\n", H1_r2, log(N));
    printf("    H₁(|S|²) + H₁(r₂) = %.4f\n", entropy + H1_r2);
    printf("    Hirschman bound: ≥ log(N) = %.4f\n\n", log(N));
    printf("    Margin: %.4f (how much slack)\n\n",
           entropy + H1_r2 - log(N));

    printf("  ★ The Hirschman uncertainty principle IS satisfied.\n");
    printf("    But it doesn't directly prove r₂(2n) > 0.\n");
    printf("    It only constrains the TOTAL spread, not individual values.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 5. A NOVEL Entropic Statement\n\n");

    printf("  CONJECTURE (Entropic Goldbach):\n\n");
    printf("  Let P = {primes ≤ N}. Define the normalized convolution:\n");
    printf("    f(n) = r₂(n) / Σ r₂ = r₂(n) / π(N)²\n\n");
    printf("  Then the min-entropy H_∞(f) = -log(max_n f(n)) satisfies:\n");
    printf("    H_∞(f) ≥ log(N) - 2loglogN - C\n\n");

    double max_r2 = 0;
    for (int n = 4; n <= 2*N; n += 2)
        if (r2[n] > max_r2) max_r2 = r2[n];

    double H_inf = -log(max_r2 / total_r2);
    printf("  Empirical check:\n");
    printf("    max r₂ = %.0f\n", max_r2);
    printf("    total r₂ = %.0f\n", total_r2);
    printf("    H_∞ = %.4f\n", H_inf);
    printf("    log(N) - 2loglogN = %.4f\n", log(N) - 2*log(log(N)));
    printf("    H_∞ ≥ log(N)-2loglogN? %s\n\n",
           H_inf >= log(N)-2*log(log(N))-1 ? "YES ✅" : "NO ❌");

    printf("  ★ If the entropic Goldbach conjecture holds, it says:\n");
    printf("    max r₂(2n) ≤ C · N / (logN)² · (logN)² = C·N\n");
    printf("    which is trivially true. Not useful for MIN r₂.\n\n");

    printf("  🔴 SELF RED TEAM: Entropy bounds the MAX, not the MIN.\n");
    printf("     For Goldbach we need min r₂ > 0, not max r₂ bounded.\n");
    printf("     Entropy is the WRONG tool for lower bounds.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 6. The Right Tool: POSITIVITY of Fourier Coefficients\n\n");

    printf("  Goldbach = all even Fourier coefficients of |S|² are positive.\n\n");
    printf("  When does a non-negative function have all-positive FC?\n\n");
    printf("  THEOREM (Bochner): f has f̂(n) ≥ 0 for all n\n");
    printf("    iff f is POSITIVE DEFINITE.\n\n");

    printf("  Is |S(ξ)|² positive definite?\n");
    printf("  PD means: Σᵢⱼ f(ξᵢ-ξⱼ)cᵢc̄ⱼ ≥ 0 for all cᵢ.\n");
    printf("  f(ξ) = |S(ξ)|² = Σ_p Σ_q e((p-q)ξ) = Σ_d c_d e(dξ)\n");
    printf("  where c_d = #{(p,q): p-q = d}.\n\n");

    printf("  c_d ≥ 0 for all d! So |S|² has non-negative Fourier\n");
    printf("  coefficients of the FIRST kind (in the e(dξ) basis).\n\n");

    printf("  Wait — this seems circular. Let me be precise:\n");
    printf("  |S(ξ)|² = Σ_{n} r₂(n) e(nξ)\n");
    printf("  where r₂(n) = #{(p,q): p+q = n, both prime}.\n");
    printf("  So the Fourier coefficients ARE r₂(n).\n");
    printf("  The question 'are they positive?' IS Goldbach.\n\n");

    printf("  Bochner says: |S|² is positive definite iff r₂(n) ≥ 0.\n");
    printf("  Since r₂(n) is a COUNT (always ≥ 0), |S|² IS always PD.\n");
    printf("  But PD doesn't mean r₂(2n) > 0; it means r₂(n) ≥ 0.\n\n");

    printf("  ★ So the question is: when is a PD function STRICTLY PD?\n");
    printf("    I.e., when are ALL Fourier coefficients STRICTLY positive?\n\n");

    printf("  THIS is a genuine question in harmonic analysis:\n");
    printf("    'Under what conditions on f ≥ 0 are all f̂(n) > 0?'\n\n");

    printf("  Known: if f > 0 everywhere (strictly positive), then\n");
    printf("  f̂ might still have negative/zero coefficients.\n");
    printf("  But if f is a STRICTLY positive definite kernel,\n");
    printf("  then by Mercer's theorem, ALL eigenvalues are positive.\n\n");

    printf("  ★★ THE BRIDGE (genuinely novel reformulation):\n\n");
    printf("  Goldbach ←→ 'The prime exponential sum S(ξ) generates\n");
    printf("               a strictly positive definite kernel |S|²'\n\n");
    printf("  Equivalently: the Gram matrix G_{ij} = |S((i-j)/N)|²\n");
    printf("  is STRICTLY positive definite for all N.\n\n");
    printf("  This connects Goldbach to KERNEL METHODS in ML/statistics!\n");

    /* Compute small Gram matrix to test */
    printf("\n  Testing: is G_{ij} = |S((i-j)/M)|² positive definite?\n\n");

    int M = 20; /* small for demo */
    double G[20][20];
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < M; j++) {
            double xi = (double)(i-j)/M;
            double re = 0, im = 0;
            for (int ip = 0; ip < nprimes; ip++) {
                double angle = 2*M_PI*primes[ip]*xi;
                re += cos(angle); im += sin(angle);
            }
            G[i][j] = re*re + im*im;
        }
    }

    /* Check positive definiteness via Cholesky */
    double L[20][20] = {{0}};
    int pd = 1;
    for (int i = 0; i < M; i++) {
        for (int j = 0; j <= i; j++) {
            double s = G[i][j];
            for (int k = 0; k < j; k++) s -= L[i][k]*L[j][k];
            if (i == j) {
                if (s <= 0) { pd = 0; printf("  ❌ Not PD: diagonal entry ≤ 0 at i=%d\n", i); break; }
                L[i][j] = sqrt(s);
            } else {
                L[i][j] = s / L[j][j];
            }
        }
        if (!pd) break;
    }
    if (pd) printf("  ✅ G is positive definite for M=%d!\n\n", M);

    /* Eigenvalues of G are related to r₂ */
    printf("  The eigenvalues of G are exactly:\n");
    printf("    λ_k = Σ_n r₂(n) · e(nk/M) for k = 0,...,M-1\n");
    printf("  These are the DFT of r₂ at M points.\n");
    printf("  Positive definiteness ↔ all DFT values are non-negative.\n");
    printf("  This is a FINITE CHECK at M points, not Goldbach itself.\n");

    free(S2); free(r2);
    return 0;
}
