/*
 * red_team_4p.c — Red team the 4p shifted primes "discoveries"
 *
 * Claims to destroy or validate:
 *   1. "All Goldbach reps of 4p have q ≡ 5, r ≡ 5 (mod 6)"
 *   2. "Chen→Goldbach fraction is stable at ~28%"
 *   3. "ω-stratification reduces Goldbach to 4p"
 *   4. "min r₂(4p) is massive and growing"
 *   5. "This is genuinely new territory"
 *
 * BUILD: cc -O3 -o red_team_4p red_team_4p.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 4000001
static char sieve[MAX_N];
int primes[300000], nprimes;

void init_sieve(int limit) {
    memset(sieve, 0, limit+1);
    sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<=limit;i++)
        if(!sieve[i]) for(int j=i*i;j<=limit;j+=i) sieve[j]=1;
    for(int i=2;i<=limit;i++) if(!sieve[i]) primes[nprimes++]=i;
}

int main() {
    init_sieve(MAX_N-1);
    printf("# 🔴 RED TEAM: The 4p Problem\n\n");

    /* ═══════ CLAIM 1 ═══════ */
    printf("## CLAIM 1: All Goldbach reps have q ≡ r ≡ 5 (mod 6)\n\n");

    printf("  Testing for several primes p...\n\n");
    int test_primes[] = {5, 7, 11, 13, 100003, 500009, 0};
    for (int ti = 0; test_primes[ti]; ti++) {
        int p = test_primes[ti];
        if (sieve[p]) continue;
        int m = 4*p;
        if (m >= MAX_N) continue;

        int mod6[6][6] = {{0}};
        int total = 0;
        for (int i = 0; i < nprimes && primes[i] < m; i++) {
            int q = primes[i];
            int r = m - q;
            if (r >= 2 && !sieve[r]) {
                mod6[q%6][r%6]++;
                total++;
            }
        }

        printf("  p=%d, 4p=%d, 4p mod 6 = %d:\n", p, m, m%6);
        printf("    q≡1,r≡1: %d | q≡1,r≡5: %d | q≡5,r≡1: %d | q≡5,r≡5: %d",
               mod6[1][1], mod6[1][5], mod6[5][1], mod6[5][5]);
        /* Also check q=2 and q=3 */
        printf(" | q=2: %d | q=3: %d\n",
               (m-2 >= 2 && !sieve[m-2]) ? 1 : 0,
               (m-3 >= 2 && !sieve[m-3]) ? 1 : 0);
    }

    printf("\n  🔴 AUDIT: 4p mod 6 determines the residue classes.\n");
    printf("  4p mod 6 = 4(p mod 6).\n");
    printf("  • If p ≡ 1 (mod 6): 4p ≡ 4 (mod 6). q+r ≡ 4. q≡5,r≡5(≡10≡4✓)\n");
    printf("  • If p ≡ 5 (mod 6): 4p ≡ 20 ≡ 2 (mod 6). q+r ≡ 2. q≡1,r≡1(✓)\n");
    printf("                       or q=2 (special case)\n\n");

    /* Recheck: for p ≡ 5 (mod 6), 4p ≡ 2 (mod 6) */
    printf("  ★ The mod 6 claim is WRONG for p ≡ 5 (mod 6)!\n");
    printf("    When p ≡ 5 (mod 6): 4p ≡ 2 (mod 6), so q+r ≡ 2 (mod 6).\n");
    printf("    Primes > 3 are ≡ 1 or 5 (mod 6).\n");
    printf("    q≡1 + r≡1 = 2 ✓ (not q≡5 + r≡5 = 10≡4 ✗)\n\n");

    printf("  The previous test only checked p=100003.\n");
    printf("  100003 mod 6 = %d. So 4·100003 ≡ %d (mod 6).\n",
           100003%6, (4*100003)%6);
    printf("  It was p ≡ 1 (mod 6), which gives q≡5,r≡5.\n");
    printf("  For p ≡ 5: reps have q≡1,r≡1 instead!\n\n");

    printf("  🔴 VERDICT: The 'q≡5,r≡5 lock-in' is NOT universal.\n");
    printf("     It's a TRIVIAL consequence of 4p mod 6, not a deep structure.\n");
    printf("     For p≡1(mod3): reps are q≡5,r≡5. For p≡2(mod3): q≡1,r≡1.\n");
    printf("     This is elementary modular arithmetic, not a discovery.\n\n");

    /* ═══════ CLAIM 2 ═══════ */
    printf("## CLAIM 2: Chen→Goldbach fraction stable at ~28%%\n\n");

    printf("  The claim: r₂(4p) / r_chen(4p) ≈ 0.28, constant.\n\n");

    printf("  THEORETICAL CHECK:\n");
    printf("  Chen counts q with Ω(4p-q) ≤ 2 (at most 2 prime factors with mult).\n");
    printf("  Among numbers n with Ω(n) ≤ 2, the fraction that are prime is:\n");
    printf("    #{prime ≤ x} / #{P₂ ≤ x} ≈ π(x) / (π(x) + π₂(x))\n");
    printf("  where π₂(x) = #{semiprimes ≤ x} ≈ x·loglogx/logx.\n\n");

    printf("  So prime fraction ≈ (x/logx) / (x/logx + x·loglogx/logx)\n");
    printf("                   = 1 / (1 + loglogx)\n\n");

    double N_test = 400000;
    double llN = log(log(N_test));
    printf("  At x ≈ 4p ≈ %.0f: 1/(1+loglogx) = 1/(1+%.2f) = %.3f\n\n",
           N_test, llN, 1.0/(1+llN));

    printf("  Predicted: ~%.0f%%  Observed: ~28%%\n\n",
           100.0/(1+llN));

    printf("  🟡 PARTIAL MATCH: The theoretical ~%.0f%% is somewhat close\n",
           100.0/(1+llN));
    printf("     to the observed ~28%%. The discrepancy is because:\n");
    printf("     (a) The 4p-q values aren't uniformly distributed\n");
    printf("     (b) There are sieve effects from the constraint p|4p\n");
    printf("     (c) The above approximation is crude\n\n");

    printf("  🔴 BUT: The fraction 1/(1+loglogx) → 0 as x → ∞!\n");
    printf("     loglogx grows (slowly), so the fraction DECREASES.\n\n");

    printf("  At x = 10^10:   1/(1+loglog10^10) = 1/(1+%.2f) = %.3f\n",
           log(log(1e10)), 1.0/(1+log(log(1e10))));
    printf("  At x = 10^100:  1/(1+loglog10^100) = 1/(1+%.2f) = %.3f\n",
           log(log(1e100)), 1.0/(1+log(log(1e100))));
    printf("  At x = 10^1000: 1/(1+loglog10^1000) = 1/(1+%.2f) = %.3f\n\n",
           log(1000*log(10)), 1.0/(1+log(1000*log(10))));

    printf("  However: 1/(1+loglogx) → 0 INCREDIBLY slowly.\n");
    printf("  Even at x = 10^{10^{100}}: loglogx ≈ 230, fraction ≈ 0.4%%.\n");
    printf("  The fraction never reaches zero for any physically\n");
    printf("  realizable number. But mathematically it → 0.\n\n");

    printf("  🟡 VERDICT: The '28%%' is APPROXIMATELY correct but\n");
    printf("     NOT truly constant — it's 1/(1+loglogx), which\n");
    printf("     decreases to 0 cosmically slowly. The stability\n");
    printf("     in our data is because loglog(500K) ≈ loglog(10K) ≈ 2.9.\n");
    printf("     This is not wrong, but 'stable' overstates it.\n\n");

    /* ═══════ CLAIM 3 ═══════ */
    printf("## CLAIM 3: ω-stratification reduces Goldbach to 4p\n\n");

    printf("  The claim: Goldbach's hardest cases are at n=2p (even=4p).\n\n");

    printf("  🔴 ISSUE 1: This is NOT a reduction. Solving Goldbach for 4p\n");
    printf("     does NOT solve it for other even numbers.\n");
    printf("     The stratification says 'hardest cases', but:\n");
    printf("     • n=2p is harder than n=p (trivially Goldbach as p+p)\n");
    printf("     • But n=4 is the global minimum of r₂\n");
    printf("     • n=2^k are also hard (small singular series)\n");
    printf("     • n=2·3·5·7·...·p_k have LARGE S(n) → easy\n\n");

    printf("  🔴 ISSUE 2: The ω-stratification is CLASSICAL.\n");
    printf("     Hardy & Littlewood (1923) already knew S(n) depends on ω(n).\n");
    printf("     The singular series formulation encodes exactly this.\n");
    printf("     We are rediscovering a 100-year-old fact.\n\n");

    printf("  🔴 ISSUE 3: '4p problem' ≠ 'shifted primes' breakthrough.\n");
    printf("     Asking 'for every prime p, ∃ prime q with 4p-q prime'\n");
    printf("     is EXACTLY Goldbach for the even number 4p.\n");
    printf("     This is not a simplification — it's a restriction.\n");
    printf("     Proving Goldbach for 4p is strictly EASIER than full Goldbach.\n");
    printf("     But it's still not proved!\n\n");

    printf("  🟡 VERDICT: The ω-stratification is correct but not new.\n");
    printf("     It's a re-expression of the singular series in combinatorial\n");
    printf("     language. The insight about 4p being 'hardest' is true but\n");
    printf("     known since Hardy-Littlewood.\n\n");

    /* ═══════ CLAIM 4 ═══════ */
    printf("## CLAIM 4: min r₂(4p) is massive and growing\n\n");

    printf("  The claim: min r₂(4p) ≈ 3674 for p near 100K.\n\n");

    printf("  This IS correct and is a consequence of Hardy-Littlewood:\n");
    printf("    r₂(4p) ~ C·4p/(log4p)² · (p-1)/(p-2)\n");
    printf("    ≈ C·4p/(log4p)² for large p (since (p-1)/(p-2) → 1)\n\n");

    printf("  At p=100K: r₂(4p) ~ 0.66·400K/(log400K)² ≈ 0.66·400K/153 ≈ 1725\n");
    printf("  We observed ≈ 3674 (about 2× HL, consistent with ordered pairs).\n\n");

    printf("  ✅ VERDICT: This is correct but is a TAUTOLOGY — it's HL.\n");
    printf("     min r₂ is large BECAUSE the singular series S(4p) ≈ 1\n");
    printf("     is the MINIMUM, and even the minimum is large.\n");
    printf("     This is exactly what HL predicts.\n\n");

    /* ═══════ CLAIM 5 ═══════ */
    printf("## CLAIM 5: This is 'genuinely new territory'\n\n");

    printf("  🔴 Let's be honest about what's new and what isn't:\n\n");

    printf("  KNOWN (not new):\n");
    printf("  • ω-stratification → singular series (HL 1923)\n");
    printf("  • 2p = p+p is trivially Goldbach (obvious)\n");
    printf("  • 4p is 'hard' for Goldbach (consequence of S(4p)≈1)\n");
    printf("  • Chen→Goldbach ratio ~ 1/(1+loglogx) (sieve theory)\n");
    printf("  • Parity barrier blocks proving r₂>0 from P₂ counts\n");
    printf("  • mod 6 constraints on prime sums (elementary)\n\n");

    printf("  POSSIBLY USEFUL (not new, but well-computed):\n");
    printf("  • Empirical growth rate of min r₂ in intervals\n");
    printf("  • Chen→Goldbach fraction data across ranges\n");
    printf("  • ω(n) distribution of small-r₂ numbers\n\n");

    printf("  GENUINELY NEW:\n");
    printf("  • ...nothing, really.\n\n");

    printf("  🔴 VERDICT: The 4p analysis is a COMPETENT re-derivation\n");
    printf("     of classical results in a computational setting.\n");
    printf("     The data confirms Hardy-Littlewood and Chen's theorem.\n");
    printf("     But no new mathematical insight has been produced.\n\n");

    /* ═══════ OVERALL ═══════ */
    printf("══════════════════════════════════════════════════════════\n");
    printf("## OVERALL RED TEAM VERDICT\n\n");

    printf("  ┌────────────────────────────────────────────────────────┐\n");
    printf("  │ Claim                          │ Verdict               │\n");
    printf("  ├────────────────────────────────┼───────────────────────┤\n");
    printf("  │ q≡5,r≡5 lock-in               │ 🔴 TRIVIAL (mod arith)│\n");
    printf("  │ Chen→Goldbach stable 28%%       │ 🟡 ≈correct, not const│\n");
    printf("  │ ω-stratification is new        │ 🔴 KNOWN (HL 1923)    │\n");
    printf("  │ min r₂(4p) massive             │ ✅ but = HL prediction │\n");
    printf("  │ Genuinely new territory         │ 🔴 NO (all classical) │\n");
    printf("  └────────────────────────────────┴───────────────────────┘\n\n");

    printf("  The exploration is VALUABLE as computational verification\n");
    printf("  of classical results, and the complete dataset is useful.\n");
    printf("  But intellectually honest assessment: no new mathematics.\n\n");

    printf("  The fundamental obstacle remains:\n");
    printf("  • Zero-density: GM's bound is tight for generic polys\n");
    printf("  • Goldbach: Selberg's parity barrier blocks sieve → P₁\n");
    printf("  • Both require GENUINELY NEW IDEAS, not computation\n\n");

    printf("  What computation CAN contribute:\n");
    printf("  1. Extend Goldbach verification (currently 4×10^18)\n");
    printf("  2. Find counterexamples to conjectures (SA search)\n");
    printf("  3. Guide intuition for where to look for new ideas\n");
    printf("  4. Formalize known results in Lean (publishable)\n");

    return 0;
}
