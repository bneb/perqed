import Mathlib

open Complex Filter Topology

noncomputable section

def sylvester : ℕ → ℕ
| 0 => 2
| (n + 1) => sylvester n * (sylvester n - 1) + 1

def MahlerTerm (w : ℂ) (k : ℕ) : ℂ :=
  w ^ (sylvester k) / (1 + w ^ (sylvester k))

def MahlerSeries (w : ℂ) : ℂ :=
  if abs w < 1 then ∑' k, MahlerTerm w k else 0

lemma mahler_term_summable (w : ℂ) (h : abs w < 1) : Summable (MahlerTerm w) := by
  -- We need to prove that w^(s_k) / (1+w^(s_k)) is summable.
  -- Since abs w < 1, abs(w^(s_k)) decays doubly exponentially.
  sorry

end
