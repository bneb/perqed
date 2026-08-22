//! Stage 0 Graph Invariant & Mathematical Sanity Filter
//!
//! Enforces rigorous discrete mathematics theorems to reject impossible or flawed
//! chromatic number claims before wasting compute in DPLL SAT or Lean 4 kernels.
//!
//! Core Invariants Enforced (each is a sound theorem, in rejection order):
//! 1. Bipartiteness: χ(G) ≤ 2, so any claim of χ ≥ 3 on a bipartite graph is
//!    rejected outright (a bound the degeneracy check alone cannot give —
//!    K_{3,3} is 3-degenerate yet 2-chromatic).
//! 2. Degeneracy Theorem: any (k−1)-degenerate graph is provably k-colorable
//!    by greedy ordering. If d(G) < B − 1, a claim of χ ≥ B is impossible.
//! 3. Sharp Brooks' Theorem: for a connected component that is neither a
//!    complete graph nor an odd cycle, χ ≤ Δ. E.g. the Petersen graph has
//!    Δ = 3 and χ = 3, so χ ≥ 4 is rejected even though its degeneracy
//!    bound (χ ≤ 4) would admit it.
//! 4. Turán Density Bound: E > ex(n, K_r) forces a K_r subgraph, hence χ ≥ r.
//!    The certificate reports the largest such r as confirmation for the
//!    downstream SAT stage (ex(n, K_r) computed exactly, integral form).
//! 5. Triangle & Odd-Cycle Profile: bipartiteness, triangle-freeness,
//!    odd-cycle presence reported in the certificate.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SanityError {
    #[error("Degeneracy violation: Graph is {degeneracy}-degenerate (d_avg = {avg_degree:.3}), making it provably {provable_colorable}-colorable. Claimed lower bound χ ≥ {claimed_bound} is mathematically impossible.")]
    DegeneracyViolation {
        degeneracy: usize,
        avg_degree: f64,
        provable_colorable: usize,
        claimed_bound: usize,
    },
    #[error("Brooks' theorem violation: Maximum degree Δ(G) = {max_degree} < {min_required_degree}. Claimed χ ≥ {claimed_bound} is impossible.")]
    BrooksViolation {
        max_degree: usize,
        min_required_degree: usize,
        claimed_bound: usize,
        /// true when the sharp bound (χ ≤ Δ, no complete/odd-cycle component)
        /// is what fired; false for the plain χ ≤ Δ + 1 bound.
        #[serde(default)]
        sharp: bool,
    },
    #[error("Bipartite violation: graph is bipartite (χ ≤ 2) but χ ≥ {claimed_bound} was claimed ({vertex_count} vertices)")]
    BipartiteViolation {
        vertex_count: usize,
        claimed_bound: usize,
    },
    #[error("Empty graph cannot have chromatic number ≥ {0}")]
    EmptyGraph(usize),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SanityCertificate {
    pub vertex_count: usize,
    pub edge_count: usize,
    pub avg_degree: f64,
    pub max_degree: usize,
    pub degeneracy: usize,
    pub k_core_sizes: HashMap<usize, usize>,
    pub triangle_free: bool,
    pub is_bipartite: bool,
    pub brooks_bound: usize,
    /// Sharp Brooks bound: per-component χ ≤ Δ (non-complete, non-odd-cycle
    /// components) or χ ≤ Δ + 1 (complete graphs and odd cycles).
    #[serde(default)]
    pub sharp_brooks_bound: usize,
    /// Largest r ≥ 3 with E > ex(n, K_r): Turán forces a K_r subgraph, so
    /// χ ≥ r is confirmed without running SAT. None when nothing is forced.
    #[serde(default)]
    pub turan_forced_clique_bound: Option<usize>,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphCycleProfile {
    pub is_bipartite: bool,
    pub triangle_free: bool,
    pub odd_cycle_found: Option<usize>,
}

pub struct GraphSanityChecker;

impl GraphSanityChecker {
    /// Compute the full k-core decomposition of a graph
    /// Returns a map from core level k to the list of surviving vertices.
    pub fn compute_k_core_decomposition(adj: &[HashSet<usize>]) -> HashMap<usize, Vec<usize>> {
        let n = adj.len();
        let mut degrees: Vec<usize> = adj.iter().map(|s| s.len()).collect();
        let mut in_core: Vec<bool> = vec![true; n];
        let mut k_cores = HashMap::new();

        let max_deg = degrees.iter().copied().max().unwrap_or(0);

        for k in 1..=(max_deg + 1) {
            let mut queue: VecDeque<usize> = VecDeque::new();
            for v in 0..n {
                if in_core[v] && degrees[v] < k {
                    queue.push_back(v);
                }
            }

            while let Some(v) = queue.pop_front() {
                if !in_core[v] {
                    continue;
                }
                in_core[v] = false;
                for &nbr in &adj[v] {
                    if in_core[nbr] {
                        if degrees[nbr] > 0 {
                            degrees[nbr] -= 1;
                        }
                        if degrees[nbr] < k {
                            queue.push_back(nbr);
                        }
                    }
                }
            }

            let surviving: Vec<usize> = (0..n).filter(|&v| in_core[v]).collect();
            if surviving.is_empty() {
                break;
            }
            k_cores.insert(k, surviving);
        }

        k_cores
    }

    /// Computes the exact degeneracy d(G) of the graph:
    /// d(G) = max_{H ⊆ G} δ(H)
    ///
    /// Lazy bucket (Batagelj–Zaversnik) peeling in O(n + m): vertices sit in
    /// buckets indexed by their current degree; stale entries are skipped via
    /// the in-graph flag. Correctness invariant: all buckets below the current
    /// pointer are empty, so the popped vertex has the true minimum degree.
    pub fn compute_degeneracy(adj: &[HashSet<usize>]) -> usize {
        let n = adj.len();
        if n == 0 {
            return 0;
        }

        let mut degrees: Vec<usize> = adj.iter().map(|s| s.len()).collect();
        let mut in_graph: Vec<bool> = vec![true; n];
        let mut buckets: Vec<Vec<usize>> = vec![Vec::new(); n];
        for v in 0..n {
            buckets[degrees[v]].push(v);
        }

        let mut ptr = 0;
        let mut remaining = n;
        let mut max_min_deg = 0;

        while remaining > 0 {
            while ptr < n && buckets[ptr].is_empty() {
                ptr += 1;
            }
            if ptr >= n {
                break;
            }
            let v = buckets[ptr].pop().unwrap();
            if !in_graph[v] {
                continue; // stale entry from an earlier degree update
            }

            max_min_deg = max_min_deg.max(ptr);
            in_graph[v] = false;
            remaining -= 1;

            for &nb in &adj[v] {
                if in_graph[nb] {
                    degrees[nb] -= 1;
                    buckets[degrees[nb]].push(nb);
                }
            }
        }

        max_min_deg
    }

    /// Evaluates if the graph is bipartite and triangle-free
    pub fn analyze_cycles(adj: &[HashSet<usize>]) -> GraphCycleProfile {
        let n = adj.len();
        let mut colors: Vec<Option<usize>> = vec![None; n];
        let mut is_bipartite = true;
        let mut odd_cycle_found = None;

        // BFS 2-coloring for bipartiteness
        for start in 0..n {
            if colors[start].is_some() {
                continue;
            }
            colors[start] = Some(0);
            let mut queue = VecDeque::new();
            queue.push_back(start);

            while let Some(u) = queue.pop_front() {
                let c_u = colors[u].unwrap();
                for &v in &adj[u] {
                    match colors[v] {
                        None => {
                            colors[v] = Some(1 - c_u);
                            queue.push_back(v);
                        }
                        Some(c_v) => {
                            if c_v == c_u {
                                is_bipartite = false;
                                if odd_cycle_found.is_none() {
                                    odd_cycle_found = Some(3); // Odd cycle present
                                }
                            }
                        }
                    }
                }
            }
        }

        // Triangle check: (u, v) ∈ E and (v, w) ∈ E and (w, u) ∈ E
        let mut triangle_free = true;
        'outer: for u in 0..n {
            for &v in &adj[u] {
                if v > u {
                    for &w in &adj[v] {
                        if w > v && adj[u].contains(&w) {
                            triangle_free = false;
                            break 'outer;
                        }
                    }
                }
            }
        }

        GraphCycleProfile {
            is_bipartite,
            triangle_free,
            odd_cycle_found,
        }
    }

    /// Verifies if a claimed chromatic lower bound χ ≥ claimed_bound is
    /// mathematically plausible, applying each sound invariant in rejection
    /// order. Returns a SanityCertificate (with Turán confirmation and the
    /// sharp Brooks bound) or a SanityError rejecting the claim.
    pub fn verify_chromatic_bound(
        adj: &[HashSet<usize>],
        claimed_bound: usize,
    ) -> Result<SanityCertificate, SanityError> {
        let n = adj.len();
        if n == 0 {
            if claimed_bound >= 1 {
                return Err(SanityError::EmptyGraph(claimed_bound));
            }
            // The vacuous claim χ ≥ 0 on the empty graph is consistent.
            return Ok(SanityCertificate {
                vertex_count: 0,
                edge_count: 0,
                avg_degree: 0.0,
                max_degree: 0,
                degeneracy: 0,
                k_core_sizes: HashMap::new(),
                triangle_free: true,
                is_bipartite: true,
                brooks_bound: 0,
                sharp_brooks_bound: 0,
                turan_forced_clique_bound: None,
                passed: true,
            });
        }

        let num_edges: usize = adj.iter().map(|s| s.len()).sum::<usize>() / 2;
        let avg_degree = (2.0 * num_edges as f64) / n as f64;
        let max_degree = adj.iter().map(|s| s.len()).max().unwrap_or(0);
        let cycle_profile = Self::analyze_cycles(adj);

        // 1. Bipartiteness: χ ≤ 2, so χ ≥ 3 is impossible. Catches graphs the
        //    degeneracy check cannot (e.g. K_{3,3} is 3-degenerate, χ = 2).
        if cycle_profile.is_bipartite && claimed_bound >= 3 {
            return Err(SanityError::BipartiteViolation {
                vertex_count: n,
                claimed_bound,
            });
        }

        // 2. Degeneracy Invariant: d-degenerate ⟹ χ(G) ≤ d + 1.
        let degeneracy = Self::compute_degeneracy(adj);
        let provable_colorable = degeneracy + 1;
        if provable_colorable < claimed_bound {
            return Err(SanityError::DegeneracyViolation {
                degeneracy,
                avg_degree,
                provable_colorable,
                claimed_bound,
            });
        }

        // 3. Brooks' Invariant, sharpened: a component that is neither a
        //    complete graph nor an odd cycle satisfies χ ≤ Δ. The plain bound
        //    χ ≤ Δ + 1 always holds; the sharp bound replaces it where legal.
        let brooks_bound = max_degree + 1;
        let sharp_bound = sharp_brooks_bound(adj);
        if sharp_bound < claimed_bound {
            return Err(SanityError::BrooksViolation {
                max_degree,
                min_required_degree: claimed_bound.saturating_sub(1),
                claimed_bound,
                sharp: sharp_bound < brooks_bound,
            });
        }

        let k_cores = Self::compute_k_core_decomposition(adj);
        let mut k_core_sizes = HashMap::new();
        for (k, v_list) in k_cores {
            k_core_sizes.insert(k, v_list.len());
        }

        // 4. Turán confirmation: E > ex(n, K_r) forces K_r ⊂ G, hence χ ≥ r.
        let turan_forced = largest_forced_clique(adj, num_edges);

        Ok(SanityCertificate {
            vertex_count: n,
            edge_count: num_edges,
            avg_degree,
            max_degree,
            degeneracy,
            k_core_sizes,
            triangle_free: cycle_profile.triangle_free,
            is_bipartite: cycle_profile.is_bipartite,
            brooks_bound,
            sharp_brooks_bound: sharp_bound,
            turan_forced_clique_bound: turan_forced,
            passed: true,
        })
    }
}

/// Connected components via BFS.
fn connected_components(adj: &[HashSet<usize>]) -> Vec<Vec<usize>> {
    let n = adj.len();
    let mut seen = vec![false; n];
    let mut comps = Vec::new();
    for start in 0..n {
        if seen[start] {
            continue;
        }
        seen[start] = true;
        let mut comp = Vec::new();
        let mut queue = VecDeque::from(vec![start]);
        while let Some(u) = queue.pop_front() {
            comp.push(u);
            for &v in &adj[u] {
                if !seen[v] {
                    seen[v] = true;
                    queue.push_back(v);
                }
            }
        }
        comps.push(comp);
    }
    comps
}

/// Sharp Brooks bound: max over components of (Δ if the component is neither
/// a complete graph nor an odd cycle, else Δ + 1). Always ≤ plain Δ + 1.
fn sharp_brooks_bound(adj: &[HashSet<usize>]) -> usize {
    let mut bound = 0;
    for comp in connected_components(adj) {
        let n_c = comp.len();
        let edges_c = comp.iter().map(|&v| adj[v].len()).sum::<usize>() / 2;
        let delta_c = comp.iter().map(|&v| adj[v].len()).max().unwrap_or(0);

        let is_complete = edges_c == n_c * (n_c - 1) / 2; // K_1 counts as complete
        let is_odd_cycle = n_c >= 3 && n_c % 2 == 1 && comp.iter().all(|&v| adj[v].len() == 2);

        let b = if is_complete || is_odd_cycle {
            delta_c + 1
        } else {
            delta_c
        };
        bound = bound.max(b);
    }
    bound
}

/// Turán's theorem, exact integral form:
/// ex(n, K_r) = ((r − 2)(n² − s²) + (r − 1)·s(s − 1)) / (2(r − 1))
/// where n = q(r − 1) + s. Max edges in a K_r-free graph on n vertices.
fn turan_max_edges(n: usize, clique: usize) -> u128 {
    if clique <= 2 {
        return 0; // ex(n, K_1) = ex(n, K_2) = 0
    }
    let n = n as u128;
    let parts = (clique - 1) as u128; // balanced partition into r − 1 parts
    let s = n % parts; // 0 ≤ s < parts; s(s − 1) = 0 when s = 0
    ((parts - 1) * (n * n - s * s) + parts * s * s.saturating_sub(1)) / (2 * parts)
}

/// Largest r ≥ 3 with E > ex(n, K_r): Turán forces K_r ⊂ G ⟹ χ ≥ r.
/// None when no clique is forced.
fn largest_forced_clique(adj: &[HashSet<usize>], num_edges: usize) -> Option<usize> {
    let n = adj.len();
    let e = num_edges as u128;
    let mut best = None;
    for r in 3..=n {
        if e > turan_max_edges(n, r) {
            best = Some(r);
        } else {
            break; // ex(n, K_r) is non-decreasing in r
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use num_rational::BigRational;
    use num_traits::Zero;

    #[test]
    fn test_degeneracy_catches_flawed_22_vertex_graph() {
        // Build 22-vertex, 30-edge graph (d_avg = 2.727)
        let mut adj = vec![HashSet::new(); 22];

        // 8-star from center 0
        for i in 1..=8 {
            adj[0].insert(i);
            adj[i].insert(0);
        }

        // Some intermediate edges (total 30 edges)
        for i in 1..=8 {
            let nxt = if i == 8 { 1 } else { i + 1 };
            adj[i].insert(nxt);
            adj[nxt].insert(i);
        }

        for i in 9..22 {
            adj[i % 8 + 1].insert(i);
            adj[i].insert(i % 8 + 1);
        }

        // Check claim of χ ≥ 5
        let res = GraphSanityChecker::verify_chromatic_bound(&adj, 5);
        assert!(res.is_err(), "Must reject χ ≥ 5 on 3-degenerate graph");

        match res.err().unwrap() {
            SanityError::DegeneracyViolation { provable_colorable, .. } => {
                assert!(provable_colorable <= 4, "Provable coloring must be <= 4");
            }
            other => panic!("Expected DegeneracyViolation, got: {:?}", other),
        }
    }

    #[test]
    fn test_valid_bipartite_graph_passes_chi_ge_2() {
        let mut adj = vec![HashSet::new(); 4];
        // C_4: 0-1-2-3-0 (Bipartite, χ = 2)
        adj[0].insert(1); adj[1].insert(0);
        adj[1].insert(2); adj[2].insert(1);
        adj[2].insert(3); adj[3].insert(2);
        adj[3].insert(0); adj[0].insert(3);

        let cert = GraphSanityChecker::verify_chromatic_bound(&adj, 2).unwrap();
        assert!(cert.is_bipartite);
        assert!(cert.triangle_free);
        assert_eq!(cert.degeneracy, 2);
    }

    /// Complete bipartite K_{3,3}: χ = 2 exactly, but degeneracy 3 means the
    /// degeneracy check alone would admit a claim of χ ≥ 4.
    #[test]
    fn test_bipartite_k33_rejects_chi_ge_3() {
        let mut adj = vec![HashSet::new(); 6];
        for u in 0..3 {
            for v in 3..6 {
                adj[u].insert(v);
                adj[v].insert(u);
            }
        }

        let res = GraphSanityChecker::verify_chromatic_bound(&adj, 3);
        match res {
            Err(SanityError::BipartiteViolation { vertex_count, claimed_bound }) => {
                assert_eq!(vertex_count, 6);
                assert_eq!(claimed_bound, 3);
            }
            other => panic!("K_3,3 must reject χ ≥ 3 as bipartite, got: {:?}", other),
        }

        // Claim χ ≥ 2 on the same graph is consistent (χ = 2 exactly)
        let cert = GraphSanityChecker::verify_chromatic_bound(&adj, 2).unwrap();
        assert!(cert.is_bipartite);
        assert!(cert.triangle_free);
    }

    /// Petersen graph: 3-regular, connected, not complete, not an odd cycle.
    /// Sharp Brooks' theorem gives χ ≤ Δ = 3, so χ ≥ 4 must be rejected even
    /// though the degeneracy bound (χ ≤ d + 1 = 4) admits it.
    fn petersen_adjacency() -> Vec<HashSet<usize>> {
        let mut adj = vec![HashSet::new(); 10];
        // outer 5-cycle 0..5
        for i in 0..5 {
            let j = (i + 1) % 5;
            adj[i].insert(j);
            adj[j].insert(i);
        }
        // inner pentagram 5..10
        for i in 0..5 {
            let j = 5 + (i + 2) % 5;
            adj[5 + i].insert(j);
            adj[j].insert(5 + i);
        }
        // spokes
        for i in 0..5 {
            adj[i].insert(5 + i);
            adj[5 + i].insert(i);
        }
        adj
    }

    #[test]
    fn test_sharp_brooks_rejects_petersen_chi_ge_4() {
        let adj = petersen_adjacency();

        let res = GraphSanityChecker::verify_chromatic_bound(&adj, 4);
        match res {
            Err(SanityError::BrooksViolation { max_degree, sharp, .. }) => {
                assert_eq!(max_degree, 3);
                assert!(sharp, "Petersen is not complete and not an odd cycle, so the sharp bound χ ≤ Δ applies");
            }
            other => panic!("Petersen must reject χ ≥ 4 via sharp Brooks, got: {:?}", other),
        }

        // χ = 3 for Petersen: claim χ ≥ 3 is consistent and must pass
        let cert = GraphSanityChecker::verify_chromatic_bound(&adj, 3).unwrap();
        assert_eq!(cert.degeneracy, 3);
        assert_eq!(cert.sharp_brooks_bound, 3);
    }

    /// C_5: Δ = 2 but χ = 3 — the odd-cycle exception to sharp Brooks must
    /// NOT reject a consistent claim.
    #[test]
    fn test_odd_cycle_c5_passes_chi_ge_3() {
        let mut adj = vec![HashSet::new(); 5];
        for i in 0..5 {
            let j = (i + 1) % 5;
            adj[i].insert(j);
            adj[j].insert(i);
        }

        let cert = GraphSanityChecker::verify_chromatic_bound(&adj, 3).unwrap();
        assert_eq!(cert.degeneracy, 2);
        assert_eq!(cert.sharp_brooks_bound, 3, "odd cycle keeps the non-sharp bound");
        assert!(!cert.is_bipartite);
        assert!(cert.triangle_free);

        // χ ≥ 4 on C_5 is impossible (degeneracy 2 ⟹ χ ≤ 3)
        assert!(GraphSanityChecker::verify_chromatic_bound(&adj, 4).is_err());
    }

    /// Turán's theorem: E > ex(n, K_r) forces a K_r subgraph and hence χ ≥ r.
    /// K_6: E = 15 = ex(6, K_6), but 15 > ex(6, K_5) = 14 and the graph is
    /// complete, so the certificate must confirm a forced clique of size 6.
    #[test]
    fn test_turan_forced_clique_bound() {
        // K_6
        let mut k6 = vec![HashSet::new(); 6];
        for u in 0..6 {
            for v in (u + 1)..6 {
                k6[u].insert(v);
                k6[v].insert(u);
            }
        }
        let cert = GraphSanityChecker::verify_chromatic_bound(&k6, 6).unwrap();
        assert_eq!(cert.turan_forced_clique_bound, Some(6));

        // C_5: 5 edges, ex(5, K_3) = 6 — nothing forced
        let mut c5 = vec![HashSet::new(); 5];
        for i in 0..5 {
            let j = (i + 1) % 5;
            c5[i].insert(j);
            c5[j].insert(i);
        }
        let cert = GraphSanityChecker::verify_chromatic_bound(&c5, 3).unwrap();
        assert_eq!(cert.turan_forced_clique_bound, None);

        // K_5 minus nothing: E = 10 > ex(5, K_5) = 6 forces K_5 itself
        let mut k5 = vec![HashSet::new(); 5];
        for u in 0..5 {
            for v in (u + 1)..5 {
                k5[u].insert(v);
                k5[v].insert(u);
            }
        }
        let cert = GraphSanityChecker::verify_chromatic_bound(&k5, 5).unwrap();
        assert_eq!(cert.turan_forced_clique_bound, Some(5));
    }

    /// A K_4 claim of χ ≥ 5 is rejected by degeneracy (3-degenerate ⟹ χ ≤ 4),
    /// while χ ≥ 4 passes.
    #[test]
    fn test_complete_k4_chi_bounds() {
        let mut k4 = vec![HashSet::new(); 4];
        for u in 0..4 {
            for v in (u + 1)..4 {
                k4[u].insert(v);
                k4[v].insert(u);
            }
        }

        assert!(GraphSanityChecker::verify_chromatic_bound(&k4, 5).is_err());
        let cert = GraphSanityChecker::verify_chromatic_bound(&k4, 4).unwrap();
        assert_eq!(cert.degeneracy, 3);
        assert_eq!(cert.sharp_brooks_bound, 4, "complete graph keeps the non-sharp bound");
        assert_eq!(cert.turan_forced_clique_bound, Some(4));
    }

    /// Empty graph edge cases: χ ≥ 1 impossible on zero vertices, but the
    /// vacuous claim χ ≥ 0 is consistent.
    #[test]
    fn test_empty_graph_chi_bounds() {
        let empty: Vec<HashSet<usize>> = vec![];
        assert!(GraphSanityChecker::verify_chromatic_bound(&empty, 1).is_err());
        let cert = GraphSanityChecker::verify_chromatic_bound(&empty, 0).unwrap();
        assert!(cert.passed);
    }

    /// End-to-end Stage 0 integration over the generic algebraic engine:
    /// an equilateral unit-distance triangle in ℚ(√3)² has χ = 3 exactly.
    /// A star in ℚ(√3)² is bipartite and must reject χ ≥ 3.
    #[test]
    fn test_integration_algebraic_unit_distance_graphs() {
        use crate::domain_synth::{AlgebraicNumber, AlgebraicNumberField, Point2DAlgebraic};

        let q_sqrt3 = AlgebraicNumberField::from_spec("QQ[sqrt(3)]").unwrap();
        let half = BigRational::new(1.into(), 2.into());
        let half_sqrt3 = AlgebraicNumber::new(vec![BigRational::zero(), half.clone()], q_sqrt3.clone());

        // Triangle: (0,0), (1,0), (1/2, √3/2)
        let pts = [
            Point2DAlgebraic::origin(q_sqrt3.clone()),
            Point2DAlgebraic::new(
                AlgebraicNumber::from_integers(&[1, 0], q_sqrt3.clone()),
                AlgebraicNumber::zero(q_sqrt3.clone()),
            ),
            Point2DAlgebraic::new(
                AlgebraicNumber::new(vec![half.clone(), BigRational::zero()], q_sqrt3.clone()),
                half_sqrt3,
            ),
        ];

        let mut adj = vec![HashSet::new(); 3];
        for i in 0..3 {
            for j in (i + 1)..3 {
                if pts[i].is_unit_distance(&pts[j]) {
                    adj[i].insert(j);
                    adj[j].insert(i);
                }
            }
        }
        assert_eq!(adj.iter().map(|s| s.len()).sum::<usize>() / 2, 3, "equilateral triangle has 3 unit edges");

        let cert = GraphSanityChecker::verify_chromatic_bound(&adj, 3).unwrap();
        assert_eq!(cert.turan_forced_clique_bound, Some(3));
        assert!(GraphSanityChecker::verify_chromatic_bound(&adj, 4).is_err());

        // Bipartite star centered at origin with unit spokes to (1,0) and (0,1)
        // (leaves must NOT be unit-distance from each other)
        let star_pts = [
            Point2DAlgebraic::origin(q_sqrt3.clone()),
            Point2DAlgebraic::new(
                AlgebraicNumber::from_integers(&[1, 0], q_sqrt3.clone()),
                AlgebraicNumber::zero(q_sqrt3.clone()),
            ),
            Point2DAlgebraic::new(
                AlgebraicNumber::zero(q_sqrt3.clone()),
                AlgebraicNumber::from_integers(&[1, 0], q_sqrt3.clone()),
            ),
        ];
        let mut adj2 = vec![HashSet::new(); 3];
        for i in 0..3 {
            for j in (i + 1)..3 {
                if star_pts[i].is_unit_distance(&star_pts[j]) {
                    adj2[i].insert(j);
                    adj2[j].insert(i);
                }
            }
        }
        match GraphSanityChecker::verify_chromatic_bound(&adj2, 3) {
            Err(SanityError::BipartiteViolation { .. }) => {}
            other => panic!("star in Q(sqrt(3))^2 must reject χ ≥ 3 as bipartite, got: {:?}", other),
        }
    }
}
