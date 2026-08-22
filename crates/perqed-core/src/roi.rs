//! Mathematical ROI Value Function
//!
//! Evaluates and ranks candidate conjectures by scientific return-on-investment:
//! ROI(C) = (Novelty * Significance * InformationGain) / EstimatedCost
//! Promoting only the top 5% to formal proof search.

use crate::dag::MathlibDag;
use crate::types::Conjecture;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoiScore {
    pub conjecture_id: String,
    pub novelty: f64,
    pub significance: f64,
    pub information_gain: f64,
    pub estimated_cost: f64,
    pub total_roi: f64,
    pub is_promoted: bool,
    pub ranking_rationale: String,
}

pub struct RoiEvaluator {
    dag: MathlibDag,
}

impl RoiEvaluator {
    pub fn new(dag: MathlibDag) -> Self {
        Self { dag }
    }

    /// Evaluates a single candidate conjecture
    pub fn evaluate_conjecture(&self, conjecture: &Conjecture, empirical_table_size: usize) -> RoiScore {
        // 1. Novelty: Topological distance from existing Mathlib DAG
        let premise_keys: Vec<String> = conjecture
            .domain
            .split('.')
            .map(|s| s.to_string())
            .collect();
        let novelty = self.dag.compute_novelty_distance(&premise_keys).max(0.1);

        // 2. Significance: Unification potential + asymptotic bound significance
        let unification_count = self.dag.estimate_unification_count(&conjecture.domain);
        let significance = (1.0 + (unification_count as f64) * 0.2).min(5.0);

        // 3. Information Gain: Kolmogorov description length compression ratio
        let statement_len = (conjecture.informal_claim.len() + conjecture.target.len()) as f64;
        let observations_size = (empirical_table_size as f64).max(10.0);
        let info_gain = ((observations_size / (statement_len * 0.1)).ln() + 1.0).max(0.2);

        // 4. Estimated Proof Search Cost: Distance to known decision procedures
        let is_arithmetic = conjecture.domain.contains("nat") || conjecture.domain.contains("int") || conjecture.domain.contains("arith");
        let is_linear = conjecture.target.contains('+') || conjecture.target.contains('-');
        
        let estimated_cost = if is_arithmetic && is_linear {
            1.2 // High proximity to omega/linarith
        } else if conjecture.domain.contains("ring") || conjecture.domain.contains("algebra") {
            2.0 // Proximity to ring/polyrith
        } else {
            4.5 // Requires deep heuristic MCTS tactic search
        };

        let total_roi = (novelty * significance * info_gain) / estimated_cost;

        let rationale = format!(
            "Novelty: {:.2}, Significance: {:.2} ({} unified), InfoGain: {:.2}, Cost: {:.2}",
            novelty, significance, unification_count, info_gain, estimated_cost
        );

        RoiScore {
            conjecture_id: conjecture.conjecture_id.clone(),
            novelty,
            significance,
            information_gain: info_gain,
            estimated_cost,
            total_roi,
            is_promoted: false, // Updated by batch ranker
            ranking_rationale: rationale,
        }
    }

    /// Ranks a batch of candidate conjectures and promotes the top percent
    pub fn rank_and_filter(&self, conjectures: &[Conjecture], promotion_percentile: f64) -> Vec<(Conjecture, RoiScore)> {
        if conjectures.is_empty() {
            return Vec::new();
        }

        let mut scored: Vec<(Conjecture, RoiScore)> = conjectures
            .iter()
            .map(|c| {
                let score = self.evaluate_conjecture(c, 100);
                (c.clone(), score)
            })
            .collect();

        // Sort descending by total_roi
        scored.sort_by(|a, b| b.1.total_roi.partial_cmp(&a.1.total_roi).unwrap());

        let promote_count = ((scored.len() as f64) * (promotion_percentile / 100.0)).ceil() as usize;
        let promote_threshold = promote_count.max(1);

        for (idx, item) in scored.iter_mut().enumerate() {
            if idx < promote_threshold {
                item.1.is_promoted = true;
            }
        }

        scored
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_roi_evaluator_ranking() {
        let dag = MathlibDag::new();
        let evaluator = RoiEvaluator::new(dag);

        let mut vars = HashMap::new();
        vars.insert("n".to_string(), "Nat".to_string());

        let conj_high = Conjecture {
            conjecture_id: "conj_high_roi".to_string(),
            domain: "algebra.nat".to_string(),
            informal_claim: "n + 0 = n".to_string(),
            hypotheses: vec!["n >= 0".to_string()],
            target: "n + 0 = n".to_string(),
            variables: vars.clone(),
            custom_predicates: vec![],
            provenance_source: None,
        };

        let conj_obscure = Conjecture {
            conjecture_id: "conj_obscure".to_string(),
            domain: "esoteric.subfield".to_string(),
            informal_claim: "Very complex long statement with high cost".to_string(),
            hypotheses: vec![],
            target: "Very complex long statement with high cost".to_string(),
            variables: vars,
            custom_predicates: vec![],
            provenance_source: None,
        };

        let ranked = evaluator.rank_and_filter(&[conj_obscure, conj_high], 50.0);
        assert_eq!(ranked.len(), 2);
        assert!(ranked[0].1.total_roi >= ranked[1].1.total_roi);
        assert!(ranked[0].1.is_promoted);
    }
}
