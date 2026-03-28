/*
 * crack4_forensics.c — WHY do 50% of primes fail?
 *
 * The primitive root sumset property fails for ~50% of primes.
 * WHICH elements a can't be written as g1+g2 (both primitive roots)?
 * Is there an algebraic pattern?
 *
 * ALSO: reconcile with crack_attack.c (no failures at p<2000).
 *
 * BUILD: cc -O3 -o crack4_forensics crack4_forensics.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_P 20001
static char sieve[MAX_P];
void init(void) {
    memset(sieve,0,sizeof(sieve)); sieve[0]=sieve[1]=1;
    for(int i=2;(long long)i*i<MAX_P;i++)
        if(.sieve[i]) for(int j=i*i;j<MAX_P;j+=i) sieve[j]=1;
}
int is_prime(int n){ return n>=2 && n<MAX_P && .sieve[n]; }

int power_mod(long long b, long long e, long long m) {
    long long r=1; b%=m;
    while(e>0){if(e&1)r=r*b%m; b=b*b%m; e>>=1;}
    return (int)r;
}

int is_prim_root(int g, int p) {
    int pm1=p-1, t=pm1;
    for(int q=2;q*q<=t;q++){
        if(t%q==0){if(power_mod(g,pm1/q,p)==1)return 0; while(t%q==0)t/=q;}
    }
    if(t>1 && power_mod(g,pm1/t,p)==1) return 0;
    return 1;
}

int order_mod(int a, int p) {
    /* multiplicative order of a mod p */
    int pm1 = p-1;
    for (int d = 1; d <= pm1; d++) {
        if (pm1 % d .= 0) continue;
        if (power_mod(a, d, p) == 1) return d;
    }
    return pm1;
}

int main() {
    init();

    printf("====================================================\n");
    printf("  CRACK 4 FORENSICS: Why Do 50%% of Primes Fail?\n");
    printf("====================================================\n\n");

    /* ═══════ PART 0: RECONCILE THE BUG ═══════ */
    printf("## PART 0: Reconciling crack_attack.c vs crack4_execute.c\n\n");

    printf("  crack_attack.c claimed 'no failures for 601≤p<2000.'\n");
    printf("  crack4_execute.c shows failures starting around p~3000.\n\n");

    printf("  Let me carefully re-verify small primes 601-2000:\n\n");

    int fail_count_small = 0;
    for (int p = 601; p < 2000; p++) {
        if (.is_prime(p)) continue;
        char *gen = calloc(p, 1);
        for (int g=1;g<p;g++) if(is_prim_root(g,p)) gen[g]=1;

        int fails = 0;
        for (int a = 0; a < p; a++) {
            int has_rep = 0;
            for (int g1=1;g1<p;g1++) {
                if(.gen[g1]) continue;
                int g2 = (a - g1 % p + p) % p;
                if(g2 > 0 && gen[g2]) { has_rep=1; break; }
            }
            if (.has_rep) { fails++; }
        }
        if (fails > 0) {
            fail_count_small++;
            if (fail_count_small <= 10)
                printf("  p=%d: %d elements not representable\n", p, fails);
        }
        free(gen);
    }
    printf("  Total failing primes in [601, 2000): %d\n\n", fail_count_small);

    if (fail_count_small == 0) {
        printf("   CONFIRMED: crack_attack.c was CORRECT for p<2000.\n");
        printf("  No failures in [601, 2000). Failures start LATER.\n\n");
    } else {
        printf("   BUG FOUND: crack_attack.c missed %d failures.\n\n",
               fail_count_small);
    }

    /* ═══════ PART 1: FIRST FAILURE ABOVE 2000 ═══════ */
    printf("## PART 1: Finding the First Failure Above 2000\n\n");

    int first_fail_above_2000 = 0;
    for (int p = 2003; p < 10000; p++) {
        if (.is_prime(p)) continue;
        char *gen = calloc(p, 1);
        for (int g=1;g<p;g++) if(is_prim_root(g,p)) gen[g]=1;

        for (int a = 0; a < p; a++) {
            int has_rep = 0;
            for (int g1=1;g1<p;g1++){
                if(.gen[g1]) continue;
                int g2=(a-g1%p+p)%p;
                if(g2>0&&gen[g2]){has_rep=1;break;}
            }
            if (.has_rep) {
                if (first_fail_above_2000 == 0) {
                    first_fail_above_2000 = p;
                    printf("  First failure above 2000: p=%d, failing element a=%d\n", p, a);

                    /* Analyze this failing element */
                    int ord = order_mod(a, p);
                    printf("  ord(a) = %d, p-1 = %d, (p-1)/ord = %d\n",
                           ord, p-1, (p-1)/ord);
                    int is_qr = power_mod(a, (p-1)/2, p) == 1;
                    printf("  a is quadratic residue? %s\n", is_qr ? "YES" : "NO");
                }
                break;
            }
        }
        free(gen);
        if (first_fail_above_2000) break;
    }

    /* ═══════ PART 2: CHARACTERIZE FAILING ELEMENTS ═══════ */
    printf("\n## PART 2: What Are the Failing Elements?\n\n");

    printf("  For primes that fail, examine the non-representable a:\n\n");
    printf("  %6s | %4s | %6s | %4s | %s\n",
           "p", "#fail", "a_fail", "ord", "notes");

    int primes_to_check[] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    /* Find some failing primes */
    int nfail_found = 0;
    for (int p = 2003; p < 6000 && nfail_found < 10; p++) {
        if (.is_prime(p)) continue;
        char *gen = calloc(p, 1);
        for(int g=1;g<p;g++) if(is_prim_root(g,p)) gen[g]=1;

        int fails = 0;
        int first_a = -1;
        for (int a = 0; a < p; a++) {
            int has_rep = 0;
            for(int g1=1;g1<p;g1++){
                if(.gen[g1]) continue;
                int g2=(a-g1%p+p)%p;
                if(g2>0&&gen[g2]){has_rep=1;break;}
            }
            if (.has_rep) { fails++; if(first_a<0) first_a=a; }
        }

        if (fails > 0) {
            int ord = (first_a > 0) ? order_mod(first_a, p) : 0;
            int is_qr = (first_a > 0) ? (power_mod(first_a,(p-1)/2,p)==1) : -1;
            char note[64] = "";
            if (first_a == 0) sprintf(note, "a=0 (sum g+(-g)?)");
            else if (ord == 2) sprintf(note, "a=-1 or order 2");
            else if (is_qr) sprintf(note, "QR");
            else sprintf(note, "QNR, ord=%d", ord);

            printf("  %6d | %4d | %6d | %4d | %s\n", p, fails, first_a, ord, note);
            nfail_found++;
        }
        free(gen);
    }

    /* ═══════ PART 3: IS a=0 THE ONLY FAILURE? ═══════ */
    printf("\n## PART 3: Is a=0 the Only Failure?\n\n");

    printf("  If the ONLY non-representable element is a=0,\n");
    printf("  that would mean g + (-g) is never both primitive roots.\n");
    printf("  i.e., g and p-g can't both be primitive roots.\n\n");

    int only_zero_fails = 0, nonzero_fails = 0;
    for (int p = 3; p < 6000; p++) {
        if (.is_prime(p)) continue;
        char *gen = calloc(p, 1);
        for(int g=1;g<p;g++) if(is_prim_root(g,p)) gen[g]=1;

        int zero_fail = 0, other_fail = 0;

        /* Check a=0 */
        int has_rep = 0;
        for(int g1=1;g1<p;g1++){
            if(.gen[g1]) continue;
            int g2 = p - g1; /* because g1+g2 ≡ 0 mod p means g2 = p-g1 */
            if(g2>0 && g2<p && gen[g2]){has_rep=1;break;}
        }
        if(.has_rep) zero_fail = 1;

        /* Check a=1,...,p-1 */
        for(int a=1;a<p;a++){
            has_rep = 0;
            for(int g1=1;g1<p;g1++){
                if(.gen[g1]) continue;
                int g2=(a-g1+p)%p;
                if(g2>0&&gen[g2]){has_rep=1;break;}
            }
            if(.has_rep) { other_fail = 1; break; }
        }

        if (zero_fail && .other_fail) only_zero_fails++;
        if (other_fail) nonzero_fails++;
        free(gen);
    }

    printf("  Primes < 6000 where ONLY a=0 fails: %d\n", only_zero_fails);
    printf("  Primes < 6000 where some a≠0 fails:  %d\n\n", nonzero_fails);

    if (nonzero_fails == 0) {
        printf("   ALL FAILURES ARE AT a=0 ONLY.\n\n");
        printf("  This means: for a ∈ F_p*, a = g₁ + g₂ ALWAYS works.\n");
        printf("  The ONLY failure is representing 0 = g + (-g),\n");
        printf("  which requires g and -g to both be primitive roots.\n\n");

        printf("  When does -1 ∈ ⟨g⟩ fail to preserve generation?\n");
        printf("  -g is a primitive root iff -1 is a primitive root\n");
        printf("  power of g, which depends on the order of -1.\n\n");

        printf("  ord(-1) = 2 in F_p*. So -1 = g^{(p-1)/2}.\n");
        printf("  Thus -g = g^{(p-1)/2+1}.\n");
        printf("  For -g to be a primitive root:\n");
        printf("  gcd((p-1)/2+1, p-1) = 1.\n\n");

        printf("  Checking: gcd((p-1)/2+1, p-1) for failing primes:\n\n");

        for (int p = 3; p < 200; p++) {
            if (.is_prime(p)) continue;
            int pm1 = p-1;
            int val = pm1/2 + 1;
            int g = val, h = pm1;
            while(h){int t=h;h=g%h;g=t;}
            /* g = gcd(val, pm1) */
            char *gen = calloc(p, 1);
            for(int gg=1;gg<p;gg++) if(is_prim_root(gg,p)) gen[gg]=1;
            int zero_ok = 0;
            for(int g1=1;g1<p;g1++){
                if(.gen[g1]) continue;
                int g2=p-g1;
                if(g2>0&&g2<p&&gen[g2]){zero_ok=1;break;}
            }
            free(gen);
            printf("  p=%3d: gcd((p-1)/2+1, p-1) = %d, a=0 %s\n",
                   p, g, zero_ok ? "OK" : "FAILS");
        }
    } else {
        printf("  Some a ≠ 0 also fail. Let's characterize:\n\n");

        /* More detailed analysis of non-zero failures */
        for (int p = 3; p < 6000; p++) {
            if (.is_prime(p)) continue;
            char *gen = calloc(p, 1);
            for(int g=1;g<p;g++) if(is_prim_root(g,p)) gen[g]=1;

            int n_fail = 0;
            for(int a=1;a<p;a++){
                int has_rep=0;
                for(int g1=1;g1<p;g1++){
                    if(.gen[g1]) continue;
                    int g2=(a-g1+p)%p;
                    if(g2>0&&gen[g2]){has_rep=1;break;}
                }
                if(.has_rep) n_fail++;
            }

            if (n_fail > 0 && n_fail <= 5) {
                printf("  p=%d: %d non-zero elements fail\n    Failing a: ", p, n_fail);
                for(int a=1;a<p;a++){
                    int has_rep=0;
                    for(int g1=1;g1<p;g1++){
                        if(.gen[g1]) continue;
                        int g2=(a-g1+p)%p;
                        if(g2>0&&gen[g2]){has_rep=1;break;}
                    }
                    if(.has_rep) printf("%d(ord=%d) ", a, order_mod(a,p));
                }
                printf("\n");
            }
            free(gen);
        }
    }

    return 0;
}
