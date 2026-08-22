//! Mathlib Dependency DAG & Topological Index
//!
//! Maintains a directed acyclic graph of Mathlib 4 definitions, lemmas,
//! instances, and algebraic structures for topological novelty and unification scoring.

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MathlibDag {
    nodes: HashMap<String, MathlibNode>,
    adjacency: HashMap<String, Vec<String>>,       // from dependency -> dependents
    reverse_adj: HashMap<String, Vec<String>>,     // from dependent -> dependencies
}

impl MathlibDag {
    pub fn new() -> Self {
        let mut dag = Self {
            nodes: HashMap::new(),
            adjacency: HashMap::new(),
            reverse_adj: HashMap::new(),
        };
        dag.populate_default_mathlib_dag();
        dag
    }

    pub fn insert_node(&mut self, node: MathlibNode) {
        let name = node.name.clone();
        for dep in &node.dependencies {
            self.adjacency.entry(dep.clone()).or_default().push(name.clone());
            self.reverse_adj.entry(name.clone()).or_default().push(dep.clone());
        }
        self.nodes.insert(name, node);
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
        15
    }

    /// Computes the average topological distance from a set of premise keywords to the Mathlib DAG
    pub fn compute_novelty_distance(&self, premise_names: &[String]) -> f64 {
        if premise_names.is_empty() {
            return 1.0;
        }

        let mut min_distances = Vec::new();
        for name in premise_names {
            if self.nodes.contains_key(name) {
                min_distances.push(0.0);
            } else {
                // Find distance to closest known ancestor/concept in same domain
                let mut best_d = 10.0;
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
        (avg / 10.0).min(1.0).max(0.1)
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
                statement: "Core logical primitives".to_string(),
                dependencies: vec![],
            },
            MathlibNode {
                name: "Mathlib.Logic.Basic".to_string(),
                module: "Logic".to_string(),
                domain: "logic".to_string(),
                is_definition: false,
                statement: "Basic propositional logic theorems".to_string(),
                dependencies: vec!["Init.Core".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Data.Nat.Basic".to_string(),
                module: "Data.Nat".to_string(),
                domain: "algebra.nat".to_string(),
                is_definition: false,
                statement: "Natural number arithmetic and commutativity".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Algebra.Group.Basic".to_string(),
                module: "Algebra.Group".to_string(),
                domain: "algebra.group".to_string(),
                is_definition: true,
                statement: "Group theory structures and identities".to_string(),
                dependencies: vec!["Mathlib.Logic.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Algebra.Ring.Basic".to_string(),
                module: "Algebra.Ring".to_string(),
                domain: "algebra.ring".to_string(),
                is_definition: true,
                statement: "Ring theory axioms and distributivity".to_string(),
                dependencies: vec!["Mathlib.Algebra.Group.Basic".to_string(), "Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.SimpleGraph.Basic".to_string(),
                module: "Combinatorics.SimpleGraph".to_string(),
                domain: "combinatorics.graph".to_string(),
                is_definition: true,
                statement: "Simple graph theory and vertex colorings".to_string(),
                dependencies: vec!["Mathlib.Data.Nat.Basic".to_string()],
            },
            MathlibNode {
                name: "Mathlib.Combinatorics.CapSet".to_string(),
                module: "Combinatorics".to_string(),
                domain: "combinatorics.extremal".to_string(),
                is_definition: false,
                statement: "Cap-set problem bounds in affine vector spaces".to_string(),
                dependencies: vec!["Mathlib.Algebra.Ring.Basic".to_string(), "Mathlib.Combinatorics.SimpleGraph.Basic".to_string()],
            },
        ];

        for node in core_nodes {
            self.insert_node(node);
        }
    }
}
