//! Tactic Generation Engine
//!
//! Generates candidate Lean 4 tactics conditioned on active proof goals and premises
//! using formal tactic models (DeepSeek-Prover-V2, Goedel-Prover-V2, Qwen-Math)
//! supplemented by rule-based heuristic expansions.

use crate::model_client::{ModelMessage, ModelRequest, ModelRouter};
use crate::types::{ProofState, TacticCandidate};
use serde::Deserialize;
use std::collections::HashSet;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TacticError {
    #[error("Model error: {0}")]
    Model(#[from] crate::model_client::ModelError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub struct TacticGenerator {
    model_router: ModelRouter,
    model_name: String,
}

impl TacticGenerator {
    pub fn new(model_router: ModelRouter, model_name: Option<String>) -> Self {
        Self {
            model_router,
            model_name: model_name.unwrap_or_else(|| "deepseek-prover-v2".to_string()),
        }
    }

    /// Generates ranked beam of tactic candidates for current proof state
    pub async fn generate_candidates(
        &self,
        state: &ProofState,
        available_premises: &[String],
        beam_size: usize,
    ) -> Result<Vec<TacticCandidate>, TacticError> {
        let mut candidates = Vec::new();
        let mut seen_tactics = HashSet::new();

        // 1. First add smart domain-specific heuristic tactics based on active goal
        let heuristic_tactics = self.generate_heuristics(state, available_premises);
        for tac in heuristic_tactics {
            if seen_tactics.insert(tac.tactic_code.clone()) {
                candidates.push(tac);
            }
        }

        // 2. Query formal tactic model (DeepSeek-Prover-V2 / Goedel / Qwen / Gemini)
        let prompt = self.build_prompt(state, available_premises, beam_size);
        let req = ModelRequest {
            model: self.model_name.clone(),
            messages: vec![
                ModelMessage {
                    role: "system".to_string(),
                    content: "You are an automated Lean 4 formal prover tactic engine. Emit JSON array of tactics with confidence scores.".to_string(),
                },
                ModelMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            temperature: 0.2,
            max_tokens: 1024,
            response_format: Some("json_object".to_string()),
        };

        if let Ok(resp) = self.model_router.complete(&req).await {
            let clean = resp
                .content
                .trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();

            #[derive(Deserialize)]
            struct ModelTactic {
                tactic: String,
                #[serde(default = "default_score")]
                score: f64,
            }
            fn default_score() -> f64 {
                0.8
            }

            if let Ok(parsed) = serde_json::from_str::<Vec<ModelTactic>>(clean) {
                for m in parsed {
                    let code = m.tactic.trim().to_string();
                    if !code.is_empty() && seen_tactics.insert(code.clone()) {
                        let is_term = Self::is_terminal_tactic(&code);
                        candidates.push(TacticCandidate {
                            tactic_code: code,
                            score: m.score,
                            generator_model: self.model_name.clone(),
                            is_terminal: is_term,
                        });
                    }
                }
            }
        }

        // Sort by score descending
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        Ok(candidates.into_iter().take(beam_size).collect())
    }

    fn build_prompt(&self, state: &ProofState, premises: &[String], beam_size: usize) -> String {
        format!(
            "Generate candidate tactics for Lean 4 proof state:\n\nOpen Goals:\n{}\n\nActive Hypotheses:\n{}\n\nAvailable Premises:\n{}\n\nProvide up to {} tactical steps in JSON format: [ {{\"tactic\": \"intro h\", \"score\": 0.95}} ]",
            state.open_goals.join("\n"),
            state.hypotheses.join("\n"),
            premises.join(", "),
            beam_size
        )
    }

    fn is_terminal_tactic(code: &str) -> bool {
        let trimmed = code.trim();
        trimmed.starts_with("exact")
            || trimmed == "rfl"
            || trimmed == "decide"
            || trimmed == "omega"
            || trimmed == "ring"
            || trimmed == "trivial"
            || trimmed == "assumption"
    }

    fn generate_heuristics(&self, state: &ProofState, premises: &[String]) -> Vec<TacticCandidate> {
        let mut list = Vec::new();

        if let Some(goal) = state.open_goals.first() {
            // Implication / Universal Quantifier goal -> intro
            if goal.contains("→") || goal.contains("forall") || goal.contains("∀") {
                list.push(TacticCandidate {
                    tactic_code: "intro n".to_string(),
                    score: 0.98,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
                list.push(TacticCandidate {
                    tactic_code: "intro n; rfl".to_string(),
                    score: 0.97,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: true,
                });
                list.push(TacticCandidate {
                    tactic_code: "intros".to_string(),
                    score: 0.95,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
                list.push(TacticCandidate {
                    tactic_code: "intro h".to_string(),
                    score: 0.94,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
                list.push(TacticCandidate {
                    tactic_code: "intro a b".to_string(),
                    score: 0.90,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
            }

            // Conjunction / Equivalence -> constructor
            if goal.contains("∧") || goal.contains("↔") {
                list.push(TacticCandidate {
                    tactic_code: "constructor".to_string(),
                    score: 0.92,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
            }

            // Disjunction -> Or.inl / Or.inr
            if goal.contains("∨") {
                list.push(TacticCandidate {
                    tactic_code: "apply Or.inl".to_string(),
                    score: 0.75,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
                list.push(TacticCandidate {
                    tactic_code: "apply Or.inr".to_string(),
                    score: 0.75,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
            }

            // Arithmetic equations -> Nat identities, ring, omega
            if goal.contains("+ 0") || goal.contains("0 +") {
                list.push(TacticCandidate {
                    tactic_code: "exact Nat.add_zero _".to_string(),
                    score: 0.98,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: true,
                });
                list.push(TacticCandidate {
                    tactic_code: "rw [Nat.add_zero]".to_string(),
                    score: 0.92,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: false,
                });
            }

            if goal.contains("=") {
                list.push(TacticCandidate {
                    tactic_code: "rfl".to_string(),
                    score: 0.85,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: true,
                });
                list.push(TacticCandidate {
                    tactic_code: "omega".to_string(),
                    score: 0.88,
                    generator_model: "heuristic_rule".to_string(),
                    is_terminal: true,
                });
            }
        }

        // Add premise applications
        for p in premises.iter().take(3) {
            list.push(TacticCandidate {
                tactic_code: format!("exact {}", p),
                score: 0.82,
                generator_model: "premise_injection".to_string(),
                is_terminal: true,
            });
            list.push(TacticCandidate {
                tactic_code: format!("apply {}", p),
                score: 0.80,
                generator_model: "premise_injection".to_string(),
                is_terminal: false,
            });
        }

        list
    }
}
