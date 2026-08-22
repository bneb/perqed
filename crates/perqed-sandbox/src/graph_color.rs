//! Generic exact chromatic number computation over adjacency lists.
//!
//! MRV/DSATUR backtracking DPLL — lifted from the ℚ(√2)-specific
//! `hadwiger_nelson` graph type so any verified certificate's adjacency
//! (e.g. from the dynamic probe harness) can be decided.

use std::collections::{HashMap, HashSet};

/// Exact test whether the graph admits a valid k-coloring via MRV/DSATUR.
/// Returns None if UNSAT (provably not k-colorable, χ > k), or Some(coloring)
/// with every edge properly colored if SAT.
pub fn solve_k_colorability(
    adj: &[HashSet<usize>],
    k: usize,
) -> Option<HashMap<usize, usize>> {
    let num_vertices = adj.len();
    let mut assignment: HashMap<usize, usize> = HashMap::new();

    if dsatur_backtrack_k(adj, &mut assignment, num_vertices, k) {
        Some(assignment)
    } else {
        None
    }
}

/// Exact chromatic number χ(G) by testing k = 1, 2, 3, … until SAT.
/// Returns 0 for the empty graph.
pub fn compute_chromatic_number(adj: &[HashSet<usize>]) -> usize {
    for k in 1..=adj.len() {
        if solve_k_colorability(adj, k).is_some() {
            return k;
        }
    }
    adj.len()
}

fn dsatur_backtrack_k(
    adj: &[HashSet<usize>],
    assignment: &mut HashMap<usize, usize>,
    num_vertices: usize,
    k: usize,
) -> bool {
    if assignment.len() == num_vertices {
        return true;
    }

    // Pick unassigned vertex with MRV (minimum remaining legal colors)
    let mut best_v = None;
    let mut min_available = k + 1;
    let mut best_colors = Vec::new();

    for (v, nbrs) in adj.iter().enumerate() {
        if assignment.contains_key(&v) {
            continue;
        }

        let mut used_colors = vec![false; k];
        for &nbr in nbrs {
            if let Some(&c) = assignment.get(&nbr) {
                if c < k {
                    used_colors[c] = true;
                }
            }
        }

        let available: Vec<usize> = (0..k).filter(|&c| !used_colors[c]).collect();
        if available.is_empty() {
            return false;
        }

        if available.len() < min_available {
            min_available = available.len();
            best_v = Some(v);
            best_colors = available;
            if min_available == 1 {
                break;
            }
        }
    }

    let v = match best_v {
        Some(v) => v,
        None => return true,
    };

    for color in best_colors {
        assignment.insert(v, color);
        if dsatur_backtrack_k(adj, assignment, num_vertices, k) {
            return true;
        }
        assignment.remove(&v);
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn complete(n: usize) -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); n];
        for u in 0..n {
            for v in (u + 1)..n {
                adj[u].insert(v);
                adj[v].insert(u);
            }
        }
        adj
    }

    fn cycle(n: usize) -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); n];
        for i in 0..n {
            let j = (i + 1) % n;
            adj[i].insert(j);
            adj[j].insert(i);
        }
        adj
    }

    fn complete_bipartite(a: usize, b: usize) -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); a + b];
        for u in 0..a {
            for v in a..(a + b) {
                adj[u].insert(v);
                adj[v].insert(u);
            }
        }
        adj
    }

    fn star(n: usize) -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); n];
        for v in 1..n {
            adj[0].insert(v);
            adj[v].insert(0);
        }
        adj
    }

    fn petersen() -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); 10];
        for i in 0..5 {
            let j = (i + 1) % 5;
            adj[i].insert(j);
            adj[j].insert(i);
        }
        for i in 0..5 {
            let j = 5 + (i + 2) % 5;
            adj[5 + i].insert(j);
            adj[j].insert(5 + i);
        }
        for i in 0..5 {
            adj[i].insert(5 + i);
            adj[5 + i].insert(i);
        }
        adj
    }

    #[test]
    fn test_chromatic_number_complete_graphs() {
        assert_eq!(compute_chromatic_number(&complete(1)), 1);
        assert_eq!(compute_chromatic_number(&complete(4)), 4);
        assert_eq!(compute_chromatic_number(&complete(5)), 5);
    }

    #[test]
    fn test_chromatic_number_odd_and_even_cycles() {
        assert_eq!(compute_chromatic_number(&cycle(3)), 3);
        assert_eq!(compute_chromatic_number(&cycle(5)), 3);
        assert_eq!(compute_chromatic_number(&cycle(4)), 2);
    }

    #[test]
    fn test_chromatic_number_bipartite_families() {
        assert_eq!(compute_chromatic_number(&complete_bipartite(3, 3)), 2);
        assert_eq!(compute_chromatic_number(&star(9)), 2);
    }

    #[test]
    fn test_chromatic_number_petersen() {
        assert_eq!(compute_chromatic_number(&petersen()), 3);
    }

    #[test]
    fn test_chromatic_number_empty_graph() {
        let empty: Vec<HashSet<usize>> = vec![];
        assert_eq!(compute_chromatic_number(&empty), 0);
    }

    #[test]
    fn test_k_colorability_witness_is_exact() {
        let adj = complete_bipartite(3, 3);
        let coloring = solve_k_colorability(&adj, 2).expect("K_3,3 is 2-colorable");
        assert_eq!(coloring.len(), 6);
        for u in 0..3 {
            for v in 3..6 {
                assert_ne!(coloring[&u], coloring[&v], "edge (u,v) must be properly colored");
            }
        }
        assert!(solve_k_colorability(&adj, 1).is_none(), "K_3,3 is not 1-colorable");
    }

    #[test]
    fn test_unsat_claim_for_petersen_at_two() {
        assert!(solve_k_colorability(&petersen(), 2).is_none());
    }
}
