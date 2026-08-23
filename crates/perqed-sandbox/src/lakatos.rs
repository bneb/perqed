//! Lakatosian Vault & Counterexample Refinement Engine
//!
//! Tracks falsified hypotheses in an immutable abstract graveyard and performs
//! automated boundary refinement (Proofs and Refutations methodology) to isolate
//! obstructions and synthesize corrected conjectures.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LakatosError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraveyardEntry {
    pub hypothesis_signature: String,
    pub failure_reason: String,
    pub killer_counterexample: serde_json::Value,
    pub timestamp: String,
}

pub struct LakatosianVault {
    graveyard_path: PathBuf,
    entries: Vec<GraveyardEntry>,
}

impl LakatosianVault {
    pub fn new<P: AsRef<Path>>(workspace_dir: P) -> Self {
        let path = workspace_dir.as_ref().join("data/abstract_graveyard.json");
        let mut vault = Self {
            graveyard_path: path,
            entries: Vec::new(),
        };
        let _ = vault.load();
        vault
    }

    /// Normalizes a hypothesis string by removing excess whitespace and casing
    pub fn normalize_signature(hypothesis: &str) -> String {
        hypothesis
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
            .to_lowercase()
    }

    fn load(&mut self) -> Result<(), LakatosError> {
        if self.graveyard_path.exists() {
            let content = fs::read_to_string(&self.graveyard_path)?;
            self.entries = serde_json::from_str(&content)?;
        }
        Ok(())
    }

    fn save(&self) -> Result<(), LakatosError> {
        if let Some(parent) = self.graveyard_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&self.entries)?;
        fs::write(&self.graveyard_path, json)?;
        Ok(())
    }

    /// Records a strictly falsified hypothesis along with its minimal counterexample
    pub fn record_failure(
        &mut self,
        hypothesis: &str,
        counterexample: &serde_json::Value,
        failure_reason: &str,
    ) -> Result<bool, LakatosError> {
        let normalized = Self::normalize_signature(hypothesis);

        // Deduplication check
        if self.entries.iter().any(|e| Self::normalize_signature(&e.hypothesis_signature) == normalized) {
            return Ok(false);
        }

        let entry = GraveyardEntry {
            hypothesis_signature: hypothesis.to_string(),
            failure_reason: failure_reason.to_string(),
            killer_counterexample: counterexample.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        self.entries.push(entry);
        self.save()?;
        Ok(true)
    }

    /// Checks whether an exact or normalized hypothesis is already known to be false
    pub fn is_falsified(&self, hypothesis: &str) -> bool {
        let normalized = Self::normalize_signature(hypothesis);
        self.entries
            .iter()
            .any(|e| Self::normalize_signature(&e.hypothesis_signature) == normalized)
    }

    pub fn all_graveyard_entries(&self) -> &[GraveyardEntry] {
        &self.entries
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefinedHypothesis {
    pub conjecture_id: String,
    pub domain: String,
    pub informal_claim: String,
    pub hypotheses: Vec<String>,
    pub target: String,
    pub variables: HashMap<String, String>,
}

pub struct LakatosianRefiner;

impl LakatosianRefiner {
    /// Synthesizes a refined boundary hypothesis by isolating the structural obstruction exposed by the counterexample
    pub fn refine_hypothesis(
        conjecture_id: &str,
        domain: &str,
        informal_claim: &str,
        hypotheses: &[String],
        target: &str,
        variables: &HashMap<String, String>,
        counterexample: &serde_json::Value,
    ) -> Option<RefinedHypothesis> {
        let mut new_hypotheses = hypotheses.to_vec();

        if let Some(obj) = counterexample.as_object() {
            for (var_name, val) in obj {
                if let Some(num) = val.as_i64() {
                    // Check if negative value violated a quadratic/power constraint
                    if num < 0 && (target.contains(&format!("{} >=", var_name)) || target.contains(&format!("{}^2", var_name))) {
                        new_hypotheses.push(format!("{} >= 0", var_name));
                    } else if num > 0 && target.contains(&format!("{} <=", var_name)) {
                        new_hypotheses.push(format!("{} <= 0", var_name));
                    } else {
                        new_hypotheses.push(format!("{} != {}", var_name, num));
                    }
                } else if let Some(num) = val.as_f64() {
                    if num < 0.0 && (target.contains(&format!("{} >=", var_name)) || target.contains(&format!("{}^2", var_name))) {
                        new_hypotheses.push(format!("{} >= 0", var_name));
                    } else {
                        new_hypotheses.push(format!("{} != {}", var_name, num));
                    }
                }
            }
        }

        Some(RefinedHypothesis {
            conjecture_id: format!("{}_refined", conjecture_id),
            domain: domain.to_string(),
            informal_claim: format!("{} (refined boundary condition)", informal_claim),
            hypotheses: new_hypotheses,
            target: target.to_string(),
            variables: variables.clone(),
        })
    }
}
