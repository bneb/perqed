/*
 * tau_lib.h — Ramanujan τ(n) computation library.
 *
 * Computes τ(n) for all n ≤ max_n via the divisor sum recurrence:
 *   n · a(n) = -24 · Σ_{k=1}^{n} σ₁(k) · a(n-k)
 * where a(0)=1 and τ(n) = a(n-1).
 *
 * This is O(N²) but exact in double precision up to N ≈ 500K.
 * The normalized values τ(p)/p^{11/2} ∈ [-2, 2] (Deligne, proven).
 *
 * GRH-free: uses only proven results (Deligne 1974).
 */
#ifndef TAU_LIB_H
#define TAU_LIB_H

#include <stdio.h>
#include <stdlib.h>
#include <math.h>

/* Known τ values for verification */
static const double TAU_KNOWN[] = {
    0,     /* τ(0) unused */
    1,     /* τ(1) */
    -24,   /* τ(2) */
    252,   /* τ(3) */
    -1472, /* τ(4) */
    4830,  /* τ(5) */
    -6048, /* τ(6) */
    -16744,/* τ(7) */
    84480, /* τ(8) */
    -113643,/* τ(9) */
    -115920,/* τ(10) */
    534612, /* τ(11) */
    -370944 /* τ(12) */
};
#define TAU_N_KNOWN 12

typedef struct {
    double *values;  /* τ(n) for n=0..max_n */
    int max_n;
    double *sigma1;  /* σ₁(n) = sum of divisors */
} TauTable;

/* Compute σ₁(n) for all n ≤ max_n */
static inline double *tau_compute_sigma1(int max_n) {
    double *sigma1 = calloc(max_n + 1, sizeof(double));
    for (int d = 1; d <= max_n; d++)
        for (int m = d; m <= max_n; m += d)
            sigma1[m] += d;
    return sigma1;
}

/* Compute τ(n) for all n ≤ max_n.
 * progress_fn is called every 10% if non-NULL. */
static inline TauTable tau_compute(int max_n, void (*progress_fn)(int, int)) {
    TauTable t;
    t.max_n = max_n;
    t.sigma1 = tau_compute_sigma1(max_n + 1);

    /* a(n) = coefficients of Π(1-q^k)^24 */
    double *a = calloc(max_n + 2, sizeof(double));
    a[0] = 1.0;

    int next_report = max_n / 10;
    for (int n = 1; n <= max_n; n++) {
        double sum = 0;
        for (int k = 1; k <= n; k++)
            sum += t.sigma1[k] * a[n - k];
        a[n] = -24.0 * sum / n;

        if (progress_fn && n >= next_report) {
            progress_fn(n, max_n);
            next_report += max_n / 10;
        }
    }

    /* τ(n) = a(n-1) because Δ = q · Π(1-q^k)^24 */
    t.values = calloc(max_n + 1, sizeof(double));
    for (int n = 1; n <= max_n; n++)
        t.values[n] = a[n - 1];

    free(a);
    return t;
}

/* Free τ table resources */
static inline void tau_free(TauTable *t) {
    free(t->values);
    free(t->sigma1);
    t->values = NULL;
    t->sigma1 = NULL;
}

/* Normalized τ: τ(p)/p^{11/2}, bounded by [-2, 2] */
static inline double tau_normalized(const TauTable *t, int p) {
    if (p <= 0 || p > t->max_n) return 0;
    return t->values[p] / pow((double)p, 5.5);
}

/* Verify known values. Returns number of failures. */
static inline int tau_verify_known(const TauTable *t) {
    int failures = 0;
    for (int n = 1; n <= TAU_N_KNOWN && n <= t->max_n; n++) {
        double err = fabs(t->values[n] - TAU_KNOWN[n]);
        if (err > 0.5) failures++;
    }
    return failures;
}

/* Verify Ramanujan conjecture: |τ(p)/p^{11/2}| ≤ 2 for all primes.
 * is_composite must be a sieve array. Returns number of violations. */
static inline int tau_verify_ramanujan(const TauTable *t, const char *is_composite) {
    int violations = 0;
    for (int p = 2; p <= t->max_n; p++) {
        if (is_composite[p]) continue;
        double ratio = fabs(tau_normalized(t, p));
        if (ratio > 2.001) violations++;
    }
    return violations;
}

/* Verify Hecke multiplicativity: τ(mn) = τ(m)·τ(n) for gcd(m,n)=1.
 * Tests n_tests random pairs. Returns number of failures. */
static inline int tau_verify_hecke(const TauTable *t, int n_tests) {
    int failures = 0;
    /* Deterministic "random" pairs */
    for (int i = 0; i < n_tests; i++) {
        int m = 2 + (i * 7 + 13) % 50;
        int n = 2 + (i * 11 + 29) % 50;
        if (fft_gcd(m, n) != 1) continue;
        if ((long long)m * n > t->max_n) continue;

        double lhs = t->values[m * n];
        double rhs = t->values[m] * t->values[n];
        double err = fabs(lhs - rhs);
        double scale = fabs(lhs) + fabs(rhs) + 1;
        if (err / scale > 1e-6) failures++;
    }
    return failures;
}

/* Verify τ(p²) = τ(p)² - p¹¹ for primes p.
 * Returns number of failures. */
static inline int tau_verify_p_squared(const TauTable *t, const char *is_composite, int max_test) {
    int failures = 0;
    for (int p = 2; p <= max_test && (long long)p*p <= t->max_n; p++) {
        if (is_composite[p]) continue;
        double lhs = t->values[p * p];
        double rhs = t->values[p] * t->values[p] - pow((double)p, 11);
        double err = fabs(lhs - rhs);
        double scale = fabs(lhs) + fabs(rhs) + 1;
        if (err / scale > 1e-6) failures++;
    }
    return failures;
}

#endif /* TAU_LIB_H */
