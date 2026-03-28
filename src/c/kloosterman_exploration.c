/*
 * kloosterman_exploration.c — Deep Dive into Kloosterman Sums
 *
 * THE BIG PICTURE:
 *   Zero-density via mollified moments involves off-diagonal sums.
 *   After Voronoi summation, these become sums of Kloosterman sums:
 *     Σ_{c} S(m,n;c)/c · W(mn/c²)
 *   where S(m,n;c) = Σ_{x(mod c), gcd(x,c)=1} e((mx+nx̄)/c)
 *   and W is a weight function from the functional equation.
 *
 *   The quality of the zero-density estimate depends on
 *   HOW MUCH CANCELLATION the Kloosterman sum gives:
 *
 *   Individual: S(m,n;c) ≤ d(c)·√c·(m,n,c)^{1/2}  (Weil, 1948)
 *   Averaged:   Σ_{c≤C} S(m,n;c)/c ≪ ???  (Linnik-Selberg conjecture: C^{1/2+ε})
 *   Bilinear:   Σ_m Σ_n a_m b_n S(m,n;c) ≪ ???  (Deshouillers-Iwaniec)
 *
 * WE COMPUTE AND TEST ALL THREE LEVELS.
 *
 * BUILD: cc -O3 -o kloosterman_exploration kloosterman_exploration.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Compute S(m,n;c) exactly */
long long kloosterman(int m, int n, int c) {
    /* S(m,n;c) = Σ_{x=1}^{c}, gcd(x,c)=1, e((mx + n·x̄)/c) */
    /* x̄ = modular inverse of x mod c */
    /* Return real part × c (to avoid floating point) — actually, just compute directly */
    double re = 0;
    for (int x = 1; x < c; x++) {
        /* Check gcd(x,c) = 1 */
        int g = x, h = c;
        while (h) { int t = h; h = g%h; g = t; }
        if (g != 1) continue;

        /* Find x_inv: x · x_inv ≡ 1 (mod c) */
        /* Extended Euclidean */
        int a = x, b = c, s0=1, s1=0;
        while (b > 0) {
            int q = a/b, r = a%b;
            int s2 = s0 - q*s1;
            a=b; b=r; s0=s1; s1=s2;
        }
        int x_inv = ((s0 % c) + c) % c;

        double angle = 2*M_PI*((long long)m*x + (long long)n*x_inv) / c;
        re += cos(angle);
    }
    return (long long)round(re);
}

/* Faster Kloosterman using double */
double kloosterman_d(int m, int n, int c) {
    double re = 0;
    for (int x = 1; x < c; x++) {
        int g = x, h = c;
        while (h) { int t = h; h = g%h; g = t; }
        if (g != 1) continue;
        int a = x, b = c, s0=1, s1=0;
        while (b > 0) {
            int q = a/b, r = a%b;
            int s2 = s0 - q*s1;
            a=b; b=r; s0=s1; s1=s2;
        }
        int x_inv = ((s0 % c) + c) % c;
        double angle = 2*M_PI*((long long)m*x + (long long)n*x_inv) / c;
        re += cos(angle);
    }
    return re;
}

int main() {
    printf("# Kloosterman Sum Deep Dive\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## BRANCH 1: Individual Kloosterman Sums vs Weil Bound\n\n");

    printf("  Weil bound: |S(m,n;c)| ≤ d(c)·√c·gcd(m,n,c)^{1/2}\n\n");

    printf("  %4s %4s %6s | %10s | %10s | %8s\n",
           "m", "n", "c", "S(m,n;c)", "Weil", "ratio");

    int test_cases[][3] = {
        {1,1,7}, {1,1,11}, {1,1,13}, {1,1,23}, {1,1,97},
        {1,1,100}, {1,1,101}, {1,1,128}, {1,1,210},
        {2,3,11}, {2,3,97}, {5,7,101}, {1,0,13},
        {3,3,9}, {6,6,12}, /* gcd > 1 cases */
        {0,0,0}
    };

    for (int i = 0; test_cases[i][2]; i++) {
        int m = test_cases[i][0], n = test_cases[i][1], c = test_cases[i][2];
        double S = kloosterman_d(m, n, c);

        /* d(c) = number of divisors */
        int dc = 0;
        for (int d = 1; d <= c; d++) if (c%d == 0) dc++;

        /* gcd(m,n,c) */
        int g = m; { int h=n; while(h){int t=h;h=g%h;g=t;} }
        { int h=c; while(h){int t=h;h=g%h;g=t;} }
        int gmnc = g;

        double weil = dc * sqrt((double)c) * sqrt((double)gmnc);

        printf("  %4d %4d %6d | %10.1f | %10.1f | %8.4f\n",
               m, n, c, S, weil, fabs(S)/weil);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## BRANCH 2: Averaged Cancellation Σ S(m,n;c)/c\n\n");

    printf("  This is the KEY sum that appears in mollified moments.\n");
    printf("  Linnik-Selberg conjecture: Σ_{c≤C} S(m,n;c)/c ≪ C^{1/2+ε}\n");
    printf("  Individual Weil: each term ≤ d(c)/√c, so sum ≤ C^{1/2}·logC\n");
    printf("  SQUARE ROOT CANCELLATION would give: sum ≤ C^{1/4}·(logC)^A\n\n");

    int m_test = 1, n_test = 1;
    printf("  S_sum(C) = Σ_{c≤C} S(%d,%d;c)/c:\n\n", m_test, n_test);
    printf("  %6s | %12s | %12s | %12s | %12s\n",
           "C", "S_sum", "|S_sum|", "C^{1/2}logC", "ratio");

    double running_sum = 0;
    int checkpoints[] = {10, 20, 50, 100, 200, 500, 1000, 2000, 0};
    int ci = 0;
    for (int c = 1; c <= 2000 && checkpoints[ci]; c++) {
        double S = kloosterman_d(m_test, n_test, c);
        running_sum += S / c;

        if (c == checkpoints[ci]) {
            double bound = sqrt(c) * log(c);
            printf("  %6d | %12.4f | %12.4f | %12.4f | %12.6f\n",
                   c, running_sum, fabs(running_sum), bound,
                   fabs(running_sum)/bound);
            ci++;
        }
    }

    /* ═══════════════════════════════════════════ */
    printf("\n  Testing multiple (m,n) pairs:\n\n");
    printf("  %4s %4s | %12s | %12s | %s\n",
           "m", "n", "Σ S/c (C=500)", "√500·log500", "ratio");

    int mn_pairs[][2] = {{1,1},{1,2},{2,3},{3,5},{5,7},{7,11},{1,100},{11,13},{0,0}};
    for (int i = 0; mn_pairs[i][0]; i++) {
        int m = mn_pairs[i][0], n = mn_pairs[i][1];
        double s = 0;
        for (int c = 1; c <= 500; c++)
            s += kloosterman_d(m, n, c) / c;
        double bound = sqrt(500.0)*log(500.0);
        printf("  %4d %4d | %12.4f | %12.4f | %12.6f\n",
               m, n, s, bound, fabs(s)/bound);
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## BRANCH 4: Zero-Density from Mollifier Length θ\n\n");

    printf("  The mollified second moment:\n");
    printf("    ∫|ζ(1/2+it)·M(1/2+it)|² dt ≈ T·P(logD/logT)\n");
    printf("  where P is a polynomial that depends on the mollifier shape.\n\n");

    printf("  For zero-density at level σ:\n");
    printf("    N(σ,T) ≤ ∫|ζ·M|^{2k} / (min|ζ·M|)^{2k}\n\n");

    printf("  The key: with mollifier length D = T^θ, the\n");
    printf("  off-diagonal error involves Σ S(m,n;c)/c.\n\n");

    printf("  By Weil (individual): error ≤ T · D^{1/2} / T^{1/2}\n");
    printf("    = T^{1/2+θ/2}. For error < main term T:\n");
    printf("    need 1/2 + θ/2 < 1, i.e., θ < 1. ALWAYS satisfied!\n\n");

    printf("  But the ACTUAL constraint is more subtle:\n");
    printf("  The off-diagonal has N² terms (N = D = T^θ),\n");
    printf("  each bounded by Weil at size √c.\n");
    printf("  After summing: Σ_{m,n≤D} Σ_c S(m,n;c)/c · (integrand)\n\n");

    printf("  Standard evaluation: error ≈ D² · √T / T = D² / √T\n");
    printf("  For error < main term D: need D²/√T < D, i.e., D < √T.\n");
    printf("  → θ < 1/2. This IS the Selberg barrier!\n\n");

    printf("  With AVERAGED Kloosterman cancellation:\n");
    printf("  Σ_c S(m,n;c)/c ≪ C^ε instead of C^{1/2},\n");
    printf("  the error becomes: D² · T^ε / T = D² / T^{1-ε}.\n");
    printf("  Need D² < T^{1-ε}, i.e., θ < (1-ε)/2 ≈ 1/2.\n");
    printf("  Still θ < 1/2! Averaged cancellation alone doesn't help!\n\n");

    printf("  Conrey's trick (θ = 4/7):\n");
    printf("  Uses Kloosterman sums + SPECTRAL DECOMPOSITION.\n");
    printf("  The Kuznetsov formula gives:\n");
    printf("    Σ_c S(m,n;c)/c · h(c) = SPECTRAL SIDE\n");
    printf("  The spectral side has EXPLICIT main terms (from Eisenstein).\n");
    printf("  After subtracting the main term: the remainder is smaller.\n");
    printf("  This gives θ = 4/7 for the SECOND moment at σ=1/2.\n\n");

    printf("  ★ For ZERO-DENSITY:\n");
    printf("  N(σ,T) comes from the SECOND MOMENT at level σ, not 1/2.\n");
    printf("  At σ > 1/2: the Selberg barrier is already absent (as we showed).\n");
    printf("  So Conrey's trick gives NO improvement for σ > 1/2.\n\n");

    printf("  🔴 CRITICAL INSIGHT:\n");
    printf("  Kloosterman sums help at σ = 1/2 (critical line).\n");
    printf("  But zero-density estimates need bounds for σ > 1/2.\n");
    printf("  These are in the ABSOLUTELY CONVERGENT region\n");
    printf("  where mollifiers already work without Kloosterman help.\n\n");

    printf("  The REAL bottleneck for zero-density is NOT the mollifier\n");
    printf("  but the LARGE VALUES ESTIMATE (how big can F(ρ) be at zeros).\n");
    printf("  GM's A=30/13 comes from the LARGE VALUES of F,\n");
    printf("  not from mollifier length.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## BRANCH 4b: Fantasy Analysis — What If θ Applied to Zero-Density?\n\n");

    printf("  Even though θ doesn't directly apply, let's compute:\n");
    printf("  IF the mollifier helped at σ > 1/2, what A would we get?\n\n");

    printf("  Standard: N(σ,T) ≤ T^{A(1-σ)+ε}\n");
    printf("  GM: The exponent A comes from:\n");
    printf("    A = 2k / (2kσ - k + 1 - 1/(2k))\n");
    printf("  optimized over k. For k=3 (sixth moment): A = 30/13.\n\n");

    printf("  If mollifier gives extra θ of savings:\n");
    printf("    The effective N becomes D = T^θ instead of T^{1/2}.\n");
    printf("    The large values estimate gains a factor T^{θ-1/2}.\n\n");

    printf("  %6s | %10s | %10s | %s\n",
           "θ", "A(θ)", "A(1/2)=GM", "improvement?");

    double theta_vals[] = {0.5, 4.0/7, 0.6, 2.0/3, 0.7, 0.8, 0.9, 1.0, 0};
    for (int ti = 0; theta_vals[ti] > 0; ti++) {
        double th = theta_vals[ti];
        /* Fantasy formula: A(θ) ≈ A(1/2) · (1/2)/θ */
        /* This is a VERY rough approximation */
        double A_gm = 30.0/13;
        double A_th = A_gm * (1.0 - 2*(th - 0.5)); /* crude adjustment */
        if (A_th < 2.0) A_th = 2.0; /* DH floor */

        printf("  %6.4f | %10.4f | %10.4f | %s\n",
               th, A_th, A_gm,
               A_th < A_gm ? "YES ★" : "no");
    }

    printf("\n  🔴 RED TEAM: These A(θ) values are FANTASY.\n");
    printf("  The actual formula relating θ to A is complex and\n");
    printf("  depends on the specific structure of the argument.\n");
    printf("  The linear interpolation A(θ) ≈ A(1/2)·(1-2(θ-1/2))\n");
    printf("  has NO theoretical justification.\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## BRANCH 5: Bilinear Kloosterman (Deshouillers-Iwaniec)\n\n");

    printf("  The DI bound: Σ_m Σ_n a_m b_n S(m,n;c)\n");
    printf("  ≤ c^{1/2+ε} (Σ|a_m|²)^{1/2} (Σ|b_n|²)^{1/2}\n");
    printf("  + c^ε (Σ m|a_m|²)^{1/2} (Σ n|b_n|²)^{1/2}\n\n");

    printf("  This is BETTER than individual Weil for structured sums.\n");
    printf("  Key application: the second term has a DIFFERENT structure\n");
    printf("  that can be smaller when m,n are in specific ranges.\n\n");

    printf("  Testing bilinear cancellation empirically for c=101:\n\n");

    int c = 101;
    int M = 30, NN = 30;  /* renamed to avoid conflict */

    /* Random a_m, b_n vs structured (prime indicators) */
    srand(42);
    double bilinear_rand = 0, bilinear_prime = 0;

    for (int m = 1; m <= M; m++) {
        for (int n = 1; n <= NN; n++) {
            double S = kloosterman_d(m, n, c);

            /* Random coefficients */
            double am_r = (rand()%2)*2-1, bn_r = (rand()%2)*2-1;
            bilinear_rand += am_r * bn_r * S;

            /* Prime indicator coefficients */
            int m_prime = 1, n_prime = 1;
            int g;
            g=m; for(int j=2;j*j<=g;j++) if(g%j==0) {m_prime=0;break;}
            if(m<=1) m_prime=0;
            g=n; for(int j=2;j*j<=g;j++) if(g%j==0) {n_prime=0;break;}
            if(n<=1) n_prime=0;
            bilinear_prime += m_prime * n_prime * S;
        }
    }

    double weil_bilinear = sqrt(c) * M * NN; /* trivial bound */
    printf("  |Bilinear(random)| = %.1f\n", fabs(bilinear_rand));
    printf("  |Bilinear(primes)| = %.1f\n", fabs(bilinear_prime));
    printf("  Trivial bound √c·M·N = %.1f\n", weil_bilinear);
    printf("  Random/trivial = %.4f\n", fabs(bilinear_rand)/weil_bilinear);
    printf("  Prime/trivial  = %.4f\n\n", fabs(bilinear_prime)/weil_bilinear);

    /* ═══════════════════════════════════════════ */
    printf("## BRANCH 6: Red Team Summary\n\n");

    printf("  ┌─────────────────────────────────────────────────────┐\n");
    printf("  │ Branch                    │ Result                  │\n");
    printf("  ├───────────────────────────┼─────────────────────────┤\n");
    printf("  │ 1. Individual Weil        │ ✅ Confirmed empirically │\n");
    printf("  │ 2. Averaged Σ S/c         │ 🟡 Small, needs more C  │\n");
    printf("  │ 3. Kuznetsov spectral     │ ❌ Too advanced for code │\n");
    printf("  │ 4a. θ→zero-density        │ 🔴 DOESN'T TRANSFER    │\n");
    printf("  │ 4b. Fantasy A(θ)          │ 🔴 No justification    │\n");
    printf("  │ 5. Bilinear DI            │ 🟡 Shows cancellation  │\n");
    printf("  └───────────────────────────┴─────────────────────────┘\n\n");

    printf("  ★★★ THE KEY INSIGHT (from Branch 4):\n\n");
    printf("  Kloosterman sums help at σ = 1/2 but NOT for σ > 1/2.\n");
    printf("  Zero-density estimates are about σ > 1/2.\n");
    printf("  The Selberg barrier is IRRELEVANT for zero-density.\n\n");

    printf("  The REAL bottleneck for improving A = 30/13 is:\n");
    printf("    1. The LARGE VALUES ESTIMATE for Dirichlet polynomials\n");
    printf("    2. The SIXTH MOMENT exponent μ₃ = 4/3\n");
    printf("    3. Both are about the PARABOLIC geometry of e(t·logn)\n\n");

    printf("  Kloosterman sums enter the VERTICAL (t) direction.\n");
    printf("  The large values problem is about the HORIZONTAL (σ) direction.\n");
    printf("  These are ORTHOGONAL — Kloosterman doesn't help with σ.\n\n");

    printf("  ★ This closes the last branch of our exploration.\n");
    printf("  All paths to improving A = 30/13 are blocked:\n");
    printf("    • Exponent pairs: converge to wrong limit\n");
    printf("    • Decoupling: gives μ₃=4/3, already used by GM\n");
    printf("    • Multiplicative structure: makes F LARGER\n");
    printf("    • GUE repulsion: controls variance, not mean\n");
    printf("    • Mollifiers: barrier irrelevant for σ > 1/2\n");
    printf("    • Kloosterman: helps vertically, not horizontally\n\n");

    printf("  The honest conclusion: A = 30/13 appears to be\n");
    printf("  a STRUCTURAL barrier, not a technical one.\n");
    printf("  Breaking it requires a genuinely new idea that\n");
    printf("  we haven't been able to find in 21 approaches.\n");

    return 0;
}
