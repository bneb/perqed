//! Empirical Discovery & Negative Folklore Registry
//!
//! Terence Tao (Nov 2025 / Discovery at Scale & June 2026 SAIR Challenges):
//! "Using automated discovery tools to systematically record negative results
//!  (e.g., that a thorough search for obvious counterexamples to a conjecture did not disprove it),
//!  transforming subjective folklore into rigorous, quantified empirical datasets."

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConjectureStatus {
    /// Formally proven and verified by the Lean 4 kernel
    VerifiedTheorem {
        proof_script: String,
        kernel_duration_ms: u64,
    },
    /// Falsified by an exact algebraic or arithmetic counterexample
    FalsifiedCounterexample {
        counterexample_witness: String,
        method: String,
    },
    /// Survived extensive multi-engine falsification without counterexamples (Negative Folklore Evidence)
    EmpiricalFolkloreSurviving {
        sample_budget: usize,
        search_depth: usize,
        symmetry_slices_tested: Vec<String>,
    },
    /// Hypotheses proved contradictory (H ⊢ ⊥)
    VacuousHypothesisRejected {
        contradiction_premise: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RegistryEntry {
    pub id: String,
    pub conjecture_name: String,
    pub statement: String,
    pub domain: String,
    pub mdl_complexity_bits: f64,
    pub status: ConjectureStatus,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmpiricalDiscoveryRegistry {
    pub entries: Vec<RegistryEntry>,
}

impl EmpiricalDiscoveryRegistry {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    /// Record a discovery or exploration outcome
    pub fn record(
        &mut self,
        id: &str,
        conjecture_name: &str,
        statement: &str,
        domain: &str,
        mdl_complexity_bits: f64,
        status: ConjectureStatus,
    ) {
        self.entries.push(RegistryEntry {
            id: id.to_string(),
            conjecture_name: conjecture_name.to_string(),
            statement: statement.to_string(),
            domain: domain.to_string(),
            mdl_complexity_bits,
            status,
        });
    }

    pub fn verified_theorems(&self) -> Vec<&RegistryEntry> {
        self.entries
            .iter()
            .filter(|e| matches!(e.status, ConjectureStatus::VerifiedTheorem { .. }))
            .collect()
    }

    pub fn falsified_conjectures(&self) -> Vec<&RegistryEntry> {
        self.entries
            .iter()
            .filter(|e| matches!(e.status, ConjectureStatus::FalsifiedCounterexample { .. }))
            .collect()
    }

    pub fn folklore_surviving(&self) -> Vec<&RegistryEntry> {
        self.entries
            .iter()
            .filter(|e| matches!(e.status, ConjectureStatus::EmpiricalFolkloreSurviving { .. }))
            .collect()
    }

    /// Export structured markdown summary table
    pub fn export_markdown_table(&self) -> String {
        let mut md = String::from("| ID | Conjecture | Domain | Status | Witness / Proof Info |\n");
        md.push_str("| :--- | :--- | :--- | :--- | :--- |\n");

        for e in &self.entries {
            let (status_str, detail) = match &e.status {
                ConjectureStatus::VerifiedTheorem { kernel_duration_ms, .. } => {
                    ("Verified (Lean 4)", format!("Kernel: {}ms", kernel_duration_ms))
                }
                ConjectureStatus::FalsifiedCounterexample { counterexample_witness, method } => {
                    ("Falsified", format!("{}: {}", method, counterexample_witness))
                }
                ConjectureStatus::EmpiricalFolkloreSurviving { sample_budget, search_depth, .. } => {
                    ("Folklore Surviving", format!("Samples: {}, Depth: {}", sample_budget, search_depth))
                }
                ConjectureStatus::VacuousHypothesisRejected { contradiction_premise } => {
                    ("Vacuous (Rejected)", contradiction_premise.clone())
                }
            };
            md.push_str(&format!(
                "| {} | {} | {} | {} | {} |\n",
                e.id, e.conjecture_name, e.domain, status_str, detail
            ));
        }

        md
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_recording_and_filtering() {
        let mut reg = EmpiricalDiscoveryRegistry::new();

        reg.record(
            "thm-1",
            "LinearMapInjectivity",
            "∀ (f : V → W), Injective f ↔ Ker f = {0}",
            "linear_algebra",
            42.0,
            ConjectureStatus::VerifiedTheorem {
                proof_script: "exact LinearMap.injective_iff_ker_eq_bot.mpr".to_string(),
                kernel_duration_ms: 12,
            },
        );

        reg.record(
            "conj-2",
            "JacobianConjecture3D",
            "det DF = const ⇒ Invertible F",
            "algebraic_geometry",
            120.0,
            ConjectureStatus::FalsifiedCounterexample {
                counterexample_witness: "F(z1,z2,z3) of deg 7 with det DF = -2".to_string(),
                method: "SL2C_Symmetry_Slicing".to_string(),
            },
        );

        reg.record(
            "folk-3",
            "SendovConjectureExtreme",
            "Roots of P in unit disk ⇒ root of P' within distance 1",
            "complex_analysis",
            64.0,
            ConjectureStatus::EmpiricalFolkloreSurviving {
                sample_budget: 100_000,
                search_depth: 10,
                symmetry_slices_tested: vec!["UnitCircleRoots".to_string()],
            },
        );

        assert_eq!(reg.verified_theorems().len(), 1);
        assert_eq!(reg.falsified_conjectures().len(), 1);
        assert_eq!(reg.folklore_surviving().len(), 1);

        let table = reg.export_markdown_table();
        assert!(table.contains("JacobianConjecture3D"));
        assert!(table.contains("SendovConjectureExtreme"));
    }
}
