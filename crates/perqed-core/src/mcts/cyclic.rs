//! Well-Founded Inductive Knots & Cyclic Proof Detection
//!
//! Differentiates between sterile tautological rewrite loops and valid well-founded
//! inductive knots (cyclic proof theory) using structural goal complexity metrics.

use super::transposition::CanonicalGoalHasher;
use crate::types::ProofState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GoalComplexityMetric {
    pub term_length: usize,
    pub quantifier_depth: usize,
    pub operator_count: usize,
    pub total_score: f64,
}

impl GoalComplexityMetric {
    pub fn compute(state: &ProofState) -> Self {
        let text = state.open_goals.join(" ");

        let quantifier_count = text.matches('∀').count()
            + text.matches('∃').count()
            + text.matches("forall").count()
            + text.matches("exists").count();

        let operator_count = text.matches('+').count()
            + text.matches('-').count()
            + text.matches('*').count()
            + text.matches('/').count()
            + text.matches('^').count()
            + text.matches('∧').count()
            + text.matches('∨').count()
            + text.matches('→').count()
            + text.matches('↔').count()
            + text.matches('=').count();

        let term_length = text.chars().filter(|c| !c.is_whitespace()).count();

        let total_score = (quantifier_count * 10 + operator_count * 3 + term_length) as f64;

        Self {
            term_length,
            quantifier_depth: quantifier_count,
            operator_count,
            total_score,
        }
    }
}

impl PartialOrd for GoalComplexityMetric {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.total_score.partial_cmp(&other.total_score)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CyclicVerdict {
    NoCycle,
    SterileCycle {
        repetition_depth: usize,
    },
    InductiveKnot {
        ancestor_id: usize,
        descent_metric: f64,
        suggested_descent_tactic: String,
    },
}

#[derive(Debug, Clone, Default)]
pub struct CyclicProofDetector {
    path_history: Vec<(usize, String, GoalComplexityMetric, Vec<String>)>, // (node_id, hash, metric, raw_goals)
}

impl CyclicProofDetector {
    pub fn new() -> Self {
        Self {
            path_history: Vec::new(),
        }
    }

    pub fn push_state(&mut self, node_id: usize, state: &ProofState) {
        let hash = CanonicalGoalHasher::hash_proof_state(state);
        let metric = GoalComplexityMetric::compute(state);
        self.path_history
            .push((node_id, hash, metric, state.open_goals.clone()));
    }

    pub fn pop_state(&mut self) {
        self.path_history.pop();
    }

    /// Evaluates whether the current state forms a cycle with any of its ancestors on the active path
    pub fn check_ancestor_cycle<'a, I>(&self, current_state: &ProofState, ancestors: I) -> CyclicVerdict
    where
        I: IntoIterator<Item = (usize, &'a ProofState)>,
    {
        let current_hash = CanonicalGoalHasher::hash_proof_state(current_state);
        let current_metric = GoalComplexityMetric::compute(current_state);
        let current_goals = &current_state.open_goals;

        for (ancestor_id, anc_state) in ancestors {
            let anc_hash = CanonicalGoalHasher::hash_proof_state(anc_state);
            let anc_metric = GoalComplexityMetric::compute(anc_state);
            let anc_goals = &anc_state.open_goals;

            // Case 1: Exact canonical state equality
            if current_hash == anc_hash {
                // If metric did not strictly decrease, it is a sterile rewrite loop
                return CyclicVerdict::SterileCycle {
                    repetition_depth: ancestor_id,
                };
            }

            // Case 2: Structural relation to quantified ancestor
            let is_subterm_of_ancestor = anc_goals.iter().any(|anc_g| {
                current_goals.iter().any(|curr_g| {
                    (anc_g.contains('∀') || anc_g.contains("forall") || anc_g.contains('→'))
                        && (anc_g.contains(curr_g)
                            || current_state.hypotheses.iter().any(|h| h.contains("ih")))
                })
            });

            if is_subterm_of_ancestor || current_state.hypotheses.iter().any(|h| h.contains("ih")) {
                if current_metric < anc_metric {
                    let diff = anc_metric.total_score - current_metric.total_score;
                    let tactic = if current_state.hypotheses.iter().any(|h| h.contains("ih")) {
                        "exact ih".to_string()
                    } else {
                        "apply induction".to_string()
                    };

                    return CyclicVerdict::InductiveKnot {
                        ancestor_id,
                        descent_metric: diff,
                        suggested_descent_tactic: tactic,
                    };
                }
            }
        }

        CyclicVerdict::NoCycle
    }

    /// Evaluates whether current state forms a cycle against internal linear history
    pub fn check_cycle(&self, current_state: &ProofState) -> CyclicVerdict {
        let current_hash = CanonicalGoalHasher::hash_proof_state(current_state);
        let current_metric = GoalComplexityMetric::compute(current_state);
        let current_goals = &current_state.open_goals;

        for (ancestor_id, anc_hash, anc_metric, anc_goals) in self.path_history.iter().rev() {
            // Case 1: Exact canonical state equality
            if &current_hash == anc_hash {
                // If metric did not strictly decrease, it is a sterile rewrite loop
                return CyclicVerdict::SterileCycle {
                    repetition_depth: *ancestor_id,
                };
            }

            // Case 2: Structural relation to quantified ancestor
            // Check if current goal is an instantiated subterm of an ancestor quantified goal
            let is_subterm_of_ancestor = anc_goals.iter().any(|anc_g| {
                current_goals.iter().any(|curr_g| {
                    (anc_g.contains('∀') || anc_g.contains("forall") || anc_g.contains('→'))
                        && (anc_g.contains(curr_g)
                            || current_state.hypotheses.iter().any(|h| h.contains("ih")))
                })
            });

            if is_subterm_of_ancestor || current_state.hypotheses.iter().any(|h| h.contains("ih")) {
                if current_metric < *anc_metric {
                    let diff = anc_metric.total_score - current_metric.total_score;
                    let tactic = if current_state.hypotheses.iter().any(|h| h.contains("ih")) {
                        "exact ih".to_string()
                    } else {
                        "apply induction".to_string()
                    };

                    return CyclicVerdict::InductiveKnot {
                        ancestor_id: *ancestor_id,
                        descent_metric: diff,
                        suggested_descent_tactic: tactic,
                    };
                }
            }
        }

        CyclicVerdict::NoCycle
    }
}
