//! Constrained Conjecture & Invariant Synthesis Engine
//!
//! Replaces unconstrained natural language prompts with structured search over
//! programmatic invariants, extremal bounding functions, and integer sequence databases (OEIS).

use crate::types::Conjecture;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OeisSequence {
    pub id: String,
    pub name: String,
    pub terms: Vec<i64>,
    pub formula: Option<String>,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundCandidate {
    pub variable: String,
    pub expression: String,
    pub asymptotic_class: String, // e.g. "O(n^2)", "O(2^n)", "O(n log n)"
    pub empirical_error: f64,
}

pub struct ProgramInvariantSearch {
    oeis_db: Vec<OeisSequence>,
}

impl ProgramInvariantSearch {
    pub fn new() -> Self {
        let mut searcher = Self { oeis_db: Vec::new() };
        searcher.populate_core_oeis();
        searcher
    }

    /// Match a generated numeric table against known integer sequences
    pub fn match_sequence(&self, terms: &[i64]) -> Vec<(&OeisSequence, usize)> {
        let mut matches = Vec::new();
        if terms.len() < 3 {
            return matches;
        }

        for seq in &self.oeis_db {
            if let Some(pos) = seq.terms.windows(terms.len()).position(|w| w == terms) {
                matches.push((seq, pos));
            }
        }
        matches
    }

    /// Synthesizes candidate bounding functions f(n) over empirical data points (n, y)
    pub fn synthesize_extremal_bounds(&self, data_points: &[(i64, f64)]) -> Vec<BoundCandidate> {
        let mut candidates = Vec::new();
        if data_points.is_empty() {
            return candidates;
        }

        // Test Candidate 1: Linear Bound f(n) = c * n
        let mut max_ratio_lin: f64 = 0.0;
        for &(n, y) in data_points {
            if n > 0 {
                max_ratio_lin = max_ratio_lin.max(y / (n as f64));
            }
        }
        let c_lin = max_ratio_lin.ceil();
        candidates.push(BoundCandidate {
            variable: "n".to_string(),
            expression: format!("{} * n", c_lin),
            asymptotic_class: "O(n)".to_string(),
            empirical_error: 0.0,
        });

        // Test Candidate 2: Quadratic Bound f(n) = c * n^2
        let mut max_ratio_quad: f64 = 0.0;
        for &(n, y) in data_points {
            if n > 0 {
                max_ratio_quad = max_ratio_quad.max(y / ((n * n) as f64));
            }
        }
        let c_quad = max_ratio_quad.ceil().max(1.0);
        candidates.push(BoundCandidate {
            variable: "n".to_string(),
            expression: format!("{} * (n * n)", c_quad),
            asymptotic_class: "O(n^2)".to_string(),
            empirical_error: 0.0,
        });

        // Test Candidate 3: Exponential Bound f(n) = 2^n
        candidates.push(BoundCandidate {
            variable: "n".to_string(),
            expression: "2^n".to_string(),
            asymptotic_class: "O(2^n)".to_string(),
            empirical_error: 0.0,
        });

        candidates
    }

    /// Synthesizes structured mathematical conjectures from an invariant specification
    pub fn synthesize_program_conjectures(
        &self,
        domain: &str,
        base_claim: &str,
        empirical_terms: &[i64],
    ) -> Vec<Conjecture> {
        let mut list = Vec::new();

        // 1. OEIS Sequence Invariant Match
        let seq_matches = self.match_sequence(empirical_terms);
        for (seq, _offset) in seq_matches {
            let mut vars = HashMap::new();
            vars.insert("n".to_string(), "Nat".to_string());

            list.push(Conjecture {
                conjecture_id: format!("oeis_{}_{}", seq.id.to_lowercase(), list.len() + 1),
                domain: domain.to_string(),
                informal_claim: format!(
                    "{}: Empirical sequence matches OEIS {} ({})",
                    base_claim, seq.id, seq.name
                ),
                hypotheses: vec!["n >= 1".to_string()],
                target: format!("SequenceTerm n == {}", seq.formula.as_deref().unwrap_or(&seq.name)),
                variables: vars,
                custom_predicates: vec![],
                provenance_source: Some(format!("OEIS:{}", seq.id)),
            });
        }

        // 2. Extremal Bound Invariant Synthesis
        let data_points: Vec<(i64, f64)> = empirical_terms
            .iter()
            .enumerate()
            .map(|(idx, &v)| ((idx + 1) as i64, v as f64))
            .collect();
        let bounds = self.synthesize_extremal_bounds(&data_points);

        for bound in bounds {
            let mut vars = HashMap::new();
            vars.insert("n".to_string(), "Nat".to_string());

            list.push(Conjecture {
                conjecture_id: format!("bound_{}_{}", bound.asymptotic_class.replace(['(', ')', '^'], "_"), list.len() + 1),
                domain: domain.to_string(),
                informal_claim: format!("{}: Invariant upper bound holds as {}", base_claim, bound.expression),
                hypotheses: vec!["n >= 1".to_string()],
                target: format!("InvariantCapacity n <= {}", bound.expression),
                variables: vars,
                custom_predicates: vec![],
                provenance_source: Some("ExtremalBoundSynthesizer".to_string()),
            });
        }

        list
    }

    fn populate_core_oeis(&mut self) {
        self.oeis_db = vec![
            OeisSequence {
                id: "A000045".to_string(),
                name: "Fibonacci numbers".to_string(),
                terms: vec![0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144],
                formula: Some("F(n-1) + F(n-2)".to_string()),
                domain: "number_theory.recurrence".to_string(),
            },
            OeisSequence {
                id: "A000108".to_string(),
                name: "Catalan numbers".to_string(),
                terms: vec![1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862],
                formula: Some("(2n)! / ((n+1)! * n!)".to_string()),
                domain: "combinatorics.dyck".to_string(),
            },
            OeisSequence {
                id: "A000217".to_string(),
                name: "Triangular numbers".to_string(),
                terms: vec![0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
                formula: Some("n * (n + 1) / 2".to_string()),
                domain: "algebra.nat".to_string(),
            },
            OeisSequence {
                id: "A000290".to_string(),
                name: "Square numbers".to_string(),
                terms: vec![0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100],
                formula: Some("n^2".to_string()),
                domain: "algebra.nat".to_string(),
            },
            OeisSequence {
                id: "A000079".to_string(),
                name: "Powers of 2".to_string(),
                terms: vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
                formula: Some("2^n".to_string()),
                domain: "algebra.nat".to_string(),
            },
        ];
    }
}
