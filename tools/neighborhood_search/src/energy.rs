//! `energy.rs` — Bitset Ramsey Energy Evaluator
//!
//! Counts K_r (red cliques) + K_s (blue cliques / independent sets) and
//! returns their sum as the Ramsey energy `E`.
//!
//! # Algorithm
//! For clique counting we use bitmask enumeration with bitwise-AND intersection:
//! for each r-subset of vertices, intersect their neighborhoods; if the
//! result contains all r vertices, they form a clique.
//!
//! For small r (≤6) and n ≤ 35 this brute-force approach is fast enough to
//! sustain well over 1M evaluations/sec on modern hardware.

/// Count the number of r-cliques in the graph described by `adj` (bitboard).
pub fn count_cliques(adj: &[u64], n: usize, r: usize) -> usize {
    if r == 0 {
        return 1;
    }
    if r == 1 {
        return n;
    }
    let mut count = 0usize;
    // Enumerate r-subsets using a candidates bitmask approach.
    // For efficiency, use branch-and-bound: for each starting vertex i,
    // restrict to vertices j > i that are neighbors of i.
    count_cliques_recursive(adj, n, r, 0, (1u64 << n) - 1, 0, &mut count);
    count
}

fn count_cliques_recursive(
    adj: &[u64],
    _n: usize,
    r: usize,
    depth: usize,
    candidates: u64,
    _clique: u64,
    count: &mut usize,
) {
    if depth == r {
        *count += 1;
        return;
    }
    let remaining = r - depth;
    if (candidates.count_ones() as usize) < remaining {
        return; // prune: not enough candidates left
    }
    let mut cands = candidates;
    while cands != 0 {
        let lsb = cands.trailing_zeros() as usize;
        let bit = 1u64 << lsb;
        // Only consider subsets with increasing vertex indices to avoid duplicates
        let next_candidates = (candidates & adj[lsb]) & !((bit << 1) - 1);
        count_cliques_recursive(adj, _n, r, depth + 1, next_candidates, _clique | bit, count);
        cands &= !bit;
    }
}

/// Compute the complement adjacency matrix.
pub fn complement(adj: &[u64], n: usize) -> Vec<u64> {
    let mask = (1u64 << n) - 1;
    adj.iter()
        .enumerate()
        .map(|(i, &row)| (!row & mask) & !(1u64 << i)) // exclude self-loop
        .collect()
}

/// Ramsey energy = K_r red cliques + K_s blue independent sets.
/// Red edges: adj edges. Blue edges: complement edges.
pub fn ramsey_energy(adj: &[u64], n: usize, r: usize, s: usize) -> usize {
    let red_cliques = count_cliques(adj, n, r);
    let comp = complement(adj, n);
    let blue_cliques = count_cliques(&comp, n, s);
    red_cliques + blue_cliques
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::matrix::compile_adjacency;

    #[test]
    fn empty_graph_has_no_cliques() {
        let adj = vec![0u64; 6];
        assert_eq!(count_cliques(&adj, 6, 3), 0);
    }

    #[test]
    fn complete_graph_k4_has_exactly_one_k4_clique() {
        // K_4: all 4 vertices fully connected
        let n = 4;
        let all = (1u64 << n) - 1;
        let adj: Vec<u64> = (0..n).map(|i| all & !(1u64 << i)).collect();
        assert_eq!(count_cliques(&adj, n, 4), 1);
    }

    #[test]
    fn complete_graph_k5_has_five_k4_cliques() {
        // C(5,4) = 5
        let n = 5;
        let all = (1u64 << n) - 1;
        let adj: Vec<u64> = (0..n).map(|i| all & !(1u64 << i)).collect();
        assert_eq!(count_cliques(&adj, n, 4), 5);
    }

    #[test]
    fn empty_graph_complement_is_complete() {
        let adj = vec![0u64; 5];
        let comp = complement(&adj, 5);
        let n = 5;
        let all = (1u64 << n) - 1;
        for (i, &row) in comp.iter().enumerate() {
            assert_eq!(row, all & !(1u64 << i));
        }
    }

    #[test]
    fn complement_of_complement_is_identity() {
        let adj = compile_adjacency(&[5, 7, 10, 14, 15, 20, 21, 25, 28, 30], 35);
        let comp = complement(&adj, 35);
        let double_comp = complement(&comp, 35);
        assert_eq!(adj, double_comp);
    }

    #[test]
    fn seed_energy_is_210() {
        // Canonical regression: the R(4,6)≥36 Cayley graph seed gives E=210
        let seed = &[5usize, 7, 10, 14, 15, 20, 21, 25, 28, 30];
        let adj = compile_adjacency(seed, 35);
        let energy = ramsey_energy(&adj, 35, 4, 6);
        assert_eq!(energy, 210, "canonical seed energy must be 210, got {energy}");
    }

    #[test]
    fn ramsey_energy_zero_for_trivially_small_graph() {
        // On 3 vertices, no K_4 and no K_6 is possible regardless of edges
        let adj = vec![0u64; 3];
        assert_eq!(ramsey_energy(&adj, 3, 4, 6), 0);
    }
}
