/*
 * weight_bases.c — Weight formula starting from different prime bases.
 *
 * Base 1: All primes (p₁=2, p₂=3, p₃=5, ...)
 * Base 2: Odd primes (p₁=3, p₂=5, p₃=7, ...) — natural: 2 is the "anomalous" prime
 * Base 3: 6k±1 primes (p₁=5, p₂=7, ...) — natural: all primes >3 are ≡ ±1 mod 6
 *
 * BUILD: cc -O3 -o weight_bases weight_bases.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_P 50000
int all_primes[MAX_P]; int n_all = 0;

void gen_primes(int limit) {
    char *s = calloc(limit+1,1); s[0]=s[1]=1;
    for (int i=2;i<=limit;i++){if(!s[i]){all_primes[n_all++]=i;if(n_all>=MAX_P)break;
        for(long long j=(long long)i*i;j<=limit;j+=i)s[(int)j]=1;}}
    free(s);
}

typedef struct { int *p; int n; const char *name; } PrimeBase;

void analyze_base(PrimeBase base) {
    int *p = base.p;
    int np = base.n;
    printf("## Base: %s (p₁=%d, ..., %d primes)\n\n", base.name, p[0], np);

    /* Frobenius: since gcd(S₁, S₂) = gcd(p₁, p₁+p₂), representability */
    long long S1 = p[0], S2 = p[0] + p[1];
    /* gcd */
    long long a = S1, b = S2;
    while (b) { long long t = b; b = a%b; a = t; }
    long long g = a;
    printf("  S₁=%lld, S₂=%lld, gcd=%lld", S1, S2, g);
    if (g == 1) {
        long long frob = S1*S2 - S1 - S2;
        printf(", Frobenius=%lld → all integers ≥ %lld representable\n", frob, frob+1);
    } else {
        printf(" → NOT coprime! Only multiples of %lld representable\n", g);
    }

    /* Ratio w₁/w_{n-1} for various n */
    printf("\n  %6s | %8s | %10s | %10s | %10s\n",
           "n", "pₙ", "ratio", "→ limit", "correction");

    for (int n = 10; n < np && n <= 40000; n = (int)(n*2.5)) {
        double A = 0, B = 0;
        for (int i = 0; i < n; i++) {
            A += p[i];
            B += (double)(n-1-i) * p[i];
        }
        double ratio = 1.0 + (n-1) * A / B;
        double logn = log((double)n);
        double correction = ratio - 4.0;
        printf("  %6d | %8d | %10.6f | %10.6f | %10.6f\n",
               n, p[n], ratio, 4.0, correction);
    }

    /* The weight curve at n=1000 */
    int n = (np > 1000) ? 1000 : np - 1;
    double A = 0, B = 0;
    for (int i = 0; i < n; i++) { A += p[i]; B += (double)(n-1-i)*p[i]; }
    double c = (double)p[n] / (2.0 * A);
    double eps = (double)p[n] / (2.0 * B);
    double w_first = c + eps*(n-1);
    double w_last = c;

    printf("\n  At n=%d (pₙ=%d):\n", n, p[n]);
    printf("    w₁ = %.8f (weight on %s prime = %d)\n", w_first, "smallest", p[0]);
    printf("    w_{n-1} = %.8f (weight on largest prime = %d)\n", w_last, p[n-1]);
    printf("    ratio = %.4f\n", w_first/w_last);
    printf("    uniform c = pₙ/Σpᵢ = %.8f\n\n", (double)p[n]/A);
}

int main() {
    gen_primes(700000);

    printf("# Weight Formula Across Prime Bases\n\n");

    /* Base 1: all primes */
    PrimeBase base1 = { all_primes, n_all, "All primes (from 2)" };
    analyze_base(base1);

    /* Base 2: odd primes */
    int odd_primes[MAX_P]; int n_odd = 0;
    for (int i = 1; i < n_all; i++) odd_primes[n_odd++] = all_primes[i]; /* skip 2 */
    PrimeBase base2 = { odd_primes, n_odd, "Odd primes (from 3)" };
    analyze_base(base2);

    /* Base 3: primes ≥ 5 */
    int big_primes[MAX_P]; int n_big = 0;
    for (int i = 2; i < n_all; i++) big_primes[n_big++] = all_primes[i]; /* skip 2,3 */
    PrimeBase base3 = { big_primes, n_big, "Primes ≥ 5 (6k±1)" };
    analyze_base(base3);

    /* Summary comparison */
    printf("═══════════════════════════════════════════\n");
    printf("## Comparison at n=5000\n\n");
    printf("  %20s | %8s | %8s | %8s\n", "Base", "ratio", "w₁", "w_{n-1}");
    int n = 5000;
    for (int b = 0; b < 3; b++) {
        int *p; int np;
        const char *nm;
        if (b==0) { p=all_primes; np=n_all; nm="From 2"; }
        else if (b==1) { p=odd_primes; np=n_odd; nm="From 3"; }
        else { p=big_primes; np=n_big; nm="From 5"; }
        if (n >= np) continue;
        double A=0,B=0;
        for(int i=0;i<n;i++){A+=p[i];B+=(double)(n-1-i)*p[i];}
        double c=(double)p[n]/(2*A), eps=(double)p[n]/(2*B);
        double r=1+(n-1)*A/B;
        printf("  %20s | %8.4f | %8.6f | %8.6f\n", nm, r, c+eps*(n-1), c);
    }

    printf("\n## Why These Bases Are Natural\n\n");
    printf("  From 2: includes ALL primes. The \"full\" decomposition.\n");
    printf("  From 3: odd primes only. Natural because 2 is the sole even prime\n");
    printf("          — it has unique arithmetic properties (only ramified prime).\n");
    printf("  From 5: primes ≡ ±1 mod 6. Every prime > 3 has this form.\n");
    printf("          This is the \"canonical\" prime set in modular arithmetic.\n");
    printf("          Equivalently: primes coprime to 6 = 2·3.\n\n");

    printf("  KEY: ratio → 4 regardless of starting prime.\n");
    printf("  The limiting ratio 4 is a UNIVERSAL constant of prime distribution,\n");
    printf("  independent of which small primes are excluded.\n");

    return 0;
}
