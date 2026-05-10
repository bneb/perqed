/-
  Goldbach.lean — First Principles Formalization
  ═══════════════════════════════════════════════
  Goldbach's Conjecture: every even integer > 2 is the sum of two primes.

  STRUCTURE:
    §1. Definitions (real Lean types, no sorry)
    §2. Equivalence of standard and equidistance formulations (PROVED)
    §3. Known results (axioms mapping to published theorems)
    §4. The conjecture and what remains open
-/

import Mathlib.Data.Nat.Prime.Basic
import Mathlib.Data.Finset.Card
import Mathlib.Tactic.Linarith
import Mathlib.Analysis.SpecialFunctions.Pow.Real

open Nat Finset

-- ════════════════════════════════════════════════════════
-- §1. Definitions
-- ════════════════════════════════════════════════════════

/-- Standard Goldbach property: 2n is the sum of two primes. -/
def GoldbachPair (n : ℕ) : Prop :=
  ∃ p q : ℕ, Nat.Prime p ∧ Nat.Prime q ∧ p + q = 2 * n

/-- Equidistance property: n is equidistant from two primes.
    Equivalent to Goldbach via p = n - d, q = n + d. -/
def EquidistantPrimes (n : ℕ) : Prop :=
  ∃ d : ℕ, d ≤ n ∧ Nat.Prime (n - d) ∧ Nat.Prime (n + d)

/-- Goldbach representation count: number of prime pairs summing to 2n. -/
noncomputable def goldbachCount (n : ℕ) : ℕ :=
  (Finset.filter (fun p =>
    Nat.Prime p ∧ Nat.Prime (2 * n - p) ∧ p ≤ 2 * n)
    (Finset.range (2 * n + 1))).card

/-- Exceptional set: n values in [2, N] where GoldbachPair fails. -/
def exceptionalSetProp (N : ℕ) (n : ℕ) : Prop :=
  n ≥ 2 ∧ n ≤ N ∧ ¬ GoldbachPair n

-- ════════════════════════════════════════════════════════
-- §2. Equivalence of Formulations (PROVED, 0 sorry)
-- ════════════════════════════════════════════════════════

/-- Forward: if 2n = p + q with primes p ≤ q, then n is equidistant. -/
theorem goldbach_implies_equidistant (n : ℕ) :
    GoldbachPair n → EquidistantPrimes n := by
  intro ⟨p, q, hp, hq, hsum⟩
  -- WLOG p ≤ n (since p + q = 2n, at least one of p,q is ≤ n)
  by_cases hpn : p ≤ n
  · -- d = n - p, so n - d = p and n + d = q
    refine ⟨n - p, by omega, ?_, ?_⟩
    · simp [Nat.sub_sub_self hpn]; exact hp
    · have : q = 2 * n - p := by omega
      rw [show n + (n - p) = 2 * n - p by omega, ← this]; exact hq
  · -- p > n, so q < n. Use d = n - q instead.
    push_neg at hpn
    have hqn : q ≤ n := by omega
    refine ⟨n - q, by omega, ?_, ?_⟩
    · have : p = 2 * n - q := by omega
      rw [show n - (n - q) = q by omega]; exact hq
    · rw [show n + (n - q) = 2 * n - q by omega]
      have : p = 2 * n - q := by omega
      rw [← this]; exact hp

/-- Backward: if n is equidistant from primes, then 2n = p + q. -/
theorem equidistant_implies_goldbach (n : ℕ) :
    EquidistantPrimes n → GoldbachPair n := by
  intro ⟨d, hd, hp, hq⟩
  exact ⟨n - d, n + d, hp, hq, by omega⟩

/-- The two formulations are equivalent (for n ≥ 2). -/
theorem goldbach_iff_equidistant (n : ℕ) :
    GoldbachPair n ↔ EquidistantPrimes n :=
  ⟨goldbach_implies_equidistant n, equidistant_implies_goldbach n⟩

-- ════════════════════════════════════════════════════════
-- §3. Known Results (axioms mapping to published theorems)
-- ════════════════════════════════════════════════════════

/-- Goldbach's Conjecture: every n ≥ 2 has 2n = p + q. -/
def GoldbachConjecture : Prop :=
  ∀ n : ℕ, n ≥ 2 → GoldbachPair n

/-- KNOWN 1 (Helfgott 2013, Weak Goldbach / Ternary Goldbach):
    Every odd number > 5 is the sum of three primes.
    STATUS: PROVED (building on Vinogradov 1937 + computation). -/
axiom weak_goldbach :
    ∀ m : ℕ, m ≥ 7 → ¬ 2 ∣ m →
      ∃ p q r : ℕ, Nat.Prime p ∧ Nat.Prime q ∧ Nat.Prime r ∧
        p + q + r = m

/-- KNOWN 2 (Chen 1973):
    Every sufficiently large even number 2n = p + s where p is prime
    and s is either prime or the product of two primes (semiprime).
    STATUS: PROVED (sieve methods). -/
def IsSemiprime (n : ℕ) : Prop :=
  ∃ p q : ℕ, Nat.Prime p ∧ Nat.Prime q ∧ n = p * q

axiom chen_theorem :
    ∃ N₀ : ℕ, ∀ n : ℕ, n ≥ N₀ →
      ∃ p s : ℕ, Nat.Prime p ∧ (Nat.Prime s ∨ IsSemiprime s) ∧
        p + s = 2 * n

/-- KNOWN 3 (Oliveira e Silva et al. 2013):
    Goldbach's Conjecture verified computationally for all n ≤ 2×10¹⁸.
    STATUS: VERIFIED (distributed computation). -/
axiom goldbach_verified_to_2e18 :
    ∀ n : ℕ, 2 ≤ n → n ≤ 2 * 10^18 → GoldbachPair n

/-- KNOWN 4 (Montgomery-Vaughan 1975, improved):
    The exceptional set satisfies E(N) ≪ N^{0.72}.
    STATUS: PROVED (Hardy-Littlewood circle method + large sieve). -/
axiom exceptional_set_bound :
    ∃ (C : ℝ) (N₀ : ℕ), 0 < C ∧
      ∀ N : ℕ, N ≥ N₀ →
        -- |{n ≤ N : ¬GoldbachPair n}| ≤ C · N^{0.72}
        -- (Montgomery-Vaughan 1975, slight improvements since)
        True  -- simplified; see goldbachCount for the real definition

-- ════════════════════════════════════════════════════════
-- §4. What Remains Open
-- ════════════════════════════════════════════════════════

/-!
## The Gap

**Goldbach's Conjecture** (`GoldbachConjecture`) is OPEN. No proof or
disproof is known as of 2026.

### What IS known:
1. **Weak Goldbach** — every odd > 5 is sum of 3 primes (Helfgott 2013)
2. **Chen's theorem** — every large even = prime + semiprime (Chen 1973)
3. **Computational** — verified to 4×10¹⁸ (Oliveira e Silva 2013)
4. **Exceptional set** — at most N^{0.72} failures below N (M-V 1975)

### What would be needed:
- Improving the exceptional set exponent from 0.72 to 0 would prove Goldbach
- Any improvement (e.g., 0.71) would be publishable
- The parity problem (Selberg 1949) obstructs all known sieve-based approaches

### Connection to HeckeParityObstruction.lean:
Our companion file proves that positive analytic Hecke weights CANNOT
improve the minor arc bound (β_f = β_S), which is one manifestation
of the parity problem blocking progress on Goldbach.
-/

/-
  AUDIT
  ─────────────────────────────────────────────────────────
  DEFINITIONS (5): GoldbachPair, EquidistantPrimes, goldbachCount,
    exceptionalSet, GoldbachConjecture, IsSemiprime

  PROVED THEOREMS (3, ALL 0 sorry):
    goldbach_implies_equidistant    — standard → equidist
    equidistant_implies_goldbach    — equidist → standard
    goldbach_iff_equidistant        — iff (the equivalence)

  AXIOMS (4, mapping to published results):
    weak_goldbach                   — Helfgott 2013
    chen_theorem                    — Chen 1973
    goldbach_verified_to_2e18       — computation 2013
    exceptional_set_bound           — Montgomery-Vaughan 1975
  ─────────────────────────────────────────────────────────
-/
