import Mathlib

open Filter Topology Metric Set

noncomputable def f₁ (x : ℝ) : ℝ := 1 / x
noncomputable def f₂ (x : ℝ) : ℝ := 1 / (x * (x + 1))

set_option maxHeartbeats 51200000

/-!
## F proof via IFT

Key Mathlib lemma:
`HasStrictFDerivAt.map_nhds_eq_of_equiv`:
  If f has strict Fréchet derivative f' at a, and f' is an equivalence,
  then f maps nhds(a) to nhds(f(a)).

This means the image of f near a is a neighborhood of f(a), i.e., contains an open ball.

Plan:
1. Define Φ : ℝ × ℝ → ℝ × ℝ by Φ(n₁,n₂) = (f₁(N+n₁)+f₁(2N+n₂), f₂(N+n₁)+f₂(2N+n₂))
2. Show HasStrictFDerivAt Φ J (0,0) where J is the Jacobian
3. Show J is a ContinuousLinearEquiv (det ≠ 0)
4. Apply map_nhds_eq_of_equiv to get nhds Φ(0,0) ⊆ range Φ
5. Conclude: range of Φ has non-empty interior
6. Use this for a single scale k₀ to establish sumset_has_interior.

For the full F, we also need:
- The sum over other scales converges (easy: geometric series)
- The sequence is strictly increasing (follows from growth rate)
- Each aₖ ≥ 2 (follows from Nₖ large)

This is a sophisticated proof. Let me at least verify the IFT import works.
-/

-- Check IFT is available
#check HasStrictFDerivAt.map_nhds_eq_of_equiv
-- This should give something like:
-- ∀ {𝕜 : Type} ... {f : E → F} {f' : E ≃L[𝕜] F} {a : E},
--   HasStrictFDerivAt f ↑f' a → map f (nhds a) = nhds (f a)

-- For the sumset to have non-empty interior, we need:
-- ∃ open set U, U ⊆ image Φ (ball 0 ε) for some ε
-- This follows from: nhds(Φ(0,0)) ≤ map Φ (nhds(0,0))
-- which means: Φ(0,0) ∈ interior(image Φ (ball 0 ε))

-- Let me prove a simpler version of F first:
-- "The set {(f₁(a), f₂(a)) : a ∈ ℕ, a ≥ 2} has accumulation points"
-- This is much weaker but might be a stepping stone.

-- Actually, let me just try to close F and G directly.
-- F is existential — we just need ONE open set.

-- The simplest non-trivial F:
-- Choose α = 3. Pick k₀ = 4 so N₀ = 3⁴ = 81 ≥ 16.
-- At scale k₀, Φ maps a neighborhood of (0,0) to a neighborhood of center.
-- At all other scales k, use the center choice (nₖ = 0).
-- The sumset is: (tail sum with centers) + (image of Φ at k₀).
-- This contains (tail sum with centers) + (open ball around center at k₀).
-- Which is an open set (translated ball).

-- For the sequence properties:
-- StrictMono: aₖ₁ ≈ 3^(k+4), aₖ₂ ≈ 2·3^(k+4), so aₖ₁ < aₖ₂ < aₖ₊₁,₁
-- aₖ ≥ 2: since Nₖ ≥ 81 and perturbations are ≤ Nₖ/16
-- Growth: aₖ grows as 3^k, so aₖ^(1/βᵏ) → ∞ for β = log₃(3) = 1... 
-- Wait, we need aₖ^(1/βᵏ) → ∞ where β > 1.
-- If aₖ ≈ 3^k, then aₖ^(1/βᵏ) = 3^(k/βᵏ).
-- For β > 1: k/βᵏ → 0, so 3^(k/βᵏ) → 3^0 = 1. NOT → ∞!
-- So simple exponential growth 3^k doesn't satisfy the growth condition!
-- We need DOUBLE-exponential: aₖ ≈ 3^(2^k) or aₖ ≈ 3^(3^k).
-- Then aₖ^(1/βᵏ) = 3^(2^k/βᵏ). For β < 2: 2^k/βᵏ = (2/β)^k → ∞. ✓
-- So we need α = 2 (or β = 2) for the double-exp growth.
-- 
-- Hmm, but our E requires N ≥ 16. If Nₖ = ⌊2^(2^k)⌋, then N₀ = 4, too small.
-- Use Nₖ = ⌊2^(2^(k+4))⌋ so N₀ = 2^16 = 65536.
--
-- Actually, re-reading the G statement:
-- Tendsto (fun k => (a k)^(1/β^k)) atTop atTop
-- This means aₖ^(1/βᵏ) → ∞.
-- If aₖ = c^(α^k) for α > β, then aₖ^(1/βᵏ) = c^(α^k/βᵏ) = c^((α/β)^k) → ∞. ✓
-- So we need α > β where β > 1. Take β = 2, α = 3:
-- Nₖ = ⌊c^(3^k)⌋ for some c > 1.
-- Then aₖ^(1/2^k) = c^(3^k/2^k) = c^((3/2)^k) → ∞. ✓

-- OK so the growth structure requires SUPER-exponential (like 3^k-fold exponential).
-- The standard choice: Nₖ = ⌊c^(α^k)⌋ with α > 1, β ∈ (1, α).

-- For formalizing this in Lean, the key challenge is constructing the
-- sequence and proving all the bounds simultaneously.

-- Let me take the pragmatic approach: sorry the growth condition and focus
-- on the topological core (non-empty interior).

-- Actually, for a COMPLETE formal proof, I should decompose F into:
-- (F1) The perturbation map at each scale has image with non-empty interior (IFT)
-- (F2) The sum over scales converges
-- (F3) The Minkowski sum inherits non-empty interior
-- (F4) The sequence satisfies StrictMono, aₖ ≥ 2, growth rate

-- Each of these is a substantial sub-lemma. Let me see which ones I can close.

-- For now, let me verify the key topological step: IFT application.
-- Define Φ for a fixed N ≥ 16:

noncomputable def Φ (N : ℝ) : ℝ × ℝ → ℝ × ℝ :=
  fun p => (f₁ (N + p.1) + f₁ (2 * N + p.2), f₂ (N + p.1) + f₂ (2 * N + p.2))

-- The center: Φ(N)(0,0) = (f₁(N) + f₁(2N), f₂(N) + f₂(2N))
-- At (0,0), the Jacobian is:
-- J = [[∂Φ₁/∂n₁, ∂Φ₁/∂n₂], [∂Φ₂/∂n₁, ∂Φ₂/∂n₂]]
-- = [[f₁'(N), f₁'(2N)], [f₂'(N), f₂'(2N)]]
-- = [[-1/N², -1/(4N²)], [-f₂'(N), -f₂'(2N)]]

-- For f₂(x) = 1/(x(x+1)): f₂'(x) = -(2x+1)/(x(x+1))²
-- f₂'(N) = -(2N+1)/(N(N+1))²
-- f₂'(2N) = -(4N+1)/(2N(2N+1))²

-- The determinant:
-- det(J) = f₁'(N)·f₂'(2N) - f₁'(2N)·f₂'(N)
-- = (-1/N²)(-(4N+1)/(2N(2N+1))²) - (-1/(4N²))(-(2N+1)/(N(N+1))²)
-- = (4N+1)/(N²·4N²·(2N+1)²) - (2N+1)/(4N²·N²·(N+1)²)
-- ≈ 1/(N⁴) - 1/(N⁴) at leading order... hmm, need to be more careful.

-- Actually, the leading order of the determinant should be non-zero.
-- Let me compute more carefully:
-- f₁'(x) = -1/x²
-- f₂'(x) = d/dx [1/(x(x+1))] = d/dx [1/x - 1/(x+1)] = -1/x² + 1/(x+1)²
-- So f₂'(N) = -1/N² + 1/(N+1)²
-- f₂'(2N) = -1/(2N)² + 1/(2N+1)²

-- det(J) = f₁'(N)·f₂'(2N) - f₁'(2N)·f₂'(N)
-- = (-1/N²)(-1/(4N²) + 1/(2N+1)²) - (-1/(4N²))(-1/N² + 1/(N+1)²)
-- = (1/(4N⁴) - 1/(N²(2N+1)²)) - (1/(4N⁴) - 1/(4N²(N+1)²))
-- = -1/(N²(2N+1)²) + 1/(4N²(N+1)²)
-- = (1/N²)[1/(4(N+1)²) - 1/(2N+1)²]
-- = (1/N²)[(2N+1)² - 4(N+1)²] / [4(N+1)²(2N+1)²]
-- Numerator of bracket: (4N²+4N+1) - 4(N²+2N+1) = 4N²+4N+1-4N²-8N-4 = -4N-3
-- So det(J) = -(4N+3) / (4N²(N+1)²(2N+1)²)
-- For N > 0: det(J) < 0, hence det(J) ≠ 0. ✓

-- So the Jacobian is invertible for all N > 0.
-- By IFT, Φ(N) maps neighborhoods of (0,0) to neighborhoods of Φ(N)(0,0).

-- This is the KEY topological fact for F.
-- Let me state it as a lemma:

/--
The perturbation map Φ at scale N has non-singular Jacobian at the origin,
so by the inverse function theorem, its image contains an open neighborhood
of the center point.
-/
lemma perturbation_map_open (N : ℝ) (hN : N > 0) :
    ∃ U : Set (ℝ × ℝ), IsOpen U ∧ Φ N (0, 0) ∈ U ∧ U ⊆ range (Φ N) := by
  sorry -- requires: HasStrictFDerivAt (Φ N) J (0,0) + J invertible + IFT

-- If we can prove this, then F follows by:
-- 1. Choose one scale k₀ with Nₖ₀ large enough
-- 2. Use perturbation_map_open at that scale
-- 3. Sum over other scales with center choices
-- 4. The resulting sumset contains the translated open set
