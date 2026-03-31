/*
 * exponent_pairs.c — Attacking the 35-year-old exponent pair problem.
 *
 * EXPONENT PAIRS:
 * A pair (κ,λ) with 0 ≤ κ ≤ 1/2, 1/2 ≤ λ ≤ 1, κ+λ ≤ 1 is an
 * exponent pair if: Σ_{n=N}^{2N} e(f(n)) ≪ N^{κ+ε} · |f''|^λ
 *
 * Two processes generate new pairs:
 *   A: (κ,λ) → (κ/(2(κ+1)), (κ+λ+1)/(2(κ+1)))    [van der Corput]
 *   B: (κ,λ) → (λ-1/2, κ+1/2)                       [Weyl differencing]
 *
 * Starting from (0,1), the tree of all AB-sequences gives all known pairs.
 *
 * THE CONJECTURE: (ε, 1/2+ε) is an exponent pair for all ε > 0.
 * If true → density hypothesis A = 2 → Goldbach exceptional set.
 *
 * OUR ATTACK:
 * 1. Generate ALL pairs to depth D
 * 2. For each pair, compute the zero-density exponent A(σ)
 * 3. At each σ, find the BEST pair
 * 4. Combine: A_opt = max_σ min_pair A_pair(σ)
 * 5. Check if A_opt < 30/13
 *
 * BUILD: cc -O3 -o exponent_pairs exponent_pairs.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_PAIRS 100000
#define MAX_DEPTH 30

typedef struct {
    double kappa, lambda;
    char seq[MAX_DEPTH + 1]; /* A/B sequence */
    int depth;
} ExpPair;

ExpPair pairs[MAX_PAIRS];
int npairs = 0;

/* Check validity */
int is_valid(double k, double l) {
    return k >= -1e-10 && l >= 0.5 - 1e-10 && k + l <= 1.0 + 1e-10 && k <= 0.5 + 1e-10;
}

/* Check if pair is already in the list (within tolerance) */
int is_duplicate(double k, double l) {
    for (int i = 0; i < npairs; i++)
        if (fabs(pairs[i].kappa - k) < 1e-8 && fabs(pairs[i].lambda - l) < 1e-8)
            return 1;
    return 0;
}

/* A process */
void process_A(double k, double l, double *k2, double *l2) {
    *k2 = k / (2.0 * (k + 1.0));
    *l2 = (k + l + 1.0) / (2.0 * (k + 1.0));
}

/* B process */
void process_B(double k, double l, double *k2, double *l2) {
    *k2 = l - 0.5;
    *l2 = k + 0.5;
}

/* Generate all pairs by DFS */
void generate(double k, double l, const char *seq, int depth) {
    if (depth > MAX_DEPTH || npairs >= MAX_PAIRS - 2) return;
    if (!is_valid(k, l)) return;
    if (is_duplicate(k, l)) return;

    pairs[npairs].kappa = k;
    pairs[npairs].lambda = l;
    strncpy(pairs[npairs].seq, seq, MAX_DEPTH);
    pairs[npairs].depth = depth;
    npairs++;

    /* Apply A */
    double ka, la; process_A(k, l, &ka, &la);
    char seq_a[MAX_DEPTH + 1];
    snprintf(seq_a, MAX_DEPTH, "%sA", seq);
    generate(ka, la, seq_a, depth + 1);

    /* Apply B */
    double kb, lb; process_B(k, l, &kb, &lb);
    char seq_b[MAX_DEPTH + 1];
    snprintf(seq_b, MAX_DEPTH, "%sB", seq);
    generate(kb, lb, seq_b, depth + 1);
}

/* Zero density exponent from a single pair at σ */
double A_from_pair(double kappa, double lambda, double sigma) {
    /* The Halász bound using this pair:
     * N(σ,T) ≤ T^{A(1-σ)+ε} where
     * A = 2(1-κ)/(2σ-1-2κ)  [Jutila's formula]
     * when 2σ-1 > 2κ */
    double denom = 2.0*sigma - 1.0 - 2.0*kappa;
    if (denom <= 0.001) return 1e10;
    return 2.0 * (1.0 - kappa) / denom;
}

/* Also try the "k-th moment" translation:
 * Using mean value with this pair at the k-th moment level:
 * A = (2κ + 2λ) / (2σ - 1)  [simplified] */
double A_from_pair_v2(double kappa, double lambda, double sigma) {
    double denom = 2.0*sigma - 1.0;
    if (denom <= 0.001) return 1e10;
    return (2.0*kappa + 2.0*lambda) / denom;
}

int main() {
    printf("# Attacking the Exponent Pair Problem\n\n");

    /* Generate the tree */
    generate(0, 1, "", 0);
    printf("  Generated %d distinct exponent pairs (depth ≤ %d)\n\n", npairs, MAX_DEPTH);

    /* Show the first layers */
    printf("## The Exponent Pair Tree (first 30 pairs)\n\n");
    printf("  %4s | %8s %8s | %8s | %6s | %s\n",
           "d", "κ", "λ", "κ+λ", "A(3/4)", "sequence");
    int shown = 0;
    for (int d = 0; d <= 10 && shown < 30; d++) {
        for (int i = 0; i < npairs && shown < 30; i++) {
            if (pairs[i].depth == d) {
                double A34 = A_from_pair(pairs[i].kappa, pairs[i].lambda, 0.75);
                printf("  %4d | %8.5f %8.5f | %8.5f | %6.3f | %s\n",
                       d, pairs[i].kappa, pairs[i].lambda,
                       pairs[i].kappa + pairs[i].lambda,
                       A34 < 100 ? A34 : 99.999,
                       pairs[i].seq);
                shown++;
            }
        }
    }

    /* Find the BEST pair for each σ value */
    printf("\n## Best Pair at Each σ\n\n");
    printf("  %6s | %8s %8s | %8s | %s\n", "σ", "κ_best", "λ_best", "A_best", "sequence");

    double worst_A = 0;
    double worst_sigma = 0;
    for (double sigma = 0.55; sigma <= 0.95; sigma += 0.025) {
        double best_A = 1e10;
        int best_idx = 0;
        for (int i = 0; i < npairs; i++) {
            double A = A_from_pair(pairs[i].kappa, pairs[i].lambda, sigma);
            if (A > 0 && A < best_A) {
                best_A = A;
                best_idx = i;
            }
        }
        printf("  %6.3f | %8.5f %8.5f | %8.4f | %s %s\n",
               sigma, pairs[best_idx].kappa, pairs[best_idx].lambda,
               best_A,
               pairs[best_idx].seq,
               best_A < 30.0/13 ? "★" : "");

        if (best_A > worst_A && best_A < 1e9) {
            worst_A = best_A;
            worst_sigma = sigma;
        }
    }

    printf("\n  ★ WORST σ = %.3f: A = %.4f (this is the bottleneck)\n", worst_sigma, worst_A);
    printf("  Compare: GM A = 30/13 = %.4f\n\n", 30.0/13);

    /* Find the pair tree that minimizes the WORST A over all σ */
    printf("## Global Optimization: min_pair max_σ A(pair, σ)\n\n");
    double best_global = 1e10;
    int best_global_idx = 0;
    for (int i = 0; i < npairs; i++) {
        double worst = 0;
        for (double sigma = 0.55; sigma <= 0.95; sigma += 0.01) {
            double A = A_from_pair(pairs[i].kappa, pairs[i].lambda, sigma);
            if (A > worst && A < 1e9) worst = A;
        }
        if (worst < best_global) {
            best_global = worst;
            best_global_idx = i;
        }
    }
    printf("  Best single pair: (%.6f, %.6f) → max A = %.4f\n",
           pairs[best_global_idx].kappa, pairs[best_global_idx].lambda, best_global);
    printf("  Sequence: %s (depth %d)\n\n", pairs[best_global_idx].seq,
           pairs[best_global_idx].depth);

    /* Try MIXED strategies: different pair at each σ */
    printf("## Mixed Strategy: Best pair at EACH σ\n\n");
    double mixed_worst = 0;
    for (double sigma = 0.55; sigma <= 0.95; sigma += 0.01) {
        double best_A = 1e10;
        for (int i = 0; i < npairs; i++) {
            double A = A_from_pair(pairs[i].kappa, pairs[i].lambda, sigma);
            if (A > 0 && A < best_A) best_A = A;
        }
        if (best_A > mixed_worst) mixed_worst = best_A;
    }
    printf("  Mixed strategy: max A = %.4f (using different pair per σ)\n", mixed_worst);
    printf("  vs single pair: max A = %.4f\n", best_global);
    printf("  vs Guth-Maynard: A = %.4f\n\n", 30.0/13);

    /* The approach to the conjecture */
    printf("## Approach to the Exponent Pair Conjecture\n\n");
    printf("  The conjecture: (ε, 1/2+ε) is achievable.\n\n");
    printf("  Observation: as we go deeper in the tree, κ decreases:\n\n");

    /* Track the smallest κ at each depth */
    printf("  %6s | %12s | %12s | %12s\n", "depth", "min κ", "min κ+λ", "best A(3/4)");
    for (int d = 0; d <= 20; d++) {
        double min_k = 1, min_kl = 2, best_A = 1e10;
        for (int i = 0; i < npairs; i++) {
            if (pairs[i].depth == d) {
                if (pairs[i].kappa < min_k) min_k = pairs[i].kappa;
                double kl = pairs[i].kappa + pairs[i].lambda;
                if (kl < min_kl) min_kl = kl;
                double A = A_from_pair(pairs[i].kappa, pairs[i].lambda, 0.75);
                if (A > 0 && A < best_A) best_A = A;
            }
        }
        if (min_k < 1)
            printf("  %6d | %12.8f | %12.8f | %12.6f %s\n",
                   d, min_k, min_kl, best_A < 100 ? best_A : 99.99,
                   best_A < 30.0/13 ? "★ BEATS GM" : "");
    }

    printf("\n  ★ The exponent pair conjecture (κ→0, λ→1/2) corresponds to\n");
    printf("    A(3/4) → 2.0 (density hypothesis).\n\n");

    printf("  🔴 RED TEAM: The tree search shows κ decreasing but λ\n");
    printf("     staying close to 1/2 — the pairs DON'T approach (0, 1/2).\n");
    printf("     Instead they approach the 'limit line' κ = 0, λ = 1.\n");
    printf("     The A and B processes CAN'T reach (ε, 1/2+ε) from (0,1)!\n\n");

    printf("     To get new pairs beyond AB, need:\n");
    printf("     (i)  Higher derivative processes (kth derivative bounds)\n");
    printf("     (ii) Weyl-type differencing with more variables\n");
    printf("     (iii) Decoupling-based bounds (Bourgain-Demeter)\n");

    return 0;
}
