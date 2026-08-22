//! Sandboxed Falsification Gate
//!
//! Falsify-First barrier running SMT (Z3), CAS (SymPy), and Non-Vacuity separation probers
//! within isolated process sandboxes to eliminate >90% of unsound conjectures prior to proof search.

use crate::types::Conjecture;
use perqed_sandbox::{CustomPredicate, FalsificationPayload, FalsificationVerdict, SandboxRunner};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tracing::{info, warn};

#[derive(Error, Debug)]
pub enum FalsificationGateError {
    #[error("Sandbox runner error: {0}")]
    Sandbox(#[from] perqed_sandbox::SandboxError),
    #[error("Conjecture falsified! Counterexample: {0:?}, Reason: {1}")]
    ConjectureFalsified(Option<HashMap<String, serde_json::Value>>, String),
    #[error("Conjecture rejected as vacuous (H ⊢ ⊥): {0}")]
    VacuousHypotheses(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PredicateSpec {
    pub name: String,
    pub expr: String,
    #[serde(default)]
    pub variables: HashMap<String, String>,
}

pub struct FalsificationGate {
    runner: SandboxRunner,
}

impl FalsificationGate {
    pub fn new(runner: SandboxRunner) -> Self {
        Self { runner }
    }

    /// Run full falsification suite against candidate conjecture
    pub async fn check_conjecture(
        &self,
        conjecture: &Conjecture,
    ) -> Result<FalsificationVerdict, FalsificationGateError> {
        info!("Executing Sandboxed Falsification Gate on conjecture: {}", conjecture.conjecture_id);

        let custom_predicates: Vec<CustomPredicate> = conjecture
            .custom_predicates
            .iter()
            .map(|p| CustomPredicate {
                name: p.name.clone(),
                expr: p.expr.clone(),
                variables: p.variables.clone(),
                domain_bounds: None,
            })
            .collect();

        let payload = FalsificationPayload {
            conjecture_id: conjecture.conjecture_id.clone(),
            domain: conjecture.domain.clone(),
            informal_claim: conjecture.informal_claim.clone(),
            variables: conjecture.variables.clone(),
            hypotheses: conjecture.hypotheses.clone(),
            target: conjecture.target.clone(),
            custom_predicates,
            domain_bounds: None,
        };

        let verdict = self.runner.run_falsification(&payload).await?;

        if !verdict.hypothesis_consistent {
            warn!("Conjecture {} rejected: hypotheses are contradictory (H ⊢ ⊥)", conjecture.conjecture_id);
            return Err(FalsificationGateError::VacuousHypotheses(verdict.reason));
        }

        if verdict.falsified {
            warn!("Conjecture {} falsified! Reason: {}", conjecture.conjecture_id, verdict.reason);
            return Err(FalsificationGateError::ConjectureFalsified(
                verdict.counterexample,
                verdict.reason,
            ));
        }

        info!("✅ Falsification Gate passed for {}", conjecture.conjecture_id);
        Ok(verdict)
    }
}
