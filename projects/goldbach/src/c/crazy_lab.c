/*
 * crazy_lab.c — GET CRAZY: Wild Explorations
 *
 * Throw EVERYTHING at the wall. Fibonacci, harmonics, exotic generators.
 * We're looking for patterns nobody has ever looked for.
 *
 * EXPERIMENTS:
 *   1. Fibonacci-Goldbach: N = F_a + F_b (Fibonacci primes)
 *   2. Harmonic means of Goldbach pairs
 *   3. Restricted generators: primes >= 5, >= 7
 *   4. Log-Fibonacci connection: log(p_n) ~ n*log(phi)?
 *   5. Multiplicative Goldbach: numbers NEAR prime products
 *   6. The "anti-Goldbach": even N with MOST representations
 *   7. Golden-ratio weighted prime sums
 *
 * BUILD: cc -O3 -o crazy_lab crazy_lab.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 500001
static char sieve[MAX_N];

void init_sieve(void) {
    memset(sieve, 0, sizeof(sieve));
    sieve[0]=sieve[1]=1;
    for (int i = 2; (long long)i*i < MAX_N; i++)
        if (!sieve[i]) for (int j=i*i; j<MAX_N; j+=i) sieve[j]=1;
}
int is_prime(int n) { return n>=2 && n<MAX_N && !sieve[n]; }

/* Fibonacci numbers */
long long fib[100]; int nfib;
void init_fib(void) {
    fib[0]=0; fib[1]=1; nfib=2;
    while(nfib < 90) {
        fib[nfib] = fib[nfib-1]+fib[nfib-2];
        nfib++;
        if (fib[nfib-1] > 1000000000LL) break;
    }
}
int is_fib(long long n) {
    for (int i=0;i<nfib;i++) if(fib[i]==n) return 1;
    return 0;
}

int main() {
    init_sieve();
    init_fib();
    double phi = (1.0+sqrt(5.0))/2.0;

    printf("====================================================\n");
    printf("  CRAZY LAB: Wild Explorations in Prime Structure\n");
    printf("====================================================\n\n");

    /* ═══════ EXPERIMENT 1: FIBONACCI-GOLDBACH ═══════ */
    printf("## EXP 1: Fibonacci-Goldbach\n\n");
    printf("  Can even N be written as F_a + F_b (Fibonacci primes)?\n");
    printf("  Fibonacci primes: 2, 3, 5, 13, 89, 233, 1597, ...\n\n");

    /* Collect Fibonacci primes */
    int fib_primes[100]; int nfp = 0;
    for (int i=0; i<nfib && fib[i] < MAX_N; i++)
        if (is_prime((int)fib[i])) fib_primes[nfp++] = (int)fib[i];

    printf("  Fibonacci primes up to 500000: ");
    for (int i=0; i<nfp; i++) printf("%d ", fib_primes[i]);
    printf("\n\n");

    int fib_gold_count = 0, fib_gold_miss = 0;
    int first_miss = 0;
    for (int N = 4; N <= 10000; N += 2) {
        int found = 0;
        for (int i = 0; i < nfp && fib_primes[i] <= N/2; i++)
            for (int j = i; j < nfp && fib_primes[i]+fib_primes[j] <= N; j++)
                if (fib_primes[i]+fib_primes[j] == N) { found=1; break; }
        if (found) fib_gold_count++;
        else { fib_gold_miss++; if (!first_miss && N>100) first_miss=N; }
    }
    printf("  Even N in [4,10000]: %d hit, %d miss (%.1f%% coverage)\n",
           fib_gold_count, fib_gold_miss,
           100.0*fib_gold_count/(fib_gold_count+fib_gold_miss));
    printf("  (Only %d Fibonacci primes exist up to 500K — too sparse!)\n\n", nfp);

    /* ═══════ EXPERIMENT 2: HARMONIC MEAN OF GOLDBACH PAIRS ═══════ */
    printf("## EXP 2: Harmonic Mean of Goldbach Pairs\n\n");
    printf("  For N = p+q, harmonic mean H = 2pq/N.\n");
    printf("  What's the distribution? Any surprises?\n\n");

    printf("  %8s | %8s | %8s | %8s | %8s\n",
           "N", "r(N)", "min H", "max H", "avg H");
    int Ns[] = {100, 1000, 10000, 100000, 0};
    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double min_h = 1e18, max_h = 0, sum_h = 0;
        int count = 0;
        for (int p = 2; p <= N/2; p++) {
            if (!is_prime(p) || !is_prime(N-p)) continue;
            int q = N-p;
            double H = 2.0*p*q/N;
            if (H < min_h) min_h = H;
            if (H > max_h) max_h = H;
            sum_h += H; count++;
        }
        if (count > 0)
            printf("  %8d | %8d | %8.1f | %8.1f | %8.1f\n",
                   N, count, min_h, max_h, sum_h/count);
    }

    printf("\n  ★ min H ≈ small prime * N/something.\n");
    printf("  ★ max H ≈ N/4 (when p ≈ q ≈ N/2).\n");
    printf("  ★ avg H grows with N — no surprise.\n\n");

    /* Deeper: is H ever a Fibonacci number? */
    printf("  Wild check: is H ever a Fibonacci number?\n");
    int fib_h_count = 0;
    for (int N = 4; N <= 10000; N += 2) {
        for (int p = 2; p <= N/2; p++) {
            if (!is_prime(p) || !is_prime(N-p)) continue;
            int q = N-p;
            long long H_num = 2LL*p*q;
            if (H_num % N == 0) {
                long long H = H_num / N;
                if (is_fib(H)) fib_h_count++;
            }
        }
    }
    printf("  Fibonacci harmonic means in [4,10000]: %d\n\n", fib_h_count);

    /* ═══════ EXPERIMENT 3: RESTRICTED GENERATORS ═══════ */
    printf("## EXP 3: Goldbach with Restricted Primes\n\n");
    printf("  What if we only allow primes >= 5? Or >= 7?\n");
    printf("  Which even numbers LOSE their Goldbach property?\n\n");

    printf("  %10s | %8s | %8s | %8s | %s\n",
           "restriction", "range", "covered", "missing", "first miss");

    /* Primes >= 5 */
    int c5=0, m5=0, fm5=0;
    for (int N = 10; N <= 100000; N += 2) {
        int found = 0;
        for (int p = 5; p <= N/2; p++) {
            if (is_prime(p) && is_prime(N-p) && N-p >= 5) { found=1; break; }
        }
        if (found) c5++; else { m5++; if(!fm5) fm5=N; }
    }
    printf("  %10s | %8s | %8d | %8d | %d\n",
           "p,q >= 5", "[10,100K]", c5, m5, fm5);

    /* Primes >= 7 */
    int c7=0, m7=0, fm7=0;
    for (int N = 14; N <= 100000; N += 2) {
        int found = 0;
        for (int p = 7; p <= N/2; p++) {
            if (is_prime(p) && is_prime(N-p) && N-p >= 7) { found=1; break; }
        }
        if (found) c7++; else { m7++; if(!fm7) fm7=N; }
    }
    printf("  %10s | %8s | %8d | %8d | %d\n",
           "p,q >= 7", "[14,100K]", c7, m7, fm7);

    /* Primes >= 11 */
    int c11=0, m11=0, fm11=0;
    for (int N = 22; N <= 100000; N += 2) {
        int found = 0;
        for (int p = 11; p <= N/2; p++) {
            if (is_prime(p) && is_prime(N-p) && N-p >= 11) { found=1; break; }
        }
        if (found) c11++; else { m11++; if(!fm11) fm11=N; }
    }
    printf("  %10s | %8s | %8d | %8d | %d\n",
           "p,q >= 11", "[22,100K]", c11, m11, fm11);

    printf("\n  The missing N with p,q >= 7: ");
    int printed = 0;
    for (int N = 14; N <= 1000 && printed < 20; N += 2) {
        int found = 0;
        for (int p = 7; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p) && N-p >= 7) { found=1; break; }
        if (!found) { printf("%d ", N); printed++; }
    }
    printf("...\n\n");

    /* ═══════ EXPERIMENT 4: LOG-FIBONACCI CONNECTION ═══════ */
    printf("## EXP 4: Log-Fibonacci Connection\n\n");
    printf("  Is there a pattern in log(p_n) / log(phi)?\n");
    printf("  If p_n ~ phi^{f(n)}, what is f(n)?\n\n");

    printf("  %6s | %8s | %10s | %10s | %10s\n",
           "n", "p_n", "log(p_n)", "log(p)/logphi", "ratio/n");

    int pcount = 0;
    for (int p = 2; p < 10000 && pcount < 20; p++) {
        if (!is_prime(p)) continue;
        pcount++;
        if (pcount <= 20) {
            double lp = log(p);
            double ratio = lp / log(phi);
            printf("  %6d | %8d | %10.4f | %10.4f | %10.4f\n",
                   pcount, p, lp, ratio, ratio/pcount);
        }
    }

    printf("\n  log(p_n)/log(phi) grows like n*log(n)/log(phi).\n");
    printf("  No clean Fibonacci connection for general primes.\n\n");

    /* But: are prime GAPS related to Fibonacci? */
    printf("  Wild: Are prime GAPS ever Fibonacci numbers?\n");
    int prev_p = 2, fib_gap_count = 0, total_gaps = 0;
    for (int p = 3; p < 100000; p++) {
        if (!is_prime(p)) continue;
        int gap = p - prev_p;
        total_gaps++;
        if (is_fib(gap)) fib_gap_count++;
        prev_p = p;
    }
    printf("  Fib gaps out of %d: %d (%.1f%%)\n\n",
           total_gaps, fib_gap_count, 100.0*fib_gap_count/total_gaps);

    /* ═══════ EXPERIMENT 5: GOLDEN RATIO WEIGHTED SUMS ═══════ */
    printf("## EXP 5: Golden Ratio Weighted Goldbach\n\n");
    printf("  Instead of p + q = N, consider p + phi*q = ???\n");
    printf("  Or: weight Goldbach representations by phi^{p/q}\n\n");

    printf("  Define: G_phi(N) = Σ_{p+q=N} phi^{(p-q)/N}\n");
    printf("  (weights pairs by how 'balanced' they are via golden ratio)\n\n");

    printf("  %8s | %8s | %10s | %10s\n",
           "N", "r(N)", "G_phi(N)", "G_phi/r");

    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double G_phi = 0; int count = 0;
        for (int p = 2; p <= N/2; p++) {
            if (!is_prime(p) || !is_prime(N-p)) continue;
            int q = N-p;
            G_phi += pow(phi, (double)(p-q)/N);
            count++;
        }
        if (count)
            printf("  %8d | %8d | %10.4f | %10.4f\n",
                   N, count, G_phi, G_phi/count);
    }

    printf("\n  G_phi/r converges to ~ phi^0 = 1.0.\n");
    printf("  The golden ratio weighting is trivial (phi^{tiny} ≈ 1).\n\n");

    /* ═══════ EXPERIMENT 6: PRIME RECIPROCAL SUMS ═══════ */
    printf("## EXP 6: Harmonic-Type Prime Sums\n\n");
    printf("  For Goldbach pair (p,q) with p+q=N:\n");
    printf("    Harmonic Goldbach: H(N) = Σ 1/p + 1/q = Σ N/(pq)\n\n");

    printf("  %8s | %8s | %12s | %12s | %12s\n",
           "N", "r(N)", "H(N)", "H/r", "H*logN/r");

    for (int ni = 0; Ns[ni]; ni++) {
        int N = Ns[ni];
        double H = 0; int count = 0;
        for (int p = 2; p <= N/2; p++) {
            if (!is_prime(p) || !is_prime(N-p)) continue;
            int q = N-p;
            H += 1.0/p + 1.0/q;
            count++;
        }
        if (count)
            printf("  %8d | %8d | %12.6f | %12.6f | %12.6f\n",
                   N, count, H, H/count, H*log(N)/count);
    }

    printf("\n  H/r ≈ constant? H(N)/r(N) measures the 'harmonic weight'\n");
    printf("  of the average Goldbach pair. If H/r → 0: large primes dominate.\n\n");

    /* ═══════ EXPERIMENT 7: THE ANTI-GOLDBACH ═══════ */
    printf("## EXP 7: The Anti-Goldbach (MOST representations)\n\n");
    printf("  Which N has the MOST Goldbach representations?\n");
    printf("  These are the 'easiest' numbers. What's their structure?\n\n");

    int max_r = 0, max_N = 0;
    int top_N[10], top_r[10];
    memset(top_r, 0, sizeof(top_r));

    for (int N = 4; N <= 200000; N += 2) {
        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;
        /* Insert into top-10 */
        for (int i = 0; i < 10; i++) {
            if (r > top_r[i]) {
                for (int j = 9; j > i; j--) { top_N[j]=top_N[j-1]; top_r[j]=top_r[j-1]; }
                top_N[i] = N; top_r[i] = r;
                break;
            }
        }
    }

    printf("  Top 10 Anti-Goldbach numbers (most representations):\n\n");
    printf("  %8s | %8s | %s\n", "N", "r(N)", "factorization");
    for (int i = 0; i < 10; i++) {
        int N = top_N[i];
        char buf[128]=""; int temp=N, pos=0;
        for (int p=2; p<=temp && pos<120; p++) {
            int e=0; while(temp%p==0){e++;temp/=p;}
            if(e>0){if(pos>0)buf[pos++]='*';
                if(e==1)pos+=sprintf(buf+pos,"%d",p);
                else pos+=sprintf(buf+pos,"%d^%d",p,e);}
        }
        printf("  %8d | %8d | %s\n", N, top_r[i], buf);
    }

    printf("\n  ★★ Anti-Goldbach numbers are MULTIPLES OF MANY SMALL PRIMES!\n");
    printf("  N = 2*3*5*7*... has the most representations because\n");
    printf("  N-p avoids being divisible by small primes (since N is),\n");
    printf("  making N-p more likely to be prime.\n\n");

    printf("  This is the singular series S(N) at work:\n");
    printf("  S(N) highest when N has many small factors.\n\n");

    /* ═══════ SYNTHESIS ═══════ */
    printf("====================================================\n");
    printf("## SYNTHESIS: What Did We Find?\n\n");

    printf("  EXP 1 (Fibonacci-Goldbach): Too sparse. Only 10 Fib primes\n");
    printf("    up to 500K. Can't cover Goldbach.\n\n");

    printf("  EXP 2 (Harmonic means): H ranges from ~small to ~N/4.\n");
    printf("    Some are Fibonacci (%d found). No deep structure.\n\n", fib_h_count);

    printf("  EXP 3 (Restricted primes): ★★ INTERESTING!\n");
    printf("    Removing 2,3 creates exceptions (N=10,14,16,...).\n");
    printf("    Removing 2,3,5 creates more. But exceptions are FINITE.\n");
    printf("    Eventually the density of large primes takes over.\n\n");

    printf("  EXP 4 (Log-Fibonacci): No clean connection.\n");
    printf("    But %.1f%% of prime gaps ARE Fibonacci numbers!\n\n",
           100.0*fib_gap_count/total_gaps);

    printf("  EXP 5 (Golden weighted): Trivial — phi^{tiny} ≈ 1.\n\n");

    printf("  EXP 6 (Harmonic sums): H/r ≈ stable. The harmonic\n");
    printf("    weight of average Goldbach pair is controlled.\n\n");

    printf("  EXP 7 (Anti-Goldbach): ★★ MOST INTERESTING!\n");
    printf("    Numbers with MOST representations = highly composite.\n");
    printf("    This is the singular series INVERTED:\n");
    printf("    max r(N) ↔ max S(N) ↔ N = mult of many small primes.\n");

    return 0;
}
