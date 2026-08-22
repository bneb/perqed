//! Mathematical ROI Value Function with Minimum Description Length (MDL)
//!
//! Evaluates and ranks candidate conjectures by scientific return-on-investment:
//! ROI(C) = (Novelty * Significance * InfoGain_MDL) / EstimatedCost
//!
//! InfoGain_MDL(C) = DataEntropy - λ * bit_length(AST(C))
//! Penalizes formula AST complexity strictly using Minimum Description Length (MDL)
//! to prevent Runge's phenomenon / ad-hoc polynomial overfitting.

use crate::dag::MathlibDag;
use crate::types::Conjecture;
use serde::{Deserialize, Serialize};

/// Computational Power & Energy Profile for August 2026 SOTA Architectures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerCostModel {
    /// Joules consumed per Tier 1 query (DeepSeek V4 Prover local vLLM FP8: ~0.8 J)
    pub tier1_joules_per_query: f64,
    /// Joules consumed per Tier 2 query (Gemini 3.7 Flash Cloud TPU: ~2.5 J)
    pub tier2_joules_per_query: f64,
    /// Joules consumed per Tier 3 query (GPT-5.6 Luna Frontier Cluster: ~15.0 J)
    pub tier3_joules_per_query: f64,
    /// Joules consumed per native Rust / SMT compiled sweep (<50ms CPU: ~0.005 J)
    pub native_sweep_joules: f64,
    /// Pricing per 1M tokens (USD)
    pub tier1_cost_per_m_tokens: f64, // $0.05 / M
    pub tier2_cost_per_m_tokens: f64, // $0.25 / M
    pub tier3_cost_per_m_tokens: f64, // $3.125 / M average
}

impl Default for PowerCostModel {
    fn default() -> Self {
        Self {
            tier1_joules_per_query: 0.8,
            tier2_joules_per_query: 2.5,
            tier3_joules_per_query: 15.0,
            native_sweep_joules: 0.005,
            tier1_cost_per_m_tokens: 0.05,
            tier2_cost_per_m_tokens: 0.25,
            tier3_cost_per_m_tokens: 3.125,
        }
    }
}

impl PowerCostModel {
    /// Computes asymmetric compute leverage compared to unconstrained naive LLM prompting
    pub fn compute_funnel_leverage(
        &self,
        total_candidates: usize,
        surviving_falsification: usize,
        mcts_expansions_per_thm: usize,
    ) -> (f64, f64, f64) {
        // Naive approach: Run frontier LLM reasoning across all candidates with full tree
        let naive_queries = (total_candidates * mcts_expansions_per_thm) as f64;
        let naive_tokens = naive_queries * 1500.0;
        let naive_cost_usd = (naive_tokens / 1_000_000.0) * self.tier3_cost_per_m_tokens;
        let naive_joules = naive_queries * self.tier3_joules_per_query;

        // Perqed Asymmetric Funnel approach:
        // 1. Native falsification on all candidates (0 LLM cost)
        let falsify_joules = (total_candidates as f64) * self.native_sweep_joules;
        // 2. Tier 1 MCTS only on surviving candidates
        let funnel_queries = (surviving_falsification * mcts_expansions_per_thm) as f64;
        let funnel_tokens = funnel_queries * 600.0;
        let funnel_cost_usd = (funnel_tokens / 1_000_000.0) * self.tier1_cost_per_m_tokens;
        let funnel_joules = falsify_joules + funnel_queries * self.tier1_joules_per_query;

        let cost_leverage_multiplier = if funnel_cost_usd > 0.0 {
            naive_cost_usd / funnel_cost_usd
        } else {
            10_000.0
        };

        let energy_leverage_multiplier = if funnel_joules > 0.0 {
            naive_joules / funnel_joules
        } else {
            10_000.0
        };

        (funnel_cost_usd, cost_leverage_multiplier, energy_leverage_multiplier)
    }
}

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
    mdl_lambda: f64, // Description length penalty weight (default 0.05)
    pub power_cost_model: PowerCostModel,
}

impl RoiEvaluator {
    pub fn new(dag: MathlibDag) -> Self {
        Self {
            dag,
            mdl_lambda: 0.05,
            power_cost_model: PowerCostModel::default(),
        }
    }

    pub fn with_lambda(dag: MathlibDag, mdl_lambda: f64) -> Self {
        Self {
            dag,
            mdl_lambda,
            power_cost_model: PowerCostModel::default(),
        }
    }

    /// Computes the Minimum Description Length (MDL) Information Gain:
    /// InfoGain(C) = log2(N_observations) - λ * bit_length(AST(C))
    pub fn compute_mdl_information_gain(&self, conjecture: &Conjecture, empirical_table_size: usize) -> f64 {
        let n_obs = (empirical_table_size as f64).max(2.0);
        let data_entropy = n_obs.log2();

        // Estimate AST bit-length from token and character complexity
        let token_count = conjecture.target.split_whitespace().count().max(1);
        let char_len = conjecture.target.len();
        let ast_bit_length = (token_count as f64) * 8.0 + (char_len as f64) * 3.0;

        let raw_mdl_gain = data_entropy - self.mdl_lambda * (ast_bit_length / 10.0);
        raw_mdl_gain.max(0.1)
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

        // 2. Significance: Unification potential + domain impact
        let unification_count = self.dag.estimate_unification_count(&conjecture.domain);
        let significance = (1.0 + (unification_count as f64) * 0.2).min(5.0);

        // 3. Information Gain: MDL formulation penalizing complex expressions
        let info_gain = self.compute_mdl_information_gain(conjecture, empirical_table_size);

        // 4. Estimated Proof Search Cost: Distance to known decision procedures
        let is_arithmetic = conjecture.domain.contains("nat") || conjecture.domain.contains("int") || conjecture.domain.contains("arith");
        let is_linear = conjecture.target.contains('+') || conjecture.target.contains('-');
        
        let estimated_cost = if is_arithmetic && is_linear {
            1.2 // High proximity to omega/linarith (<5ms)
        } else if conjecture.domain.contains("ring") || conjecture.domain.contains("algebra") {
            2.0 // Proximity to ring/polyrith (<15ms)
        } else {
            4.5 // Requires deep heuristic MCTS tactic search
        };

        let total_roi = (novelty * significance * info_gain) / estimated_cost;

        let rationale = format!(
            "Novelty: {:.2}, Significance: {:.2} ({} unified), InfoGain(MDL): {:.2}, Cost: {:.2}",
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
        scored.sort_by(|a, b| b.1.total_roi.partial_cmp(&a.1.total_roi).unwrap_or(std::cmp::Ordering::Equal));

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
    fn test_mdl_penalizes_overfitting_expression() {
        let dag = MathlibDag::new();
        let evaluator = RoiEvaluator::new(dag);

        let mut vars = HashMap::new();
        vars.insert("n".to_string(), "Nat".to_string());

        // Concise short invariant
        let conj_concise = Conjecture {
            conjecture_id: "concise".to_string(),
            domain: "algebra.nat".to_string(),
            informal_claim: "n + 0 = n".to_string(),
            hypotheses: vec![],
            target: "n + 0 == n".to_string(),
            variables: vars.clone(),
            custom_predicates: vec![],
            provenance_source: None,
        };

        // Bloated overfitted polynomial
        let conj_bloat = Conjecture {
            conjecture_id: "overfit".to_string(),
            domain: "algebra.nat".to_string(),
            informal_claim: "Piecewise overfitted high degree polynomial".to_string(),
            hypotheses: vec![],
            target: "(31 * n^5 - 142 * n^4 + 891 * n^3 - 412 * n^2 + 109 * n - 17) / 240 == 0".to_string(),
            variables: vars,
            custom_predicates: vec![],
            provenance_source: None,
        };

        let gain_concise = evaluator.compute_mdl_information_gain(&conj_concise, 100);
        let gain_bloat = evaluator.compute_mdl_information_gain(&conj_bloat, 100);

        assert!(gain_concise > gain_bloat, "MDL should award higher Information Gain to concise invariant vs bloated overfit");
    }
}
