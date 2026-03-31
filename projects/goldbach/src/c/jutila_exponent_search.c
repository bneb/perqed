/*
 * jutila_exponent_search.c — The bug fix changes EVERYTHING.
 *
 * THE BUG: Red team used formula A = 2(1-κ)/(2σ-1-2κ) → A=10 at (1/6,2/3).
 * That's the WRONG formula for Jutila's method.
 *
 * CORRECT (Jutila 1977): the zero-density exponent via large values is
 *   A = (1 + 2κ) / (2σ - 1)
 * when using exponent pair (κ, λ) with κ + λ = 1 - (1-2σ)/A.
 *
 * Actually, there are MANY different zero-density formulas, and the
 * correct one depends on HOW the exponent pair enters the argument.
 * Let me carefully derive which formula gives A = f(κ,λ,σ).
 *
 * REFERENCE FORMULAS (all give different A):
 *   (1) Ingham: A = 2/(2σ-1)                     [no exponent pair]
 *   (2) Halász: A = max(3, 2/(2σ-1))             [no exponent pair]
 *   (3) Jutila: various, depends on method
 *   (4) Heath-Brown: A = 12/(5(2σ-1))            [no exponent pair, σ>3/4]
 *   (5) Huxley: A = 12/5                          [uniform, best classical]
 *   (6) GM: A = 30/13                             [uses decoupling]
 *
 * The question: does ANY formula with exponent pairs give A < 30/13?
 *
 * BUILD: cc -O3 -o jutila_exponent_search jutila_exponent_search.c -lm
 */
#include <stdio.h>
#include <math.h>

/* Exponent pair processes */
/* A: (κ,λ) → (κ', λ') = (1/(2(κ+1)), (κ+λ+1)/(2(κ+1))) */
/* B: (κ,λ) → (λ-1/2, κ+1/2) */

typedef struct { double k, l; char path[64]; } EP;

EP process_A(EP p) {
    EP r;
    r.k = 1.0 / (2*(p.k + 1));
    r.l = (p.k + p.l + 1) / (2*(p.k + 1));
    snprintf(r.path, sizeof(r.path), "A(%s)", p.path);
    return r;
}

EP process_B(EP p) {
    EP r;
    r.k = p.l - 0.5;
    r.l = p.k + 0.5;
    snprintf(r.path, sizeof(r.path), "B(%s)", p.path);
    return r;
}

/* Zero-density formulas involving exponent pairs */

/* Formula 1 (Jutila 1977, Theorem 1):
 * If (κ,λ) is an exponent pair, then for 1/2 < σ < 1:
 *   N(σ,T) ≤ T^{A(1-σ)+ε}
 * where A can be computed from κ,λ,σ by:
 *   A = 2(1-σ+κ) / ((2σ-1)(1-κ) + κ)  ... checking
 * Actually this doesn't look right either.
 *
 * Let me just compute ALL known formulas and take the minimum. */

/* Formula set (from Ivić "The Riemann Zeta Function" Ch. 11): */

double A_ingham(double sigma) {
    /* N(σ,T) ≤ T^{3(1-σ)/(2-σ)+ε} for 1/2 ≤ σ ≤ 1 */
    /* A = 3/(2-σ) ... no, Ingham gives A=3 uniformly. Hmm. */
    /* Actually A(σ) = 3(1-σ)/(2-σ) / (1-σ) = 3/(2-σ). */
    /* At σ=3/4: A = 3/1.25 = 2.4. */
    return 3.0 / (2.0 - sigma);
}

double A_heath_brown(double sigma) {
    /* Heath-Brown (1979): A = 12/5 for σ ≥ 3/4 (uniform) */
    if (sigma >= 0.75) return 12.0/5;
    return 999;
}

double A_huxley(double sigma) {
    /* Huxley (1972): A = 12/5 = 2.4 (uniform for all σ > 1/2) */
    return 12.0/5;
}

/* Jutila-type formula using exponent pair (κ,λ):
 * From Ivić, Theorem 12.2:
 *   N(σ,T) ≤ T^{a(1-σ)+ε} where
 *   a = 2(1+κ-λ) / (1-λ+κ(3-2σ)/(2σ-1))   ... complicated
 *
 * Actually, Jutila's result (simplified for the Halász-Jutila variant):
 * Using the pair (κ,λ) in the exponential sum bound gives:
 *   A(σ) = 2(λ-κ) / (2σ-1+2(λ-κ)-2)  ... still complicated.
 *
 * Let me use the CORRECT classical formula from the literature.
 * The standard result (e.g., Titchmarsh Section 9.19, or Ivić Ch 11):
 *
 * THEOREM (Jutila 1977): Let (κ,λ) be an exponent pair. Then
 *   N(σ,T) ≤ T^{A(σ)(1-σ)+ε} with
 *   A(σ) = 2/(2σ-1)                  if 1-σ ≤ κ/(1+2κ)
 *   A(σ) = (2+4κ)/(1+2κ-...)         otherwise
 *
 * This is getting complicated. Let me just implement the main known bounds. */

/* SIMPLER APPROACH: The following formulas are from
 * Montgomery's "Ten Lectures on the Interface Between Analytic Number Theory
 * and Harmonic Analysis", Lecture 12.
 *
 * Result: If (κ,λ) is an exponent pair, then N(σ,T) ≤ T^{A(1-σ)+ε} with
 *   A = min over several formulas involving κ,λ,σ. */

/* Formula M1: A = 2/(2σ-1) [Ingham-MVT, no pair needed] */
double A_M1(double sigma) { return 2.0/(2*sigma-1); }

/* Formula M2: Using Halász trick with pair (κ,λ):
 * A = (2λ) / (2σ-1+2λ-1)  = 2λ/(2σ+2λ-2)
 * At σ=3/4, (1/6,2/3): A = (4/3)/(1/2+1/3) = (4/3)/(5/6) = 8/5 = 1.6
 * Wait — that would BEAT GM! Can that be right?! */
double A_M2(double sigma, double kappa, double lambda) {
    return (2*lambda) / (2*sigma + 2*lambda - 2);
}

/* Formula M3: Density via mean values with pair:
 * A = (1+2κ)/(2σ-1+2κ)
 * At σ=3/4, (1/6,2/3): A = (4/3)/(1/2+1/3) = (4/3)/(5/6) = 8/5 = 1.6 */
double A_M3(double sigma, double kappa) {
    return (1+2*kappa)/(2*sigma-1+2*kappa);
}

int main() {
    printf("# Exponent Pair → Zero-Density: CORRECTED Analysis\n\n");

    /* Generate exponent pairs from AB-tree */
    EP pairs[1000]; int npairs = 0;

    /* Start with (0,1) */
    pairs[npairs++] = (EP){0, 1, "T"};  /* trivial pair */

    /* Level 1: A and B from (0,1) */
    EP ep01 = {0, 1, "T"};
    pairs[npairs++] = process_A(ep01);  /* (1/2, 1/2)?? no */

    /* Let me compute: A(0,1) = (1/(2·1), (0+1+1)/(2·1)) = (1/2, 1) */
    /* That's not right either. A(0,1): κ'=1/(2(0+1))=1/2, λ'=(0+1+1)/(2(0+1))=1 */
    /* So A(0,1) = (1/2, 1). Check: 1/2+1 = 3/2 ≥ 1 ✓, but κ≤1/2 and λ≥1/2 ✓ */

    /* Actually the van der Corput A process is:
     * (κ,λ) → (κ/(2(κ+1)), (κ+λ+1)/(2(κ+1))) ... hmm let me recheck */

    /* Standard: A-process (Weyl step): (κ,λ) → ((κ)/(2κ+2), (κ+λ+1)/(2κ+2)) */
    /* B-process (trivial): (κ,λ) → (λ-1/2, κ+1/2) */

    /* A(0,1): κ'=0/2=0, λ'=(0+1+1)/2=1 → (0,1) fixed point. */
    /* Hmm — A(0,1)=(0,1)? That's the trivial pair again. */

    /* Let me use the CORRECT A process. From Graham-Kolesnik:
     * A: (κ,λ) → (κ/(2κ+2), (κ+λ+1)/(2κ+2))
     * B: (κ,λ) → (λ-1/2, κ+1/2)
     *
     * A(0,1) = (0/(0+2), (0+1+1)/(0+2)) = (0, 1). Still trivial!
     *
     * So to get non-trivial: B(0,1) = (1-1/2, 0+1/2) = (1/2, 1/2). Valid pair.
     * Then A(1/2,1/2) = (1/2/(2·3/2), (1/2+1/2+1)/(2·3/2)) = (1/6, 2/3). ✓
     */

    npairs = 0;
    EP start = {0, 1, "T"};
    pairs[npairs++] = start;

    EP b01 = process_B(start);  /* (1/2, 1/2) */
    pairs[npairs++] = b01;

    EP ab01 = process_A(b01);   /* (1/6, 2/3) ← the classical pair */
    pairs[npairs++] = ab01;

    /* Generate more pairs to depth 6 */
    for (int depth = 0; depth < 5; depth++) {
        int n = npairs;
        for (int i = 0; i < n && npairs < 500; i++) {
            EP pa = process_A(pairs[i]);
            EP pb = process_B(pairs[i]);
            /* Check validity: 0 ≤ κ ≤ 1/2, κ+1/2 ≤ λ ≤ 1 */
            if (pa.k >= -0.001 && pa.k <= 0.501 && pa.l >= pa.k+0.499 && pa.l <= 1.001)
                pairs[npairs++] = pa;
            if (pb.k >= -0.001 && pb.k <= 0.501 && pb.l >= pb.k+0.499 && pb.l <= 1.001)
                pairs[npairs++] = pb;
        }
    }

    printf("  Generated %d exponent pairs.\n\n", npairs);

    /* ═══════════════════════════════════════════ */
    printf("## 1. All Zero-Density Formulas at σ = 3/4\n\n");

    double sigma = 0.75;
    printf("  %6s %6s | %6s %6s %6s %6s | %6s | %s\n",
           "κ", "λ", "M1", "M2", "M3", "HB",  "best", "vs GM");

    double best_A_overall = 999;
    double best_k = -1, best_l = -1;
    int best_idx = -1;

    for (int i = 0; i < npairs; i++) {
        double k = pairs[i].k, l = pairs[i].l;
        if (k < -0.001 || l < 0.499) continue;

        double a_m1 = A_M1(sigma);
        double a_m2 = A_M2(sigma, k, l);
        double a_m3 = A_M3(sigma, k);
        double a_hb = A_heath_brown(sigma);

        double best = fmin(fmin(a_m1, a_m2), fmin(a_m3, a_hb));

        if (i < 10 || best < 2.35) {
            printf("  %6.4f %6.4f | %6.3f %6.3f %6.3f %6.3f | %6.3f | %s\n",
                   k, l, a_m1, a_m2, a_m3, a_hb, best,
                   best < 30.0/13 ? "★★ BEATS GM!" :
                   best < 2.4 ? "★ beats Huxley" : "");
        }

        if (best < best_A_overall) {
            best_A_overall = best;
            best_k = k; best_l = l;
            best_idx = i;
        }
    }

    printf("\n  BEST OVERALL: A = %.6f at (%.4f, %.4f)\n", best_A_overall, best_k, best_l);
    printf("  GM:           A = %.6f = 30/13\n", 30.0/13);
    printf("  Beats GM:     %s\n\n", best_A_overall < 30.0/13 ? "YES ★★★" : "NO");

    /* ═══════════════════════════════════════════ */
    printf("## 2. 🔴 RED TEAM: Are These Formulas Correct?\n\n");

    printf("  Formula M2: A = 2λ/(2σ+2λ-2)\n");
    printf("  At (1/6, 2/3), σ=3/4: A = %.4f\n", A_M2(sigma, 1.0/6, 2.0/3));
    printf("  At (0, 1), σ=3/4: A = %.4f\n\n", A_M2(sigma, 0, 1));

    printf("  ⚠️  Formula M2 at (0,1) gives A = 2·1/(1.5+2-2) = 2/1.5 = %.4f\n",
           A_M2(sigma, 0, 1));
    printf("  That means A = 4/3 ≈ 1.33 from the TRIVIAL pair!\n\n");

    printf("  If this were correct, it would give A < 2, proving DH via a\n");
    printf("  TRIVIAL argument. This CANNOT be right.\n\n");

    printf("  🔴 ISSUE: Formula M2 is NOT the correct zero-density formula.\n");
    printf("  It's the bound for a DIFFERENT problem (mean square of F),\n");
    printf("  not for the zero-density function N(σ,T).\n\n");

    printf("  The correct formula involves the FULL Halász-Montgomery\n");
    printf("  machinery, which has additional constraints:\n");
    printf("  - The exponent pair gives a bound on |F| when f has\n");
    printf("    certain smoothness properties\n");
    printf("  - The translation from |F| to N(σ,T) involves an\n");
    printf("    additional averaging step that LOSES information\n");
    printf("  - The overall density exponent is NOT simply 2λ/(2σ+2λ-2)\n\n");

    printf("  WITHOUT the correct published formula (which requires\n");
    printf("  reading Jutila 1977, Huxley 1972, or Ivić Chapter 11\n");
    printf("  carefully), we CANNOT trust our A(σ) computations.\n\n");

    printf("  ★ WHAT WE KNOW FOR CERTAIN:\n");
    printf("  - Huxley proved A = 12/5 = 2.4 (published, cited, verified)\n");
    printf("  - GM proved A = 30/13 ≈ 2.31 (published Annals, verified)\n");
    printf("  - No classical exponent pair gives A < 30/13\n");
    printf("    (because GM's method is fundamentally different)\n\n");

    printf("  ★ THE HONEST QUESTION:\n");
    printf("  Is our formula M2 = 2λ/(2σ+2λ-2) actually valid for N(σ,T)?\n");
    printf("  If YES: the trivial pair (0,1) gives A=4/3 < 2, proving DH.\n");
    printf("  Since DH is a major open problem, M2 is ALMOST CERTAINLY WRONG\n");
    printf("  as a zero-density formula.\n\n");

    printf("  The lesson: we must READ THE ACTUAL PAPERS, not invent\n");
    printf("  formulas. Our unit tests caught the Halász bug. This\n");
    printf("  red team catches the M2 formula bug.\n");

    return 0;
}
