/*
 * spectral_translation.c — Does Spectral Fourth Moment → Better Zero-Density?
 *
 * THE QUESTION:
 *   At σ = 0.55, the spectral bound gives fourth moment error T^{0.29}
 *   vs generic T^{0.90}. Does this improve A = 30/13?
 *
 * THE TRANSLATION:
 *   Ingham's density theorem derives N(σ,T) from ∫|ζ(σ+it)|⁴.
 *   The fourth moment = MAIN TERM + ERROR.
 *   N(σ,T) is bounded by the FULL fourth moment (main + error).
 *   Does improving the ERROR improve N(σ,T)?
 *
 * BUILD: cc -O3 -o spectral_translation spectral_translation.c -lm
 */
#include <stdio.h>
#include <math.h>

int main() {
    printf("═══════════════════════════════════════════════════════\n");
    printf("  Does Spectral ∫|ζ|⁴ Improvement → Better N(σ,T)?\n");
    printf("═══════════════════════════════════════════════════════\n\n");

    /* ════════════ THE INGHAM ARGUMENT ════════════ */
    printf("## 1. How Ingham Uses the Fourth Moment\n\n");

    printf("  Ingham's density theorem (1940):\n");
    printf("    N(σ,T) ≤ T^{3(1-σ)/(3σ-1)+ε}\n\n");

    printf("  DERIVATION SKETCH:\n");
    printf("  Step 1: For zeros ρ = β+iγ with β > σ:\n");
    printf("    |ζ'(ρ)/ζ(ρ)| is 'large' (pole of order 1)\n");
    printf("    But ζ(ρ) = 0, so use ζ' instead:\n");
    printf("    |ζ'(ρ)| ≈ logT (from Hadamard product)\n\n");

    printf("  Step 2: By the zero-detecting inequality:\n");
    printf("    N(σ,T) ≤ Σ_ρ 1 ≤ Σ_ρ |ζ(β+iγ)/ζ(σ+iγ)|^4 · C(σ,β)\n\n");

    printf("  Step 3: Use Hölder's inequality to separate:\n");
    printf("    N(σ,T) ≤ [∫|ζ(σ+it)|⁴ dt]^{a} · [∫|ζ(β+it)|⁴ dt]^{b}\n");
    printf("           · [something about zero-spacing]^{c}\n\n");

    printf("  Step 4: ∫|ζ(σ+it)|⁴ = T·ζ(2σ)⁴/ζ(4σ) + ERROR\n\n");

    printf("  ★ The MAIN TERM T·ζ(2σ)⁴/ζ(4σ) dominates.\n");
    printf("  ★ The ERROR is subleading: O(T^{2/3+ε}) at best.\n");
    printf("  ★ N(σ,T) is bounded by the FULL integral (main + error).\n\n");

    printf("  Therefore: improving the ERROR does NOT change A!\n\n");

    printf("  The main term gives:\n");
    printf("    N(σ,T) ≤ [T · C(σ)]^a · [...] ∝ T^{something}\n");
    printf("  and A = 3/(3σ-1) comes from the MAIN TERM.\n\n");

    /* ════════════ RED TEAM ════════════ */
    printf("## 2. 🔴 RED TEAM: Why Spectral ≠ Better Density\n\n");

    printf("  CLAIM: Motohashi spectral bound at σ=0.55 gives error\n");
    printf("    T^{0.29} instead of T^{0.90}.\n");
    printf("  HOPE: This improves A from 30/13 to something smaller.\n\n");

    printf("  KILL: The fourth moment error is IRRELEVANT for density.\n\n");

    printf("  Here's why:\n\n");

    printf("  ∫₀ᵀ |ζ(σ+it)|⁴ dt = T · M(σ) + E(T,σ)\n");
    printf("  where M(σ) = ζ(2σ)⁴/ζ(4σ) and E = o(T).\n\n");

    printf("  Ingham: N(σ,T) ≤ C · [∫|ζ(σ+it)|⁴ dt]^{power}\n");
    printf("  ≈ C · [T · M(σ)]^{power} · [1 + E/(T·M)]^{power}\n");
    printf("  ≈ C · T^{power} · M^{power} · (1 + o(1))\n\n");

    printf("  The correction from E is (1 + o(1)), i.e., 1 + T^{ε-1}.\n");
    printf("  Whether E = T^{0.29} or T^{0.90}, the correction is TINY\n");
    printf("  compared to the main term T · M(σ).\n\n");

    printf("  The exponent A = 3/(3σ-1) comes from the power of T\n");
    printf("  in the MAIN TERM, not from the error.\n\n");

    printf("  ┌──────────────────────────────────────────────────────┐\n");
    printf("  │  🔴 VERDICT: Improving the fourth moment ERROR     │\n");
    printf("  │  does NOT improve zero-density estimates.           │\n");
    printf("  │  The density exponent A depends on the MAIN TERM.  │\n");
    printf("  │  The main term T·ζ(2σ)⁴/ζ(4σ) is an exact         │\n");
    printf("  │  asymptotic — it CANNOT be improved.               │\n");
    printf("  └──────────────────────────────────────────────────────┘\n\n");

    /* ════════════ WHAT COULD ACTUALLY WORK ════════════ */
    printf("## 3. What WOULD Improve A?\n\n");

    printf("  To improve A = 3/(3σ-1) from the fourth moment approach,\n");
    printf("  you need one of:\n\n");

    printf("  (a) A BETTER DETECTING FUNCTION F:\n");
    printf("      Instead of using |ζ|⁴ directly, use |F|⁴ where\n");
    printf("      F has a LARGER value at zeros relative to its mean.\n");
    printf("      This is what GM does with the SIXTH moment (k=3).\n\n");

    printf("  (b) A HIGHER MOMENT with better exponent:\n");
    printf("      GM k=3: ∫|F|⁶ ≤ T · N^{4/3+ε} (from BD decoupling)\n");
    printf("      If k=4 had μ₄ < 2 (conjectured), A would improve.\n");
    printf("      But μ₄ = 2 is believed optimal (from the parabola).\n\n");

    printf("  (c) A DIFFERENT ARGUMENT entirely:\n");
    printf("      Not based on moments of Dirichlet polynomials.\n");
    printf("      E.g., explicit formulas, sieve methods, etc.\n\n");

    printf("  (d) SUBCONVEXITY for specific L-values:\n");
    printf("      If L(σ, u_j × E₂) has subconvexity at σ = 3/4,\n");
    printf("      the spectral terms in Motohashi would be smaller.\n");
    printf("      But this would improve the ERROR, not the main term.\n");
    printf("      → Same issue as before.\n\n");

    /* ════════════ THE REAL LANDSCAPE ════════════ */
    printf("## 4. The Complete Landscape of Known Zero-Density\n\n");

    printf("  %6s | %8s | %8s | %8s | %8s | %s\n",
           "σ", "Ingham", "Huxley", "GM", "best", "= DH?");

    double sigs[] = {0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.833, 0.85, 0.90, 0.95, 0};
    for (int i = 0; sigs[i] > 0; i++) {
        double s = sigs[i];
        double ingham = 3.0/(3*s - 1);      /* Ingham 1940 */
        double huxley = 12.0/5;              /* Huxley 1972 (uniform) */
        double gm = 30.0/13;                 /* GM 2024 (uniform) */
        double dh = 2.0;                     /* Density Hypothesis */

        double best = ingham;
        if (huxley < best) best = huxley;
        if (gm < best) best = gm;
        char *method = "Ingham";
        if (best == gm) method = "GM";
        if (best == huxley) method = "Huxley";

        printf("  %6.3f | %8.4f | %8.4f | %8.4f | %8.4f | %s%s\n",
               s, ingham, huxley, gm, best,
               best <= dh + 0.01 ? "DH ✅  " : "",
               method);
    }

    printf("\n  Crossover GM/Ingham: GM better for σ < ~0.77\n");
    printf("  DH achieved: σ ≥ 5/6 ≈ 0.833 (from Ingham)\n");
    printf("  Improvement target: σ ∈ [1/2, 5/6] where best > 2\n\n");

    /* ════════════ WHAT'S LEFT ════════════ */
    printf("## 5. Exhaustive Status After 22 Approaches\n\n");

    printf("  We have shown that improving A requires:\n\n");

    printf("  BLOCKED PATHS:\n");
    printf("  ├─ Better μ₃ (sixth moment exponent)\n");
    printf("  │   → 4/3 is optimal from parabolic decoupling\n");
    printf("  ├─ Better fourth moment error\n");
    printf("  │   → Error is subleading, doesn't change A\n");
    printf("  ├─ Kloosterman at σ>1/2\n");
    printf("  │   → Trivially convergent, no help\n");
    printf("  ├─ RMT repulsion\n");
    printf("  │   → Controls variance, not mean\n");
    printf("  ├─ Multiplicative/prime structure\n");
    printf("  │   → Makes large values WORSE\n");
    printf("  └─ Mollifiers past Selberg barrier\n");
    printf("      → Only helps at σ=1/2 (irrelevant for density)\n\n");

    printf("  CONCEIVABLY OPEN PATHS:\n");
    printf("  ├─ (a) Better detecting functions (beyond von Mangoldt)\n");
    printf("  │   → What property would F need?\n");
    printf("  │   → F(ρ) large at zeros but ∫|F|^{2k} small\n");
    printf("  │   → This is the MOLLIFIER approach (Levinson)\n");
    printf("  │   → Selberg barrier applies at σ=1/2 but NOT for density\n");
    printf("  │   → For density at σ>1/2: mollifiers DO help\n");
    printf("  │   → But the FOURTH MOMENT argument already uses\n");
    printf("  │     ζ as the detecting function, which is optimal!\n");
    printf("  ├─ (b) Eighth moment with μ₄ < 2\n");
    printf("  │   → Conjectured: μ₄ = 2 (not improvable)\n");
    printf("  │   → If μ₄ = 2: eighth moment gives same A as sixth\n");
    printf("  └─ (c) Non-moment methods\n");
    printf("      → Explicit formulas + optimization (Beurling-Selberg)\n");
    printf("      → Algebraic geometry (function field transfer)\n");
    printf("      → Both are open but speculative\n\n");

    printf("  ★ The most promising remaining path:\n");
    printf("  (c) Non-moment methods, specifically:\n");
    printf("  The Beurling-Selberg OPTIMIZATION:\n");
    printf("    Choose h in the explicit formula to minimize N(σ,T)\n");
    printf("    subject to h(ρ) ≥ 1 for Re(ρ) > σ.\n");
    printf("    This is a CONVEX OPTIMIZATION that could be solved\n");
    printf("    computationally to give the optimal bound.\n\n");

    printf("  If the Beurling-Selberg optimal bound matches A=30/13,\n");
    printf("  then the explicit-formula approach is also exhausted.\n");
    printf("  If it's better: a genuine new result.\n");

    return 0;
}
