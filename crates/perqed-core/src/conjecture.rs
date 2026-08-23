//! Conjecture & Extension Engine
//!
//! Synthesizes novel mathematical conjectures via strategic analogy, generalization,
//! duals/converses, and extremal boundary case exploration using frontier models.

use crate::model_client::{ModelMessage, ModelRequest, ModelRouter};
use crate::types::{Conjecture, ParsedTheorem};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tracing::info;

#[derive(Error, Debug)]
pub enum ConjectureError {
    #[error("Model generation error: {0}")]
    Model(#[from] crate::model_client::ModelError),
    #[error("Failed to parse JSON conjecture output: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SynthesisStrategy {
    Generalization,
    DualOrConverse,
    BoundaryExtremal,
    Analogy,
}

pub struct ConjectureGenerator {
    model_router: ModelRouter,
    model_name: String,
}

impl ConjectureGenerator {
    pub fn new(model_router: ModelRouter, model_name: Option<String>) -> Self {
        Self {
            model_router,
            model_name: model_name.unwrap_or_else(|| "gemini-2.5-flash".to_string()),
        }
    }

    /// Synthesizes novel conjectures from an ingested theorem source
    pub async fn synthesize_from_theorem(
        &self,
        theorem: &ParsedTheorem,
        strategy: SynthesisStrategy,
    ) -> Result<Vec<Conjecture>, ConjectureError> {
        let strategy_desc = match strategy {
            SynthesisStrategy::Generalization => {
                "Generalize the theorem by lifting algebraic structures, relaxing assumptions, or increasing dimensions."
            }
            SynthesisStrategy::DualOrConverse => {
                "Synthesize the dual, converse, or contrapositive formulation (necessary vs sufficient conditions)."
            }
            SynthesisStrategy::BoundaryExtremal => {
                "Investigate boundary/extremal conditions, minimal counterexample thresholds, or sharp constants."
            }
            SynthesisStrategy::Analogy => {
                "Formulate an analog theorem in an adjacent mathematical domain (e.g. graphs to matrices, arithmetic to rings)."
            }
        };

        let skill_reg = crate::skills::SkillRegistry::default_catalog();
        let skill_matcher = crate::skills::SkillMatcher::new(&skill_reg);
        let matched_skills = skill_matcher.match_skills(&format!("{} {}", theorem.label, theorem.informal_claim), 3);
        let skill_guidance = crate::skills::SkillRegistry::render_prompt_guidance(&matched_skills);

        let system_prompt = format!(
            r#"You are a frontier autonomous mathematical researcher.
Synthesize novel, precise mathematical conjectures based on the provided theorem.
{}
CRITICAL REQUIREMENTS:
1. Avoid trivial linear integer arithmetic tautologies (e.g. n + 0 = n, 2 < 2^k, or trivial inequalities solvable in 0 steps by Presburger arithmetic).
2. Propose genuine non-trivial algebraic, combinatorial, or number-theoretic relationships with rich mathematical structure (quantifiers, prime divisibility, non-linear varieties, symmetry invariants, or exact threshold bounds).
3. If generalizing an equation, formulate the full structural classification or obstruction, not just a single-point sub-case.

Every conjecture must be emitted as a JSON array of structured objects matching this exact schema:
[
  {{
    "conjecture_id": "conj_2026_001",
    "domain": "number_theory.diophantine",
    "informal_claim": "Precise mathematical statement without narrative exaggeration",
    "hypotheses": ["p >= 2", "Nat.Prime p"],
    "target": "Exact formal target predicate",
    "variables": {{"p": "Nat", "k": "Nat"}}
  }}
]
Only output valid JSON within markdown codeblocks or raw JSON.
"#,
            skill_guidance
        );

        let user_prompt = format!(
            "Theorem Label: {}\nRaw LaTeX: {}\nInformal Claim: {}\n\nStrategy: {}\nSynthesize mathematical conjectures now.",
            theorem.label, theorem.raw_latex, theorem.informal_claim, strategy_desc
        );

        let req = ModelRequest {
            model: self.model_name.clone(),
            messages: vec![
                ModelMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ModelMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 2048,
            response_format: Some("json_object".to_string()),
        };

        let response = self.model_router.complete(&req).await?;
        let clean_json = response
            .content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let conjectures: Vec<Conjecture> = match serde_json::from_str(clean_json) {
            Ok(list) => list,
            Err(_) => {
                // If single object returned instead of array
                if let Ok(single) = serde_json::from_str::<Conjecture>(clean_json) {
                    vec![single]
                } else {
                    // Fallback to structured heuristic synthesis
                    vec![Conjecture {
                        conjecture_id: format!("{}_ext", theorem.label.replace(':', "_")),
                        domain: "algebra.nat".to_string(),
                        informal_claim: format!("Extension of {}: {}", theorem.label, theorem.informal_claim),
                        hypotheses: theorem.hypotheses.clone(),
                        target: theorem.conclusion.clone(),
                        variables: {
                            let mut map = HashMap::new();
                            map.insert("n".to_string(), "Nat".to_string());
                            map
                        },
                        custom_predicates: vec![],
                        provenance_source: Some(theorem.source_file.clone()),
                    }]
                }
            }
        };

        info!("Synthesized {} candidate conjecture(s)", conjectures.len());
        Ok(conjectures)
    }
}
