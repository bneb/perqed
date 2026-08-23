//! Lean 4 Specification Completeness & Target Goal Validator
//!
//! Enforces that generated Lean 4 specifications directly formalize the top-level
//! mathematical target goal (e.g. `p^2 + (2^k * p + 1) = z^2 -> False` for Diophantine obstructions)
//! rather than stopping short at intermediate helper lemmas (e.g. `z^2 % 8 = 2 -> False`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeanSpecValidationFinding {
    pub check_id: String,
    pub severity: SpecValidationSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpecValidationSeverity {
    Blocking,
    Warning,
}

pub struct LeanSpecCompletenessValidator;

impl LeanSpecCompletenessValidator {
    /// Validates that a Lean 4 specification file contains an explicit top-level
    /// specification for the target Diophantine equation and hypothesis constraints.
    pub fn validate_diophantine_spec(
        spec_content: &str,
        target_equation: &str,
        is_obstruction: bool,
    ) -> Vec<LeanSpecValidationFinding> {
        let mut findings = Vec::new();

        // 1. Check if the target equation text is present in the spec declarations
        let normalized_target = target_equation.replace(' ', "");
        let normalized_spec = spec_content.replace(' ', "");

        if !normalized_spec.contains(&normalized_target) {
            findings.push(LeanSpecValidationFinding {
                check_id: "TARGET_EQUATION_MISSING_IN_SPEC".to_string(),
                severity: SpecValidationSeverity::Blocking,
                message: format!(
                    "The target equation '{}' is missing from the Lean specification definitions. Helper lemmas alone do not constitute a formalization of the target conjecture.",
                    target_equation
                ),
            });
        }

        // 2. If an obstruction/non-existence is claimed, ensure a spec has `... = z^2 -> False` or `¬(...)`
        if is_obstruction {
            let has_negation_goal = spec_content.contains("-> False") 
                || spec_content.contains("→ False") 
                || spec_content.contains("¬");
            let has_eq_in_hypothesis = normalized_spec.contains(&format!("{}=", normalized_target))
                || normalized_spec.contains(&format!("{}→False", normalized_target))
                || normalized_spec.contains(&format!("{}->False", normalized_target));

            if !has_negation_goal || !has_eq_in_hypothesis {
                findings.push(LeanSpecValidationFinding {
                    check_id: "OBSTRUCTION_EQUATION_NOT_NEGATED_DIRECTLY".to_string(),
                    severity: SpecValidationSeverity::Blocking,
                    message: "The specification claims a non-existence / modular obstruction theorem, but does not contain a top-level declaration taking the target equation as hypothesis and concluding `False`.".to_string(),
                });
            }
        }

        // 3. Check for integer division truncation hazard in `Nat` specifications
        if spec_content.contains("/ 2") || spec_content.contains("/ 4") || spec_content.contains("/ 8") {
            findings.push(LeanSpecValidationFinding {
                check_id: "NAT_DIVISION_TRUNCATION_HAZARD".to_string(),
                severity: SpecValidationSeverity::Warning,
                message: "Specification uses integer division in `Nat` (e.g. `/ 2`). Consider refactoring to multiplicative form (e.g. `2 * p > ...`) to avoid floor truncation artifacts.".to_string(),
            });
        }

        findings
    }
}
