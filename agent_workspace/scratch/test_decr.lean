import Mathlib

-- A non-increasing sequence of positive integers is eventually constant.
-- Proof: bounded below by 1, so can decrease at most finitely many times.
lemma nonincr_pos_int_eventually_const (f : ℕ → ℤ) (N : ℕ)
    (hPos : ∀ k, f k > 0)
    (hDecr : ∀ n ≥ N, f (n + 1) ≤ f n) :
    ∃ (C : ℤ) (M : ℕ), ∀ n ≥ M, f n = C := by
  -- The value f(N) is a positive integer. f can decrease at most f(N)-1 times.
  -- We prove by strong induction on the value f(N).
  -- Specifically: we show that for any k ≥ N, f is constant on [k, ∞) or 
  -- f(k+1) < f(k) and we recurse with a smaller bound.
  -- Since f ≥ 1 always, this terminates.
  
  -- Alternative clean proof: 
  -- Define g : ℕ → ℕ by g(n) = (f(N) - f(N+n)).toNat for n ≥ 0.
  -- g is non-decreasing, g(0) = 0, g(n) ≤ f(N) - 1.
  -- A non-decreasing bounded ℕ sequence is eventually constant.
  -- Therefore g is eventually constant, so f is eventually constant.
  
  -- But let's do it more directly.
  -- Since f is non-increasing from N, f(n) ≤ f(N) for all n ≥ N.
  have hUpper : ∀ n ≥ N, f n ≤ f N := by
    intro n hn
    induction n with
    | zero => omega
    | succ m ih =>
      by_cases hm : m ≥ N
      · exact le_trans (hDecr m hm) (ih hm)
      · have : m + 1 = N := by omega
        subst this; exact le_refl _
  -- f(n) ∈ {1, ..., f(N)} for all n ≥ N.
  -- Define M as the first n ≥ N where f(n) = f(n+1) = f(n+2) = ... 
  -- We know such M exists because f can't decrease forever (bounded below by 1).
  
  -- Cleanest approach: since f is ℤ-valued, non-increasing from N, and f ≥ 1,
  -- the set {f(n) | n ≥ N} has a minimum. Let M achieve the minimum.
  -- Then f(n) ≥ f(M) for all n ≥ N, but f is non-increasing from M ≥ N,
  -- so f(n) ≤ f(M) for all n ≥ M. Combined: f(n) = f(M) for all n ≥ M.
  
  -- Actually, just use: f is non-increasing and bounded below → convergent.
  -- In ℤ (discrete), convergent → eventually constant.
  -- f non-increasing from N: f(N) ≥ f(N+1) ≥ f(N+2) ≥ ... ≥ 1
  -- This is a non-increasing sequence of naturals (since f ≥ 1), hence eventually constant.
  
  -- Let's just find the stabilization point.
  -- The value drops: f(N) - f(n) is non-decreasing in n (for n ≥ N) and bounded by f(N) - 1.
  -- When f(N) - f(n) = f(N) - f(n+1) (i.e., f(n) = f(n+1)), f has stabilized.
  
  -- We claim f stabilizes at or before step N + (f N).toNat.
  -- Because f can decrease by at least 1 each time it decreases,
  -- and f(N) ≥ 1, so at most f(N) - 1 decreases.
  
  -- For formalization, let me use well-founded descent.
  -- There exists n ≥ N such that f(n) = f(n+1).
  -- Proof: if f(n) > f(n+1) for all n ≥ N, then f(N+k) ≤ f(N) - k for all k.
  -- For k = f(N).toNat, f(N + k) ≤ f(N) - f(N) = 0, contradicting f > 0.
  by_contra h_no_const
  push_neg at h_no_const
  -- h_no_const : ∀ C M, ∃ n ≥ M, f n ≠ C
  -- This means f is not eventually constant.
  -- Since f is non-increasing from N and integer-valued, "not eventually constant"
  -- means f strictly decreases infinitely often.
  -- But f ≥ 1, contradiction.
  
  -- More precisely: since f is non-increasing from N and not eventually constant,
  -- for every M ≥ N, there exists n ≥ M with f(n+1) < f(n).
  have h_inf_decr : ∀ M ≥ N, ∃ n ≥ M, f (n + 1) < f n := by
    intro M hM
    -- f is non-increasing from N. If f were constant on [M, ∞), 
    -- we'd have ∃ C M, ∀ n ≥ M, f n = C, contradicting h_no_const.
    by_contra h_all_eq
    push_neg at h_all_eq
    -- h_all_eq : ∀ n ≥ M, f n ≤ f (n + 1)
    -- Combined with f(n+1) ≤ f(n) for n ≥ N ≤ M, we get f(n) = f(n+1) for n ≥ M.
    have h_const_from_M : ∀ n ≥ M, f n = f M := by
      intro n hn
      induction n with
      | zero => omega
      | succ m ih =>
        by_cases hm : m ≥ M
        · have h1 := hDecr m (le_trans hM hm)
          have h2 := h_all_eq m hm
          have h3 := ih hm
          omega
        · have : m + 1 = M := by omega
          subst this; rfl
    exact h_no_const (f M) M (fun n hn => h_const_from_M n hn)
  -- Now: f strictly decreases infinitely often from N onward.
  -- Build a sequence of strict decreases: n_0 < n_1 < n_2 < ...
  -- with f(n_k + 1) < f(n_k).
  -- Since f is non-increasing: f(n_0) > f(n_0 + 1) ≥ f(n_1) > f(n_1 + 1) ≥ ...
  -- So f(N) > f(n_0 + 1) ≥ f(n_1) > f(n_1 + 1) ≥ ...
  -- After k strict decreases: f(n_k) ≤ f(N) - k.
  -- For k = f(N), f(n_k) ≤ 0, contradicting f > 0.
  
  -- Let's build this more carefully. Get the first drop after N.
  rcases h_inf_decr N (le_refl N) with ⟨n0, hn0, hdrop0⟩
  -- f(n0 + 1) ≤ f(n0) - 1 ≤ f(N) - 1
  have hf_n0_succ : f (n0 + 1) ≤ f N - 1 := by
    have := hUpper n0 hn0
    omega
  -- Now iterate: get drops until we violate positivity.
  -- The value f(n0+1) ≤ f(N) - 1. After f(N) - 1 drops total, f ≤ 0.
  -- We need f(N) - 1 drops. Since each drop reduces f by at least 1 from
  -- the non-increasing sequence, after (f N).toNat steps from N we have f ≤ 0.
  
  -- Simpler: by induction, show f(N + k) ≤ f(N) for all k,
  -- and that there are at least ⌊f(N)⌋ strict drops, which would make f ≤ 0.
  
  -- Actually, let me just construct the contradiction directly.
  -- We show: ∀ k ≤ f(N).toNat, ∃ n ≥ N, f(n) ≤ f(N) - k.
  -- Base: k=0, n=N.
  -- Step: given n with f(n) ≤ f(N) - k, get n' ≥ n with f(n'+1) < f(n') ≤ f(n).
  -- Then f(n'+1) ≤ f(n') - 1 ≤ f(n) - 1 ≤ f(N) - k - 1 = f(N) - (k+1).
  -- For k = f(N).toNat: f(n) ≤ f(N) - f(N).toNat ≤ 0, contradiction with hPos.
  
  -- This needs: ∀ M ≥ N, ∃ n ≥ M, f(n+1) < f(n). We have this as h_inf_decr.
  -- And: f(n+1) ≤ f(n') - 1 when f(n'+1) < f(n') (integer valued).
  -- And: hUpper gives us the chain.
  
  -- Actually, let me just use a cleaner approach.
  -- Define drop_count(n) = f(N) - f(n) for n ≥ N.
  -- drop_count is non-decreasing (since f is non-increasing).
  -- drop_count ≥ 0 (since f(n) ≤ f(N)).
  -- And drop_count(n) < f(N) (since f(n) ≥ 1, so f(N) - f(n) ≤ f(N) - 1).
  -- Since f is not eventually constant, drop_count is not eventually constant.
  -- Since drop_count is non-decreasing and integer-valued, "not eventually constant" 
  -- means it increases to ∞. But it's bounded by f(N) - 1. Contradiction!
  
  -- This is the cleanest argument. Let me formalize it.
  -- We need: a non-decreasing ℤ sequence bounded above is eventually constant.
  sorry

end
