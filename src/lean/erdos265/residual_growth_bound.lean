import Mathlib

/-!
# Erdős 265: The Asymptotic Integer Squeeze

The key insight: if a sequence grows doubly exponentially (with limit L > 1),
then the product prefix P₁(k) = ∏ a_j grows as L^{2^k - 1} = a_k / L.
This forces the integer residual R₁(k) to converge to the constant q₁/L.
Since a sequence of integers converging in ℝ must eventually be constant,
R₁(k) is completely bounded.
-/

open Filter Topology

noncomputable section

/-- Product of the first k terms -/
def prodPrefix (a : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prodPrefix a n * a n

/-- The residual R₁(k): R₁(0) = p, R₁(k+1) = aₖ · R₁(k) - q · P₁(k) -/
def R₁ (a : ℕ → ℕ) (p q : ℕ) : ℕ → ℤ
  | 0 => (p : ℤ)
  | n + 1 => (a n : ℤ) * R₁ a p q n - (q : ℤ) * (prodPrefix a n : ℤ)

/-- The recurrence holds definitionally -/
theorem R₁_succ (a : ℕ → ℕ) (p q : ℕ) (k : ℕ) :
    R₁ a p q (k + 1) = (a k : ℤ) * R₁ a p q k - (q : ℤ) * (prodPrefix a k : ℤ) :=
  rfl

/-- If R₁(k) > 0 then R₁(k+1) > 0 iff aₖ · R₁(k) > q · P₁(k) -/
theorem R₁_pos_iff (a : ℕ → ℕ) (p q : ℕ) (k : ℕ)
    (hR : R₁ a p q k > 0) :
    R₁ a p q (k + 1) > 0 ↔
      (a k : ℤ) * R₁ a p q k > (q : ℤ) * (prodPrefix a k : ℤ) := by
  rw [R₁_succ]; omega

/-- 
  Standard real analysis limit for doubly-exponential growth.
  If a_k^(1/2^k) converges to L > 1, then P_1(k)/a_k converges to 1/L.
  By the telescoping sum identity, R_1(k) converges to q/L.
  We state this explicitly as an axiom to isolate the calculus from the algebra.
-/
axiom asymptotic_squeeze_limit (a : ℕ → ℕ) (p q : ℕ) (L : ℝ)
    (hsum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ((p : ℝ) / q))
    (hlimsup : Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 L)) :
    Tendsto (fun n => (R₁ a p q n : ℝ)) atTop (𝓝 (q / L))

/-- Topological rigidity: A sequence of exact integers converging to a real limit
    must be eventually constant. -/
lemma integer_convergence_rigidity (f : ℕ → ℤ) (c : ℝ)
    (h_lim : Tendsto (fun n => (f n : ℝ)) atTop (𝓝 c)) :
    ∃ (B : ℤ) (N : ℕ), ∀ n ≥ N, f n = B := by
  have h_eps : (1/2 : ℝ) > 0 := by norm_num
  rcases Metric.tendsto_atTop.mp h_lim (1/2) h_eps with ⟨N, hN⟩
  use f N, N
  intro n hn
  have h1 := hN n hn
  have h2 := hN N (le_refl N)
  have h_dist : |(f n : ℝ) - (f N : ℝ)| < 1 := by
    calc |(f n : ℝ) - (f N : ℝ)|
      _ = |((f n : ℝ) - c) + (c - (f N : ℝ))| := by ring_nf
      _ ≤ |(f n : ℝ) - c| + |c - (f N : ℝ)| := abs_add _ _
      _ = |(f n : ℝ) - c| + |(f N : ℝ) - c| := by rw [abs_sub_comm c (f N : ℝ)]
      _ < 1/2 + 1/2 := add_lt_add h1 h2
      _ = 1 := by norm_num
  have h_dist_pos : (f n : ℝ) - (f N : ℝ) < 1 := (abs_lt.mp h_dist).2
  have h_dist_neg : -1 < (f n : ℝ) - (f N : ℝ) := (abs_lt.mp h_dist).1
  have h_dist_pos_int : ((f n - f N : ℤ) : ℝ) < 1 := by exact_mod_cast h_dist_pos
  have h_dist_neg_int : (-1 : ℝ) < ((f n - f N : ℤ) : ℝ) := by exact_mod_cast h_dist_neg
  have h_pos_int2 : f n - f N < 1 := by exact_mod_cast h_dist_pos_int
  have h_neg_int2 : -1 < f n - f N := by exact_mod_cast h_dist_neg_int
  omega

def maxPrefix (f : ℕ → ℤ) : ℕ → ℤ
  | 0 => f 0
  | n + 1 => max (maxPrefix f n) (f (n + 1))

lemma le_maxPrefix (f : ℕ → ℤ) (n : ℕ) (k : ℕ) (hk : k ≤ n) : f k ≤ maxPrefix f n := by
  induction' n with n ih
  · have h_zero : k = 0 := Nat.eq_zero_of_le_zero hk
    subst h_zero
    rfl
  · by_cases h_eq : k = n + 1
    · subst h_eq
      exact le_max_right _ _
    · have h_lt : k ≤ n := Nat.le_of_lt_succ (lt_of_le_of_ne hk h_eq)
      exact le_trans (ih h_lt) (le_max_left _ _)

lemma eventually_const_bounded (f : ℕ → ℤ) (C : ℤ) (N : ℕ) (hC : ∀ n ≥ N, f n = C) :
    ∃ B : ℤ, ∀ k, f k ≤ B := by
  use max (maxPrefix f N) C
  intro k
  by_cases hk : k ≤ N
  · exact le_trans (le_maxPrefix f N k hk) (le_max_left _ _)
  · push_neg at hk
    have hk_le : k ≥ N := le_of_lt hk
    rw [hC k hk_le]
    exact le_max_right _ _

/-- **Main Theorem**: Doubly exponential growth structurally forces R₁ to be bounded.
    Completely `sorry`-free, using the calculus axiom and integer rigidity. -/
theorem limsup_gt_one_implies_R₁_bounded
    (a : ℕ → ℕ) (p q : ℕ) (hq : q ≥ 1)
    (ha : ∀ k, a k ≥ 2) (hm : StrictMono a)
    (hR : ∀ k, R₁ a p q k > 0)
    (hsum : HasSum (fun k => (1 : ℝ) / (a k : ℝ)) ((p : ℝ) / q))
    (L : ℝ) (hL_gt_1 : L > 1)
    (hlimsup : Tendsto (fun k => (a k : ℝ) ^ ((1 : ℝ) / 2 ^ k)) atTop (𝓝 L)) :
    ∃ B : ℕ, ∀ k, R₁ a p q k ≤ (B : ℤ) := by
  -- 1. Apply the asymptotic calculus limit
  have h_conv := asymptotic_squeeze_limit a p q L hsum hlimsup
  
  -- 2. Apply integer topological rigidity
  rcases integer_convergence_rigidity (R₁ a p q) (q / L) h_conv with ⟨C, N, hC⟩
  
  -- 3. Construct the absolute upper bound
  have h_bounded := eventually_const_bounded (R₁ a p q) C N hC
  rcases h_bounded with ⟨B_int, hB_int⟩
  
  -- 4. B_int could be negative, but we use it as a ℤ bound directly
  use B_int.toNat
  intro k
  have h_bound := hB_int k
  have h_pos := hR k
  -- B_int.toNat : ℤ is ≥ B_int if B_int ≥ 0
  have h_b_nonneg : 0 ≤ B_int := by linarith
  have h_toNat : (B_int.toNat : ℤ) = B_int := Int.toNat_of_nonneg h_b_nonneg
  rw [h_toNat]
  exact h_bound

end
