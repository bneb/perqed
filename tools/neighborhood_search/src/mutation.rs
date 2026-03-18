//! `mutation.rs` — Seed Mutation Engine
//!
//! Takes a symmetric Cayley graph difference set and applies k bounded
//! random perturbations (add / remove / swap), maintaining symmetry.

use rand::Rng;
use std::collections::HashSet;

/// Apply exactly `k` random mutations (add / remove / swap) to `seed`,
/// preserving the circulant symmetry property: if x ∈ S then n−x ∈ S.
/// Elements 0 and n are always excluded.
pub fn mutate_seed(seed: &[usize], k: usize, n: usize) -> Vec<usize> {
    let mut rng = rand::thread_rng();
    let mut set: HashSet<usize> = seed.iter().cloned().collect();

    for _ in 0..k {
        let op = rng.gen_range(0..3u8);
        match op {
            0 => {
                // Add a random symmetric pair
                let val = rng.gen_range(1..n);
                set.insert(val);
                if val != n - val {
                    set.insert(n - val);
                }
            }
            1 => {
                // Remove a symmetric pair
                if !set.is_empty() {
                    let items: Vec<usize> = set.iter().cloned().collect();
                    let val = items[rng.gen_range(0..items.len())];
                    set.remove(&val);
                    set.remove(&(n - val));
                }
            }
            _ => {
                // Swap: remove one pair, add a different one
                if !set.is_empty() {
                    let items: Vec<usize> = set.iter().cloned().collect();
                    let drop_val = items[rng.gen_range(0..items.len())];
                    set.remove(&drop_val);
                    set.remove(&(n - drop_val));
                }
                let add_val = rng.gen_range(1..n);
                set.insert(add_val);
                if add_val != n - add_val {
                    set.insert(n - add_val);
                }
            }
        }
    }

    // Post-conditions: strip 0 and n just in case
    set.remove(&0);
    set.remove(&n);

    let mut result: Vec<usize> = set.into_iter().collect();
    result.sort_unstable();
    result
}

/// Draw a random k from {1, 2, 3} and call `mutate_seed`.
pub fn mutate_seed_random_k(seed: &[usize], n: usize) -> Vec<usize> {
    let k = rand::thread_rng().gen_range(1..=3usize);
    mutate_seed(seed, k, n)
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests (RED written first, implementation above turns them GREEN)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const N: usize = 35;
    const SEED: &[usize] = &[5, 7, 10, 14, 15, 20, 21, 25, 28, 30];

    fn is_symmetric(set: &[usize], n: usize) -> bool {
        set.iter().all(|&x| set.contains(&(n - x)))
    }

    #[test]
    fn seed_0_mutations_returns_sorted_clone() {
        let result = mutate_seed(SEED, 0, N);
        assert_eq!(result, SEED, "0 mutations must return identity");
    }

    #[test]
    fn mutated_set_always_symmetric() {
        for _ in 0..500 {
            let result = mutate_seed(SEED, 3, N);
            assert!(
                is_symmetric(&result, N),
                "symmetry broken: {:?}",
                result
            );
        }
    }

    #[test]
    fn zero_and_n_never_in_result() {
        for _ in 0..500 {
            let result = mutate_seed(SEED, 3, N);
            assert!(
                !result.contains(&0) && !result.contains(&N),
                "0 or N found in {:?}",
                result
            );
        }
    }

    #[test]
    fn result_values_in_range_1_to_n_minus_1() {
        for _ in 0..200 {
            let result = mutate_seed(SEED, 2, N);
            for &v in &result {
                assert!(v >= 1 && v < N, "out of range: {} not in [1,{})", v, N);
            }
        }
    }

    #[test]
    fn result_is_sorted() {
        for _ in 0..200 {
            let result = mutate_seed(SEED, 2, N);
            let mut sorted = result.clone();
            sorted.sort_unstable();
            assert_eq!(result, sorted, "result must be sorted");
        }
    }

    #[test]
    fn result_has_no_duplicates() {
        for _ in 0..200 {
            let result = mutate_seed(SEED, 2, N);
            let unique: HashSet<usize> = result.iter().cloned().collect();
            assert_eq!(result.len(), unique.len(), "duplicates found in {:?}", result);
        }
    }

    #[test]
    fn random_k_stays_within_bounds() {
        for _ in 0..200 {
            let result = mutate_seed_random_k(SEED, N);
            assert!(is_symmetric(&result, N));
        }
    }
}
