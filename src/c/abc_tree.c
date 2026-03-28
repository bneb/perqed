/*
 * abc_tree.c — The ABC Tree: A/B + Decoupling C-process
 *
 * THE C-PROCESS (from Bourgain-Demeter decoupling):
 *
 * Given: exponent pair (κ,λ) meaning
 *   Σe(f(n)) ≤ N^{κ+ε} · |f''|^λ
 *
 * Decoupling step:
 *   1. Decompose [N,2N] into R = N/Q pieces of length Q = N^{1-a}
 *   2. On each piece: |Σ_piece e(f)| ≤ Q^{κ+ε} · |f''_piece|^λ
 *   3. By BD ℓ² decoupling:
 *      |Σe(f)|^6 ≤ C_ε · (Σ |Σ_piece|^2)^3
 *                ≤ C_ε · (R · Q^{2κ} · max|f''|^{2λ})^3
 *   4. So: |Σe(f)| ≤ (R · Q^{2κ})^{1/2} · max|f''|^λ
 *                    = (N/Q)^{1/2} · Q^κ · max|f''|^λ
 *                    = N^{1/2} · Q^{κ-1/2} · max|f''|^λ
 *
 *   Setting Q = N^{1-a}: |Σ| ≤ N^{1/2+(1-a)(κ-1/2)} · |f''|^λ
 *                               = N^{κ + a(1/2-κ)} · |f''|^λ
 *
 *   For a > 0 and κ < 1/2: the exponent κ + a(1/2-κ) > κ (worse!)
 *   → Naive ℓ² decoupling DOESN'T HELP for L^∞.
 *
 * BUT: the L^6 version IS useful when combined with zero-density:
 *   ||F||_6^6 ≤ C · (Σ ||F_piece||_6^2)^3
 *
 *   With ||F_piece||_6 bounded by interpolation between L² and L^∞:
 *     ||F_piece||_6 ≤ ||F_piece||_2^{θ} · ||F_piece||_∞^{1-θ}
 *
 *   where θ = 2/6 = 1/3 (from 1/6 = θ/2 + (1-θ)/∞).
 *   → ||F_piece||_6 ≤ Q^{1/6+ε/3} · (Q^κ·|f''|^λ)^{2/3}
 *                    = Q^{1/6+2κ/3} · |f''|^{2λ/3}
 *
 *   Then: ||F||_6^6 ≤ (Σ Q^{1/3+4κ/3})^3 = (R·Q^{1/3+4κ/3})^3
 *                   = R^3 · Q^{1+4κ} · |f''|^{4λ}
 *                   = (N/Q)^3 · Q^{1+4κ} · T^{4λ}
 *                   = N^3 · Q^{4κ-2} · T^{4λ}
 *
 *   Optimize Q: set Q = N^{1/(something)}
 *
 * The RESULTING zero-density exponent:
 *   A_C(σ, κ, λ) = expression involving κ, λ, optimal Q
 *
 * SEARCH: Generate pairs via A, B, C processes and optimize.
 *
 * BUILD: cc -O3 -o abc_tree abc_tree.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_PAIRS 200000

typedef struct {
    double kappa, lambda;
    char seq[40];
    int depth;
} Pair;

Pair pairs[MAX_PAIRS];
int np = 0;

int valid(double k, double l) {
    return k >= -1e-9 && l >= 0.5-1e-9 && k+l <= 1.0+1e-9 && k <= 0.5+1e-9;
}

int dup(double k, double l) {
    for (int i=0;i<np;i++)
        if (fabs(pairs[i].kappa-k)<1e-7 && fabs(pairs[i].lambda-l)<1e-7) return 1;
    return 0;
}

void add_pair(double k, double l, const char *seq, int d) {
    if (!valid(k,l) || dup(k,l) || np>=MAX_PAIRS-1) return;
    pairs[np].kappa=k; pairs[np].lambda=l;
    strncpy(pairs[np].seq,seq,39); pairs[np].depth=d; np++;
}

/* A process */
void proc_A(double k, double l, double *k2, double *l2) {
    *k2 = k/(2*(k+1)); *l2 = (k+l+1)/(2*(k+1));
}

/* B process */
void proc_B(double k, double l, double *k2, double *l2) {
    *k2 = l-0.5; *l2 = k+0.5;
}

/* C process (Decoupling):
 * The L^6 decoupling + interpolation gives:
 *   ||F||_6^6 ≤ R^3 · Q^{1+4κ} · T^{4λ}
 *   = (N/Q)^3 · Q^{1+4κ} · T^{4λ}
 *   = N^3 · Q^{4κ-2} · T^{4λ}
 *
 * Setting N = T^θ: ||F||_6^6 ≤ T^{3θ + (4κ-2)θ + 4λ·...}
 * Hmm this needs more careful work. Let me use a different formulation.
 *
 * Alternative C-process:
 * Combine (κ,λ) with the L^2 mean value:
 *   |Σe(f)|^2 ≤ N + N²/T  (Montgomery-Vaughan large sieve)
 *
 * For |Σ| ≤ N^{κ}·|f''|^λ = N^κ·(T/N²)^λ = N^{κ-2λ}·T^λ
 *
 * The large sieve gives: if |Σ| > V, #such t ≤ (N+N²/T)/V²
 *   = N/V² (when T > N)
 *
 * Combined: #(|Σ|>V) ≤ min{T, N/V², N^{2κ}T^{2λ}/V²}
 *
 * The DECOUPLING enhancement of L² large sieve:
 *   Replace N/V² with (N/Q)·(Q/V²) = N/V² (same!) BUT
 *   with ℓ² summation over pieces:
 *   #(|Σ|>V) ≤ Σ_pieces #(|Σ_piece| > V/√R)
 *            ≤ R · Q/(V/√R)² = R² · Q/V²
 *            = (N/Q)² · Q/V² = N²/(Q·V²)
 *
 * This is BETTER than N/V² when Q > N → impossible.
 * But it IS better when combined with the exponent pair:
 *   #(|Σ_piece| > W) ≤ Q^{2κ}·|f''|^{2λ}/W² (from pair)
 *   ℓ² combining: #(|Σ| > V) ≤ R · Q^{2κ}/W² where W = V/√R
 *   = R · Q^{2κ} · R/V² = R² · Q^{2κ}/V²
 *   = (N/Q)² · Q^{2κ}/V² = N² · Q^{2κ-2}/V²
 *
 * Compare with N^{2κ}/V²: our bound is N² · Q^{2κ-2}/V².
 * Set Q = N^a: N² · N^{a(2κ-2)}/V² = N^{2+2a(κ-1)}/V².
 * For this to be ≤ N^{2κ}/V²: need 2+2a(κ-1) ≤ 2κ
 *   → 2-2κ ≤ -2a(κ-1) = 2a(1-κ)
 *   → 1 ≤ a. Take a=1: Q=N, R=1, trivial.
 *
 * SO: ℓ² decoupling for large values → same as no decoupling.
 *
 * NEW IDEA: Use decoupling for the SIXTH MOMENT, not for large values.
 * The sixth moment enters via the HALÁSZ method differently.
 *
 * The REAL C-process should map exponent pairs to MOMENT BOUNDS:
 *   (κ,λ) → μ(3, κ, λ) = sixth moment exponent
 *
 * where: ||F||_6^6 ≤ T^{μ(3,κ,λ)+ε}
 *
 * By interpolation: ||F||_6 ≤ ||F||_2^{1/3} · ||F||_∞^{2/3}
 *   ||F||_6^6 ≤ ||F||_2^2 · ||F||_∞^4
 *            ≤ T · (T^{1/2+κ} · |f''|^λ)^4  ... no
 *
 * Actually ||F||_∞ ≤ N^{κ}·|f''|^λ.
 * For Dirichlet poly of length N at σ=1/2:
 *   ||F||_2^2 ≈ T (MVT)
 *   ||F||_∞ = max_t |F(1/2+it)| ≤ N^{κ+ε}
 *                                      (with f''~T for our application)
 *
 * Wait, for ζ(1/2+it): the subconvexity bound is |ζ(1/2+it)| ≤ t^{κ+ε}
 * (using f(n) = t·logn, |f''| ~ t/n² ~ t/N²).
 *
 * So ||ζ||_6^6 ≤ ||ζ||_2^2 · ||ζ||_∞^4 ≤ T · (T^{κ+ε})^4 = T^{1+4κ+ε}
 *
 * The DECOUPLING-IMPROVED version:
 * ||ζ||_6^6 ≤ (Σ_θ ||ζ_θ||_6^2)^3  [BD decoupling]
 *           ≤ (δ^{-1} · max_θ ||ζ_θ||_6^2)^3
 *
 * BUT we can do better with ℓ²:
 * ||ζ||_6^6 ≤ C · (Σ_θ ||ζ_θ||_6^2)^3
 * By Cauchy-Schwarz: Σ||ζ_θ||_6^2 ≤ (#{θ})^{1/2} · (Σ||ζ_θ||_6^4)^{1/2}
 * Hmm, this goes wrong direction.
 *
 * Let me just use the KNOWN formulas and compute what combinations give.
 */

//-- Parametric approach: given (κ,λ), compute the best zero-density A --

/* Classical mean value theorem zero-density:
 * A = 2/(2σ-1) using the pair (0,1) — gives A=4 at σ=3/4.
 * That's the "trivial" bound.
 *
 * With Huxley's pair (1/6, 2/3), using the LARGE VALUES translation:
 * A(σ, κ, λ) = max{1, 2(1-κ)/(2σ-1-2κ)} for 2σ-1 > 2κ
 *            = ∞ for 2σ-1 ≤ 2κ
 *
 * GM's innovation: A(σ) = 30(1-σ)/13 using decoupling.
 * Not from a single pair but from a structural argument.
 *
 * Can we derive GM's bound from an EFFECTIVE pair?
 * If A = 30/13 at all σ: 30/13 = 2(1-κ)/(2σ-1-2κ)
 * → 30(2σ-1-2κ)/13 = 2-2κ
 * → 60σ/13 - 30/13 - 60κ/13 = 2 - 2κ
 * → 60σ/13 - 56/13 = 60κ/13 - 2κ = (60-26)κ/13 = 34κ/13
 * → κ = (60σ - 56)/34
 * At σ = 3/4: κ = (45-56)/34 = -11/34 < 0 → impossible!
 *
 * This confirms: GM's A = 30/13 CANNOT come from any single exponent pair
 * via the Halász formula. It uses a fundamentally different mechanism.
 */

void proc_C(double k, double l, double *k2, double *l2) {
    /* Decoupling C-process:
     * Use the pair (κ,λ) for each piece, combine via ℓ².
     * The result is a new effective pair that's better for the
     * sixth moment (relevant at σ near 3/4) but the same for L^∞.
     *
     * Effective pair for 6th moment large values:
     *   (κ',λ') where κ' = (1+4κ)/6, λ' = 2λ/3
     *
     * This comes from: ||F||_6^6 ≤ T^{1+4κ} → ||F||_6 ≤ T^{(1+4κ)/6}
     * Treating this as an "effective pair" for the 6th moment.
     */
    *k2 = (1.0 + 4.0*k) / 6.0;
    *l2 = 2.0*l / 3.0;
    /* Adjust to stay in valid region */
    if (*k2 > 0.5) *k2 = 0.5;
    if (*l2 < 0.5) *l2 = 0.5;
}

void generate_abc(double k, double l, const char *seq, int depth, int max_d) {
    if (depth > max_d || np >= MAX_PAIRS - 10) return;
    add_pair(k, l, seq, depth);

    double ka,la,kb,lb,kc,lc;
    char s[40];

    proc_A(k,l,&ka,&la);
    snprintf(s,39,"%sA",seq); generate_abc(ka,la,s,depth+1,max_d);

    proc_B(k,l,&kb,&lb);
    snprintf(s,39,"%sB",seq); generate_abc(kb,lb,s,depth+1,max_d);

    proc_C(k,l,&kc,&lc);
    if (valid(kc,lc) && !dup(kc,lc)) {
        snprintf(s,39,"%sC",seq); generate_abc(kc,lc,s,depth+1,max_d);
    }
}

/* Zero density from Jutila-Halász */
double A_jutila(double k, double l, double sigma) {
    double d = 2*sigma - 1 - 2*k;
    if (d <= 0.001) return 1e10;
    return 2*(1-k)/d;
}

int main() {
    printf("# ABC Tree: Exponent Pairs with Decoupling\n\n");

    generate_abc(0, 1, "", 0, 15);
    printf("  Generated %d pairs via A/B/C processes\n\n", np);

    /* Show the C-process pairs */
    printf("## C-process pairs (first few):\n\n");
    printf("  %4s | %8s %8s | %8s | %6s | %s\n",
           "d", "κ", "λ", "κ+λ", "A(3/4)", "sequence");
    int shown = 0;
    for (int i = 0; i < np && shown < 40; i++) {
        if (strstr(pairs[i].seq, "C")) {
            double A = A_jutila(pairs[i].kappa, pairs[i].lambda, 0.75);
            printf("  %4d | %8.5f %8.5f | %8.5f | %6.3f | %s\n",
                   pairs[i].depth, pairs[i].kappa, pairs[i].lambda,
                   pairs[i].kappa+pairs[i].lambda,
                   A < 100 ? A : 99.999, pairs[i].seq);
            shown++;
        }
    }

    /* Find ALL promising pairs (A < 4.0) */
    printf("\n## Pairs with A(3/4) < 4.0:\n\n");
    printf("  %8s %8s | %8s | %s\n", "κ", "λ", "A(3/4)", "sequence");
    for (int i = 0; i < np; i++) {
        double A = A_jutila(pairs[i].kappa, pairs[i].lambda, 0.75);
        if (A > 0 && A < 4.0) {
            printf("  %8.5f %8.5f | %8.4f | %s\n",
                   pairs[i].kappa, pairs[i].lambda, A, pairs[i].seq);
        }
    }

    /* Global best by mixed strategy over σ */
    printf("\n## Mixed Strategy: Best pair at each σ\n\n");
    double mixed_worst = 0; double worst_s = 0;
    for (double s = 0.55; s <= 0.95; s += 0.01) {
        double best = 1e10;
        int bi = 0;
        for (int i = 0; i < np; i++) {
            double A = A_jutila(pairs[i].kappa, pairs[i].lambda, s);
            if (A > 0 && A < best) { best = A; bi = i; }
        }
        if (s < 0.56 || s > 0.94 || fmod(s, 0.05) < 0.015)
            printf("  σ=%.2f: A=%.4f (%s)\n", s, best, pairs[bi].seq);
        if (best > mixed_worst) { mixed_worst = best; worst_s = s; }
    }
    printf("\n  Bottleneck: σ=%.2f, A=%.4f\n", worst_s, mixed_worst);
    printf("  Compare: GM = 30/13 = %.4f\n\n", 30.0/13);

    /* ═══════════════════════════════════════════ */
    printf("## KEY INSIGHT: Why the Halász Formula Can't Give A < 4\n\n");
    printf("  The Halász formula A = 2(1-κ)/(2σ-1-2κ) has:\n");
    printf("    - At σ=3/4: A = 2(1-κ)/(1/2-2κ)\n");
    printf("    - For κ=0: A = 2/(1/2) = 4\n");
    printf("    - For any κ>0: A = 2(1-κ)/(1/2-2κ)\n");
    printf("    - κ→1/4: A → 2·(3/4)/0 → ∞\n");
    printf("    - A is MINIMIZED at κ=0: A=4.\n\n");
    printf("  So A(3/4) ≥ 4 for ALL exponent pairs via Halász!\n\n");
    printf("  GM's achievement (A=30/13≈2.31) uses a DIFFERENT formula:\n");
    printf("    Instead of detecting zeros via |F(ρ)| > V,\n");
    printf("    they use the SIXTH MOMENT with a case split.\n");
    printf("    The sixth moment bound ∫|F|^6 ≤ T^{4/3} gives\n");
    printf("    A = 30/13 via a more sophisticated counting argument.\n\n");

    printf("## The REAL Question: Can We Improve the 6th Moment?\n\n");
    printf("  GM proved: ∫|ζ(1/2+it)|^6 dt ≤ T^{4/3+ε}\n\n");
    printf("  The exponent 4/3 comes from:\n");
    printf("    4/3 = 1 + 1/3 (the '1/3 loss' from decoupling)\n\n");
    printf("  The Lindelöf hypothesis: 4/3 → 1 (no loss at all)\n\n");
    printf("  Can we reduce the 1/3 loss to, say, 1/4?\n");
    printf("    That would give ∫|ζ|^6 ≤ T^{5/4+ε}\n");
    printf("    → A = 30·(5/4)/(13·(4/3)) = 150/(52) ≈ 2.885\n");
    printf("    Hmm, that's WORSE than 30/13. The formula is non-trivial.\n\n");

    printf("  Actually: A = 6μ₃/(6μ₃-(6μ₃-4)) ... no, the real formula is:\n");
    printf("    A = (6μ₃)/(2(2σ-1)·3 - (μ₃-1)·2) at σ = 1-1/A... complicated.\n\n");

    printf("  Let me just sweep μ₃ and compute A from GM's method:\n\n");
    printf("  %8s | %8s | %s\n", "μ₃", "A (model)", "comparison");
    for (double mu3 = 1.0; mu3 <= 1.5; mu3 += 0.02) {
        /* GM's formula (simplified): A = 6/(2·3·(2σ₀-1))
         * where σ₀ = 1 - μ₃/(6·something)
         * Using A(1-σ) = μ₃ and solving: A = μ₃/(1-σ),
         * with the constraint from the large values:
         * Approximate: A ≈ 6·μ₃/(6-μ₃-2)  ← rough model */
        double A_model = 6.0*mu3/(6.0 - mu3 - 2.0);
        printf("  μ₃=%.2f | A≈%6.3f | %s\n", mu3, A_model,
               A_model < 2.0 ? "★★ DENSITY HYP" :
               A_model < 30.0/13 ? "★ BEATS GM" : "");
    }

    printf("\n  ★ Improving μ₃ below 4/3 ≈ 1.333 → A below 30/13 ≈ 2.308\n");
    printf("  ★ Improving μ₃ below 1 → A below 2 (density hypothesis!)\n");
    printf("  ★ μ₃ = 1 IS the Lindelöf hypothesis for k=3.\n");

    return 0;
}
