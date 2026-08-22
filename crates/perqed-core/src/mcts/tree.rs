//! MCTS Tree Node and UCT Selection Data Structures

use crate::types::{ProofState, TacticCandidate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MctsNode {
    pub id: usize,
    pub parent_id: Option<usize>,
    pub children_ids: Vec<usize>,
    pub applied_tactic: Option<TacticCandidate>,
    pub proof_state: ProofState,
    pub visit_count: usize,
    pub total_value: f64,
    pub is_expanded: bool,
    pub is_terminal: bool,
    pub is_solved: bool,
    pub depth: usize,
}

impl MctsNode {
    pub fn new(
        id: usize,
        parent_id: Option<usize>,
        applied_tactic: Option<TacticCandidate>,
        proof_state: ProofState,
        depth: usize,
    ) -> Self {
        let is_solved = proof_state.is_solved;
        Self {
            id,
            parent_id,
            children_ids: Vec::new(),
            applied_tactic,
            proof_state,
            visit_count: 0,
            total_value: 0.0,
            is_expanded: false,
            is_terminal: is_solved,
            is_solved,
            depth,
        }
    }

    /// Upper Confidence Bound for Trees (UCT) score
    pub fn uct_score(&self, parent_visits: usize, exploration_c: f64) -> f64 {
        if self.visit_count == 0 {
            return f64::INFINITY;
        }
        let exploitation = self.total_value / (self.visit_count as f64);
        let exploration =
            exploration_c * ((parent_visits as f64).ln() / (self.visit_count as f64)).sqrt();
        exploitation + exploration
    }

    /// Average value (Q / N)
    pub fn mean_value(&self) -> f64 {
        if self.visit_count == 0 {
            0.0
        } else {
            self.total_value / (self.visit_count as f64)
        }
    }
}
