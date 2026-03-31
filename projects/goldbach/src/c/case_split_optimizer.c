/*
 * case_split_optimizer.c — Model the Guth-Maynard case split optimization
 * and test whether finer splits improve the exponent.
 *
 * The large values problem:
 * Given F(t) = Σ_{n~N} a_n n^{-it}, how many J well-separated
 * points t_j ∈ [0,T] can satisfy |F(t_j)| ≥ V = N^σ?
 *
 * The bounds depend on the additive energy E of the point set:
 *   E(S) = #{(i,j,k,l): t_i + t_j = t_k + t_l}
 * Ranges: J² ≤ E ≤ J³
 *
 * BOUND 1 (Mean value): J ≤ TN / V²
 *   Valid always. Exponent: A_mv = 2σ/(2σ-1) when V = N^σ, T ~ N.
 *
 * BOUND 2 (Halász-Montgomery / Heath-Brown):
 *   When E ≥ E₀: J ≤ (TN/V²)^{2/3} · E₀^{1/3} / V^{2/3} (simplified)
 *   Better with more structure.
 *
 * BOUND 3 (Decoupling / Guth-Maynard):
 *   When E ≤ E₀: J ≤ (TN)^{1+ε} / V^{4+2δ(E₀)} (simplified)
 *   Better with less structure.
 *
 * The actual exponents are more subtle. Let me model the key relationship.
 *
 * From Guth-Maynard: the zero density exponent at σ is determined by:
 *   A(σ) = inf_{α: balancing parameter} max(f₁(σ,α), f₂(σ,α))
 * where f₁ comes from the high-energy case and f₂ from low-energy.
 *
 * For the 2-way split:
 *   f₁(σ,α) = function from Heath-Brown + additive energy ≥ J^{2+α}
 *   f₂(σ,α) = function from decoupling + additive energy ≤ J^{2+α}
 *
 * The critical point σ = 3/4 gives:
 *   A(3/4) = 30/13 (from Guth-Maynard)
 *   A(3/4) = 12/5 (from Huxley)
 *
 * For a k-way split, we optimize over (k-1) thresholds.
 *
 * MODEL (simplified but captures the key structure):
 * At the critical value σ = 3/4 (V = N^{3/4}):
 *
 * The large values set S has |S| = J and additive energy E.
 * Write E = J^{2+β} for β ∈ [0,1].
 *
 * Bound from classical (good for high energy, large β):
 *   J ≤ T^{a₁(β)}  where a₁(β) = (some decreasing function of β)
 *
 * Bound from decoupling (good for low energy, small β):
 *   J ≤ T^{a₂(β)}  where a₂(β) = (some increasing function of β)
 *
 * 2-way split: A = min_β₀ max(a₁(β₀), a₂(β₀))
 * k-way split: same optimization (minimax is minimax regardless of # cases)
 *
 * KEY INSIGHT: if a₁ and a₂ are the ONLY two bounds, then the minimax
 * is the crossing point of a₁ and a₂, and MORE CASE SPLITS DON'T HELP.
 *
 * But if there's a THIRD bound a₃(β) that's better than both in some range,
 * then a 3-way split could improve things.
 *
 * Let's model this and check.
 */

#include <stdio.h>
#include <stdlib.h>
#include <math.h>

/*
 * Simplified model of the bounds:
 *
 * The zero-density exponent for N(σ,T) ≤ T^{A(1-σ)} at σ comes from:
 *
 * Given J points with |F(t_j)| ≥ N^σ and additive energy E = J^{2+β}:
 *
 * Bound 1 (mean value): J ≤ N^{2(1-σ)+ε}  → A_mv = 2
 *   (This gives the Density Hypothesis value A=2)
 *
 * Bound 2 (Huxley, from 4th moment + additive structure):
 *   J ≤ N^{(12/5)(1-σ)·g₁(β,σ)}
 *   For β=1 (max structure): better
 *   For β=0 (no structure): gives 12/5
 *
 * Bound 3 (Decoupling, from BDG):
 *   J ≤ N^{A_dec(β,σ)·(1-σ)}
 *   Better for small β
 *
 * In Guth-Maynard, the crossing of bounds 2 and 3 at σ=3/4
 * gives A = 30/13.
 *
 * Let me model the actual exponent curves.
 *
 * From the paper's key theorem (paraphrased):
 * For V = N^σ with 1/2 < σ < 1:
 *
 * Classical (Huxley): J ≤ N^{(12/5)(1-σ)}·T^ε
 *   → A_classical = 12/5 = 2.4
 *
 * Guth-Maynard beat this at σ ≤ 3/4 via decoupling.
 * At σ = 3/4 specifically:
 *   Classical gives A = 12/5 = 2.4  → J ≤ T^{0.6}·N^ε
 *   GM gives A = 30/13 ≈ 2.307 → J ≤ T^{0.577}·N^ε
 *
 * The GM bound is obtained by:
 *   If E(S) ≥ J^{2+α}: Heath-Brown bound gives
 *     J ≤ T^{(4-2α)/(4σ-2+α)} (simplified)
 *   If E(S) < J^{2+α}: decoupling gives
 *     J ≤ T^{2/(2σ-1+α/2)} (simplified)
 *
 *   At σ=3/4: optimize over α to get J ≤ T^{30/13·(1-3/4)} = T^{30/52}
 *
 * Now, for a 3-way split with thresholds α₁ < α₂:
 *   Case A: E ≥ J^{2+α₂} → classical bound f_A(α₂)
 *   Case B: J^{2+α₁} ≤ E < J^{2+α₂} → interpolated bound f_B(α₁,α₂)
 *   Case C: E < J^{2+α₁} → decoupling bound f_C(α₁)
 *
 * The question is whether f_B can be better than max(f_A, f_C).
 */

/* Model: at σ=3/4, the exponent A as a function of the
 * additive energy parameter α ∈ [0,1]:
 *
 * f_HB(α) = exponent from Heath-Brown when E ≥ J^{2+α}
 *          Higher α → more structure assumed → better bound
 *          f_HB(α) is DECREASING in α
 *
 * f_dec(α) = exponent from decoupling when E ≤ J^{2+α}
 *          Higher α → more energy allowed → weaker constraint → worse bound
 *          f_dec(α) is INCREASING in α
 *
 * From Guth-Maynard, the specific formulas at σ=3/4:
 */

/* Heath-Brown bound exponent as function of energy parameter α */
/* When E ≥ J^{2+α}, for σ = 3/4:
 * J ≤ (TN/V²)^{2/(2+α)} = (T·N^{1-2σ})^{2/(2+α)}
 * At σ=3/4: J ≤ T^{2/(2+α)} · N^{-1/(2+α)}
 * For T ~ N: J ≤ N^{1/(2+α)}  ... hmm, this doesn't match.
 *
 * Let me use a more direct model.
 * The zero density exponent A satisfies:
 * N(σ,T) ≤ T^{A(1-σ)+ε}
 *
 * From the classical Halász-Montgomery-Huxley approach:
 * The bound J(V,T) feeds into zero-density via a specific relationship.
 *
 * Rather than deriving the exact formulas, let me use the known
 * endpoints to calibrate:
 *
 * - At α = 0: f_dec(0) = 2 (density hypothesis value, decoupling trivial)
 *             f_HB(0) = 12/5 = 2.4 (Huxley)
 * - At α = 1: f_dec(1) = 12/5 = 2.4 (decoupling gives nothing extra)
 *             f_HB(1) = something ≤ 2 (strong structure → good bound)
 *
 * The crossing point: f_HB(α*) = f_dec(α*) = 30/13 ≈ 2.307
 *
 * For a simple model, assume linear interpolation:
 * f_HB(α) = 12/5 + (2 - 12/5)·α/(1) = 2.4 - 0.4·α  (decreasing)
 * f_dec(α) = 2 + (12/5 - 2)·α/(1) = 2 + 0.4·α       (increasing)
 *
 * Crossing: 2.4 - 0.4α = 2 + 0.4α → 0.4 = 0.8α → α = 0.5
 * Value: 2 + 0.4·0.5 = 2.2  ≠ 30/13 ≈ 2.307
 *
 * So linear doesn't match. Let me try:
 * f_HB(α) = 12/5 · (1-α) + c₁·α    (decreasing, c₁ < 12/5)
 * f_dec(α) = c₂ + (12/5 - c₂)·α^p  (increasing, concave or convex)
 *
 * Calibrate to 30/13 at crossing:
 */

double f_HB(double alpha) {
    /* Heath-Brown bound: decreasing in α (more structure → better) */
    /* Calibrated so f_HB(0) = 12/5, f_HB(1) ≈ 2 */
    /* With the crossing at α* giving 30/13 */
    /* Using: f_HB(α) = 12/5 - (12/5 - 30/13)·α / α* where α* solves crossing */
    /* Let's use the form from the paper's structure:
     * f_HB(α) = 2/(1 - δ_HB(α)) where δ_HB increases with α
     */
    return 2.4 / (1.0 + 0.2 * alpha);  /* gives f_HB(0)=2.4, f_HB(1)=2.0 */
}

double f_dec(double alpha) {
    /* Decoupling bound: increasing in α (less constraint → worse) */
    /* f_dec(0) should be 2 (density hypothesis if E is truly minimal) */
    /* f_dec(1) should be 12/5 (decoupling gives nothing) */
    /* Calibrate so crossing f_HB(α*) = f_dec(α*) = 30/13 */
    return 2.0 + 0.4 * pow(alpha, 0.7);  /* concave curve */
}

/* Possible third bound: from a k-th moment method */
double f_moment(double alpha, int k) {
    /* k-th moment bound: J ≤ (T^{k} · expression)^{1/k} */
    /* Depends on additive energy through higher-order correlations */
    /* For k=2 (Halász-Montgomery): gives 5/2 */
    /* For k=4 (Huxley): gives 12/5 */
    /* For k=6 (hypothetical 6th moment): gives 7/3 */
    double A_k = (2.0 * k - 1.0) / k;  /* limiting behavior */
    /* Correction for energy parameter */
    return A_k + (2.4 - A_k) * pow(1.0 - alpha, 0.5);
}

int main() {
    printf("# Zero-Density Exponent Optimizer: k-way Case Splits\n\n");

    /* First, calibrate the model */
    printf("# Calibration:\n");
    for (double a = 0; a <= 1.01; a += 0.1) {
        printf("  α=%.1f: f_HB=%.4f  f_dec=%.4f  max=%.4f\n",
               a, f_HB(a), f_dec(a), fmax(f_HB(a), f_dec(a)));
    }

    /* Find the 2-way optimal (should give ~30/13) */
    double best_2way = 999;
    double best_alpha = 0;
    for (double a = 0; a <= 1.0; a += 0.0001) {
        double val = fmax(f_HB(a), f_dec(a));
        if (val < best_2way) {
            best_2way = val;
            best_alpha = a;
        }
    }
    printf("\n# 2-way split: A = %.6f at α* = %.4f\n", best_2way, best_alpha);
    printf("#   (Target: 30/13 = %.6f)\n", 30.0/13);

    /* 3-way split with a third bound */
    printf("\n# 3-way split using k-th moment bounds:\n");
    printf("#  k  |    A_3way  |  improvement over 2-way\n");

    for (int k = 3; k <= 10; k++) {
        double best_3way = 999;
        double best_a1 = 0, best_a2 = 0;

        for (double a1 = 0; a1 <= 1.0; a1 += 0.001) {
            for (double a2 = a1 + 0.001; a2 <= 1.0; a2 += 0.001) {
                /* Case A: E ≥ J^{2+a2} → use f_HB(a2) */
                /* Case B: J^{2+a1} ≤ E < J^{2+a2} → use f_moment(avg, k) */
                /* Case C: E < J^{2+a1} → use f_dec(a1) */
                double bound_A = f_HB(a2);
                double bound_B = f_moment((a1 + a2) / 2.0, k);
                double bound_C = f_dec(a1);
                double val = fmax(fmax(bound_A, bound_B), bound_C);
                if (val < best_3way) {
                    best_3way = val;
                    best_a1 = a1;
                    best_a2 = a2;
                }
            }
        }

        double improvement = best_2way - best_3way;
        printf("  k=%2d | A=%.6f | %+.6f  %s (α₁=%.3f, α₂=%.3f)\n",
               k, best_3way, improvement,
               (improvement > 0.0001) ? "BETTER ✓" : "",
               best_a1, best_a2);
    }

    /* Also try: continuous optimization with N bounds */
    printf("\n# N-way split (continuous): best of all k-th moment bounds at each α\n");
    {
        /* For each α, compute the tightest bound across all methods */
        double best_cont = 999;
        double best_a = 0;

        for (double a = 0; a <= 1.0; a += 0.0001) {
            double bound = fmin(f_HB(a), f_dec(a));
            for (int k = 3; k <= 20; k++)
                bound = fmin(bound, f_moment(a, k));
            if (bound < best_cont) {
                best_cont = bound;
                best_a = a;
            }
        }
        printf("  Best continuous: A = %.6f at α = %.4f\n", best_cont, best_a);
        printf("  Improvement over 2-way: %+.6f\n", best_2way - best_cont);
    }

    printf("\n# NOTE: These results depend on the model calibration.\n");
    printf("# The actual improvement depends on the precise form of the bounds.\n");
    printf("# If any 3-way split shows BETTER, it warrants further mathematical analysis.\n");

    return 0;
}
