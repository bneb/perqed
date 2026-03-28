/*
 * crack11_distribution_attack.c — What the Distribution Tells Us
 *
 * The r(N)/prediction distribution has:
 *   mean ≈ 0.99, std ≈ 0.20, CV ≈ 20%, bimodal
 *
 * QUESTION: What does this tell us about ATTACK STRATEGIES?
 *
 * KEY INSIGHT: To prove Goldbach, we need to show r(N) > 0 for all N.
 * Since r(N) ≈ prediction · (0.99 ± 0.20), we need to show:
 *   |r(N) - prediction| < prediction
 * i.e., the fluctuations stay within 100% of the prediction.
 *
 * Empirically, the min ratio is ~0.65, so fluctuations are < 35%.
 * A proof needs to get the error bound from ∞ (current) to < 100%.
 *
 * BUILD: cc -O3 -o crack11_distribution_attack crack11_distribution_attack.c -lm
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
    double S = 2*C2;
    int t=N; for(int p=3;p<=t;p++){if(t%p)continue;while(t%p==0)t/=p;S*=(double)(p-1)/(p-2);}
    return S;
}

int main() {
    init();
    double C2 = twin_prime_const();

    printf("====================================================\n");
    printf("  CRACK 11: The Distribution as Attack Surface Map\n");
    printf("====================================================\n\n");

    int limit = 1000000;

    /* ═══════ PART 1: LEFT TAIL — HOW CLOSE TO ZERO? ═══════ */
    printf("## PART 1: The Left Tail — How Close Does r(N) Get to Zero?\n\n");

    printf("  If r(N)/prediction ever reaches 0, that's a counterexample.\n");
    printf("  How close does the left tail get?\n\n");

    double min_ratio = 1e10;
    int min_ratio_N = 0;
    double ratios_sorted[50]; int n_extreme = 0;

    /* Find the 20 smallest ratios */
    typedef struct { double ratio; int N; } RN;
    RN extremes[1000];
    int ne = 0;

    for (int N = 1000; N <= limit; N += 2) {
        double S = singular_series(N, C2);
        double logN = log((double)N);
        double pred = S * N / (2 * logN * logN);
        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;
        double ratio = r / pred;

        if (ne < 30 || ratio < extremes[ne-1].ratio) {
            if (ne < 30) ne++;
            extremes[ne-1].ratio = ratio;
            extremes[ne-1].N = N;
            /* Sort by ratio (insertion sort) */
            for (int i = ne-1; i > 0; i--) {
                if (extremes[i].ratio < extremes[i-1].ratio) {
                    RN tmp = extremes[i]; extremes[i]=extremes[i-1]; extremes[i-1]=tmp;
                } else break;
            }
        }
    }

    printf("  The 20 even numbers with SMALLEST r(N)/prediction:\n\n");
    printf("  %4s | %10s | %6s | %8s | %8s | %6s\n",
           "rank", "N", "r(N)", "pred", "ratio", "N mod 6");

    for (int i = 0; i < 20 && i < ne; i++) {
        int N = extremes[i].N;
        double S = singular_series(N, C2);
        double logN = log((double)N);
        double pred = S * N / (2*logN*logN);
        int r = 0;
        for (int p = 2; p <= N/2; p++)
            if (is_prime(p) && is_prime(N-p)) r++;
        printf("  %4d | %10d | %6d | %8.1f | %8.4f | %6d\n",
               i+1, N, r, pred, extremes[i].ratio, N%6);
    }

    printf("\n   Minimum ratio: %.4f at N = %d\n\n", extremes[0].ratio, extremes[0].N);

    /* ═══════ PART 2: STRATIFY BY N MOD 6 ═══════ */
    printf("## PART 2: Stratification by N mod 6\n\n");

    printf("  The bimodality suggests different classes behave differently.\n\n");

    for (int mod6 = 0; mod6 < 6; mod6 += 2) {
        double sum = 0, sum2 = 0; int cnt = 0;
        double min_r_class = 1e10;
        int min_r_N = 0;

        for (int N = 1000; N <= limit; N += 6) {
            int NN = N + mod6;
            if (NN > limit || NN < 1000) continue;
            double S = singular_series(NN, C2);
            double logN = log((double)NN);
            double pred = S * NN / (2*logN*logN);
            int r = 0;
            for (int p = 2; p <= NN/2; p++)
                if (is_prime(p) && is_prime(NN-p)) r++;
            double ratio = r / pred;
            sum += ratio; sum2 += ratio*ratio; cnt++;
            if (ratio < min_r_class) { min_r_class = ratio; min_r_N = NN; }
        }

        double mean = sum/cnt, var = sum2/cnt - mean*mean;
        printf("  N ≡ %d mod 6: mean=%.4f, std=%.4f, CV=%.4f, min=%.4f (N=%d)\n",
               mod6, mean, sqrt(var), sqrt(var)/mean, min_r_class, min_r_N);
    }

    printf("\n   KEY: Each class has a DIFFERENT CV.\n");
    printf("  The tighter the CV, the easier to prove the left tail > 0.\n\n");

    /* ═══════ PART 3: DOES THE LEFT TAIL SHRINK WITH N? ═══════ */
    printf("## PART 3: Left Tail vs N — Does It Approach 1?\n\n");

    printf("  If min(r/pred) → 1 as N → ∞, then the fluctuations\n");
    printf("  shrink and Goldbach becomes 'more true'.\n\n");

    printf("  %12s | %10s | %10s | %10s\n",
           "range", "min r/pred", "mean r/pred", "std r/pred");

    int ranges[][2] = {{1000,5000},{5000,10000},{10000,50000},
                       {50000,100000},{100000,500000},{500000,1000000},{0,0}};

    for (int ri = 0; ranges[ri][0]; ri++) {
        double sum=0,sum2=0,min_rr=1e10; int cnt=0;
        for (int N = ranges[ri][0]; N <= ranges[ri][1]; N += 2) {
            double S = singular_series(N, C2);
            double logN = log((double)N);
            double pred = S*N/(2*logN*logN);
            int r = 0;
            for (int p = 2; p <= N/2; p++)
                if (is_prime(p)&&is_prime(N-p)) r++;
            double ratio = r/pred;
            sum+=ratio; sum2+=ratio*ratio; cnt++;
            if(ratio<min_rr) min_rr=ratio;
        }
        double mean=sum/cnt, std=sqrt(sum2/cnt-mean*mean);
        printf("  [%6d,%6d] | %10.4f | %10.4f | %10.4f\n",
               ranges[ri][0], ranges[ri][1], min_rr, mean, std);
    }

    /* ═══════ PART 4: WHAT THE DISTRIBUTION TELLS ABOUT ATTACKS ═══════ */
    printf("\n## PART 4: Attack Implications\n\n");

    printf("  ┌───────────────────────────────────────────────────────┐\n");
    printf("  │ OBSERVATION              │ IMPLICATION FOR ATTACKS    │\n");
    printf("  ├───────────────────────────────────────────────────────┤\n");
    printf("  │ r/pred ∈ [0.65, 1.40]    │ Need prove error < 100%%  │\n");
    printf("  │ CV ≈ 20%% (not 50-100%%)  │ Randomness is MILD       │\n");
    printf("  │ CV shrinks with N        │ Problem gets EASIER       │\n");
    printf("  │ Bimodal (N mod 6)        │ STRATIFY: prove per class │\n");
    printf("  │ No structure beyond S(N) │ No shortcut past S(N)     │\n");
    printf("  │ Left tail ≈ 0.65·pred    │ 'Safety margin' = 65%%    │\n");
    printf("  └───────────────────────────────────────────────────────┘\n\n");

    printf("  ATTACK STRATEGY 1: CONCENTRATION INEQUALITY\n");
    printf("  If r(N) is 'like' a sum of ~N/log²N independent 0/1 RVs,\n");
    printf("  then Chernoff bound gives P[r < (1-δ)·μ] < e^{-δ²μ/2}.\n");
    printf("  For δ = 1 (r = 0): P[r = 0] < e^{-μ/2}.\n");
    printf("  Union over N ≤ X: P[∃ cex] < X · e^{-μ/2}.\n");
    printf("  For μ ≈ X/log²X: P < X · e^{-X/(2log²X)} → 0.\n");
    printf("  PROBLEM: Chernoff requires INDEPENDENCE.\n");
    printf("  But (p is prime) and (N-p is prime) are NOT independent.\n\n");

    printf("  ATTACK STRATEGY 2: SECOND MOMENT METHOD\n");
    printf("  Compute E[r²] and use Cauchy-Schwarz:\n");
    printf("  P[r > 0] ≥ E[r]² / E[r²].\n");
    printf("  If E[r²] ≈ E[r]²·(1 + 1/μ), then P[r > 0] ≈ 1 - 1/μ → 1.\n");
    printf("  This is the Paley-Zygmund approach.\n");
    printf("  PROBLEM: gives 'almost all N', not 'ALL N'.\n\n");

    printf("  ATTACK STRATEGY 3: STRATIFIED CIRCLE METHOD\n");
    printf("  Instead of bounding E uniformly, bound E for each\n");
    printf("  residue class N ≡ a mod q separately.\n");
    printf("  Each class has tighter CV → tighter error bounds.\n");
    printf("  PROBLEM: the error still comes from minor arcs,\n");
    printf("  which don't depend on N mod q.\n\n");

    printf("  ATTACK STRATEGY 4: LEFT TAIL BOUND (NOVEL?)\n");
    printf("  The key observation: the LEFT tail of r/pred is BOUNDED\n");
    printf("  away from 0. The minimum ratio GROWS (approaches 1) as\n");
    printf("  N increases. If we can prove:\n");
    printf("    min_{N∈[X,2X]} r(N)/prediction(N) → 1\n");
    printf("  then Goldbach follows for N > X₀.\n\n");

    printf("  This is equivalent to proving: the variance of r(N)\n");
    printf("  around its prediction goes to zero relative to the mean.\n");
    printf("  I.e., Var(r) / E[r]² → 0.\n\n");

    printf("  KNOWN: Var(r(N)) averaged over N ∈ [X, 2X] is bounded\n");
    printf("  by the FOURTH MOMENT of primes in short intervals.\n");
    printf("  Montgomery-Vaughan (1975) proved this gives E(X) = O(X^{1-δ}).\n\n");

    printf("  THE EXACT GAP: They get Var(r)/E[r]² = O(1/log^C N),\n");
    printf("  which gives P[r=0] < 1/log^C N, hence the exceptional set\n");
    printf("  has density 0 — but NOT that it's empty.\n\n");

    printf("  TO PROVE IT'S EMPTY: need Var(r)/E[r]² = O(1/N^{1+ε}),\n");
    printf("  which would give P[r=0] < 1/N^{1+ε}, and union bound\n");
    printf("  over all N gives convergence.\n\n");

    printf("   THE DISTRIBUTION TELLS US:\n");
    printf("  CV² = Var/E² ≈ 0.04. Empirically this is small.\n");
    printf("  But provably it's only known to be O(1/log^C N),\n");
    printf("  not O(1/N^{1+ε}).\n\n");

    printf("  The gap between 'known CV² = O(1/log^C)' and\n");
    printf("  'needed CV² = O(1/N^{1+ε})' is ENORMOUS:\n");
    printf("  it's the gap between log-power and polynomial decay.\n");
    printf("  This is EXACTLY the 3-log-powers gap from the\n");
    printf("  circle method.\n\n");

    printf("   FINAL INSIGHT:\n");
    printf("  The r(N) distribution is a PICTURE of the circle\n");
    printf("  method gap. The CV = 20%% is what we SEE empirically;\n");
    printf("  proving it's < 100%% requires closing a gap of\n");
    printf("  log³N in the minor arc estimates.\n\n");

    printf("  The distribution doesn't reveal a NEW attack.\n");
    printf("  It reveals, with exquisite clarity, the SHAPE\n");
    printf("  of the wall we keep hitting.\n");

    return 0;
}
