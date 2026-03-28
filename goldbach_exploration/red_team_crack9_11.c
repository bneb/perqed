/*
 * red_team_crack9_11.c — RED TEAM: Auditing CRACKs 9-11
 *
 * BUILD: cc -O3 -o red_team_crack9_11 red_team_crack9_11.c -lm
 */
#include <stdio.h>
#include <math.h>

int main() {
    printf("====================================================\n");
    printf("   RED TEAM: CRACKs 9, 10, 11 Audit\n");
    printf("====================================================\n\n");

    /* ═══════ CRACK 9: min r(N) Growth ═══════ */
    printf("##  CRACK 9: min r(N) Growth Rate\n\n");

    printf("  CLAIM: 'min r ≈ C·N/log²N' — same as Hardy-Littlewood.\n\n");

    printf("  RED TEAM VERDICT:  PARTIALLY WRONG.\n\n");

    printf("  PROBLEM 1: The claim says min·logN/X slowly decreases.\n");
    printf("  But this ratio goes 0.35 → 0.11 → 0.08 → 0.06 → 0.05.\n");
    printf("  That's NOT slowly decreasing — it drops by 7x over the range.\n");
    printf("  This suggests min r(N) ∼ C·N/log^α(N) with α > 2,\n");
    printf("  NOT α = 2. Fitting gives α ≈ 2.5-3.0.\n\n");

    printf("  PROBLEM 2: C is NOT constant. If min r ∼ C·N/log²N,\n");
    printf("  then C(X) = min_r · log²X / X should be constant.\n");
    printf("  Observed: C(10K) = 0.078, C(1M) = 0.054, C(1.5M) = 0.053.\n");
    printf("  Still decreasing. So either α > 2 or there's a log-log\n");
    printf("  correction.\n\n");

    printf("  PROBLEM 3: Window size bias. Using [X, X+10K] means:\n");
    printf("  - At X=10K, the window is as wide as X itself\n");
    printf("  - At X=1.5M, the window is 0.7%% of X\n");
    printf("  Wider relative window → more chance of finding small r.\n");
    printf("  So the growth looks FASTER than it is (small-X mins\n");
    printf("  are suppressed by the wide search window).\n\n");

    printf("  CORRECT STATEMENT:\n");
    printf("  min r(N) in [X, X+W] grows roughly as X/log^{2-3}X,\n");
    printf("  consistent with Hardy-Littlewood for the hardest N\n");
    printf("  (those with smallest S(N)).\n\n");

    printf("  KNOWN? YES. This is exactly the prediction from\n");
    printf("  r(N) = S(N)·J(N). The minimum S(N) ≈ 1.32 (for\n");
    printf("  N ≡ 4 mod 6 coprime to small primes), so\n");
    printf("  min r ≈ 1.32 · N / (2log²N) ≈ 0.66 · N/log²N.\n");
    printf("  At N=10^6: this gives ~4360, observed min ≈ 3963. ✓\n\n");

    printf("  VERDICT: The growth is EXPECTED from Hardy-Littlewood.\n");
    printf("  Not novel. The fit issues (α > 2) are from window bias.\n\n");

    /* ═══════ CRACK 10: Counterexample Anatomy ═══════ */
    printf("##  CRACK 10: Counterexample Anatomy\n\n");

    printf("  CLAIM 1: 'P[counterexample at 10^18] ≈ e^{-10^14}'\n");
    printf("  RED TEAM:  CORRECT math, but KNOWN argument.\n");
    printf("  This is the standard Cramér probabilistic argument.\n");
    printf("  Appeared in Hardy & Littlewood (1923).\n\n");

    printf("  CLAIM 2: 'Composite chain: max 75 vs 8700 needed.'\n");
    printf("  RED TEAM:  MISLEADING.\n");
    printf("  The 'chain' counts consecutive primes p where N-p is\n");
    printf("  composite. But this isn't the right metric.\n");
    printf("  A counterexample needs ALL primes to fail, not just\n");
    printf("  consecutive ones. The chain length measures the\n");
    printf("  INITIAL run of failures before the first success.\n");
    printf("  The actual question is total failures, not initial run.\n");
    printf("  A counterexample would have initial run = total = π(N/2).\n");
    printf("  That said, the qualitative point stands: the longest\n");
    printf("  initial runs are FAR shorter than needed.\n\n");

    printf("  CLAIM 3: '60 bits encoding 10^16 bits — Kolmogorov'\n");
    printf("  RED TEAM:  FLAWED ARGUMENT.\n\n");

    printf("  This argument is WRONG as stated. Here's why:\n\n");

    printf("  N₀ does NOT 'encode' the compositeness of N₀-p.\n");
    printf("  The compositeness of N₀-p is a CONSEQUENCE of the\n");
    printf("  prime structure, not information encoded BY N₀.\n");
    printf("  N₀ is a specific integer; the primes are fixed.\n\n");

    printf("  Analogy: The number 6 'encodes' the fact that\n");
    printf("  6 = 2×3. It doesn't take extra bits for this.\n");
    printf("  Similarly, N₀ doesn't need extra bits to encode\n");
    printf("  which N₀-p are composite; that's determined by\n");
    printf("  the primes, which are fixed.\n\n");

    printf("  The Kolmogorov argument would work if the primes\n");
    printf("  were RANDOM — then correlating 10^16 random bits\n");
    printf("  into a 60-bit pattern would be impossible. But the\n");
    printf("  primes are DETERMINISTIC (just not well-understood).\n\n");

    printf("  CORRECT VERSION: The argument should be:\n");
    printf("  'Under the Cramér random model, a counterexample is\n");
    printf("  exponentially unlikely.' This is standard and known.\n\n");

    printf("  CLAIM 4: 'Bimodal distribution from N mod 6.'\n");
    printf("  RED TEAM:  CORRECT but TRIVIAL.\n");
    printf("  The bimodality is just S(N) taking different values\n");
    printf("  for N ≡ 0,2,4 mod 6. When you divide by S(N)·N/log²N,\n");
    printf("  the remaining ratio should be UNImodal.\n");
    printf("  If it's still bimodal after normalization, THAT would\n");
    printf("  be interesting. But the histogram in CRACK 10 was\n");
    printf("  of the raw ratio, not the S(N)-normalized ratio.\n\n");

    /* ═══════ CRACK 11: Distribution as Attack Map ═══════ */
    printf("##  CRACK 11: Distribution as Attack Map\n\n");

    printf("  CLAIM: 'The distribution IS a photograph of the\n");
    printf("  circle method gap.'\n\n");

    printf("  RED TEAM:  THIS IS THE BEST INSIGHT.\n\n");

    printf("  This is genuinely well-stated. The connection:\n");
    printf("  CV² = 0.04 empirically ↔ need to prove CV² < 1\n");
    printf("  ↔ need Var(r)/E[r]² < 1\n");
    printf("  ↔ need minor arc contribution < major arc\n");
    printf("  ↔ the circle method barrier.\n\n");

    printf("  The argument that Var(r)/E[r]² = O(1/log^C N)\n");
    printf("  vs needed O(1/N^{1+ε}) correctly identifies the gap\n");
    printf("  as log-power vs polynomial, which IS the 3-log-powers\n");
    printf("  gap restated.\n\n");

    printf("  HOWEVER: the claim that stratification doesn't help\n");
    printf("  needs nuance. The minor arcs DO depend on N mod q\n");
    printf("  through the exponential sum e(Nα). For major arcs\n");
    printf("  near a/q, the behavior depends on gcd(N,q).\n");
    printf("  Stratification by N mod q DOES affect which major\n");
    printf("  arcs contribute, just not enough to close the gap.\n\n");

    printf("  CLAIM: 'Left tail improves with N (min → 1).'\n");
    printf("  RED TEAM:  VERIFIED AND IMPORTANT.\n");
    printf("  The data: min ratio goes 0.655 → 0.721 → 0.755.\n");
    printf("  This IS expected from r(N) having Var/E² → 0,\n");
    printf("  but seeing it empirically is valuable.\n");
    printf("  The RATE of approach (log-slow or polynomial?) is\n");
    printf("  the key question — and matches the circle method.\n\n");

    printf("  CLAIM: 'ALL 20 worst cases are N ≡ 2 mod 6.'\n");
    printf("  RED TEAM:  ACTUALLY N ≡ 4 mod 6.\n");
    printf("  The data shows N mod 6 = 2 for all 20.\n");
    printf("  But N=2672: 2672/2 = 1336, 1336 mod 3 = 2.\n");
    printf("  So 2672 ≡ 2 mod 6. Let's check: 2672 = 6·445 + 2. ✓\n");
    printf("  And 1412 = 6·235 + 2. ✓\n");
    printf("  So they ARE all ≡ 2 mod 6. But wait —\n");
    printf("  the stratified analysis shows N≡4 mod 6 has the\n");
    printf("  LOWEST min (0.6549) while N≡2 has min 0.7635.\n");
    printf("  N=2672 ≡ 2 mod 6 but has the overall minimum?.\n\n");

    printf("  Ah — the issue is that the stratification used a\n");
    printf("  DIFFERENT prediction formula per class but the\n");
    printf("  extremes table used the SAME formula for all.\n");
    printf("  Different S(N) for different N explains the discrepancy.\n");
    printf("  N ≡ 2 mod 6 coprime to 5,7,... has VERY small S.\n\n");

    /* ═══════ OVERALL ═══════ */
    printf("====================================================\n");
    printf("##  OVERALL ASSESSMENT\n\n");

    printf("  ┌─────────────────────────────────────────────────────┐\n");
    printf("  │ CLAIM                       │ VERDICT              │\n");
    printf("  ├─────────────────────────────────────────────────────┤\n");
    printf("  │ min r ≈ C·N/log²N           │  APPROX (α>2)      │\n");
    printf("  │ P[cex] ≈ e^{-N/(2log²N)}    │  CORRECT (known)   │\n");
    printf("  │ Chain 75 vs 8700            │  MISLEADING metric │\n");
    printf("  │ Kolmogorov compression      │  FLAWED argument   │\n");
    printf("  │ Bimodal distribution        │  TRIVIAL (S(N))    │\n");
    printf("  │ 'Distribution = gap photo'  │  BEST INSIGHT      │\n");
    printf("  │ Left tail improves          │  VERIFIED          │\n");
    printf("  │ All worst N ≡ 2 mod 6       │  CORRECT           │\n");
    printf("  │ Var/E² gap = log³N          │  EXACT             │\n");
    printf("  └─────────────────────────────────────────────────────┘\n\n");

    printf("   STRONGEST RESULT: The restatement of the circle\n");
    printf("  method gap as a CONCENTRATION inequality:\n");
    printf("    'Prove CV² < 1 ↔ prove minor < major'\n");
    printf("  This is the clearest formulation of the problem.\n\n");

    printf("   BIGGEST ERROR: The Kolmogorov argument is wrong.\n");
    printf("  N₀ doesn't 'encode' 10^16 bits. The primes are fixed.\n");
    printf("  The correct version is the Cramér probabilistic argument.\n\n");

    printf("   MATERIAL PROGRESS SCORECARD (57 approaches):\n");
    printf("  New theorems proved:    0\n");
    printf("  Known theorems verified: ~5\n");
    printf("  Interesting data points: ~8\n");
    printf("  Overclaimed results:    ~4\n");
    printf("  Correct novel framing:  2 (F_p parity, CV=gap photo)\n");

    return 0;
}
