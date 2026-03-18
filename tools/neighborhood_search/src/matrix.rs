//! `matrix.rs` — Adjacency Matrix Compiler & Flattener
//!
//! Expands a 1-D circulant difference set into a packed bitboard adjacency
//! matrix.  Each row is a u64 where bit j is set iff there is a red edge
//! i→j.  N must be ≤ 64.

use std::collections::HashSet;

/// Compile a circulant adjacency bitboard from a difference set.
///
/// `matrix[i]` is a u64 where bit `j` is set iff `(i as isize - j as isize).rem_euclid(n as isize) as usize ∈ diff_set`.
/// Diagonal (self-loops) is always 0.
pub fn compile_adjacency(diff_set: &[usize], n: usize) -> Vec<u64> {
    assert!(n <= 64, "n must be ≤ 64 for u64 bitboard");
    let lookup: HashSet<usize> = diff_set.iter().cloned().collect();
    (0..n)
        .map(|i| {
            let mut row: u64 = 0;
            for j in 0..n {
                if i == j {
                    continue; // no self-loops
                }
                let diff = (i as isize - j as isize).rem_euclid(n as isize) as usize;
                if lookup.contains(&diff) {
                    row |= 1u64 << j;
                }
            }
            row
        })
        .collect()
}

/// Flatten the upper-triangular portion of the adjacency matrix into a
/// compact '0'/'1' string of length n*(n-1)/2.
pub fn flatten_upper(adj: &[u64], n: usize) -> String {
    let mut s = String::with_capacity(n * (n - 1) / 2);
    for i in 0..n {
        for j in (i + 1)..n {
            if (adj[i] >> j) & 1 == 1 {
                s.push('1');
            } else {
                s.push('0');
            }
        }
    }
    s
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const N: usize = 35;
    const SEED: &[usize] = &[5, 7, 10, 14, 15, 20, 21, 25, 28, 30];

    #[test]
    fn diagonal_always_zero() {
        let adj = compile_adjacency(SEED, N);
        for (i, &row) in adj.iter().enumerate() {
            assert_eq!(
                (row >> i) & 1,
                0,
                "self-loop at vertex {i}"
            );
        }
    }

    #[test]
    fn matrix_is_symmetric() {
        let adj = compile_adjacency(SEED, N);
        for i in 0..N {
            for j in 0..N {
                let ij = (adj[i] >> j) & 1;
                let ji = (adj[j] >> i) & 1;
                assert_eq!(ij, ji, "asymmetric at ({i},{j})");
            }
        }
    }

    #[test]
    fn compile_known_circulant_edge() {
        // diff 5 is in SEED so vertex 5 should be adjacent to vertex 0
        let adj = compile_adjacency(SEED, N);
        assert_eq!((adj[0] >> 5) & 1, 1, "edge (0,5) should be present");
        assert_eq!((adj[0] >> 1) & 1, 0, "edge (0,1) should be absent (1 not in seed)");
    }

    #[test]
    fn empty_diff_set_gives_all_zeros() {
        let adj = compile_adjacency(&[], N);
        assert!(adj.iter().all(|&r| r == 0));
    }

    #[test]
    fn flatten_length_is_correct() {
        let adj = compile_adjacency(SEED, N);
        let flat = flatten_upper(&adj, N);
        assert_eq!(flat.len(), N * (N - 1) / 2);
    }

    #[test]
    fn flatten_contains_only_01() {
        let adj = compile_adjacency(SEED, N);
        let flat = flatten_upper(&adj, N);
        assert!(flat.chars().all(|c| c == '0' || c == '1'));
    }

    #[test]
    fn flatten_roundtrip_edge_count() {
        let adj = compile_adjacency(SEED, N);
        let flat = flatten_upper(&adj, N);
        let edge_count_flat = flat.chars().filter(|&c| c == '1').count();
        // Each undirected edge appears once in upper triangle
        let edge_count_adj: u32 = adj.iter().map(|r| r.count_ones()).sum::<u32>() / 2;
        assert_eq!(edge_count_flat, edge_count_adj as usize);
    }

    #[test]
    fn small_n_known_result() {
        // diff_set={1} on N=4: edges (0,1),(1,2),(2,3),(3,0) — a 4-cycle
        let adj = compile_adjacency(&[1, 3], 4);
        // vertex 0 should be adjacent to 1 (diff=1 ∈ set) and 3 (diff=3 ∈ set)
        assert_eq!((adj[0] >> 1) & 1, 1);
        assert_eq!((adj[0] >> 3) & 1, 1);
        assert_eq!((adj[0] >> 2) & 1, 0);
    }
}
