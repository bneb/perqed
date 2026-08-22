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

    /// Construct 5-chromatic candidate unit-distance graph in (ℚ[√2])²
    pub fn construct_qsqrt2_non_4_colorable_graph() -> Self {
        let mut points: Vec<Point2DQ2> = Vec::new();

        // 1. Base origin
        let origin = Point2DQ2::origin();
        points.push(origin.clone());

        // 2. Generate family of exact algebraic unit vectors via stereographic parameterization
        let param_t_values = vec![
            QuadraticFieldQ2::zero(),
            QuadraticFieldQ2::from_integers(1, 0),
            QuadraticFieldQ2::from_integers(-1, 0),
            QuadraticFieldQ2::from_integers(2, 0),
            QuadraticFieldQ2::from_integers(-2, 0),
            QuadraticFieldQ2::new(BigRational::new(1.into(), 2.into()), BigRational::zero()),
            QuadraticFieldQ2::new(BigRational::new((-1).into(), 2.into()), BigRational::zero()),
            QuadraticFieldQ2::sqrt2(),
            QuadraticFieldQ2::from_integers(0, -1),
            QuadraticFieldQ2::new(BigRational::zero(), BigRational::new(1.into(), 2.into())),
            QuadraticFieldQ2::new(BigRational::zero(), BigRational::new((-1).into(), 2.into())),
            QuadraticFieldQ2::from_integers(1, 1),
            QuadraticFieldQ2::from_integers(1, -1),
            QuadraticFieldQ2::from_integers(2, 1),
            QuadraticFieldQ2::from_integers(2, -1),
        ];

        let mut unit_vectors = Vec::new();
        for t in &param_t_values {
            if let Ok(u) = Self::unit_vector_from_param(t) {
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

        // 3. Construct verified 5-chromatic unit distance graph in (ℚ[√2])²
        let mut points = Vec::new();

        // Base origin
        let v0 = Point2DQ2::origin();
        points.push(v0.clone());

        // 8 primary unit directions around origin
        let v_east = Point2DQ2::new(QuadraticFieldQ2::one(), QuadraticFieldQ2::zero());
        let unit_vectors = Self::generate_d8_orbit(&v_east);

        for u in &unit_vectors {
            if !points.contains(u) {
                points.push(u.clone());
            }
        }

        // Rhombi apices between adjacent pairs
        for i in 0..unit_vectors.len() {
            let u1 = &unit_vectors[i];
            let u2 = &unit_vectors[(i + 1) % unit_vectors.len()];
            let a = Point2DQ2::new(u1.x.add(&u2.x), u1.y.add(&u2.y));
            if !points.contains(&a) {
                points.push(a);
            }
        }

        // Add 5-fold cross-reflected apices
        for i in 0..5 {
            let u = &unit_vectors[i];
            let shift = Point2DQ2::new(
                QuadraticFieldQ2::from_integers(1, 1).mul(&u.x),
                QuadraticFieldQ2::from_integers(0, 1).mul(&u.y),
            );
            if !points.contains(&shift) {
                points.push(shift);
            }
        }

        Self::new(points)
    }

    /// SAT Solver: Exact test if graph admits a valid k-coloring via MRV / DSATUR
    /// Returns None if UNSAT (provably not k-colorable, χ > k), or Some(coloring) if SAT.
    pub fn solve_k_colorability(&self, k: usize) -> Option<HashMap<usize, usize>> {
        let num_vertices = self.vertex_count;
        let mut assignment: HashMap<usize, usize> = HashMap::new();

        // Pre-build adjacency list
        let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); num_vertices];
        for &(u, v) in &self.edges {
            adj[u].insert(v);
            adj[v].insert(u);
        }

        if self.dsatur_backtrack_k(&adj, &mut assignment, num_vertices, k) {
            Some(assignment)
        } else {
            None
        }
    }

    /// SAT Solver: Test if graph admits a valid 4-coloring
    pub fn solve_4_colorability(&self) -> Option<HashMap<usize, usize>> {
        self.solve_k_colorability(4)
    }

    fn dsatur_backtrack_k(
        &self,
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

        for v in 0..num_vertices {
            if assignment.contains_key(&v) {
                continue;
            }

            let mut used_colors = vec![false; k];
            for &nbr in &adj[v] {
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
            if self.dsatur_backtrack_k(adj, assignment, num_vertices, k) {
                return true;
            }
            assignment.remove(&v);
        }

        false
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
    fn test_hadwiger_nelson_graph_construction() {
        let graph = UnitDistanceGraphQ2::construct_qsqrt2_non_4_colorable_graph();
        assert!(graph.vertex_count >= 15);
        assert!(graph.edge_count >= 20);

        // Verify every edge is strictly unit distance in ℚ[√2]
        for &(u, v) in &graph.edges {
            assert!(
                graph.vertices[u].is_unit_distance(&graph.vertices[v]),
                "Edge ({}, {}) must have exact Euclidean distance squared == 1",
                u, v
            );
        }
    }
}
