/*
 * fft_lib.h — Shared FFT + number theory library for Goldbach analysis.
 *
 * Include this header in any .c file. All functions are static inline
 * to avoid linker issues with header-only design.
 *
 * Components:
 *   1. Radix-2 Cooley-Tukey FFT (forward + inverse)
 *   2. Möbius function sieve
 *   3. Prime sieve (Eratosthenes)
 *   4. Major/minor arc classification
 *   5. Minor arc sup-norm computation via FFT
 */
#ifndef FFT_LIB_H
#define FFT_LIB_H

#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define FFT_PI 3.14159265358979323846

/* ═══ Utility ═══ */

static inline int fft_next_pow2(int n) {
    int p = 1;
    while (p < n) p <<= 1;
    return p;
}

static inline int fft_gcd(int a, int b) {
    while (b) { int t = b; b = a % b; a = t; }
    return a;
}

/* ═══ Radix-2 Cooley-Tukey FFT ═══ */
/* dir=1 for forward, dir=-1 for inverse. n must be power of 2. */
static inline void fft_transform(double *re, double *im, int n, int dir) {
    /* Bit-reversal permutation */
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            double t;
            t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
    /* Butterfly stages */
    for (int len = 2; len <= n; len <<= 1) {
        double ang = 2.0 * FFT_PI / len * dir;
        double wRe = cos(ang), wIm = sin(ang);
        for (int i = 0; i < n; i += len) {
            double curRe = 1.0, curIm = 0.0;
            for (int j = 0; j < len / 2; j++) {
                int u = i + j, v = i + j + len / 2;
                double tRe = curRe * re[v] - curIm * im[v];
                double tIm = curRe * im[v] + curIm * re[v];
                re[v] = re[u] - tRe;
                im[v] = im[u] - tIm;
                re[u] += tRe;
                im[u] += tIm;
                double newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
    /* Normalization for inverse */
    if (dir == -1) {
        for (int i = 0; i < n; i++) {
            re[i] /= n;
            im[i] /= n;
        }
    }
}

/* ═══ Prime sieve ═══ */
static inline char *fft_sieve_primes(int max_n) {
    char *is_comp = calloc(max_n + 1, 1);
    is_comp[0] = is_comp[1] = 1;
    for (long long i = 2; i * i <= max_n; i++)
        if (!is_comp[i])
            for (long long j = i * i; j <= max_n; j += i)
                is_comp[j] = 1;
    return is_comp;
}

/* ═══ Möbius function ═══ */
static inline int8_t *fft_sieve_mobius(int max_n) {
    int8_t *mu = calloc(max_n + 1, 1);
    int *sp = calloc(max_n + 1, sizeof(int)); /* smallest prime factor */
    for (int i = 2; i <= max_n; i++)
        if (sp[i] == 0)
            for (int j = i; j <= max_n; j += i)
                if (sp[j] == 0) sp[j] = i;
    mu[1] = 1;
    for (int n = 2; n <= max_n; n++) {
        int p = sp[n];
        if ((n / p) % p == 0) mu[n] = 0;
        else mu[n] = -mu[n / p];
    }
    free(sp);
    return mu;
}

/* ═══ Major arc detection ═══ */
/* Returns 1 if k/M is within Q/(qN) of some a/q with gcd(a,q)=1, q≤Q */
static inline int fft_is_major_arc(int k, int M, int Q, int N) {
    double alpha = (double)k / M;
    for (int q = 1; q <= Q; q++) {
        double threshold = (double)Q / ((double)q * N);
        for (int a = 0; a <= q; a++) {
            if (a > 0 && a < q && fft_gcd(a, q) != 1) continue;
            double dist = fabs(alpha - (double)a / q);
            if (dist > 0.5) dist = 1.0 - dist;
            if (dist < threshold) return 1;
        }
    }
    return 0;
}

/* ═══ Minor arc sup-norm ═══ */
/* Computes sup_{minor arcs} |Σ w(n) e(nα)| via FFT */
static inline double fft_minor_arc_sup(double *weights, int N, int Q) {
    int M = fft_next_pow2(4 * N);
    double *re = calloc(M, sizeof(double));
    double *im = calloc(M, sizeof(double));
    if (!re || !im) { fprintf(stderr, "OOM in fft_minor_arc_sup N=%d\n", N); exit(1); }

    for (int n = 1; n <= N; n++) re[n] = weights[n];
    fft_transform(re, im, M, 1);

    double sup = 0;
    for (int k = 0; k < M; k++) {
        if (fft_is_major_arc(k, M, Q, N)) continue;
        double mag = sqrt(re[k] * re[k] + im[k] * im[k]);
        if (mag > sup) sup = mag;
    }

    free(re);
    free(im);
    return sup;
}

#endif /* FFT_LIB_H */
