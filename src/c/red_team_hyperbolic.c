/*
 * red_team_hyperbolic.c — Red team the hyperbolic splitting claim.
 *
 * BUILD: cc -O3 -o red_team_hyperbolic red_team_hyperbolic.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

double poly_abs2(int *S, int M, double t) {
    double re=0,im=0;
    for(int i=0;i<M;i++){
        double a=1.0/sqrt((double)S[i]);
        double p=-t*log((double)S[i]);
        re+=a*cos(p); im+=a*sin(p);
    }
    return re*re+im*im;
}

int main() {
    printf("# 🔴 RED TEAM: Hyperbolic Splitting\n\n");

    /* ═══════ ISSUE 1: OVERCOUNTING ═══════ */
    printf("## ISSUE 1: The Decomposition OVERCOUNTS\n\n");

    printf("  We claimed: F(s) = Σ_d d^{-s} G_d(s)\n");
    printf("  where G_d(s) = Σ_{m: dm∈[N,2N]} m^{-s}\n\n");

    printf("  But Σ_d d^{-s} G_d(s) = Σ_d Σ_{m: dm∈[N,2N]} (dm)^{-s}\n");
    printf("  = Σ_{n∈[N,2N]} τ_D(n) · n^{-s}\n");
    printf("  where τ_D(n) = #{d ≤ D : d | n}\n\n");

    printf("  For n prime: τ_D(n) = 1 (only d=1 divides it, if 1≤D)\n");
    printf("  For n = 6:   τ_D(n) = #{1,2,3,6 ∩ [1,D]}\n\n");

    int N = 500; int R = 500;
    int tau[1500]; /* τ_D(n) for D=10 */
    int D = 10;
    for (int n = N; n < N+R; n++) {
        tau[n-N] = 0;
        for (int d = 1; d <= D; d++)
            if (n % d == 0) tau[n-N]++;
    }

    printf("  Verification (N=%d, D=%d):\n", N, D);
    int min_tau=999, max_tau=0; double avg_tau=0;
    for (int i=0;i<R;i++) {
        if (tau[i]<min_tau) min_tau=tau[i];
        if (tau[i]>max_tau) max_tau=tau[i];
        avg_tau+=tau[i];
    }
    avg_tau/=R;
    printf("    τ_D(n): min=%d, max=%d, avg=%.2f\n\n", min_tau, max_tau, avg_tau);

    printf("  🔴 VERDICT: Σ d^{-s} G_d ≠ F(s).\n");
    printf("     The sum overcounts by factor τ_D(n) per term.\n");
    printf("     Average overcounting = %.2f× → the 'saving' is ILLUSORY.\n\n", avg_tau);

    /* ═══════ ISSUE 2: DIAGONAL VS BOUND COMPARISON ═══════ */
    printf("## ISSUE 2: Comparing Diagonal with ℓ² Bound is Invalid\n\n");

    printf("  We compared:\n");
    printf("    Diagonal = Σ |G_d|²/d     (one PIECE of |F|²)\n");
    printf("    ℓ² bound = D · Σ |G_d|²   (an UPPER BOUND on |F|²)\n\n");

    printf("  But the diagonal is NOT a bound on |F|². It's one part\n");
    printf("  of the EXACT expansion (which also has off-diagonal).\n\n");

    printf("  The correct comparison:\n");
    printf("    |F|² = diagonal + off-diagonal\n");
    printf("    |F|² ≤ ℓ² bound\n\n");

    printf("  The 20.5× ratio compares a PIECE of the truth with a BOUND.\n");
    printf("  If off-diagonal ≈ 19.5 × diagonal, there's NO saving.\n\n");

    /* Let's CHECK: diagonal + off-diagonal vs ℓ² bound */
    int S[1000]; for(int i=0;i<R;i++) S[i]=N+i;

    /* Compute averages at sample t values */
    int ngrid = 2000;
    double T = 500.0;
    double avg_F2 = 0;            /* E[|F|²] */
    double avg_diag = 0;          /* E[diagonal] */
    double avg_sumGd2 = 0;        /* E[Σ|Gd|²] */

    for (int k = 0; k < ngrid; k++) {
        double t = (k+0.5)*T/ngrid;
        avg_F2 += poly_abs2(S, R, t);

        /* Compute each G_d */
        double sum_Gd2_over_d = 0;
        double sum_Gd2 = 0;
        for (int d = 1; d <= D; d++) {
            int piece[2000]; int pc=0;
            for (int m=1; d*m<N+R; m++)
                if (d*m >= N) piece[pc++] = m;
            if (pc == 0) continue;

            double re=0,im=0;
            for (int j=0;j<pc;j++){
                double a=1.0/sqrt((double)piece[j]);
                double p=-t*log((double)piece[j]);
                re+=a*cos(p); im+=a*sin(p);
            }
            double gd2 = re*re+im*im;
            sum_Gd2_over_d += gd2/d;
            sum_Gd2 += gd2;
        }
        avg_diag += sum_Gd2_over_d;
        avg_sumGd2 += sum_Gd2;
    }
    avg_F2 /= ngrid;
    avg_diag /= ngrid;
    avg_sumGd2 /= ngrid;

    printf("  ACTUAL MEASUREMENT (averaged over t):\n");
    printf("    E[|F|²]              = %.4f\n", avg_F2);
    printf("    E[diagonal]          = %.4f (Σ|Gd|²/d)\n", avg_diag);
    printf("    E[off-diagonal]      = %.4f (|F|² - diag if F=Σd^{-s}Gd)\n",
           avg_F2 - avg_diag);
    printf("    E[ℓ² bound]          = %.4f (D·Σ|Gd|²)\n", D*avg_sumGd2);
    printf("    Ratio diag/|F|²      = %.2f%%\n", 100*avg_diag/avg_F2);
    printf("    Ratio off-diag/|F|²  = %.2f%%\n\n", 100*(avg_F2-avg_diag)/avg_F2);

    printf("  🔴 OFF-DIAGONAL IS %.1f%% OF |F|².\n",
           100*(avg_F2-avg_diag)/avg_F2);
    printf("     The diagonal is only %.1f%% → the 'saving' is eaten\n",
           100*avg_diag/avg_F2);
    printf("     by the off-diagonal terms.\n\n");

    /* ═══════ ISSUE 3: GM ALREADY USES THIS ═══════ */
    printf("## ISSUE 3: GM Already Uses Hyperbolic Decomposition\n\n");

    printf("  Vaughan's identity decomposes Σ Λ(n) n^{-s} as:\n");
    printf("    Σ Λ(n) n^{-s} = Type I + Type II + Type III\n\n");
    printf("  WHERE:\n");
    printf("    Type I ≈ Σ_{d≤D} μ(d) d^{-s} Σ_m (log m) m^{-s}\n");
    printf("    Type II ≈ Σ_{d~D} a_d d^{-s} Σ_{m~N/D} b_m m^{-s}\n\n");

    printf("  This IS the Dirichlet hyperbola / hyperbolic split!\n");
    printf("  GM's proof ALREADY uses this decomposition.\n\n");

    printf("  The question was whether we can do BETTER than GM within\n");
    printf("  this framework. Answer:\n\n");
    printf("  The saving from the 1/d diagonal was illusory because:\n");
    printf("  (a) The decomposition overcounts (τ_D(n) factor)\n");
    printf("  (b) The off-diagonal dominates (%.0f%% of |F|²)\n",
           100*(avg_F2-avg_diag)/avg_F2);
    printf("  (c) GM already optimizes the Type I/II split\n\n");

    /* ═══════ ISSUE 4: WHAT ABOUT MÖBIUS CORRECTION? ═══════ */
    printf("## ISSUE 4: Can Möbius Fix the Overcounting?\n\n");

    printf("  The CORRECT decomposition uses Möbius inversion:\n");
    printf("    F(s) = Σ_n n^{-s} = Σ_d μ(d) d^{-s} Σ_m m^{-s} [dm∈[N,2N]]\n\n");

    printf("  But this has SIGN CHANGES (μ takes ±1 and 0).\n");
    printf("  The ℓ² orthogonality is DESTROYED by the signs.\n\n");

    printf("  Specifically: |Σ μ(d) d^{-s} G̃_d|² has cross terms\n");
    printf("  μ(d₁)μ(d₂) that can be negative → no simple bound.\n\n");

    printf("  This is the fundamental reason why multiplicative structure\n");
    printf("  is hard to exploit: the Möbius function introduces\n");
    printf("  sign cancellations that fight against ℓ² positivity.\n\n");

    /* ═══════ OVERALL VERDICT ═══════ */
    printf("══════════════════════════════════════════════════════════\n");
    printf("## OVERALL RED TEAM VERDICT\n\n");

    printf("  ┌────────────────────────────────────────────────────────┐\n");
    printf("  │ Issue                    │ Severity  │ Finding        │\n");
    printf("  ├──────────────────────────┼───────────┼────────────────┤\n");
    printf("  │ 1. Overcounting          │ CRITICAL  │ τ_D ≈ %.1f×    │\n", avg_tau);
    printf("  │ 2. Diagonal vs bound     │ CRITICAL  │ Off-diag=%3.0f%% │\n",
           100*(avg_F2-avg_diag)/avg_F2);
    printf("  │ 3. GM already uses this  │ HIGH      │ Vaughan ident. │\n");
    printf("  │ 4. Möbius kills ℓ²       │ HIGH      │ Sign changes   │\n");
    printf("  └──────────────────────────┴───────────┴────────────────┘\n\n");

    printf("  ★ The 20.5× 'saving' from hyperbolic splitting is NOT REAL.\n");
    printf("  It arose from comparing an incomplete piece (diagonal)\n");
    printf("  of an overcounted sum with an upper bound of the true sum.\n\n");

    printf("  HOWEVER: the IDEA is sound — GM does use hyperbolic splitting\n");
    printf("  (via Vaughan's identity). The question of whether the\n");
    printf("  multiplicative structure can give additional savings beyond\n");
    printf("  GM remains. The obstacle is that:\n\n");

    printf("  (a) Correct decompositions need Möbius → sign changes\n");
    printf("  (b) ℓ² orthogonality requires positivity\n");
    printf("  (c) Multiplicative large sieve helps, but GM already uses it\n\n");

    printf("  ★ THE REMAINING HOPE:\n");
    printf("  A decomposition that avoids Möbius signs while still\n");
    printf("  exploiting multiplicative structure. Example:\n");
    printf("  - Heath-Brown's identity (uses μ² instead of μ → nonnegative)\n");
    printf("  - Factor into L-functions: ζ(s) = Π(1-p^{-s})^{-1}\n");
    printf("  - Use Hecke eigenforms (multiplicative coefficients, no signs)\n");

    return 0;
}
