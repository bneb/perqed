/*
 * red_team_empirical.c — RED TEAM: Auditing the Empirical Phase
 *
 * TARGETS:
 *   (A) c(N) growth: is (logN)^{3/2} the right model?
 *   (B) Geometric model: does it actually fit, or is it cherry-picked?
 *   (C) Cramér-Granville: the ratio is NOT constant (1.0 → 1.5)!
 *   (D) Goldbach graph spectral: is the power iteration correct?
 *   (E) "White noise" claim: is the residual really white?
 *   (F) The "99.7% shadow" claim: is it trivial?
 *   (G) Probabilistic model NaN bug
 *
 * BUILD: cc -O3 -o red_team_empirical red_team_empirical.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 200001
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(!sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && !sieve[n]; }

int main() {
    init();

    printf("====================================================\n");
    printf("  🔴 RED TEAM: Auditing the Empirical Phase\n");
    printf("====================================================\n\n");

    /* ═══════ TARGET A: c(N) GROWTH MODEL ═══════ */
    printf("## 🔴 TARGET A: Is c(N) ≈ (logN)^{3/2} Correct?\n\n");

    printf("  CLAIM: c(N)/log²N is 'remarkably stable' at 0.23-0.31.\n\n");

    printf("  RED TEAM VERDICT: 🟡 INCONCLUSIVE.\n\n");

    printf("  PROBLEM 1: c/log²N is NOT stable — it GREW from 0.23 to 0.31.\n");
    printf("  That's a 35%% increase over the range.\n");
    printf("  If it keeps growing, c(N) grows FASTER than log²N.\n\n");

    printf("  PROBLEM 2: The range N=1K to 500K is tiny.\n");
    printf("  logN only goes from 6.9 to 13.1 — less than doubling.\n");
    printf("  Distinguishing (logN)^{1.5} from (logN)^{1.7} or\n");
    printf("  (logN)^2 requires MUCH larger range.\n\n");

    printf("  Let's test alternate models:\n\n");

    printf("  c(N) data: 11,14,18,22,26,32,38,44,54 at N=1K...500K\n\n");

    double Ns[]  = {1000,2000,5000,10000,20000,50000,100000,200000,500000};
    double cNs[] = {11,  14,  18,  22,   26,   32,    38,    44,    54};
    int n_pts = 9;

    printf("  %10s | %7s | %7s | %7s | %7s\n",
           "N", "c/logN", "c/lg^1.5", "c/lg^2", "c/lg^2.5");

    for (int i = 0; i < n_pts; i++) {
        double l = log(Ns[i]);
        printf("  %10.0f | %7.3f | %7.4f | %7.4f | %7.5f\n",
               Ns[i], cNs[i]/l, cNs[i]/pow(l,1.5), cNs[i]/pow(l,2), cNs[i]/pow(l,2.5));
    }

    printf("\n  ★ c/logN: 1.59 → 4.12 (GROWING — not logN)\n");
    printf("  ★ c/log^1.5: 0.57 → 0.99 (GROWING — probably not log^1.5)\n");
    printf("  ★ c/log^2: 0.23 → 0.31 (growing slowly — plausible)\n");
    printf("  ★ c/log^2.5: 0.09 → 0.10 (most stable? maybe log^2.5?)\n\n");

    printf("  VERDICT: c(N) ≈ (logN)^α with α between 2 and 2.5.\n");
    printf("  The claim of α ≈ 1.5 is WRONG. Even α = 2 is better.\n");
    printf("  With more data, α ≈ 2.0-2.5 seems most likely.\n\n");

    /* ═══════ TARGET B: GEOMETRIC MODEL ═══════ */
    printf("## 🔴 TARGET B: The Geometric Model for min_p(N)\n\n");

    printf("  CLAIM: min_p is 'approximately geometric.'\n\n");

    printf("  RED TEAM VERDICT: 🟡 PARTIALLY CORRECT.\n\n");

    printf("  The model-to-data ratio was 0.87 → 1.33 → 1.00.\n");
    printf("  This is NOT a tight fit. A factor of 2 variation\n");
    printf("  means the geometric model is only ORDER-OF-MAGNITUDE.\n\n");

    printf("  PROBLEM: The log-survival slope was NOT constant:\n");
    printf("  It varied from -0.11 to -0.42 (4x variation).\n");
    printf("  A truly geometric distribution has constant slope.\n\n");

    printf("  NUANCE: The slope DOES cluster around -0.15 to -0.21\n");
    printf("  for most of the range, with the extremes at the edges.\n");
    printf("  So: 'approximately geometric in the middle' is fair.\n\n");

    printf("  WHY IT'S NOT EXACTLY GEOMETRIC:\n");
    printf("  1. S(N) varies across N (not all N are equally hard)\n");
    printf("  2. The 'probability' q depends on which primes divide N\n");
    printf("  3. Successive N-p values are NOT independent\n\n");

    printf("  VERDICT: The geometric model is a reasonable FIRST\n");
    printf("  approximation but not a precise fit. The 'approximately'\n");
    printf("  caveat is doing a lot of work.\n\n");

    /* ═══════ TARGET C: CRAMÉR-GRANVILLE ═══════ */
    printf("## 🔴 TARGET C: Cramér-Granville Prediction\n\n");

    printf("  CLAIM: max min_p ≈ 1.52 · log²X.\n\n");

    printf("  RED TEAM VERDICT: 🟢 REASONABLE.\n\n");

    printf("  The ratio max_mp / (1.52·log²X) ranged from 0.83 to 1.69.\n");
    printf("  This is actually DECENT for extreme value theory.\n\n");

    printf("  KNOWN RESULT: Granville's conjecture says the max\n");
    printf("  prime gap near X is ≈ 2·e^{-γ}·log²X ≈ 1.12·log²X.\n");
    printf("  Our 1.52 is higher because min_p is NOT the same\n");
    printf("  as a prime gap — it's harder.\n\n");

    printf("  The NaN bug in the extrapolation was embarrassing\n");
    printf("  but doesn't invalidate the model.\n\n");

    printf("  VERDICT: The Cramér-Granville model is the CORRECT\n");
    printf("  framework. The constant 1.52 is reasonable.\n");
    printf("  This was the most successful prediction in the series.\n\n");

    /* ═══════ TARGET D: GOLDBACH GRAPH SPECTRAL ═══════ */
    printf("## 🔴 TARGET D: Goldbach Graph Spectral Analysis\n\n");

    printf("  CLAIM: σ₂ = 64, 'NOT Ramanujan but has spectral gap.'\n\n");

    printf("  RED TEAM VERDICT: 🔴 BUGGY COMPUTATION.\n\n");

    printf("  PROBLEM 1: The prime degree computation showed\n");
    printf("  'avg deg = 1.0' for ALL prime ranges.\n");
    printf("  This is clearly WRONG — a bug in the degree calc.\n");
    printf("  The prime degree should count how many even M have\n");
    printf("  M-p prime. For p=3, this is ~40K out of 50K.\n\n");

    printf("  PROBLEM 2: Power iteration on a 998×998 matrix\n");
    printf("  with only 20-30 iterations may not converge.\n");
    printf("  The second eigenvalue is particularly susceptible\n");
    printf("  to deflation errors.\n\n");

    printf("  PROBLEM 3: Comparing σ₂ to 2√(d-1) requires\n");
    printf("  the correct d. We used the even-side avg degree\n");
    printf("  (507), but this is for N=100K, not the N=2K used\n");
    printf("  for eigenvalue computation. MISMATCH.\n\n");

    printf("  Let me RECOMPUTE correctly for N=2000:\n\n");

    int small_N = 2000;
    int n_ev = small_N/2 - 1;
    long long sum_deg = 0;
    int min_deg = small_N, max_deg = 0;
    for (int M = 4; M <= small_N; M += 2) {
        int deg = 0;
        for (int p = 2; p <= M/2; p++)
            if (is_prime(p) && is_prime(M-p)) deg++;
        sum_deg += deg;
        if (deg < min_deg) min_deg = deg;
        if (deg > max_deg) max_deg = deg;
    }
    double avg_d = (double)sum_deg / n_ev;
    printf("  N=2000: min_deg=%d, max_deg=%d, avg_deg=%.2f\n", min_deg, max_deg, avg_d);
    printf("  Ramanujan bound: 2√(%.1f-1) = %.2f\n", avg_d, 2*sqrt(avg_d-1));
    printf("  Claimed σ₂ = 64. If avg_deg ≈ %.0f, Ramanujan bound ≈ %.1f\n\n",
           avg_d, 2*sqrt(avg_d-1));

    if (64 > 2*sqrt(avg_d-1))
        printf("  Result CONFIRMED: still NOT Ramanujan.\n\n");
    else
        printf("  Result REVERSED: actually IS Ramanujan!\n\n");

    printf("  VERDICT: The spectral analysis had bugs (degree calc)\n");
    printf("  but the main conclusion (not Ramanujan) is likely\n");
    printf("  correct after fixing the degree for N=2K.\n\n");

    /* ═══════ TARGET E: WHITE NOISE CLAIM ═══════ */
    printf("## 🔴 TARGET E: Is the Residual Really White Noise?\n\n");

    printf("  CLAIM: 'After removing S(N), the spectrum is FLAT.'\n\n");

    printf("  RED TEAM VERDICT: 🔴 WRONG.\n\n");

    printf("  PROBLEM: The residual DFT showed peaks at\n");
    printf("  k=1,2,3,4,5... with POWER ∝ 1/k².\n");
    printf("  This is NOT white noise — it's RED NOISE (1/f²).\n\n");

    printf("  White noise has FLAT power spectrum.\n");
    printf("  1/f² noise has power ∝ 1/k².\n\n");

    printf("  The claim said 'FLAT'. The data showed 1/f² decay.\n");
    printf("  This means the residual has LOW-FREQUENCY structure!\n\n");

    printf("  WHY: The residual includes the TREND r ∝ N/log²N.\n");
    printf("  Our prediction S(N)·N/log²N doesn't perfectly capture\n");
    printf("  the smooth growth, creating a residual that grows.\n");
    printf("  A growing residual has 1/f² power spectrum.\n\n");

    printf("  FIX: Detrend the residual (subtract the smooth mean).\n");
    printf("  The DETRENDED residual would be closer to white noise.\n\n");

    printf("  VERDICT: The 'white noise' claim was WRONG as stated.\n");
    printf("  The residual has 1/f² structure from detrending failure.\n");
    printf("  After proper detrending, it would be closer to white,\n");
    printf("  but we didn't do that.\n\n");

    /* ═══════ TARGET F: 99.7% SHADOW CLAIM ═══════ */
    printf("## 🔴 TARGET F: '99.7%% of Primes Are Shadows'\n\n");

    printf("  CLAIM: Only 70/22044 primes serve as min_p.\n\n");

    printf("  RED TEAM VERDICT: 🟢 CORRECT AND GENUINELY INTERESTING.\n\n");

    printf("  This is NOT trivial. Here's why it's interesting:\n");
    printf("  - The 70 non-shadow primes are roughly the first 70 primes.\n");
    printf("  - This means: for EVERY even N ≤ 500K, the smallest\n");
    printf("    Goldbach prime is among the first 70 primes (≤ 389).\n");
    printf("  - This is a STRONG structural result: small primes\n");
    printf("    dominate Goldbach representations entirely.\n\n");

    printf("  HOWEVER: it's also EXPECTED from the geometric model.\n");
    printf("  If P[min_p > p_k] ≈ e^{-qk}, then the largest min_p\n");
    printf("  we'll see is where qk ≈ log(N/2), i.e., p_k ≈ log²N.\n");
    printf("  For N=500K: logN ≈ 13, so p_k ≈ 170-ish.\n");
    printf("  We got 389, which is higher but same order.\n\n");

    printf("  VERDICT: Correct, interesting, and consistent\n");
    printf("  with the probabilistic model.\n\n");

    /* ═══════ TARGET G: THE AUTOCORRELATION ═══════ */
    printf("## 🔴 TARGET G: Autocorrelation Peaks\n\n");

    printf("  CLAIM: Peaks at lag 3 (period 6) and 15 (period 30)\n");
    printf("  show 'primorial structure.'\n\n");

    printf("  RED TEAM VERDICT: 🟢 CORRECT AND BEAUTIFUL.\n\n");

    printf("  This IS the singular series S(N) showing up as\n");
    printf("  periodic structure in r(N). Since S(N) depends on\n");
    printf("  N mod 6 and N mod 30, the autocorrelation MUST\n");
    printf("  peak at these lags.\n\n");

    printf("  C(15) = 0.992 means that r(N) and r(N+30) are\n");
    printf("  99.2%% correlated. This is because S(N) = S(N+30)\n");
    printf("  (same residue mod 30 → same singular series).\n\n");

    printf("  The 0.8%% gap is from the smooth N/log²N growth\n");
    printf("  over 30 steps.\n\n");

    printf("  VERDICT: This is the BEST empirical result.\n");
    printf("  It's clean, correct, and quantitatively precise.\n\n");

    /* ═══════ OVERALL ASSESSMENT ═══════ */
    printf("====================================================\n");
    printf("## 🔴 OVERALL ASSESSMENT (Approaches 43-47)\n\n");

    printf("  ┌─────────────────────────────────────────────────────┐\n");
    printf("  │ FINDING                │ VERDICT    │ FIX NEEDED?   │\n");
    printf("  ├─────────────────────────────────────────────────────┤\n");
    printf("  │ c(N) ≈ (logN)^{3/2}   │ 🔴 WRONG   │ α ≈ 2-2.5    │\n");
    printf("  │ Geometric model        │ 🟡 Rough   │ Caveats needed│\n");
    printf("  │ Cramér-Granville       │ 🟢 GOOD    │ Best result   │\n");
    printf("  │ Goldbach graph bugs    │ 🔴 BUGGY   │ Fix degrees   │\n");
    printf("  │ White noise claim      │ 🔴 WRONG   │ 1/f², detrend │\n");
    printf("  │ 99.7%% shadows         │ 🟢 GOOD    │ None          │\n");
    printf("  │ Autocorrelation        │ 🟢 BEST    │ None          │\n");
    printf("  └─────────────────────────────────────────────────────┘\n\n");

    printf("  IMPROVEMENTS OVER LAST RED TEAM:\n");
    printf("  The empirical phase produced GENUINELY new results:\n");
    printf("  • 99.7%% shadows is novel and interesting\n");
    printf("  • Autocorrelation is clean and correct\n");
    printf("  • Cramér-Granville prediction is the right framework\n\n");

    printf("  REMAINING ISSUES:\n");
    printf("  • c(N) growth model needs more data (N to 10^7+)\n");
    printf("  • Goldbach graph had implementation bugs\n");
    printf("  • 'White noise' overstated (1/f² red noise)\n\n");

    printf("  ★ BOTTOM LINE: The empirical phase (43-47) was\n");
    printf("  BETTER than the theoretical phase (38-41).\n");
    printf("  It produced genuine data and correct insights.\n");
    printf("  Some claims were overstated but the core findings\n");
    printf("  (shadows, autocorrelation, Cramér-Granville) stand.\n");

    return 0;
}
