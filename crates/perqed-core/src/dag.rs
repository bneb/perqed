//! Mathlib Dependency DAG & Topological Index
//!
//! Maintains a directed acyclic graph of Mathlib 4 definitions, lemmas,
//! instances, and algebraic structures for topological novelty, unification scoring,
//! and semantic premise retrieval.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MathlibNode {
    pub name: String,
    pub module: String,
    pub domain: String,
    pub is_definition: bool,
    pub statement: String,
    pub dependencies: Vec<String>,
}

/// Configuration parameters for DAG topological distance and novelty scoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagScoringConfig {
    pub disconnected_default_distance: usize,
    pub initial_best_distance: f64,
    pub max_distance_normalization: f64,
    pub min_novelty_distance: f64,
    pub max_novelty_distance: f64,
    pub empty_premise_default_novelty: f64,
}

impl Default for DagScoringConfig {
    fn default() -> Self {
        Self {
            disconnected_default_distance: 15,
            initial_best_distance: 10.0,
            max_distance_normalization: 10.0,
            min_novelty_distance: 0.1,
            max_novelty_distance: 1.0,
            empty_premise_default_novelty: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MathlibDag {
    nodes: HashMap<String, MathlibNode>,
    adjacency: HashMap<String, Vec<String>>,       // from dependency -> dependents
    reverse_adj: HashMap<String, Vec<String>>,     // from dependent -> dependencies
    pub config: DagScoringConfig,
}

impl Default for MathlibDag {
    fn default() -> Self {
        Self::new()
    }
}

impl MathlibDag {
    pub fn new() -> Self {
        Self::with_config(DagScoringConfig::default())
    }

    pub fn with_config(config: DagScoringConfig) -> Self {
        let mut dag = Self {
            nodes: HashMap::new(),
            adjacency: HashMap::new(),
            reverse_adj: HashMap::new(),
            config,
        };
        dag.populate_default_mathlib_dag();
        dag
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    pub fn insert_node(&mut self, node: MathlibNode) {
        let name = node.name.clone();
        for dep in &node.dependencies {
            self.adjacency.entry(dep.clone()).or_default().push(name.clone());
            self.reverse_adj.entry(name.clone()).or_default().push(dep.clone());
        }
        self.nodes.insert(name, node);
    }

    /// Finds relevant Mathlib premises matching a target proof goal using token overlap and semantic domain weighting
    pub fn find_relevant_premises(&self, goal: &str, top_k: usize) -> Vec<String> {
        let g_lower = goal.to_lowercase();
        let query_tokens: Vec<&str> = g_lower
            .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '.')
            .filter(|s| s.len() > 1)
            .collect();

        let mut scored: Vec<(f64, &str)> = Vec::new();

        for (name, node) in &self.nodes {
            let mut score = 0.0;
            let name_lower = name.to_lowercase();
            let stmt_lower = node.statement.to_lowercase();
            let domain_lower = node.domain.to_lowercase();

            for tok in &query_tokens {
                if name_lower.contains(tok) {
                    score += 5.0;
                }
                if stmt_lower.contains(tok) {
                    score += 3.0;
                }
                if domain_lower.contains(tok) {
                    score += 2.0;
                }
            }

            // Bonus for direct algebraic concept matching
            if (g_lower.contains("add") || g_lower.contains("+")) && name_lower.contains("add") {
                score += 4.0;
            }
            if (g_lower.contains("mul") || g_lower.contains("*")) && name_lower.contains("mul") {
                score += 4.0;
            }
            if (g_lower.contains("graph") || g_lower.contains("chromatic") || g_lower.contains("color")) && domain_lower.contains("graph") {
                score += 6.0;
            }
            if (g_lower.contains("series") || g_lower.contains("sum") || g_lower.contains("limsup")) && domain_lower.contains("analysis") {
                score += 6.0;
            }

            if score > 0.0 {
                scored.push((score, name.as_str()));
            }
        }

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(top_k).map(|(_, name)| name.to_string()).collect()
    }

    /// Computes the shortest graph distance between two declarations in Mathlib
    pub fn topological_distance(&self, start: &str, target: &str) -> usize {
        if start == target {
            return 0;
        }

        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();

        queue.push_back((start.to_string(), 0));
        visited.insert(start.to_string());

        while let Some((curr, dist)) = queue.pop_front() {
            if curr == target {
                return dist;
            }

            // Check outgoing and incoming edges for undirected semantic proximity
            let mut neighbors = Vec::new();
            if let Some(out_edges) = self.adjacency.get(&curr) {
                neighbors.extend(out_edges.clone());
            }
            if let Some(in_edges) = self.reverse_adj.get(&curr) {
                neighbors.extend(in_edges.clone());
            }

            for nbr in neighbors {
                if visited.insert(nbr.clone()) {
                    queue.push_back((nbr, dist + 1));
                }
            }
        }

        // Return large default distance if disconnected in subgraph
        self.config.disconnected_default_distance
    }

    /// Computes the average topological distance from a set of premise keywords to the Mathlib DAG
    pub fn compute_novelty_distance(&self, premise_names: &[String]) -> f64 {
        if premise_names.is_empty() {
            return self.config.empty_premise_default_novelty;
        }

        let mut min_distances = Vec::new();
        for name in premise_names {
            if self.nodes.contains_key(name) {
                min_distances.push(0.0);
            } else {
                let mut best_d = self.config.initial_best_distance;
                for existing_name in self.nodes.keys() {
                    let d = self.topological_distance(name, existing_name) as f64;
                    if d < best_d {
                        best_d = d;
                    }
                }
                min_distances.push(best_d);
            }
        }

        let avg = min_distances.iter().sum::<f64>() / (min_distances.len() as f64);
        (avg / self.config.max_distance_normalization)
            .min(self.config.max_novelty_distance)
            .max(self.config.min_novelty_distance)
    }

    /// Estimates the number of existing Mathlib theorems that would be unified/implied
    pub fn estimate_unification_count(&self, domain: &str) -> usize {
        let domain_lower = domain.to_lowercase();
        self.nodes
            .values()
            .filter(|n| n.domain.to_lowercase().contains(&domain_lower) || n.module.to_lowercase().contains(&domain_lower))
            .count()
    }

    fn populate_default_mathlib_dag(&mut self) {
        let core_nodes = vec![
            MathlibNode {
                name: "Init.Core".to_string(),
                module: "Init".to_string(),
                domain: "logic.core".to_string(),
                is_definition: true,
                statement: "Core logical primitives and basic propositions".to_string(),
                dependencies: vec![],
            },
            MathlibNode {
                name: "Mathlib.Logic.Basic".to_string(),
                module: "Logic".to_string(),
                domain: "logic".to_string(),
                is_definition: false,
                statement: "Basic propositional logic theorems, de Morgan laws, and classical principles".to_string(),
                dependencies: vec!["Init.Core".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Data.Nat.Basic".to_string(),
                module: "Data.Nat".to_string(),
                domain: "algebra.nat".to_string(),
                is_definition: false,
                statement: "Natural number arithmetic, Nat.add_comm, Nat.add_assoc, and induction".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Nat.add_comm".to_string(),
                module: "Data.Nat".to_string(),
                domain: "algebra.nat".to_string(),
                is_definition: false,
                statement: "∀ a b : ℕ, a + b = b + a".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Nat.add_assoc".to_string(),
                module: "Data.Nat".to_string(),
                domain: "algebra.nat".to_string(),
                is_definition: false,
                statement: "∀ a b c : ℕ, (a + b) + c = a + (b + c)".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Nat.add_zero".to_string(),
                module: "Data.Nat".to_string(),
                domain: "algebra.nat".to_string(),
                is_definition: false,
                statement: "∀ a : ℕ, a + 0 = a".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Algebra.Group.Basic".to_string(),
                module: "Algebra.Group".to_string(),
                domain: "algebra.group".to_string(),
                is_definition: true,
                statement: "Group theory structures, AddCommGroup, and abelian identities".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Algebra.Ring.Basic".to_string(),
                module: "Algebra.Ring".to_string(),
                domain: "algebra.ring".to_string(),
                is_definition: true,
                statement: "Ring theory axioms, distributivity, and field structures".to_string(),
                dependencies: vec!["Mathlib.Algebra.Group.Basic".to_string(), "Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.SimpleGraph.Basic".to_string(),
                module: "Combinatorics.SimpleGraph".to_string(),
                domain: "combinatorics.graph".to_string(),
                is_definition: true,
                statement: "Simple graph theory, vertex colorings, chromatic number, and cliques".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.SimpleGraph.Coloring".to_string(),
                module: "Combinatorics.SimpleGraph.Coloring".to_string(),
                domain: "combinatorics.graph".to_string(),
                is_definition: false,
                statement: "Proper vertex colorings and SimpleGraph.chromaticNumber lower bounds".to_string(),
                dependencies: vec!["Mathlib.Combinatorics.SimpleGraph.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.CapSet".to_string(),
                module: "Combinatorics".to_string(),
                domain: "combinatorics.extremal".to_string(),
                is_definition: false,
                statement: "Cap-set problem bounds in affine vector spaces F_3^n".to_string(),
                dependencies: vec!["Mathlib.Algebra.Ring.Basic".to_string(), "Mathlib.Combinatorics.SimpleGraph.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Analysis.Calculus.Deriv.Basic".to_string(),
                module: "Analysis.Calculus".to_string(),
                domain: "analysis.calculus".to_string(),
                is_definition: true,
                statement: "Fréchet and real derivatives, chain rule, and mean value theorem".to_string(),
                dependencies: vec!["Mathlib.Algebra.Ring.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Topology.MetricSpace.Basic".to_string(),
                module: "Topology.MetricSpace".to_string(),
                domain: "topology.metric".to_string(),
                is_definition: true,
                statement: "Metric spaces, triangle inequality, Cauchy sequences, and completeness".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Topology.Order.Basic".to_string(),
                module: "Topology.Order".to_string(),
                domain: "topology.order".to_string(),
                is_definition: false,
                statement: "Limsup, liminf, and monotone convergence on conditionally complete lattices".to_string(),
                dependencies: vec!["Mathlib.Topology.MetricSpace.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Data.Real.Basic".to_string(),
                module: "Data.Real".to_string(),
                domain: "analysis.real".to_string(),
                is_definition: true,
                statement: "Real number construction, Dedekind cuts, and Archimedean property".to_string(),
                dependencies: vec!["Mathlib.Algebra.Ring.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.LinearAlgebra.Matrix.Spectrum".to_string(),
                module: "LinearAlgebra.Matrix".to_string(),
                domain: "linear_algebra.spectral".to_string(),
                is_definition: false,
                statement: "Spectral theorem for self-adjoint matrices and Rayleigh quotient bounds".to_string(),
                dependencies: vec!["Mathlib.Algebra.Ring.Basic".to_string(), "Mathlib.Data.Real.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.NumberTheory.Zaremba".to_string(),
                module: "NumberTheory.ContinuedFractions".to_string(),
                domain: "number_theory.cf".to_string(),
                is_definition: false,
                statement: "Bounded partial quotients in continued fractions and Zaremba conjecture".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string(), "Mathlib.Algebra.Ring.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Data.Complex.Basic".to_string(),
                module: "Data.Complex".to_string(),
                domain: "analysis.complex".to_string(),
                is_definition: true,
                statement: "Complex plane, Euler formula, roots of unity, and cyclotomic polynomials".to_string(),
                dependencies: vec!["Mathlib.Data.Real.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Analysis.SpecialFunctions.Pow.Real".to_string(),
                module: "Analysis.SpecialFunctions".to_string(),
                domain: "analysis.special".to_string(),
                is_definition: false,
                statement: "Real exponentiation, logarithmic bounds, and power series convergence".to_string(),
                dependencies: vec!["Mathlib.Data.Real.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Order.Filter.Basic".to_string(),
                module: "Order.Filter".to_string(),
                domain: "order.filter".to_string(),
                is_definition: true,
                statement: "Filters, atTop limits, convergence of sequences, and ultrafilters".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.Ramsey".to_string(),
                module: "Combinatorics.Ramsey".to_string(),
                domain: "combinatorics.extremal".to_string(),
                is_definition: false,
                statement: "Ramsey's theorem for complete graphs and hypergraphs".to_string(),
                dependencies: vec!["Mathlib.Combinatorics.SimpleGraph.Basic".to_string()],
            },
        ];

        for node in core_nodes {
            self.insert_node(node);
        }
    }
}
