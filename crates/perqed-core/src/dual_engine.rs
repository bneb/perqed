//! Dual-Engine Proof Search Interleaver
//!
//! Interleaves specialized symbolic decision procedures (`omega`, `linarith`, `ring`, `polyrith`, `aesop`)
//! with neural formal tactic models (DeepSeek-Prover-V2, Goedel-Prover-V2).

use crate::tactic_generator::TacticGenerator;
use crate::types::{ProofState, TacticCandidate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionProcedure {
    pub name: String,
    pub tactic: String,
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

    fn load_standard_procedures(&mut self) {
        self.procedures = vec![
            DecisionProcedure {
                name: "omega".to_string(),
                tactic: "omega".to_string(),
                domain_trigger: vec!["nat".to_string(), "int".to_string(), "arith".to_string(), "<=".to_string(), ">=".to_string(), "+".to_string()],
                priority: 100,
            },
            DecisionProcedure {
                name: "linarith".to_string(),
                tactic: "linarith".to_string(),
                domain_trigger: vec!["real".to_string(), "rat".to_string(), "ineq".to_string()],
                priority: 95,
            },
            DecisionProcedure {
                name: "ring".to_string(),
                tactic: "ring".to_string(),
                domain_trigger: vec!["ring".to_string(), "algebra".to_string(), "*".to_string(), "^".to_string()],
                priority: 90,
            },
            DecisionProcedure {
                name: "aesop".to_string(),
                tactic: "aesop".to_string(),
                domain_trigger: vec!["logic".to_string(), "prop".to_string(), "intro".to_string()],
                priority: 85,
            },
            DecisionProcedure {
                name: "simp".to_string(),
                tactic: "simp".to_string(),
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
                    generator_model: format!("symbolic_proc:{}", proc.name),
                    is_terminal: true,
                });
            }
        }

        candidates
    }

    /// Interleaves fast symbolic decision procedures with neural tactic beam sampling
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
