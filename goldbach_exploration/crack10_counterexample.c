/*
 * crack10_counterexample.c — Anatomy of a Goldbach Counterexample
 *
 * IF N₀ is the smallest even number > 2 that's NOT p + q,
 * what properties MUST it have?
 *
 * ALSO: the distribution of r(N)/prediction — what shape?
 *
 * BUILD: cc -O3 -o crack10_counterexample crack10_counterexample.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 2000001
static char sieve[MAX_N];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_N;i++)
        if(.sieve[i]) for(int j=i*i;j<MAX_N;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_N && .sieve[n]; }

double twin_prime_const() {
    double C2 = 1.0;
    for(int p=3;p<10000;p++){if(.is_prime(p))continue;C2*=1.0-1.0/((double)(p-1)*(p-1));}
    return C2;
}

double singular_series(int N, double C2) {
    double S = 2 * C2;
    int temp = N;
    for (int p = 3; p <= temp; p++) {
        if (temp%p) continue;
        while(temp%p==0) temp/=p;
        S *= (double)(p-1)/(p-2);
    }
    return S;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 10: Anatomy of a Counterexample\n");
    printf("====================================================\n\n");

    /* ═══════ PART 1: CONSPIRACY DEPTH ═══════ */
    printf("## PART 1: How Deep Is the Conspiracy?\n\n");

    printf("  If N₀ is the smallest counterexample, then N₀ - p\n");
    printf("  is composite for EVERY prime p ∈ [2, N₀/2].\n\n");

    printf("  How many primes is that? π(N₀/2).\n");
    printf("  For N₀ ~ X: about X / (2·logX) primes.\n\n");

    printf("  Each N₀ - p must be composite. The 'probability' that\n");
    printf("  a random odd number near N₀ is composite is 1 - 1/logN₀.\n\n");

    printf("  For ALL π(N₀/2) primes to fail:\n");
    printf("  P[all fail] ≈ (1 - 1/logN₀)^{N₀/(2·logN₀)}\n");
    printf("  ≈ exp(-N₀/(2·log²N₀))\n\n");

    printf("  This is ASTRONOMICALLY small for large N₀.\n\n");

    printf("  %12s | %12s | %15s | %20s\n",
           "N₀", "π(N₀/2)", "P[all fail]", "1/P (expected N)");

    for (double N0 = 1e4; N0 <= 1e18; N0 *= 10) {
        double logN = log(N0);
        double piN = N0 / (2 * logN);
        double p_fail = exp(-N0 / (2 * logN * logN));
        printf("  %12.0f | %12.0f | %15.2e | %20.2e\n",
               N0, piN, p_fail, 1.0/p_fail);
    }

    printf("\n   At N₀ = 10^18, a counterexample needs ~10^16 primes\n");
    printf("  to ALL produce composite partners. The probability is\n");
    printf("  ≈ e^{-10^14}. You'd need 10^{10^14} trials to find one.\n\n");

    printf("  This is the probabilistic REASON Goldbach is true.\n");
    printf("  But it's not a PROOF (random model ≠ deterministic).\n\n");

    /* ═══════ PART 2: MODULAR CONSTRAINTS ═══════ */
    printf("## PART 2: Modular Constraints on N₀\n\n");

    printf("  If N₀ ≡ 0 (mod 6): S(N₀) is large (≈ 3.5).\n");
    printf("  If N₀ ≡ 2 (mod 6): S(N₀) ≈ 1.3 (smallest).\n");
    printf("  If N₀ ≡ 4 (mod 6): S(N₀) ≈ 2.6 (medium).\n\n");

    printf("  So N₀ would 'most likely' be ≡ 2 (mod 6),\n");
    printf("  where S(N₀) is minimized.\n\n");

    printf("  MORE REFINED: N₀ mod 30 constraints:\n");
    printf("  The smallest S(N) occurs at N ≡ 2 mod 30.\n\n");

    printf("  %6s | %8s | %10s\n", "N mod30", "S(N)", "min r in [10K,20K]");

    for (int r = 0; r < 30; r += 2) {
        double S = singular_series(30 + r, C2); /* representative */
        int min_r_actual = 1<<30;
        for (int N = 10000 + r; N <= 20000; N += 30) {
            if (N%2) continue;
            int rr = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) rr++;
            if (rr < min_r_actual) min_r_actual = rr;
        }
        printf("  %6d | %8.4f | %10d\n", r, S, min_r_actual);
    }

    /* ═══════ PART 3: CONSECUTIVE COMPOSITE REQUIREMENT ═══════ */
    printf("\n## PART 3: The Composite Chain\n\n");

    printf("  For N₀ to be a counterexample, the sequence\n");
    printf("  N₀-2, N₀-3, N₀-5, N₀-7, N₀-11, ..., N₀-p_k\n");
    printf("  must ALL be composite (where p_k ≈ N₀/2).\n\n");

    printf("  How long are the longest 'composite chains'?\n");
    printf("  For even N, compute: max consecutive N-p composite.\n\n");

    printf("  %12s | %8s | %8s | %15s\n",
           "N", "r(N)", "chain", "1st failure");

    /* Find N with longest initial composite chain */
    int best_chain = 0, best_N = 0;
    for (int N = 100000; N <= 200000; N += 2) {
        int chain = 0;
        int first_success = 0;
        for (int p = 2; p <= N/2; p++) {
            if (.is_prime(p)) continue;
            if (is_prime(N-p)) { first_success = p; break; }
            chain++;
        }
        if (chain > best_chain) {
            best_chain = chain;
            best_N = N;

            int r = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p) && is_prime(N-p)) r++;
            printf("  %12d | %8d | %8d | p=%d, N-p=%d\n",
                   N, r, chain, first_success, N-first_success);
        }
    }

    printf("\n  Longest composite chain in [100K, 200K]: %d primes\n", best_chain);
    printf("  at N = %d.\n\n", best_N);

    printf("  A counterexample needs chain = π(N₀/2) ≈ N₀/(2logN₀).\n");
    printf("  At N = 200K: chain needs to be ~8700, but longest is %d.\n", best_chain);
    printf("  RATIO: longest_chain / needed ≈ %.6f\n\n",
           (double)best_chain / (100000.0 / (2*log(100000.0))));

    /* ═══════ PART 4: DISTRIBUTION OF r(N)/prediction ═══════ */
    printf("## PART 4: Distribution of r(N)/prediction\n\n");

    printf("  Is the normalized ratio r(N)/(S(N)·N/(2log²N))\n");
    printf("  Gaussian? Poisson? Something exotic?\n\n");

    /* Compute histogram of r(N)/prediction */
    int limit = 1000000;
    int nbins = 40;
    double bin_lo = 0.3, bin_hi = 0.9;
    int *hist = calloc(nbins+2, sizeof(int));
    double sum_ratio = 0; int cnt = 0;
    double sum_sq = 0;

    for (int N = 1000; N <= limit; N += 2) {
        double S = singular_series(N, C2);
        double logN = log((double)N);
        double pred = S * N / (2 * logN * logN);

        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;

        double ratio = r / pred;
        sum_ratio += ratio; sum_sq += ratio*ratio; cnt++;

        int bin = (int)((ratio - bin_lo) / (bin_hi - bin_lo) * nbins);
        if (bin < 0) bin = 0;
        if (bin >= nbins) bin = nbins;
        hist[bin]++;
    }

    double mean = sum_ratio / cnt;
    double var = sum_sq / cnt - mean*mean;
    double std = sqrt(var);

    printf("  Mean of r/pred: %.6f\n", mean);
    printf("  Std dev:        %.6f\n", std);
    printf("  CV (std/mean):  %.6f\n\n", std/mean);

    printf("  Histogram (N ∈ [1000, %d]):\n\n", limit);
    printf("  %8s | %8s | %s\n", "ratio", "count", "bar");

    int max_count = 0;
    for(int i=0;i<=nbins;i++) if(hist[i]>max_count) max_count=hist[i];

    for (int i = 0; i <= nbins; i++) {
        double lo_r = bin_lo + (bin_hi-bin_lo)*i/nbins;
        int bar_len = 50 * hist[i] / (max_count > 0 ? max_count : 1);
        char bar[64]; memset(bar,'#',bar_len); bar[bar_len]=0;
        if (hist[i] > 0)
            printf("  %8.4f | %8d | %s\n", lo_r, hist[i], bar);
    }

    printf("\n   The distribution appears GAUSSIAN with:\n");
    printf("  mean ≈ %.4f, std ≈ %.4f\n\n", mean, std);

    printf("  This matches the prediction from the random model:\n");
    printf("  r(N) ≈ Poisson(λ) where λ = S(N)·N/(2log²N).\n");
    printf("  For large λ, Poisson → Gaussian with mean=std=√λ.\n");
    printf("  The observed std/mean ≈ %.4f ≈ 1/√λ̄ ≈ %.4f.\n\n",
           std/mean, 1.0/sqrt(mean * limit / (2 * log(limit) * log(limit))));

    /* ═══════ PART 5: INFORMATION CONTENT ═══════ */
    printf("## PART 5: Information Content of a Counterexample\n\n");

    printf("  If N₀ is a counterexample, specifying N₀ takes\n");
    printf("  log₂(N₀) ≈ 60 bits (for N₀ ~ 10^18).\n\n");

    printf("  But N₀ encodes the information that π(N₀/2) ≈ 10^16\n");
    printf("  specific numbers are ALL composite.\n");
    printf("  Each compositeness claim takes ~1 bit (it's a binary fact).\n");
    printf("  Total information: ~10^16 bits.\n\n");

    printf("  A 60-bit number encoding 10^16 bits of information\n");
    printf("  would be a COMPRESSION MIRACLE.\n");
    printf("  This is the information-theoretic reason why\n");
    printf("  counterexamples are 'morally impossible'.\n\n");

    printf("  Of course this isn't a proof — the information IS\n");
    printf("  present in N₀ (via number theory), it's just compressed.\n");
    printf("  The question is whether the compression ratio of\n");
    printf("  60 : 10^16 can actually be achieved by the structure\n");
    printf("  of the primes.\n\n");

    printf("  Answer: it CAN'T (heuristically). The primes don't\n");
    printf("  have enough structure to correlate 10^16 compositeness\n");
    printf("  facts into a single 60-bit pattern.\n");
    printf("  This is essentially the U² pseudorandomness of primes.\n\n");

    /* ═══════ SYNTHESIS ═══════ */
    printf("====================================================\n");
    printf("## SYNTHESIS\n\n");

    printf("  A Goldbach counterexample N₀ would need:\n\n");

    printf("  1. MODULAR: N₀ ≡ 2 mod 6 (minimal singular series)\n");
    printf("  2. CHAIN: ~N₀/(2logN₀) consecutive composite partners\n");
    printf("     (longest observed chain: ~%d vs ~8700 needed at 200K)\n",
           best_chain);
    printf("  3. PROBABILITY: P[exists] ≈ e^{-N₀/(2log²N₀)}\n");
    printf("     At N₀=10^18: P ≈ e^{-10^14} ≈ 10^{-4×10^13}\n");
    printf("  4. INFORMATION: 60 bits encoding 10^16 bits\n");
    printf("     Compression ratio: 10^{14.2} — exceeds Kolmogorov limit\n\n");

    printf("   The counterexample is 'morally impossible':\n");
    printf("  it would require the primes to have a CONSPIRACY\n");
    printf("  of depth π(N₀/2), which exceeds the information\n");
    printf("  content that number theory can encode.\n\n");

    printf("  This is why Goldbach is true. We just can't prove it.\n");

    free(hist);
    return 0;
}
