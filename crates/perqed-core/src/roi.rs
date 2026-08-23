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

    /// Computes augmented intelligence-per-dollar metrics for the Golden Triad:
    /// DeepSeek-V4-Pro (Tier 1) + Gemini 3.7 Flash High (Tier 2) + GPT-5.6 Sol (Tier 3)
    pub fn compute_triad_intelligence_per_dollar(
        &self,
        solve_rate_percent: f64,
        avg_proof_tokens_tier1: usize,
        avg_ingest_tokens_tier2: usize,
    ) -> IntelligencePerDollarMetrics {
        // Average cost per verified theorem in the augmented funnel:
        // Tier 2 Ingest (Gemini 3.7 Flash): 1 query
        let tier2_cost = (avg_ingest_tokens_tier2 as f64 / 1_000_000.0) * self.tier2_cost_per_m_tokens;
        // Tier 1 MCTS (DeepSeek V4 Pro/Flash): ~100 tactic expansions
        let tier1_cost = ((avg_proof_tokens_tier1 * 100) as f64 / 1_000_000.0) * self.tier1_cost_per_m_tokens;
        // Tier 3 Audit (GPT-5.6 Sol): 1 adversarial pass on surviving 1%
        let tier3_cost = (4000.0 / 1_000_000.0) * self.tier3_cost_per_m_tokens;

        let cost_per_verified_proof_usd = tier2_cost + tier1_cost + tier3_cost;
        let proofs_per_dollar = if cost_per_verified_proof_usd > 0.0 {
            (solve_rate_percent / 100.0) / cost_per_verified_proof_usd
        } else {
            100.0
        };

        // Naive frontier model baseline ($18.50 per theorem @ 22% solve rate = 0.0118 proofs / $)
        let naive_proofs_per_dollar = 0.22 / 18.50;
        let intelligence_multiplier = proofs_per_dollar / naive_proofs_per_dollar;

        IntelligencePerDollarMetrics {
            solve_rate_percent,
            cost_per_verified_proof_usd,
            proofs_per_dollar,
            intelligence_multiplier_vs_naive: intelligence_multiplier,
            portfolio_summary: "Golden Triad: DeepSeek-V4-Pro (T1) + Gemini 3.7 Flash (T2) + GPT-5.6 Sol (T3)".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligencePerDollarMetrics {
    pub solve_rate_percent: f64,
    pub cost_per_verified_proof_usd: f64,
    pub proofs_per_dollar: f64,
    pub intelligence_multiplier_vs_naive: f64,
    pub portfolio_summary: String,
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

/// Configuration weights and thresholds for scientific return-on-investment evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoiWeights {
    pub intrinsic_weight: f64,
    pub difficulty_weight: f64,
    pub novelty_weight: f64,
    pub mdl_lambda: f64,
    pub token_bit_weight: f64,
    pub char_bit_weight: f64,
    pub ast_bit_divisor: f64,
    pub min_raw_mdl_gain: f64,
    pub min_novelty_distance: f64,
    pub base_significance: f64,
    pub unification_scale: f64,
    pub max_significance: f64,
    pub tautology_significance_penalty: f64,
    pub cost_arithmetic_linear: f64,
    pub cost_algebra_ring: f64,
    pub cost_deep_mcts: f64,
    pub default_empirical_table_size: usize,
}

impl Default for RoiWeights {
    fn default() -> Self {
        Self {
            intrinsic_weight: 0.45,
            difficulty_weight: 0.35,
            novelty_weight: 0.20,
            mdl_lambda: 0.05,
            token_bit_weight: 8.0,
            char_bit_weight: 3.0,
            ast_bit_divisor: 10.0,
            min_raw_mdl_gain: 0.1,
            min_novelty_distance: 0.1,
            base_significance: 1.0,
            unification_scale: 0.2,
            max_significance: 5.0,
            tautology_significance_penalty: 0.1,
            cost_arithmetic_linear: 1.5,
            cost_algebra_ring: 2.0,
            cost_deep_mcts: 4.5,
            default_empirical_table_size: 100,
        }
    }
}

pub struct RoiEvaluator {
    dag: MathlibDag,
    pub weights: RoiWeights,
    pub power_cost_model: PowerCostModel,
}

impl RoiEvaluator {
    pub fn new(dag: MathlibDag) -> Self {
        Self::with_weights(dag, RoiWeights::default(), PowerCostModel::default())
    }

    pub fn with_lambda(dag: MathlibDag, mdl_lambda: f64) -> Self {
        let mut weights = RoiWeights::default();
        weights.mdl_lambda = mdl_lambda;
        Self::with_weights(dag, weights, PowerCostModel::default())
    }

    pub fn with_weights(dag: MathlibDag, weights: RoiWeights, power_cost_model: PowerCostModel) -> Self {
        Self {
            dag,
            weights,
            power_cost_model,
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
        let ast_bit_length = (token_count as f64) * self.weights.token_bit_weight
            + (char_len as f64) * self.weights.char_bit_weight;

        let raw_mdl_gain = data_entropy - self.weights.mdl_lambda * (ast_bit_length / self.weights.ast_bit_divisor);
        raw_mdl_gain.max(self.weights.min_raw_mdl_gain)
    }

    /// Evaluates a single candidate conjecture
    pub fn evaluate_conjecture(&self, conjecture: &Conjecture, empirical_table_size: usize) -> RoiScore {
        // 1. Novelty: Topological distance from existing Mathlib DAG
        let premise_keys: Vec<String> = conjecture
            .domain
            .split('.')
            .map(|s| s.to_string())
            .collect();
        let novelty = self.dag.compute_novelty_distance(&premise_keys).max(self.weights.min_novelty_distance);

        // 2. Significance: Unification potential + domain impact
        let unification_count = self.dag.estimate_unification_count(&conjecture.domain);
        let raw_significance = (self.weights.base_significance + (unification_count as f64) * self.weights.unification_scale)
            .min(self.weights.max_significance);

        // 3. Information Gain: MDL formulation penalizing complex expressions
        let info_gain = self.compute_mdl_information_gain(conjecture, empirical_table_size);

        // 4. Mathematical Depth & Technique Rigor Evaluation:
        let depth_report = crate::depth_evaluator::MathematicalDepthEvaluator::evaluate_depth(
            &conjecture.target,
            &conjecture.domain,
            conjecture.domain.contains("analytical") || conjecture.domain.contains("sieve"),
            conjecture.domain.contains("exhaustiveness") || conjecture.domain.contains("baker"),
        );

        // Apply depth multiplier to eliminate trivial Presburger/identity gaming
        let adjusted_significance = raw_significance * depth_report.depth_multiplier;

        let estimated_cost = if depth_report.classification == crate::depth_evaluator::DepthClassification::TrivialPresburgerOrIdentity {
            self.weights.cost_arithmetic_linear
        } else if conjecture.domain.contains("ring") || conjecture.domain.contains("algebra") {
            self.weights.cost_algebra_ring
        } else {
            self.weights.cost_deep_mcts
        };

        let total_roi = (novelty * adjusted_significance * info_gain) / estimated_cost;

        let rationale = format!(
            "Novelty: {:.2}, Depth: {:?} (mult: {:.2}), AdjSignificance: {:.2} ({} unified), InfoGain(MDL): {:.2}, Cost: {:.2}",
            novelty, depth_report.classification, depth_report.depth_multiplier, adjusted_significance, unification_count, info_gain, estimated_cost
        );

        RoiScore {
            conjecture_id: conjecture.conjecture_id.clone(),
            novelty,
            significance: adjusted_significance,
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
