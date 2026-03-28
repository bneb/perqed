/*
 * circle_method_decomposition.c — Full Decomposition of the Circle Method
 *
 * The circle method is the ONLY known approach that could prove Goldbach.
 * Let's dissect it completely, compute each piece, and pinpoint
 * exactly WHERE it fails for binary Goldbach.
 *
 * THE FORMULA:
 *   r(N) = ∫₀¹ S(α)² e(-Nα) dα
 *   where S(α) = Σ_{p≤N} log(p) · e(pα)
 *
 * DECOMPOSITION:
 *   [0,1] = Major arcs M ∪ Minor arcs m
 *
 *   ∫_M → MAIN TERM = C(N) · N   (can compute this!)
 *   ∫_m → ERROR TERM             (must show this is small!)
 *
 *   Goldbach ⟺ Main term > |Error term|
 *
 * BUILD: cc -O3 -o circle_method_decomposition circle_method_decomposition.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100001
#define PI 3.14159265358979323846
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(!sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && !sieve[n]; }

/* Compute S(alpha) = Σ_{p≤N} log(p) · e^{2πi p α} */
void compute_S(int N, double alpha, double *re, double *im) {
    *re = 0; *im = 0;
    for (int p = 2; p <= N; p++) {
        if (!is_prime(p)) continue;
        double angle = 2 * PI * p * alpha;
        *re += log(p) * cos(angle);
        *im += log(p) * sin(angle);
    }
}

int main() {
    init();

    printf("====================================================\n");
    printf("  THE CIRCLE METHOD: Full Decomposition\n");
    printf("====================================================\n\n");

    /* ═══════ STEP 0: THE SETUP ═══════ */
    printf("## STEP 0: The Integral Representation\n\n");

    printf("  r_weighted(N) = ∫₀¹ S(α)² e(-Nα) dα\n\n");
    printf("  where S(α) = Σ_{p≤N} log(p)·e(pα)\n");
    printf("        e(x) = e^{2πix}\n\n");

    printf("  This counts Goldbach representations WEIGHTED by log(p)log(q):\n");
    printf("    r_weighted(N) = Σ_{p+q=N} log(p)·log(q)\n\n");

    printf("  To get the unweighted count: r(N) ≈ r_weighted(N) / log²(N)\n\n");

    /* Verify the integral formula numerically */
    int test_N = 1000;
    printf("  NUMERICAL VERIFICATION (N = %d):\n\n", test_N);

    /* Direct count */
    double direct_weighted = 0;
    int direct_count = 0;
    for (int p = 2; p <= test_N/2; p++) {
        if (!is_prime(p) || !is_prime(test_N-p)) continue;
        direct_weighted += log(p) * log(test_N-p);
        direct_count++;
    }
    /* Double for p<q AND p=q=N/2 */
    direct_weighted *= 2; /* account for (p,q) and (q,p) */

    /* Integral via quadrature */
    int n_points = 5000;
    double integral = 0;
    for (int k = 0; k < n_points; k++) {
        double alpha = (double)k / n_points;
        double re, im;
        compute_S(test_N, alpha, &re, &im);
        /* |S(α)|² = re² + im² */
        double S2_re = re*re - im*im; /* Re(S²) */
        double S2_im = 2*re*im;       /* Im(S²) */
        /* Multiply by e(-Nα) = cos(-2πNα) + i·sin(-2πNα) */
        double angle = -2*PI*test_N*alpha;
        double prod_re = S2_re*cos(angle) - S2_im*sin(angle);
        integral += prod_re / n_points;
    }

    printf("  Direct weighted count: %.2f\n", direct_weighted);
    printf("  Integral (quadrature): %.2f\n", integral);
    printf("  Match: %.4f%%\n\n", 100.0*integral/direct_weighted);

    /* ═══════ STEP 1: MAJOR ARCS ═══════ */
    printf("## STEP 1: Major Arcs — Where S(α) Is Large\n\n");

    printf("  Major arcs M(Q) = ∪_{q≤Q} ∪_{(a,q)=1} |α - a/q| < Q/(qN)\n\n");
    printf("  Near α = a/q, the prime sum S(α) can be APPROXIMATED:\n");
    printf("    S(a/q + β) ≈ (1/φ(q)) · Σ_{χ mod q} χ̄(a) · C(χ,β)\n");
    printf("  where C(χ,β) is a smooth function.\n\n");

    printf("  After integration over major arcs:\n");
    printf("    ∫_M S(α)² e(-Nα) dα ≈ S(N) · J(N)\n\n");

    printf("  S(N) = SINGULAR SERIES = Π_p c_p(N)\n");
    printf("  J(N) = SINGULAR INTEGRAL ≈ N\n\n");

    /* Compute singular series */
    printf("  Computing the SINGULAR SERIES S(N):\n\n");

    printf("  S(N) = 2·C₂ · Π_{p|N, p>2} (p-1)/(p-2)\n");
    printf("  where C₂ = Π_{p>2} (1 - 1/(p-1)²) ≈ 0.6601618...\n\n");

    /* Twin prime constant */
    double C2 = 1.0;
    for (int p = 3; p < 1000; p++) {
        if (!is_prime(p)) continue;
        C2 *= (1.0 - 1.0/((double)(p-1)*(p-1)));
    }

    printf("  C₂ ≈ %.7f (twin prime constant)\n", C2);
    printf("  2·C₂ ≈ %.7f\n\n", 2*C2);

    printf("  %8s | %10s | %10s | %8s | %8s\n",
           "N", "S(N)", "S(N)*N/lg²", "r(N)", "ratio");

    int Ns[] = {100, 1000, 10000, 100000, 0};
    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double S = 2 * C2;
        /* Multiply by (p-1)/(p-2) for each odd prime dividing N */
        int temp = N;
        for (int p = 3; p <= temp; p++) {
            if (temp % p != 0) continue;
            while (temp % p == 0) temp /= p;
            S *= (double)(p-1)/(p-2);
        }

        double logN = log(N);
        double prediction = S * N / (logN * logN);
        int r = 0;
        if (N <= MAX_N) {
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) r++;
        }
        printf("  %8d | %10.4f | %10.1f | %8d | %8.4f\n",
               N, S, prediction, r, r > 0 ? r / prediction : 0);
    }

    /* ═══════ STEP 2: MINOR ARCS ═══════ */
    printf("\n## STEP 2: Minor Arcs — The Battlefield\n\n");

    printf("  ∫_m S(α)² e(-Nα) dα = ERROR TERM\n\n");

    printf("  We need: |∫_m| < Main Term = S(N)·N/log²N\n\n");

    printf("  Key bound: |∫_m S(α)² e(-Nα) dα| ≤ sup_{α∈m}|S(α)| · ∫_m |S(α)| dα\n\n");

    printf("  By Parseval: ∫₀¹ |S(α)|² dα = Σ_{p≤N} log²(p) ≈ N·logN\n\n");

    printf("  So: |∫_m| ≤ sup_m |S(α)| · N·logN\n\n");

    printf("  We need: sup_m |S(α)| · N·logN < S(N)·N/log²N\n");
    printf("  i.e.: sup_m |S(α)| < S(N)/log³N ≈ 1.32/log³N\n\n");

    printf("  Compare this to the TRIVIAL bound: |S(α)| ≤ Σ log(p) ≈ N\n");
    printf("  We need sup_m |S(α)| ≤ N/log³N\n\n");

    printf("  ┌──────────────────────────────────────────────────────┐\n");
    printf("  │ WHAT WE CAN PROVE about sup_m |S(α)|:               │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ Vinogradov:  |S(α)| ≤ N·(logN)^{-A} for any A      │\n");
    printf("  │              (on minor arcs with Q = N^{1-ε})        │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ NEED for TERNARY (3 primes):                        │\n");
    printf("  │   |S(α)|³ / N² → need |S| ≤ N^{2/3+ε} ✅ DONE     │\n");
    printf("  │   Actually: |S|^{3-2} = |S| ≤ N/(logN)^A suffices  │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ NEED for BINARY (2 primes):                         │\n");
    printf("  │   |S(α)|² / N → need |S| ≤ N^{1/2+ε}  ❌ TOO HARD │\n");
    printf("  │   Or weaker: need ∫_m |S|² < N/log³N   ❌ TOO HARD │\n");
    printf("  └──────────────────────────────────────────────────────┘\n\n");

    /* ═══════ STEP 3: COMPUTE S(α) ON MINOR ARCS ═══════ */
    printf("## STEP 3: Empirical |S(α)| on Minor Arcs\n\n");

    test_N = 10000;
    printf("  Computing |S(α)| for N = %d at various α:\n\n", test_N);

    printf("  %12s | %12s | %12s | %s\n",
           "alpha", "|S(alpha)|", "|S|/N", "type");

    /* Major arc points */
    double test_alphas[] = {0, 0.5, 1.0/3, 0.25, 1.0/5, 1.0/7,
                           0.1, 0.123456, 0.314159, 0.41421356, 0.618034,
                           1.0/sqrt(2), 1.0/PI, 0};
    char *labels[] = {"0/1 (major)", "1/2 (major)", "1/3 (major)",
                      "1/4 (major)", "1/5 (major)", "1/7 (major)",
                      "1/10 (major)", "random", "pi/10",
                      "sqrt(2)-1", "1/phi", "1/sqrt(2)", "1/pi", ""};

    for (int i = 0; test_alphas[i] > -0.5 && labels[i][0]; i++) {
        double alpha = test_alphas[i];
        double re, im;
        compute_S(test_N, alpha, &re, &im);
        double mag = sqrt(re*re + im*im);
        printf("  %12.6f | %12.2f | %12.6f | %s\n",
               alpha, mag, mag/test_N, labels[i]);
    }

    /* ═══════ STEP 4: THE GAP ═══════ */
    printf("\n## STEP 4: The Exact Gap — What's Missing\n\n");

    printf("  ┌──────────────────────────────────────────────────────┐\n");
    printf("  │        THE CIRCLE METHOD DECOMPOSITION               │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │                                                      │\n");
    printf("  │  r(N) = ∫_M S²e(-N) dα  +  ∫_m S²e(-N) dα          │\n");
    printf("  │         ─────────────       ─────────────            │\n");
    printf("  │         MAIN TERM           ERROR TERM               │\n");
    printf("  │         = S(N)·N            = ???                    │\n");
    printf("  │                                                      │\n");
    printf("  │  STEP A: Major arc approx  ✅ PROVED (unconditional) │\n");
    printf("  │    S(a/q+β) ≈ φ(q)^{-1}·Σ_χ χ̄(a)·C(χ,β)           │\n");
    printf("  │    Error: O(N·exp(-c√logN)) [Siegel-Walfisz]        │\n");
    printf("  │                                                      │\n");
    printf("  │  STEP B: Singular series   ✅ COMPUTED               │\n");
    printf("  │    S(N) = 2C₂·Π_{p|N}(p-1)/(p-2) ≥ 1.32            │\n");
    printf("  │    S(N) > 0 for all even N > 2 ✅                    │\n");
    printf("  │                                                      │\n");
    printf("  │  STEP C: Singular integral  ✅ COMPUTED              │\n");
    printf("  │    J(N) = N (trivially)                              │\n");
    printf("  │                                                      │\n");
    printf("  │  STEP D: Minor arc bound   ❌ THIS IS THE GAP       │\n");
    printf("  │    Need: ∫_m |S(α)|² dα = o(N)                      │\n");
    printf("  │    Have: ∫_m |S(α)|² dα ≤ N·logN (Parseval, trivial)│\n");
    printf("  │                                                      │\n");
    printf("  │  Gap ratio: N·logN / N = logN → ∞                   │\n");
    printf("  │  We're off by a factor of log(N). JUST log(N)!       │\n");
    printf("  │                                                      │\n");
    printf("  └──────────────────────────────────────────────────────┘\n\n");

    /* ═══════ STEP 5: WHAT WOULD CLOSE THE GAP ═══════ */
    printf("## STEP 5: Five Ways to Close the Gap\n\n");

    printf("  We need ∫_m |S|² = o(N). Currently have O(N·logN).\n");
    printf("  The gap is just log(N). Here's what would close it:\n\n");

    printf("  ┌──────────────────────────────────────────────────────┐\n");
    printf("  │ A. GRH (Generalized Riemann Hypothesis)             │\n");
    printf("  │    GRH → |S(α)| ≤ √N·logN on minor arcs            │\n");
    printf("  │    → ∫_m |S|² ≤ N·log²N · |m| ≤ N·log²N / Q        │\n");
    printf("  │    Choose Q = log³N → error = o(N). ✅               │\n");
    printf("  │    STATUS: Requires GRH (unproved).                  │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ B. Zero-Density Hypothesis (A ≤ 2)                  │\n");
    printf("  │    DH → Vinogradov-type estimates improve            │\n");
    printf("  │    → minor arc contribution diminishes              │\n");
    printf("  │    STATUS: Best known A = 30/13 ≈ 2.31 > 2.         │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ C. Elliott-Halberstam Conjecture (θ = 1)            │\n");
    printf("  │    Level of distribution for primes in APs           │\n");
    printf("  │    BV gives θ = 1/2. EH conjs θ = 1.               │\n");
    printf("  │    θ = 1 → binary Goldbach (via sieve methods).     │\n");
    printf("  │    STATUS: Best θ = 1/2 + 1/584 (Zhang+Polymath).   │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ D. Better Exponential Sum Bounds                    │\n");
    printf("  │    Need: sup_m |S(α)| ≤ N^{1-δ} for some δ > 0.    │\n");
    printf("  │    Known: |S(α)| ≤ N/(logN)^A — NOT power saving.   │\n");
    printf("  │    The Huxley bound gives N^{1-1/6} but only for    │\n");
    printf("  │    Weyl sums (not prime sums).                      │\n");
    printf("  │    STATUS: No known power saving for prime exp sums. │\n");
    printf("  ├──────────────────────────────────────────────────────┤\n");
    printf("  │ E. Different Decomposition of [0,1]                 │\n");
    printf("  │    Use 'smooth' majorant instead of sharp cutoff.    │\n");
    printf("  │    But the Parseval identity is OPTIMAL for L2.      │\n");
    printf("  │    Any partition gives the same L2 total = N·logN.   │\n");
    printf("  │    STATUS: Cannot improve by repartitioning.         │\n");
    printf("  └──────────────────────────────────────────────────────┘\n\n");

    /* ═══════ STEP 6: TERNARY vs BINARY ═══════ */
    printf("## STEP 6: Why Ternary Works but Binary Doesn't\n\n");

    printf("  TERNARY (Vinogradov 1937): r₃(N) = ∫₀¹ S(α)³ e(-Nα) dα\n\n");

    printf("  Minor arc: ∫_m |S|³ ≤ sup_m|S| · ∫₀¹|S|² = sup·N·logN\n");
    printf("  Main term: ~ N²/log³N\n");
    printf("  Need: sup_m|S| · N·logN < N²/log³N\n");
    printf("  i.e.: sup_m|S| < N/log⁴N\n");
    printf("  Have: sup_m|S| ≤ N/(logN)^A for any A ✅ DONE!\n\n");

    printf("  BINARY: r₂(N) = ∫₀¹ S(α)² e(-Nα) dα\n\n");

    printf("  Minor arc: ∫_m |S|² ≤ sup_m|S| · ∫₀¹|S| dα\n");
    printf("  But ∫|S| is HARDER to bound than ∫|S|²!\n\n");

    printf("  Alternative: ∫_m |S|² ≤ ∫₀¹ |S|² = N·logN (Parseval)\n");
    printf("  Main term: ~ N/log²N\n");
    printf("  Need: ∫_m|S|² < N/log²N\n");
    printf("  Have: ∫_m|S|² ≤ N·logN\n\n");

    printf("  ★ GAP = log³N between what we need and what we have.\n\n");

    printf("  THE FUNDAMENTAL ASYMMETRY:\n");
    printf("  Ternary: 3rd power gives room for N/(logN)^A bound\n");
    printf("  Binary: 2nd power requires POWER SAVING bound N^{1-δ}\n\n");

    printf("  It's the difference between:\n");
    printf("  • Losing log factors = OK (Vinogradov can handle)\n");
    printf("  • Losing power factors = IMPOSSIBLE (no known method)\n\n");

    /* ═══════ STEP 7: THE EXACT THRESHOLD ═══════ */
    printf("## STEP 7: The Exact Threshold for Binary Goldbach\n\n");

    printf("  If we could prove:\n");
    printf("    ∫_m |S(α)|² dα ≤ N / (logN)^{2+ε}\n\n");

    printf("  Then: main term S(N)·N/log²N > error N/log^{2+ε}N\n");
    printf("  → r(N) > 0 for large N → GOLDBACH!\n\n");

    printf("  Currently: ∫_m |S|² ~ N·logN = N · (logN)^{+1}\n");
    printf("  Need:      ∫_m |S|² ~ N / (logN)^{2+ε}\n\n");

    printf("  Gap: (logN)^{3+ε} ← THIS IS WHAT GOLDBACH NEEDS.\n\n");

    printf("  In terms of 'effective exponent':\n");
    printf("  ∫_m |S|² = N · (logN)^c\n");
    printf("  Currently c = +1. Need c ≤ -2 - ε.\n");
    printf("  Gap in c: from +1 to -2 = a shift of THREE log powers.\n\n");

    printf("  ★★ GOLDBACH IS EXACTLY 3 LOG-POWERS AWAY FROM PROOF.\n\n");

    printf("  For comparison:\n");
    printf("  • Ternary Goldbach needed c ≤ +A for any A (easy)    ✅\n");
    printf("  • Binary Goldbach needs c ≤ -2-ε (hard)              ❌\n");
    printf("  • GRH gives c = -1 (not quite enough directly,\n");
    printf("    but with Q-optimization → binary Goldbach)          ✅\n");
    printf("  • Density Hypothesis gives c ≈ -1 (same as GRH)      ✅\n\n");

    printf("  Three log-powers. That's the wall.\n");

    return 0;
}
