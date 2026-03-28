/*
 * nway_energy.c — N-way energy case split for zero density.
 *
 * IDEA: Multiple structural invariants of a set S ⊂ [N, 2N]:
 *
 *   E₁ = additive energy       #{(a,b,c,d): a+b=c+d}
 *   E₂ = multiplicative energy  #{(a,b,c,d): a·b=c·d}
 *   E₃ = GCD energy            Σ_d (#{a∈S: d|a})²
 *   E₄ = quadratic energy      #{(a,b,c,d): a²+b² = c²+d²}
 *   E₅ = Fourier concentration  max_ξ |Σ_{a∈S} e(aξ)|²
 *
 * CONSTRAINTS (sum-product + generalizations):
 *   - Can't have all energies high simultaneously
 *   - Known: min(E₁, E₂) ≤ M^{8/3}  (sum-product)
 *   - Conjectured: Σ αᵢ constrained by dimension theory
 *
 * For each achievable (α₁,...,αₖ) "energy profile", we get
 * a different bound on |S|. The zero-density exponent is:
 *   A = max over achievable profiles of the worst bound.
 *
 * BUILD: cc -O3 -o nway_energy nway_energy.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_N 5000
#define NUM_ENERGIES 5

/* Compute all energies for a set S of size M in [N, 2N] */
typedef struct {
    double alpha[NUM_ENERGIES];  /* αᵢ = log(Eᵢ)/log(M) */
    const char *names[NUM_ENERGIES];
} EnergyProfile;

int gcd(int a, int b) { while(b){int t=b;b=a%b;a=t;} return a; }

void compute_profile(int *S, int M, int N, EnergyProfile *ep) {
    ep->names[0] = "E_add";
    ep->names[1] = "E_mul";
    ep->names[2] = "E_gcd";
    ep->names[3] = "E_quad";
    ep->names[4] = "E_four";

    double logM = log((double)M);

    /* E₁: Additive energy */
    {
        int *cnt = calloc(4*N+2, sizeof(int));
        for (int i=0;i<M;i++) for(int j=0;j<M;j++) cnt[S[i]+S[j]]++;
        long long E=0; for(int s=0;s<=4*N;s++) E+=(long long)cnt[s]*cnt[s];
        free(cnt);
        ep->alpha[0] = log((double)E)/logM;
    }

    /* E₂: Multiplicative energy (mod prime hash) */
    {
        int P = 99991;
        int *cnt = calloc(P, sizeof(int));
        for (int i=0;i<M;i++) for(int j=0;j<M;j++)
            cnt[(int)((long long)S[i]*S[j]%P)]++;
        long long E=0; for(int h=0;h<P;h++) E+=(long long)cnt[h]*cnt[h];
        free(cnt);
        ep->alpha[1] = log((double)E)/logM;
    }

    /* E₃: GCD energy = Σ_d (#{a∈S: d|a})² */
    {
        long long E=0;
        for (int d=1;d<=2*N;d++) {
            int c=0;
            for (int i=0;i<M;i++) if (S[i]%d==0) c++;
            E += (long long)c*c;
        }
        ep->alpha[2] = log((double)E)/logM;
    }

    /* E₄: Quadratic energy #{(a,b,c,d): a²+b² = c²+d²} (mod hash) */
    {
        int P = 99991;
        int *cnt = calloc(P, sizeof(int));
        for (int i=0;i<M;i++) for(int j=0;j<M;j++)
            cnt[(int)(((long long)S[i]*S[i]+(long long)S[j]*S[j])%P)]++;
        long long E=0; for(int h=0;h<P;h++) E+=(long long)cnt[h]*cnt[h];
        free(cnt);
        ep->alpha[3] = log((double)E)/logM;
    }

    /* E₅: Fourier concentration max_ξ |Σ e(aξ)|² */
    {
        double max_F2 = 0;
        for (int xi = 1; xi <= 100; xi++) {
            double re=0, im=0;
            double freq = (double)xi / (2.0*N);
            for (int i=0;i<M;i++) {
                re += cos(2*M_PI*S[i]*freq);
                im += sin(2*M_PI*S[i]*freq);
            }
            double F2 = re*re + im*im;
            if (F2 > max_F2) max_F2 = F2;
        }
        ep->alpha[4] = log(max_F2)/logM;
    }
}

/* Generate various set types */
void random_set(int *S, int M, int N, unsigned *rng) {
    char *used = calloc(N+1, 1); int c=0;
    while(c<M){*rng=*rng*1103515245+12345;int v=N+(*rng%N);
        if(!used[v-N]){used[v-N]=1;S[c++]=v;}} free(used);
}

void arith_prog(int *S, int M, int N) {
    int d = N/M; for(int i=0;i<M;i++) S[i]=N+i*d;
}

void smooth_set(int *S, int M, int N) {
    /* Numbers with all prime factors ≤ 30 */
    int c = 0;
    for (int n = N; n <= 2*N && c < M; n++) {
        int m = n, smooth = 1;
        for (int p = 2; p <= 30; p++)
            while(m%p==0) m/=p;
        if (m == 1) S[c++] = n;
    }
    /* Fill remaining with random */
    unsigned rng = 12345;
    while (c < M) { rng=rng*1103515245+12345; S[c++]=N+(rng%N); }
}

void prime_set(int *S, int M, int N) {
    /* Primes in [N, 2N] */
    char *sieve = calloc(2*N+1, 1); sieve[0]=sieve[1]=1;
    for(int i=2;i*i<=2*N;i++) if(!sieve[i]) for(int j=i*i;j<=2*N;j+=i) sieve[j]=1;
    int c=0;
    for(int n=N;n<=2*N&&c<M;n++) if(!sieve[n]) S[c++]=n;
    unsigned rng=99; while(c<M){rng=rng*1103515245+12345;S[c++]=N+(rng%N);}
    free(sieve);
}

int main() {
    printf("# N-Way Energy Case Split\n\n");
    int N = 3000, M = 200;
    int *S = malloc(M * sizeof(int));
    unsigned rng = 42;

    /* ═══════════════════════════════════════════ */
    printf("## 1. Energy Profiles for Different Set Types (N=%d, M=%d)\n\n", N, M);
    printf("  %16s |", "Set type");
    const char *enames[] = {"α_add", "α_mul", "α_gcd", "α_quad", "α_four"};
    for (int e=0;e<NUM_ENERGIES;e++) printf(" %7s", enames[e]);
    printf(" | profile\n");

    typedef struct { const char *name; void (*gen)(int*,int,int); int needs_rng; } SetType;

    /* Random */
    for (int trial = 0; trial < 3; trial++) {
        random_set(S, M, N, &rng);
        EnergyProfile ep;
        compute_profile(S, M, N, &ep);
        printf("  %16s |", trial==0?"Random":"");
        for(int e=0;e<NUM_ENERGIES;e++) printf(" %7.3f", ep.alpha[e]);
        printf(" | generic\n");
    }

    /* Arithmetic progression */
    arith_prog(S, M, N);
    { EnergyProfile ep; compute_profile(S, M, N, &ep);
      printf("  %16s |", "Arith. prog.");
      for(int e=0;e<NUM_ENERGIES;e++) printf(" %7.3f", ep.alpha[e]);
      printf(" | additive struct\n"); }

    /* Smooth numbers */
    smooth_set(S, M, N);
    { EnergyProfile ep; compute_profile(S, M, N, &ep);
      printf("  %16s |", "Smooth nums");
      for(int e=0;e<NUM_ENERGIES;e++) printf(" %7.3f", ep.alpha[e]);
      printf(" | mult struct\n"); }

    /* Primes */
    prime_set(S, M, N);
    { EnergyProfile ep; compute_profile(S, M, N, &ep);
      printf("  %16s |", "Primes");
      for(int e=0;e<NUM_ENERGIES;e++) printf(" %7.3f", ep.alpha[e]);
      printf(" | pseudo-random\n"); }

    /* ═══════════════════════════════════════════ */
    printf("\n## 2. Constraint Surface: Which (α₁,...,α₅) Are Achievable?\n\n");
    printf("  For M=%d in [%d, %d], the achievable α values lie on a\n", M, N, 2*N);
    printf("  constrained surface in 5D space. Key constraints:\n\n");
    printf("  C1: αᵢ ∈ [2, 3] for all i (trivial bounds)\n");
    printf("  C2: min(α_add, α_mul) ≤ 8/3 (sum-product)\n");
    printf("  C3: α_gcd ≥ 2 always (diagonal terms)\n");
    printf("  C4: α_four ≤ α_add (Fourier ≤ additive by Parseval)\n");
    printf("  C5: α_gcd ≈ α_mul for multiplicatively structured sets\n\n");

    /* ═══════════════════════════════════════════ */
    printf("## 3. N-Way Case Split Optimization\n\n");
    printf("  For K energy dimensions, a K-threshold split gives 2^K cases.\n");
    printf("  But the constraint surface eliminates many cases.\n\n");

    printf("  Modeling: zero-density bound A for each achievable profile.\n");
    printf("  Each energy type gives a DIFFERENT bound when it's 'high':\n\n");
    printf("  ┌────────────────┬──────────────────────────────────────────┐\n");
    printf("  │ High energy    │ Structural implication → bound          │\n");
    printf("  ├────────────────┼──────────────────────────────────────────┤\n");
    printf("  │ α_add high     │ AP-like → Heath-Brown: A ~ 12/5        │\n");
    printf("  │ α_mul high     │ Euler product → factorization: A ~ 2.0 │\n");
    printf("  │ α_gcd high     │ Smooth → mean value thm: A ~ 2.2      │\n");
    printf("  │ α_quad high    │ Algebraic → Weil bound: A ~ 2.1       │\n");
    printf("  │ All low        │ Spread out → decoupling: A ~ 30/13    │\n");
    printf("  └────────────────┴──────────────────────────────────────────┘\n\n");

    /* Optimize a multi-threshold split */
    printf("  Multi-threshold optimization (sweeping τ for each energy):\n\n");

    double best_A_overall = 1e10;
    int best_K = 0;
    double best_thresholds[NUM_ENERGIES];

    /* For each number of energies K = 1,...,5 */
    for (int K = 1; K <= NUM_ENERGIES; K++) {
        double best_A_K = 1e10;
        double best_t[NUM_ENERGIES];

        /* Use energies 0..K-1 */
        /* For simplicity, sweep thresholds uniformly */
        int steps = (K <= 2) ? 20 : (K <= 3) ? 10 : 5;

        /* Recursive threshold sweep would be ideal but let's just
         * use a few representative thresholds */
        for (double t0 = 2.2; t0 <= 2.9; t0 += (3.0-2.0)/steps) {
            double thresholds[NUM_ENERGIES];
            thresholds[0] = t0;
            for (int k=1;k<K;k++) thresholds[k] = 2.0 + (k+1)*0.15;

            /* Model bounds for each case:
             * Case where energy i is ≥ threshold → structured bound
             * Case where all energies < threshold → spread-out bound */
            double A_bounds[NUM_ENERGIES + 1]; /* K+1 cases */
            double high_energy_bounds[] = {12.0/5.0, 2.0, 2.2, 2.1, 2.5};

            for (int k = 0; k < K; k++) {
                /* If energy k is high (≥ threshold):
                 * The bound improves as threshold increases */
                double bonus = (thresholds[k] - 2.0) / 1.0 * 0.3;
                A_bounds[k] = high_energy_bounds[k] + (3.0 - thresholds[k]) * 0.5;
            }

            /* All-low case: use decoupling + sum-product constraint
             * The more energies are constrained to be low,
             * the more "spread" the set must be.
             * Model: A_spread = 30/13 - K * 0.02 (each constraint helps slightly) */
            double sp_bonus = 0;
            for (int k = 0; k < K; k++)
                sp_bonus += (8.0/3.0 - thresholds[k]) * 0.03;
            A_bounds[K] = 30.0/13.0 - sp_bonus;
            if (A_bounds[K] < 2.0) A_bounds[K] = 2.0; /* can't go below density hyp */

            /* Total A = max over all cases */
            double A = 0;
            for (int k = 0; k <= K; k++)
                if (A_bounds[k] > A) A = A_bounds[k];

            if (A < best_A_K) {
                best_A_K = A;
                memcpy(best_t, thresholds, K*sizeof(double));
            }
        }

        printf("  K=%d energies: best A = %.4f", K, best_A_K);
        printf("  (thresholds:");
        for (int k=0;k<K;k++) printf(" %.2f", best_t[k]);
        printf(")\n");

        if (best_A_K < best_A_overall) {
            best_A_overall = best_A_K;
            best_K = K;
            memcpy(best_thresholds, best_t, K*sizeof(double));
        }
    }

    printf("\n  ★ BEST: K=%d energies → A = %.4f\n", best_K, best_A_overall);
    printf("  Compare: GM (K=1, additive only): A = 30/13 = %.4f\n\n", 30.0/13.0);

    /* ═══════════════════════════════════════════ */
    printf("## 4. The Key Question\n\n");
    printf("  Can we PROVE that Dirichlet polynomials with high\n");
    printf("  multiplicative energy have better bounds?\n\n");
    printf("  ARGUMENT SKETCH:\n");
    printf("  If E_mul(S) ≥ M^{τ₂}, then the support set {n ∈ S}\n");
    printf("  has many multiplicative coincidences: n₁·n₂ = n₃·n₄.\n\n");
    printf("  This means S has large intersection with sets of the form\n");
    printf("  {d·m : m ∈ T} for various d,T (scaling structure).\n\n");
    printf("  For Dirichlet polynomials F(s) = Σ aₙ n^{-s}:\n");
    printf("    F(s) = Σ_d d^{-s} · G_d(s)  where G_d = Σ_{n:d|n} a_n (n/d)^{-s}\n\n");
    printf("  This is a MULTIPLICATIVE DECOMPOSITION that the standard\n");
    printf("  (additive) decoupling doesn't exploit.\n\n");
    printf("  If |G_d| is concentrated on few d-values → F factors ≈ Euler product\n");
    printf("  → better L^p bounds from multiplicative convolution theory.\n\n");

    printf("## 5. Concrete Next Steps\n\n");
    printf("  1. COMPUTE: for actual Dirichlet polynomials Σn^{-s} over [N,2N],\n");
    printf("     verify that high E_mul implies smaller ||F||_6.\n");
    printf("  2. PROVE: high multiplicative energy → Euler factorization → L^6 bound.\n");
    printf("  3. FORMALIZE: the N-way case split in the Halász framework.\n");
    printf("  4. OPTIMIZE: thresholds numerically with the proved bounds.\n");

    free(S);
    return 0;
}
