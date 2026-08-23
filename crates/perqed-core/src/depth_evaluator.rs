//! Mathematical Depth & Technique Rigor Evaluator
//!
//! Rejects trivial Presburger arithmetic / identity substitutions and prioritizes
//! graduate-level analytical, sieve-theoretic, and structural mathematics.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DepthClassification {
    /// Score < 0.3: Pure Presburger arithmetic (`omega`), direct identity expansion (`ring`),
    /// or decidable finite computation (`decide`, `rfl`). Penalized heavily.
    TrivialPresburgerOrIdentity,
    /// Score 0.3 - 0.7: Local modular obstruction scanning, difference of squares variety
    /// parametrization, or integer interval trapping.
    IntermediateParametricVariety,
    /// Score > 0.7: Linear forms in logarithms (Baker's method), Baker-Davenport reduction,
    /// asymptotic sieve density bounds, or exact algebraic field embeddings.
    AdvancedAnalyticalExhaustiveness,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepthEvaluationReport {
    pub classification: DepthClassification,
    pub raw_depth_score: f64,
    pub depth_multiplier: f64,
    pub detected_techniques: Vec<String>,
    pub is_publication_grade: bool,
    pub rationale: String,
}

pub struct MathematicalDepthEvaluator;

impl MathematicalDepthEvaluator {
    /// Evaluates the mathematical depth of a theorem or conjecture based on its proof term,
    /// tactics, mathematical structure, and analytical techniques.
    pub fn evaluate_depth(
        conjecture_statement: &str,
        proof_term_or_tactics: &str,
        has_analytical_bound: bool,
        has_exhaustiveness_reduction: bool,
    ) -> DepthEvaluationReport {
        let mut detected_techniques = Vec::new();
        let mut depth_points: f64 = 0.0;

        let proof_lower = proof_term_or_tactics.to_lowercase();
        let stmt_lower = conjecture_statement.to_lowercase();

        // 1. Analytical & Graduate-Level Techniques (+0.5 to +0.8)
        if has_exhaustiveness_reduction || proof_lower.contains("baker") || proof_lower.contains("logarithm") || proof_lower.contains("matveev") {
            detected_techniques.push("Baker's Method / Linear Forms in Logarithms".to_string());
            depth_points += 0.50;
        }

        if proof_lower.contains("continued_fraction") || proof_lower.contains("baker_davenport") || proof_lower.contains("convergent") {
            detected_techniques.push("Baker-Davenport Continued Fraction Reduction".to_string());
            depth_points += 0.35;
        }

        if has_analytical_bound || stmt_lower.contains("asymptotic") || stmt_lower.contains("density") || proof_lower.contains("sieve") {
            detected_techniques.push("Asymptotic / Sieve-Theoretic Bound".to_string());
            depth_points += 0.30;
        }

        if stmt_lower.contains("field") || stmt_lower.contains("qsqrt") || stmt_lower.contains("chromatic") {
            detected_techniques.push("Algebraic Field Embedding / Invariant Theory".to_string());
            depth_points += 0.25;
        }

        // 2. Intermediate Parametric & Structural Techniques (+0.2 to +0.4)
        if proof_lower.contains("modular_obstruction") || proof_lower.contains("% 8") || proof_lower.contains("quadratic_residue") {
            detected_techniques.push("Local-Global Modular Non-Residue Obstruction".to_string());
            depth_points += 0.20;
        }

        if proof_lower.contains("divisor_param") || stmt_lower.contains("parametrization") || proof_lower.contains("d1 * d2") {
            detected_techniques.push("Difference-of-Squares Divisor Variety".to_string());
            depth_points += 0.20;
        }

        // 3. Trivial / Elementary Indicators (Penalties if NO advanced techniques present)
        let is_purely_presburger = (proof_lower.contains("omega") || proof_lower.contains("decide") || proof_lower.contains("rfl"))
            && !has_analytical_bound && !has_exhaustiveness_reduction && detected_techniques.is_empty();

        if is_purely_presburger {
            detected_techniques.push("Elementary Presburger / Direct Reduction".to_string());
            depth_points = 0.10;
        }

        // Compute Classification & Multipliers
        let (classification, depth_multiplier, is_publication_grade) = if depth_points >= 0.70 {
            (DepthClassification::AdvancedAnalyticalExhaustiveness, 3.5, true)
        } else if depth_points >= 0.30 {
            (DepthClassification::IntermediateParametricVariety, 1.0, true)
        } else {
            (DepthClassification::TrivialPresburgerOrIdentity, 0.15, false)
        };

        let rationale = match classification {
            DepthClassification::AdvancedAnalyticalExhaustiveness => {
                "Research-grade theorem deploying effective analytical bounds, Baker-Davenport reductions, or asymptotic density theory."
            }
            DepthClassification::IntermediateParametricVariety => {
                "Solid intermediate structural result combining local modular obstructions with complete variety parametrizations."
            }
            DepthClassification::TrivialPresburgerOrIdentity => {
                "Undergraduate-level or high-school algebra relying solely on Presburger arithmetic (omega) or direct identity expansion."
            }
        }.to_string();

        DepthEvaluationReport {
            classification,
            raw_depth_score: depth_points.clamp(0.0, 1.0),
            depth_multiplier,
            detected_techniques,
            is_publication_grade,
            rationale,
        }
    }
}
