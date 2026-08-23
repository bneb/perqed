//! Semantic Goal Coverage Guard & Anti-Inflation Validator
//!
//! Enforces mathematical integrity between Target Conjectures, Formal Lean Specifications,
//! and Proved Theorems. Prevents "goal retreat" where a system proves a minor auxiliary
//! inequality (e.g., (p+1)^2 < p^2 + 2^k*p + 1) but claims to have solved an existential
//! or Diophantine conjecture (e.g., ¬∃ z, z^2 = p^2 + 2^k*p + 1).

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum CoverageError {
    #[error("Goal coverage failure: proved theorem only covers candidate '{proved_candidate}', while target requires exhaustive '{target_domain}'")]
    IncompleteDomainCoverage {
        proved_candidate: String,
        target_domain: String,
    },
    #[error("Semantic mismatch: target conjecture is '{target_type}', but candidate proof is '{proved_type}'")]
    SemanticMismatch {
        target_type: String,
        proved_type: String,
    },
    #[error("Narrative inflation detected: claimed statement '{narrative_claim}' is stronger than verified Lean AST '{lean_ast_claim}'")]
    NarrativeInflation {
        narrative_claim: String,
        lean_ast_claim: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GoalQuantifier {
    UniversalAll,
    UniversalPrimeOnly,
    UniversalRestricted { condition: String },
    Existential,
    NegatedExistential,
    SpecificPoint(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormalGoalDescriptor {
    pub name: String,
    pub target_predicate: String,
    pub quantifier: GoalQuantifier,
    pub is_diophantine_classification: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvedTheoremDescriptor {
    pub proof_name: String,
    pub proved_predicate: String,
    pub quantifier: GoalQuantifier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalCoverageReport {
    pub is_fully_covered: bool,
    pub coverage_ratio: f64,
    pub verified_scope: String,
    pub remaining_open_obligations: Vec<String>,
}

pub struct GoalCoverageGuard;

impl GoalCoverageGuard {
    /// Validates whether a candidate proved theorem structurally and semantically covers the target goal.
    pub fn validate_coverage(
        target: &FormalGoalDescriptor,
        proved: &ProvedTheoremDescriptor,
        narrative_claim: &str,
    ) -> Result<GoalCoverageReport, CoverageError> {
        // 1. Check for Narrative Inflation (narrative claiming universal non-existence when proved is specific point)
        if matches!(proved.quantifier, GoalQuantifier::SpecificPoint(_))
            && (narrative_claim.to_lowercase().contains("no solution")
                || narrative_claim.to_lowercase().contains("trapping")
                || narrative_claim.to_lowercase().contains("all z"))
        {
            return Err(CoverageError::NarrativeInflation {
                narrative_claim: narrative_claim.to_string(),
                lean_ast_claim: proved.proved_predicate.clone(),
            });
        }

        // 2. Check if a NegatedExistential goal (e.g. ¬∃ z, z^2 = ...) is claimed to be solved by SpecificPoint (e.g. z = p+1)
        if matches!(target.quantifier, GoalQuantifier::NegatedExistential) {
            match &proved.quantifier {
                GoalQuantifier::SpecificPoint(cand) => {
                    return Err(CoverageError::IncompleteDomainCoverage {
                        proved_candidate: cand.clone(),
                        target_domain: "∀ z ∈ ℕ".to_string(),
                    });
                }
                GoalQuantifier::NegatedExistential => {
                    return Ok(GoalCoverageReport {
                        is_fully_covered: true,
                        coverage_ratio: 1.0,
                        verified_scope: "Exhaustive Non-existence (∀ z)".to_string(),
                        remaining_open_obligations: vec![],
                    });
                }
                _ => {}
            }
        }

        // 3. Exact matching case
        if target.quantifier == proved.quantifier {
            Ok(GoalCoverageReport {
                is_fully_covered: true,
                coverage_ratio: 1.0,
                verified_scope: format!("{:?}", proved.quantifier),
                remaining_open_obligations: vec![],
            })
        } else {
            Ok(GoalCoverageReport {
                is_fully_covered: false,
                coverage_ratio: 0.0,
                verified_scope: format!("Auxiliary Sub-Lemma ({:?})", proved.quantifier),
                remaining_open_obligations: vec![format!(
                    "Promote from {:?} to {:?}",
                    proved.quantifier, target.quantifier
                )],
            })
        }
    }
}
