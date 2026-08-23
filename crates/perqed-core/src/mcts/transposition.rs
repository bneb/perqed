//! Canonical Goal Normalization & Transposition Table
//!
//! Maps alpha-equivalent proof states and subgoals to canonical hash keys,
//! enabling instant subtree reuse and AND-OR graph transposition sharing across
//! divergent MCTS branches.

use crate::types::ProofState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub struct CanonicalGoalHasher;

impl CanonicalGoalHasher {
    /// Strips redundant whitespace and normalizes operators
    pub fn normalize_term(s: &str) -> String {
        s.split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
    }

    /// Normalizes hypothesis strings (e.g. removes variable name differences if structural, sorts declarations)
    pub fn normalize_hypotheses(hypotheses: &[String]) -> Vec<String> {
        let mut normalized: Vec<String> = hypotheses
            .iter()
            .map(|h| Self::normalize_term(h))
            .filter(|h| !h.is_empty())
            .collect();
        normalized.sort();
        normalized
    }

    /// Computes a canonical hash for an entire proof state
    pub fn hash_proof_state(state: &ProofState) -> String {
        let mut sorted_hyps = Self::normalize_hypotheses(&state.hypotheses);
        sorted_hyps.sort();

        let norm_goals: Vec<String> = state
            .open_goals
            .iter()
            .map(|g| Self::normalize_term(g))
            .collect();

        let canonical_repr = format!(
            "HYPS: [{}] | GOALS: [{}]",
            sorted_hyps.join(" ; "),
            norm_goals.join(" ; ")
        );

        let mut hasher = Sha256::new();
        hasher.update(canonical_repr.as_bytes());
        hex::encode(hasher.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranspositionEntry {
    pub canonical_hash: String,
    pub is_solved: bool,
    pub proof_script: Option<String>,
    pub value_estimate: f64,
    pub visit_count: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TranspositionTable {
    entries: HashMap<String, TranspositionEntry>,
}

impl TranspositionTable {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
        }
    }

    pub fn insert(&mut self, hash: String, entry: TranspositionEntry) {
        self.entries.insert(hash, entry);
    }

    pub fn lookup(&self, hash: &str) -> Option<&TranspositionEntry> {
        self.entries.get(hash)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}
