import Mathlib

open Filter Topology

noncomputable section

def prefixProduct (seq : ℕ → ℕ) : ℕ → ℕ
  | 0 => 1
  | n + 1 => prefixProduct seq n * seq n

def tailResidual (seq : ℕ → ℕ) (num denom : ℕ) : ℕ → ℤ
  | 0 => (num : ℤ)
  | n + 1 => (seq n : ℤ) * tailResidual seq num denom n - 
             (denom : ℤ) * (prefixProduct seq n : ℤ)

-- NEW APPROACH: T_n bounded directly from divisibility.
-- 
-- T_{n+1} = a_n · T_n - denom · P_n
-- ⟹ T_{n+1} ≡ a_n · T_n  (mod denom)
-- ⟹ T_n ≡ a_{n-1} · a_{n-2} · ... · a_0 · T_0  (mod denom) = P_n · num (mod denom)
-- 
-- But T_n = denom · P_n · S_n, so T_n ≡ 0 (mod denom) when S_n is an integer multiple...
-- This doesn't directly help.
-- 
-- BETTER: T_n is bounded by P_n · S_n · denom where S_n → 0.
-- Specifically, T_n = denom · P_n · S_n.
-- 
-- For a STRICTLY MONOTONE sequence with a_k ≥ 2:
-- P_n · S_n = P_n · Σ_{k≥n} 1/a_k
-- = P_n/a_n + P_n/a_{n+1} + ...
-- = P_n/a_n · (1 + a_n/a_{n+1} + a_n/(a_{n+1}·a_{n+2}) + ...)
-- ≤ P_n/a_n · (1 + 1/a_n + 1/a_n² + ...)   [since a_{n+k} ≥ a_n^k for strictly mono]
-- 
-- Wait, strictly monotone with a_k ≥ 2 does NOT give a_{n+k} ≥ a_n^k.
-- But for a_k ≥ 2 and strictly increasing:
-- a_{n+1} ≥ a_n + 1, a_{n+2} ≥ a_n + 2, etc.
-- So a_{n+k} ≥ a_n + k.
-- Σ_{k≥0} 1/(a_n + k) diverges! So this bound is useless.
-- 
-- We need the sequence to grow FASTER than linearly for T_n to be bounded.
-- And from limsup > 1, we know it grows doubly-exponentially (infinitely often).
-- But NOT necessarily always.
-- 
-- HOWEVER: The key observation is that T_n is a POSITIVE INTEGER.
-- So T_n ≥ 1. And T_n = denom · P_n · S_n.
-- S_n is STRICTLY DECREASING (S_{n+1} = S_n - 1/a_n < S_n).
-- So denom · P_n · S_n is the product of a strictly increasing P_n
-- and strictly decreasing S_n.
-- 
-- Claim: P_n · S_n is eventually decreasing.
-- P_{n+1} · S_{n+1} / (P_n · S_n) = a_n · (S_n - 1/a_n) / S_n = a_n - 1/S_n
-- = a_n - P_n·denom/T_n
-- 
-- For this ratio to be ≤ 1: a_n - P_n·denom/T_n ≤ 1, i.e., T_n ≤ P_n·denom/(a_n-1).
-- i.e., denom·P_n·S_n ≤ denom·P_n/(a_n-1), i.e., S_n ≤ 1/(a_n-1). SAME CONDITION.
-- 
-- Circular again!
-- 
-- FINAL INSIGHT: The problem is fundamentally that we're trying to prove
-- the sequence satisfies the Sylvester recurrence, and the tail sum condition
-- IS the Sylvester recurrence in disguise.
-- 
-- The correct approach may be to use a COMPLETELY DIFFERENT proof strategy
-- for Erdős 265, not based on residual growth bounds.
-- 
-- Alternatively, perhaps the tail sum bound follows from a DIFFERENT property
-- of Erdős 265 sequences that we haven't used yet — e.g., the fact that BOTH
-- Σ 1/a_k AND Σ 1/(a_k - 1) are rational.
-- 
-- The dual rational sum condition gives:
-- T_n(a) = denom₁ · P_n(a) · Σ 1/a_k    [positive integer]
-- T_n(b) = denom₂ · P_n(b) · Σ 1/(a_k-1) [positive integer]  
-- where b_k = a_k - 1.
-- 
-- Having BOTH conditions simultaneously might force the tail sum bound.
-- This is related to the "dual lock-in" that we already proved leads to contradiction!

end
