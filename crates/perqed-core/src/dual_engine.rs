//! Dual-Engine Proof Search Interleaver
//!
//! Tiers deterministic symbolic decision procedures strictly by latency budget
//! (omega <5ms -> linarith <10ms -> ring <15ms -> polyrith <50ms -> aesop <200ms)
//! before invoking neural tactic beam sampling (DeepSeek-Prover-V2, Goedel-Prover-V2).

use crate::tactic_generator::TacticGenerator;
use crate::types::{ProofState, TacticCandidate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionProcedure {
    pub name: String,
    pub tactic: String,
    pub latency_budget_ms: u64,
    pub domain_trigger: Vec<String>,
    pub priority: usize,
}

pub struct DualEngineProver {
    tactic_generator: TacticGenerator,
    procedures: Vec<DecisionProcedure>,
}

impl DualEngineProver {
    pub fn new(tactic_generator: TacticGenerator) -> Self {
        let mut prover = Self {
            tactic_generator,
            procedures: Vec::new(),
        };
        prover.load_standard_procedures();
        prover
    }

    /// Loads standard Lean 4 decision procedures ordered strictly by latency budget
    fn load_standard_procedures(&mut self) {
        self.procedures = vec![
            // Tier 1: Instant Presburger / Linear Integer Arithmetic (<5ms)
            DecisionProcedure {
                name: "omega".to_string(),
                tactic: "omega".to_string(),
                latency_budget_ms: 5,
                domain_trigger: vec!["nat".to_string(), "int".to_string(), "arith".to_string(), "<=".to_string(), ">=".to_string(), "+".to_string()],
                priority: 100,
            },
            // Tier 2: Real / Rational Linear Inequalities (<10ms)
            DecisionProcedure {
                name: "linarith".to_string(),
                tactic: "linarith".to_string(),
                latency_budget_ms: 10,
                domain_trigger: vec!["real".to_string(), "rat".to_string(), "ineq".to_string(), "<".to_string(), ">".to_string()],
                priority: 95,
            },
            // Tier 3: Commutative Ring Identities (<15ms)
            DecisionProcedure {
                name: "ring".to_string(),
                tactic: "ring".to_string(),
                latency_budget_ms: 15,
                domain_trigger: vec!["ring".to_string(), "algebra".to_string(), "*".to_string(), "^".to_string()],
                priority: 90,
            },
            // Tier 4: Non-linear Polynomial Arithmetic & Nullstellensatz (<50ms)
            DecisionProcedure {
                name: "polyrith".to_string(),
                tactic: "polyrith".to_string(),
                latency_budget_ms: 50,
                domain_trigger: vec!["poly".to_string(), "ideal".to_string(), "root".to_string()],
                priority: 85,
            },
            // Tier 5: White-Box Rule Search (<200ms)
            DecisionProcedure {
                name: "aesop".to_string(),
                tactic: "aesop".to_string(),
                latency_budget_ms: 200,
                domain_trigger: vec!["logic".to_string(), "prop".to_string(), "intro".to_string()],
                priority: 75,
            },
            // Tier 6: General Equational Simplification
            DecisionProcedure {
                name: "simp".to_string(),
                tactic: "simp".to_string(),
                latency_budget_ms: 20,
                domain_trigger: vec![],
                priority: 70,
            },
        ];
    }

    /// Fast-path check: suggests instant deterministic symbolic decision tactics matching goal
    pub fn fast_symbolic_tactics(&self, state: &ProofState) -> Vec<TacticCandidate> {
        let mut candidates = Vec::new();
        let goal_text = state.open_goals.join(" ").to_lowercase();

        for proc in &self.procedures {
            let matches = proc.domain_trigger.is_empty()
                || proc.domain_trigger.iter().any(|trig| goal_text.contains(trig));

            if matches {
                candidates.push(TacticCandidate {
                    tactic_code: proc.tactic.clone(),
                    score: 0.99, // Highest priority
                    generator_model: format!("symbolic_proc:{}[<{}ms]", proc.name, proc.latency_budget_ms),
                    is_terminal: true,
                });
            }
        }

        candidates
    }

    /// Interleaves fast tiered symbolic decision procedures with neural tactic beam sampling
    pub async fn generate_interleaved_tactics(
        &self,
        state: &ProofState,
        available_premises: &[String],
        beam_size: usize,
    ) -> Vec<TacticCandidate> {
        let mut result = self.fast_symbolic_tactics(state);

        // Supplement with neural / heuristic provers
        if let Ok(neural_tactics) = self
            .tactic_generator
            .generate_candidates(state, available_premises, beam_size)
            .await
        {
            for nt in neural_tactics {
                if !result.iter().any(|t| t.tactic_code == nt.tactic_code) {
                    result.push(nt);
                }
            }
        }

        result.into_iter().take(beam_size).collect()
    }
}
