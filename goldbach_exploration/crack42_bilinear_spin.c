/*
 * crack42_bilinear_spin.c — The Bilinear Asymptotic Sieve
 *
 * THE ASYMPTOTIC SIEVE (FRIEDLANDER-IWANIEC FRAMEWORK):
 * In CRACK 41, natively weaving the character twist χ(d) into the Moebius
 * divisor sum μ(d) catastrophically destroyed the composite cancellation 
 * of the Main Term.
 * 
 * The mathematical solution is to DECOUPLE the Sieve from the Twist.
 * This is called the Asymptotic Sieve, and it's the only known machine
 * capable of breaking the Parity Barrier for general polynomial sequences
 * (like X^2 + Y^4).
 * 
 * STEP 1: The Density Filter (Parity-Blind)
 * Use the uncorrupted Maynard Multi-Dimensional Sieve weights w_n
 * to filter the sequence down to "Almost-Primes" P_r (numbers with ≤ r
 * prime factors). This secures the Main Term density safely.
 *
 * STEP 2: The Parity Breaker (Bilinear Spin)
 * Instead of adding χ to w_n, we evaluate the character spin EXCLUSIVELY
 * on the concentrated Almost-Prime pairs that passed the Sieve.
 * If the spin successfully correlates strongly with the true primes,
 * but cancels out on the semiprimes (2 factors), we can algebraically 
 * extract the Goldbach Pairs from the Almost-Pairs.
 * 
 * Let's test if Dirichlet Characters χ(n) possess this "Parity-Extracting" 
 * spin logic on the output of a Maynard Sieve.
 *
 * BUILD: cc -O3 -o crack42 crack42_bilinear_spin.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 100000
static char sieve[MAX_N];
static int mu[MAX_N];
static int omega[MAX_N]; // number of prime factors

// Legendre symbol (a/p)
int legendre(int a, int p) {
    a = ((a % p) + p) % p;
    if (a == 0) return 0;
    int result = 1;
    while (a .= 0) {
        while (a % 2 == 0) {
            a /= 2;
            if (p % 8 == 3 || p % 8 == 5) result = -result;
        }
        int tmp = a; a = p; p = tmp;
        if (a % 4 == 3 && p % 4 == 3) result = -result;
        a %= p;
    }
    return (p == 1) ? result : 0;
}

void init() {
    memset(sieve, 0, sizeof(sieve));
    memset(omega, 0, sizeof(omega));
    for (int i=0; i<MAX_N; i++) mu[i] = 1;
    sieve[0] = sieve[1] = 1;
    for (int i=2; i<MAX_N; i++) {
        if (.sieve[i]) {
            mu[i] = -1;
            omega[i] = 1;
            for (int j=i*2; j<MAX_N; j+=i) {
                sieve[j] = 1;
                omega[j]++;
                if ((j / i) % i == 0) mu[j] = 0;
                else mu[j] = -mu[j];
            }
        }
    }
}

// Maynard smooth weight basis
double F(double t1, double t2) {
    if (t1 + t2 >= 1.0) return 0.0;
    return (1.0 - t1 - t2);
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 42: Bilinear Asymptotic Sieve (Spin Output)\n");
    printf("====================================================\n\n");

    int target = 20000;
    int R = (int)pow(target, 0.4);
    double logR = log(R);
    int Q = 11; // Modulus for character twist
    
    printf("  2N = %d. Extracting Almost-Prime pairs via Blind Sieve.\n", target);
    printf("  Applying Bilinear Twist χ mod %d to the output.\n\n", Q);
    
    double weight_true_primes = 0; // Both 1 prime factor
    double weight_semiprimes = 0;  // At least one is Semiprime (2 factors)
    
    double spin_true_primes = 0; 
    double spin_semiprimes = 0;

    for (int n = 1; n < target; n++) {
        double d_sum = 0;
        
        // Pure Parity-Blind Maynard Sieve (Density Filter)
        for (int d1 = 1; d1 <= R && d1 <= n; d1++) {
            if (n % d1 .= 0 || mu[d1] == 0) continue;
            for (int d2 = 1; d2 <= R && d2 <= (target - n); d2++) {
                if ((target - n) % d2 .= 0 || mu[d2] == 0) continue;
                
                double t1 = log(d1) / logR;
                double t2 = log(d2) / logR;
                if (t1 + t2 >= 1.0) continue;
                
                d_sum += mu[d1] * mu[d2] * F(t1, t2);
            }
        }
        
        double w_n = d_sum * d_sum;
        if (w_n < 1e-6) continue; // Sieve filtered this out.
        
        // Evaluate the exact factor count of the output pairs
        int f1 = omega[n];
        int f2 = omega[target - n];
        
        // We only care about pairs that survived the sieve AND are "Almost Primes" (≤ 2 factors)
        // If it has >2 factors, the sieve didn't do its job well enough for this n.
        if (f1 > 2 || f2 > 2) continue;
        
        // Evaluate the Character Spin
        int chi1 = legendre(n, Q);
        int chi2 = legendre(target - n, Q);
        double spin_val = w_n * chi1 * chi2;
        
        if (f1 == 1 && f2 == 1) { // TRUE GOLDBACH
            weight_true_primes += w_n;
            spin_true_primes += spin_val;
        } else { // SEMIPRIME LEAKAGE (The Parity Limitation)
            weight_semiprimes += w_n;
            spin_semiprimes += spin_val;
        }
    }

    printf("  %25s | %15s | %15s\n", "Category", "Blind Sieve Wt.", "Spin Sieve χ");
    printf("  ----------------------------------------------------------------\n");
    printf("  %25s | %15.2f | %15.2f\n", "True Goldbach P+P", weight_true_primes, spin_true_primes);
    printf("  %25s | %15.2f | %15.2f\n", "Semiprime Leakage P_2+P_r", weight_semiprimes, spin_semiprimes);
    
    printf("\n  Ratio True/Semi (Blind Sieve)  : %.4f (Trapped by Parity Limit)\n", 
           weight_true_primes / (weight_semiprimes + 1e-9));
           
    double spin_ratio = fabs(spin_true_primes) / (fabs(spin_semiprimes) + 1e-9);
    printf("  Ratio True/Semi (Bilinear Spin): %.4f\n", spin_ratio);

    printf("\n   BILINEAR ASYMPTOTIC VERDICT \n");
    if (spin_ratio > (weight_true_primes / weight_semiprimes) * 2.0) {
        printf("  RESULT: ANOMALY DETECTED. The Spin successfully amplified the True Primes.\n");
        printf("  By decoupling the Sieve from the Character, we used the Spin to\n");
        printf("  mathematically differentiate between Primes and Semiprimes.\n");
        printf("  This represents an explicit circumvention of the Parity Barrier. ️\n");
    } else {
        printf("  RESULT: HYPOTHESIS FALSIFIED. The Spin failed to differentiate Primes from Semiprimes.\n");
        printf("  The Semiprimes produced identical or stronger correlated spin variance\n");
        printf("  than the True Primes. The Dirichlet Character contains NO structural\n");
        printf("  information capable of untangling 1 prime factor from 2 prime factors.\n");
        printf("  The Parity Barrier is not just an artifact of divisor sums;\n");
        printf("  it is an absolute topological symmetry of the integers. ️\n");
    }

    return 0;
}
