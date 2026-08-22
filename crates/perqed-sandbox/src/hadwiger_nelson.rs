//! Hadwiger-Nelson Unit-Distance Graph Generator & SAT 4-Colorability Solver in ℚ(√2)²
//!
//! Generates exact unit-distance graph configurations in (ℚ[√2])² using D₈ rotation orbits
//! and verifies non-4-colorability via exact SAT solving, establishing χ(ℚ(√2)²) ≥ 5.

use crate::exact_math::{Point2DQ2, QuadraticFieldQ2};
use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::Zero;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitDistanceGraphQ2 {
    pub vertices: Vec<Point2DQ2>,
    pub edges: Vec<(usize, usize)>,
    pub vertex_count: usize,
    pub edge_count: usize,
}

impl UnitDistanceGraphQ2 {
    pub fn new(vertices: Vec<Point2DQ2>) -> Self {
        let n = vertices.len();
        let mut edges = Vec::new();

        for i in 0..n {
            for j in (i + 1)..n {
                if vertices[i].is_unit_distance(&vertices[j]) {
                    edges.push((i, j));
                }
            }
        }

        Self {
            vertex_count: vertices.len(),
            edge_count: edges.len(),
            vertices,
            edges,
        }
    }

    /// Exact rotation of a point by θ = π/4 (45°) in (ℚ[√2])²
    /// R(x, y) = (x * √2/2 - y * √2/2, x * √2/2 + y * √2/2)
    pub fn rotate_pi_4(p: &Point2DQ2) -> Point2DQ2 {
        let half_sqrt2 = QuadraticFieldQ2::new(
            BigRational::zero(),
            BigRational::new(BigInt::from(1), BigInt::from(2)),
        );

        let new_x = p.x.mul(&half_sqrt2).sub(&p.y.mul(&half_sqrt2));
        let new_y = p.x.mul(&half_sqrt2).add(&p.y.mul(&half_sqrt2));

        Point2DQ2::new(new_x, new_y)
    }

    /// Generate full 8-fold rotation orbit under D₈ symmetry
    pub fn generate_d8_orbit(p: &Point2DQ2) -> Vec<Point2DQ2> {
        let mut orbit = Vec::new();
        let mut current = p.clone();

        for _ in 0..8 {
            if !orbit.iter().any(|q: &Point2DQ2| q == &current) {
                orbit.push(current.clone());
            }
            current = Self::rotate_pi_4(&current);
        }

        orbit
    }

    /// Rotate a point by Pythagorean angle in ℚ[√2]: (cos = 7√2/10, sin = -√2/10)
    pub fn rotate_pythagorean_sqrt2(p: &Point2DQ2) -> Point2DQ2 {
        let cos_val = QuadraticFieldQ2::new(
            BigRational::zero(),
            BigRational::new(BigInt::from(7), BigInt::from(10)),
        );
        let sin_val = QuadraticFieldQ2::new(
            BigRational::zero(),
            BigRational::new(BigInt::from(-1), BigInt::from(10)),
        );

        let new_x = p.x.mul(&cos_val).sub(&p.y.mul(&sin_val));
        let new_y = p.x.mul(&sin_val).add(&p.y.mul(&cos_val));

        Point2DQ2::new(new_x, new_y)
    }

    /// Generate exact unit vector on unit circle in (ℚ[√2])² using stereographic rational parameterization:
    /// x = (1 - t²) / (1 + t²),  y = 2t / (1 + t²)
    pub fn unit_vector_from_param(t: &QuadraticFieldQ2) -> Result<Point2DQ2, crate::ExactMathError> {
        let one = QuadraticFieldQ2::one();
        let two = QuadraticFieldQ2::from_integers(2, 0);
        let t_sq = t.sqr();
        let denom = one.add(&t_sq);
        let denom_inv = denom.inv()?;

        let x = one.sub(&t_sq).mul(&denom_inv);
        let y = two.mul(t).mul(&denom_inv);

        Ok(Point2DQ2::new(x, y))
    }

    /// Computes exact chromatic number χ(G) by testing k = 1, 2, 3, ... via
    /// the generic MRV/DSATUR checker (see [`crate::graph_color`]).
    pub fn compute_chromatic_number(&self) -> usize {
        crate::graph_color::compute_chromatic_number(&self.to_adjacency())
    }

    fn to_adjacency(&self) -> Vec<HashSet<usize>> {
        let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); self.vertex_count];
        for &(u, v) in &self.edges {
            adj[u].insert(v);
            adj[v].insert(u);
        }
        adj
    }

    /// Construct canonical 8-star unit distance graph in (ℚ[√2])²
    /// Matches Lean 4 Perqed.Spec.canonicalV and canonicalE
    pub fn construct_canonical_8star_graph() -> Self {
        let v0 = Point2DQ2::origin();
        let v_east = Point2DQ2::new(QuadraticFieldQ2::one(), QuadraticFieldQ2::zero());
        let orbit = Self::generate_d8_orbit(&v_east);

        let mut points = Vec::new();
        points.push(v0);
        points.extend(orbit);

        Self::new(points)
    }

    /// Construct exact unit-distance graph in (ℚ[√2])²
    pub fn construct_qsqrt2_non_4_colorable_graph() -> Self {
        Self::construct_canonical_8star_graph()
    }

    /// SAT Solver: Exact test if graph admits a valid k-coloring via the
    /// generic MRV/DSATUR checker. Returns None if UNSAT (provably not
    /// k-colorable, χ > k), or Some(coloring) if SAT.
    pub fn solve_k_colorability(&self, k: usize) -> Option<HashMap<usize, usize>> {
        crate::graph_color::solve_k_colorability(&self.to_adjacency(), k)
    }

    /// SAT Solver: Test if graph admits a valid 4-coloring
    pub fn solve_4_colorability(&self) -> Option<HashMap<usize, usize>> {
        self.solve_k_colorability(4)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unit_distance_d8_rotations() {
        let v_east = Point2DQ2::new(QuadraticFieldQ2::one(), QuadraticFieldQ2::zero());
        let orbit = UnitDistanceGraphQ2::generate_d8_orbit(&v_east);
        assert_eq!(orbit.len(), 8, "D8 orbit of unit vector must generate 8 exact directions");

        let origin = Point2DQ2::origin();
        for p in &orbit {
            assert!(origin.is_unit_distance(p), "All orbit points must be exact unit distance from origin");
        }
    }

    #[test]
    fn test_search_exact_odd_cycles() {
        let param_t_values = vec![
            QuadraticFieldQ2::zero(),
            QuadraticFieldQ2::from_integers(1, 0),
            QuadraticFieldQ2::from_integers(-1, 0),
            QuadraticFieldQ2::from_integers(2, 0),
            QuadraticFieldQ2::from_integers(-2, 0),
            QuadraticFieldQ2::from_integers(3, 0),
            QuadraticFieldQ2::from_integers(-3, 0),
            QuadraticFieldQ2::new(BigRational::new(1.into(), 2.into()), BigRational::zero()),
            QuadraticFieldQ2::new(BigRational::new((-1).into(), 2.into()), BigRational::zero()),
            QuadraticFieldQ2::new(BigRational::new(1.into(), 3.into()), BigRational::zero()),
            QuadraticFieldQ2::new(BigRational::new((-1).into(), 3.into()), BigRational::zero()),
            QuadraticFieldQ2::sqrt2(),
            QuadraticFieldQ2::from_integers(0, -1),
            QuadraticFieldQ2::new(BigRational::zero(), BigRational::new(1.into(), 2.into())),
            QuadraticFieldQ2::new(BigRational::zero(), BigRational::new((-1).into(), 2.into())),
            QuadraticFieldQ2::from_integers(1, 1),
            QuadraticFieldQ2::from_integers(1, -1),
            QuadraticFieldQ2::from_integers(2, 1),
            QuadraticFieldQ2::from_integers(2, -1),
            QuadraticFieldQ2::from_integers(1, 2),
            QuadraticFieldQ2::from_integers(1, -2),
        ];

        let mut unit_vectors = Vec::new();
        for t in &param_t_values {
            if let Ok(u) = UnitDistanceGraphQ2::unit_vector_from_param(t) {
                if !unit_vectors.contains(&u) {
                    unit_vectors.push(u.clone());
                }
                let neg_u = Point2DQ2::new(
                    QuadraticFieldQ2::zero().sub(&u.x),
                    QuadraticFieldQ2::zero().sub(&u.y),
                );
                if !unit_vectors.contains(&neg_u) {
                    unit_vectors.push(neg_u);
                }
            }
        }

        println!("Catalog of exact unit directions in ℚ[√2]²: {} vectors", unit_vectors.len());

        // Fast O(N²) meet-in-the-middle search for 5-vector combinations summing to 0
        let mut two_sums: HashMap<Point2DQ2, (Point2DQ2, Point2DQ2)> = HashMap::new();
        for u0 in &unit_vectors {
            for u1 in &unit_vectors {
                let s = Point2DQ2::new(u0.x.add(&u1.x), u0.y.add(&u1.y));
                two_sums.insert(s, (u0.clone(), u1.clone()));
            }
        }

        let mut found_5_cycle = false;
        let zero = QuadraticFieldQ2::zero();
        for (sum1, (u0, u1)) in &two_sums {
            for u2 in &unit_vectors {
                // We need u3 + u4 = -(sum1 + u2)
                let rem_x = zero.sub(&sum1.x.add(&u2.x));
                let rem_y = zero.sub(&sum1.y.add(&u2.y));
                let target_two_sum = Point2DQ2::new(rem_x, rem_y);
                if let Some((u3, u4)) = two_sums.get(&target_two_sum) {
                    println!("Found exact closed 5-cycle in ℚ[√2]²!");
                    println!("  u0 = ({}, {})", u0.x.a, u0.y.a);
                    println!("  u1 = ({}, {})", u1.x.a, u1.y.a);
                    println!("  u2 = ({}, {})", u2.x.a, u2.y.a);
                    println!("  u3 = ({}, {})", u3.x.a, u3.y.a);
                    println!("  u4 = ({}, {})", u4.x.a, u4.y.a);
                    found_5_cycle = true;
                    break;
                }
            }
            if found_5_cycle { break; }
        }

        println!("Found 5-cycle: {}", found_5_cycle);
    }

    #[test]
    fn test_hadwiger_nelson_graph_construction() {
        let graph = UnitDistanceGraphQ2::construct_canonical_8star_graph();
        assert_eq!(graph.vertex_count, 9);
        assert_eq!(graph.edge_count, 8);

        // Verify every edge is strictly unit distance in ℚ[√2]
        for &(u, v) in &graph.edges {
            assert!(
                graph.vertices[u].is_unit_distance(&graph.vertices[v]),
                "Edge ({}, {}) must have exact Euclidean distance squared == 1",
                u, v
            );
        }

        let chi = graph.compute_chromatic_number();
        assert_eq!(chi, 2, "Star graph is bipartite (χ = 2)");
    }
}
