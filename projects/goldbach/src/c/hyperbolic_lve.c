/*
 * hyperbolic_lve.c — Hyperbolic Splitting for Large Values Estimates
 *
 * THE IDEA (from user!):
 * Instead of splitting F by intervals or residue classes,
 * split by DIVISOR STRUCTURE using the Dirichlet hyperbola method.
 *
 * F(s) = Σ_{n=N}^{2N} aₙ n^{-s}
 *       = Σ_{d≤D} d^{-s} · G_d(s) + Σ_{m≤M} m^{-s} · H_m(s) - correction
 *
 * where:
 *   G_d(s) = Σ_{m: dm∈[N,2N]} a_{dm} m^{-s}   (Type I sum: d is "small")
 *   H_m(s) = Σ_{d: dm∈[N,2N]} a_{dm} d^{-s}   (Type II sum: m is "small")
 *
 * This is EXACTLY Vaughan's identity / Heath-Brown's identity!
 *
 * WHY IT'S SPECIAL:
 * - G_d is a Dirichlet poly in m of length ~N/d (SHORT for large d)
 * - G_d has a FIXED multiplicative factor d^{-s} (PHASE SHIFT)
 * - Different G_d's are NEARLY ORTHOGONAL because d^{-it} decoheres
 *
 * The ℓ² bound:
 *   |F|² ≤ |Σ d^{-s} G_d|² ≤ (Σ|G_d|²) · (Σ d^{-2σ})
 *
 * The MULTIPLICATIVE LARGE SIEVE gives the crucial improvement:
 *   Σ |Σ_{d≤D} aₐ d^{-it}|² ≤ (T + D²) · Σ|aₐ|²
 *
 * This is DIFFERENT from the additive ℓ² because the spacing of
 * log(d) values is LOG-UNIFORM, not uniform — giving BETTER orthogonality
 * for multiplicative sums than additive ones.
 *
 * BUILD: cc -O3 -o hyperbolic_lve hyperbolic_lve.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

double dirichlet_abs2(int *S, int M, double t) {
    double re=0, im=0;
    for (int i=0;i<M;i++) {
        double logn=log((double)S[i]);
        double amp=1.0/sqrt((double)S[i]);
        re += amp*cos(-t*logn);
        im += amp*sin(-t*logn);
    }
    return re*re+im*im;
}

int main() {
    printf("# Hyperbolic Splitting for Large Values Estimates\n\n");

    int N = 500;
    int RANGE = 500;  /* n ∈ [N, N+RANGE) */
    int M_total = RANGE;
    double T = 500.0;
    int ngrid = 4000;

    int *S = malloc(M_total * sizeof(int));
    for (int i = 0; i < M_total; i++) S[i] = N + i;

    /* ═══════════════════════════════════════════ */
    printf("## 1. The Hyperbolic Decomposition\n\n");
    printf("  F(s) = Σ_{n=%d}^{%d} n^{-s}\n\n", N, N+RANGE-1);
    printf("  For each d, define G_d(s) = Σ_{m: dm∈[N,N+R)} m^{-s}\n\n");

    /* For a given D threshold, decompose F = Type_I + Type_II */
    int D_vals[] = {2, 5, 10, 20, 50};
    int nD = 5;

    printf("  %4s | %8s | %10s | %10s | %10s | %s\n",
           "D", "#Type I", "max|TI|²", "max|TII|²", "combined", "vs full");

    /* Full F maximum */
    double full_max = 0;
    for (int k = 0; k < ngrid; k++) {
        double t = (k+0.5)*T/ngrid;
        double abs2 = dirichlet_abs2(S, M_total, t);
        if (abs2 > full_max) full_max = abs2;
    }
    printf("  Full F: max|F|² = %.2f\n\n", full_max);

    for (int di = 0; di < nD; di++) {
        int D = D_vals[di];

        /* Type I: Σ_{d≤D} d^{-s} G_d(s) */
        /* For each d, G_d has support on m ∈ [ceil(N/d), floor((N+R-1)/d)] */
        int type1_n[10000], type1_cnt = 0;
        for (int d = 1; d <= D; d++) {
            for (int m = 1; m <= (N+RANGE-1)/d; m++) {
                int n = d * m;
                if (n >= N && n < N+RANGE) {
                    /* Check not already counted */
                    int found = 0;
                    for (int j = 0; j < type1_cnt; j++)
                        if (type1_n[j] == n) { found = 1; break; }
                    if (!found && type1_cnt < 10000)
                        type1_n[type1_cnt++] = n;
                }
            }
        }

        /* Type II: remaining n not covered by Type I */
        int type2_n[10000], type2_cnt = 0;
        for (int i = 0; i < M_total; i++) {
            int is_type1 = 0;
            for (int j = 0; j < type1_cnt; j++)
                if (type1_n[j] == S[i]) { is_type1 = 1; break; }
            if (!is_type1 && type2_cnt < 10000)
                type2_n[type2_cnt++] = S[i];
        }

        /* Compute maxima */
        double max_t1 = 0, max_t2 = 0;
        for (int k = 0; k < ngrid; k++) {
            double t = (k+0.5)*T/ngrid;
            double abs2_t1 = dirichlet_abs2(type1_n, type1_cnt, t);
            double abs2_t2 = dirichlet_abs2(type2_n, type2_cnt, t);
            if (abs2_t1 > max_t1) max_t1 = abs2_t1;
            if (abs2_t2 > max_t2) max_t2 = abs2_t2;
        }

        printf("  %4d | T1:%4d  | %10.2f | %10.2f | %10.2f | %s\n",
               D, type1_cnt, max_t1, max_t2,
               sqrt(max_t1) + sqrt(max_t2),  /* triangle ineq bound */
               max_t1 + max_t2 < full_max ? "★ BETTER!" : "");
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Piece-by-Piece: G_d for each divisor d\n\n");

    /* For D=10, show each G_d and its properties */
    int D = 10;
    printf("  D=%d: decompose into G_d pieces\n\n", D);
    printf("  %4s | %4s | %10s | %10s | %s\n",
           "d", "|Gd|", "max|Gd|²", "E[|Gd|²]", "length=N/d");

    double sum_E_Gd = 0;
    double max_Gd_overall = 0;
    int n_pieces = 0;
    double piece_data[100][2]; /* [max, e] */

    for (int d = 1; d <= D; d++) {
        int Gd[2000]; int Gd_cnt = 0;
        for (int m = 1; m*d < N+RANGE; m++) {
            int n = d * m;
            if (n >= N && n < N+RANGE) Gd[Gd_cnt++] = m;
        }
        if (Gd_cnt == 0) continue;

        double max_gd = 0, sum_gd = 0;
        for (int k = 0; k < ngrid; k++) {
            double t = (k+0.5)*T/ngrid;
            /* G_d at this t: Σ m^{-1/2-it} for m in Gd */
            double re=0, im=0;
            for (int j=0;j<Gd_cnt;j++) {
                double logm=log((double)Gd[j]);
                double amp=1.0/sqrt((double)Gd[j]);
                re += amp*cos(-t*logm);
                im += amp*sin(-t*logm);
            }
            double abs2 = re*re+im*im;
            sum_gd += abs2;
            if (abs2 > max_gd) max_gd = abs2;
        }
        double E_gd = sum_gd / ngrid;
        printf("  %4d | %4d | %10.4f | %10.4f | N/d=%d\n",
               d, Gd_cnt, max_gd, E_gd, (N+RANGE)/d - N/d);

        sum_E_Gd += E_gd;
        if (max_gd > max_Gd_overall) max_Gd_overall = max_gd;
        piece_data[n_pieces][0] = max_gd;
        piece_data[n_pieces][1] = E_gd;
        n_pieces++;
    }

    /* ═══════════════════════════════════════════ */
    printf("\n## 3. Multiplicative Large Sieve Bound\n\n");

    printf("  The KEY difference from additive decomposition:\n\n");
    printf("  ADDITIVE ℓ²:  |ΣG_d|² ≤ D · Σ|G_d|²    (D pieces)\n");
    printf("  → large values: #{|F|>V} ≤ D·Σ E[|G_d|²] / V²\n");
    printf("                            = D · %.4f / V²\n\n", sum_E_Gd);

    printf("  MULTIPLICATIVE ℓ²: |Σ d^{-s}G_d|² ≤ ??? \n");
    printf("  The factors d^{-it} provide EXTRA orthogonality because:\n");
    printf("  d₁^{-it} · d₂^{it} = (d₁/d₂)^{-it} oscillates for d₁≠d₂.\n\n");

    printf("  By the multiplicative large sieve (Montgomery-Vaughan):\n");
    printf("  ∫₀ᵀ |Σ aₐ d^{-it}|² dt ≤ (T + Σd²) · Σ|aₐ|²\n\n");
    printf("  But for our problem: aₐ = G_d(s) depends on t!\n");
    printf("  We can't directly apply the mult. large sieve.\n\n");

    printf("  HOWEVER: if we SEPARATE the t-dependence:\n");
    printf("    F(s) = Σ_d d^{-s} G_d(s)\n");
    printf("    |F(s)|² = Σ_{d₁,d₂} (d₁/d₂)^{-it} d₁^{-σ}d₂^{-σ} G_{d₁} Ḡ_{d₂}\n\n");

    printf("  For σ = 1/2:\n");
    printf("    = Σ_d |G_d|²/(d) + Σ_{d₁≠d₂} (d₁d₂)^{-1/2} (d₁/d₂)^{-it} G_{d₁}Ḡ_{d₂}\n\n");

    printf("  The DIAGONAL terms: Σ |G_d|²/d ← this is SMALLER than Σ|G_d|²\n");
    printf("  The OFF-DIAGONAL: oscillates with frequency log(d₁/d₂)\n\n");

    printf("  Over a SHORT INTERVAL [t₀, t₀+H]:\n");
    printf("  The off-diagonal averages to 0 when H·|log(d₁/d₂)| >> 1.\n");
    printf("  Since d₁,d₂ ≤ D: |log(d₁/d₂)| ≥ 1/D (for d₁≠d₂).\n");
    printf("  So: off-diagonal → 0 when H >> D.\n\n");

    /* Compute the actual diagonal vs off-diagonal */
    double diag_sum = 0;
    for (int d = 1; d <= D; d++) diag_sum += piece_data[d-1][1] / d;

    printf("  QUANTITATIVE (D=%d):\n", D);
    printf("    Diagonal contribution:     Σ E[|Gd|²]/d = %.4f\n", diag_sum);
    printf("    Full additive ℓ² bound:    D · Σ E[|Gd|²] = %.4f\n", D * sum_E_Gd);
    printf("    Ratio (saving factor):     %.2f×\n\n", D * sum_E_Gd / diag_sum);

    printf("  ★★★ The diagonal is %.1f× smaller than the ℓ² bound!\n",
           D * sum_E_Gd / diag_sum);
    printf("      This saving comes from the 1/d factor in the diagonal.\n\n");

    printf("  For the LARGE VALUES estimate:\n");
    printf("    Additive:     #{|F|>V} ≤ D · Σ||Gd||²∞ / V²\n");
    printf("    Multiplicative: #{|F|>V} ≤ Σ ||Gd||²∞/d / V² + off-diag\n\n");

    double add_lv = 0, mult_lv = 0;
    for (int d = 1; d <= D; d++) {
        add_lv += piece_data[d-1][0];
        mult_lv += piece_data[d-1][0] / d;
    }
    printf("    Additive sum:  D · max = %d · %.2f = %.2f\n",
           D, max_Gd_overall, D * max_Gd_overall);
    printf("    Multiplicative: Σmax/d = %.4f\n", mult_lv);
    printf("    SAVING: %.1f×\n\n", D * max_Gd_overall / mult_lv);

    /* ═══════════════════════════════════════════ */
    printf("## 4. 🔴 Red Team: Is This Saving Real?\n\n");

    printf("  The 1/d factor is real BUT there's a catch:\n\n");
    printf("  The diagonal |G_d|²/d weights SMALL d more heavily.\n");
    printf("  G_d for small d has length N/d ≈ N (long! → large).\n");
    printf("  G_d for large d has length N/d = small (→ small).\n\n");
    printf("  So the 1/d weight AND the length |G_d| BOTH decrease with d:\n");
    printf("    d=1: |G₁|² ≈ N,  1/d = 1    → contribution ≈ N\n");
    printf("    d=D: |G_D|² ≈ N/D, 1/d = 1/D → contribution ≈ N/D²\n\n");
    printf("  The total diagonal ≈ N · Σ_{d≤D} 1/d² ≈ N · π²/6.\n");
    printf("  The ℓ² bound ≈ D · N · ΣE[|Gd|²] ≈ D · N · D ≈ D²N.\n\n");
    printf("  SAVING: diagonal / ℓ² ≈ N·π²/(6D²N) ≈ π²/(6D²) → HUGE!\n\n");

    printf("  BUT: the off-diagonal is only small for H >> D.\n");
    printf("  If we're averaging over short intervals H < D,\n");
    printf("  the off-diagonal is NOT negligible.\n\n");

    printf("  THE TRADEOFF:\n");
    printf("  ┌──────────────┬──────────────────────────────────────────┐\n");
    printf("  │ H >> D       │ Off-diag → 0, saving ≈ D² (HUGE)       │\n");
    printf("  │              │ But: H >> D means LONG interval → weak  │\n");
    printf("  │ H << D       │ Off-diag ≈ diagonal → NO saving        │\n");
    printf("  │ H ≈ D        │ Partial cancellation → some saving      │\n");
    printf("  └──────────────┴──────────────────────────────────────────┘\n\n");

    printf("  GM's short average uses H = N^{α} for α < 1.\n");
    printf("  If we set D = H = N^{α}, the saving is D² = N^{2α}.\n\n");

    printf("  ★ COMBINED with GM's short average:\n");
    printf("    GM's saving: δ_GM from the short average\n");
    printf("    Hyperbolic saving: + 2α (from the 1/d factor)\n");
    printf("    Total: δ_total = δ_GM + 2α\n\n");

    printf("  This is a GENUINE IMPROVEMENT if the hyperbolic\n");
    printf("  off-diagonal cancellation can be controlled!\n\n");

    printf("  The off-diagonal control requires bounding:\n");
    printf("    Σ_{d₁≠d₂} (d₁d₂)^{-1/2} |G_{d₁}| |G_{d₂}|\n");
    printf("    × |(1/H)∫ (d₁/d₂)^{-it} dt|\n\n");
    printf("  The integral = sinc(H·log(d₁/d₂)/(2π)).\n");
    printf("  For d₁/d₂ = 1 + k/d₂: log(d₁/d₂) ≈ k/d₂.\n");
    printf("  sinc ≈ 0 when H·k/d₂ >> 1, i.e., k >> d₂/H.\n\n");

    printf("  So: off-diagonal pairs with |d₁-d₂| > D/H contribute ~0.\n");
    printf("  Remaining: |d₁-d₂| ≤ D/H pairs = at most D·(D/H) = D²/H.\n");
    printf("  If H = D: off-diag ≈ D pairs (same as diagonal). Saving ≈ 1.\n\n");

    printf("  ★ BOTTOM LINE: hyperbolic splitting gives a saving of\n");
    printf("    (D/H) from the off-diagonal cancellation.\n");
    printf("    With D = N^β and H = N^α, saving = N^{β-α}.\n\n");
    printf("    Combined with GM: total saving = δ_GM + (β-α).\n");
    printf("    But β-α must be positive (D > H) for this to help.\n");
    printf("    And D > H is EXACTLY the regime where the off-diagonal\n");
    printf("    has only partial cancellation.\n\n");

    printf("  The QUESTION: can the multiplicative structure of d^{-it}\n");
    printf("  (which spaces log(d) values LOG-UNIFORMLY, not linearly)\n");
    printf("  give BETTER off-diagonal cancellation than the generic bound?\n\n");

    printf("  This connects to the MULTIPLICATIVE LARGE SIEVE theorem,\n");
    printf("  which IS stronger than the additive version for\n");
    printf("  multiplicative characters.\n");

    free(S);
    return 0;
}
