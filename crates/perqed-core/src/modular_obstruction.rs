//! Modular Residue Obstruction Engine
//!
//! Automatically discovers local-global obstructions (Hasse principle failures,
//! quadratic and higher power non-residues) for parameterized Diophantine equations.
//! Evaluates expressions f(p, k) mod m across standard moduli (e.g. mod 8, mod 3, mod 4, mod 5)
//! to prove the non-existence of integer solutions over entire congruence classes.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResidueObstruction {
    pub modulus: u64,
    pub power_exponent: u32,
    pub valid_residues: Vec<u64>,
    pub obstructed_classes: Vec<CongruenceClassObstruction>,
    pub summary_theorem: String,
    pub lean4_lemma_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CongruenceClassObstruction {
    pub variable: String,
    pub class_modulus: u64,
    pub residue_value: u64,
    pub resulting_residue: u64,
}

pub struct ModularResidueObstructionEngine {
    pub candidate_moduli: Vec<u64>,
}

impl Default for ModularResidueObstructionEngine {
    fn default() -> Self {
        Self {
            candidate_moduli: vec![3, 4, 5, 7, 8, 9, 11, 13, 16, 24],
        }
    }
}

impl ModularResidueObstructionEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Computes the set of power residues modulo `m` for x^exponent
    pub fn compute_power_residues(modulus: u64, exponent: u32) -> HashSet<u64> {
        let mut residues = HashSet::new();
        for x in 0..modulus {
            let mut val: u128 = 1;
            for _ in 0..exponent {
                val = (val * (x as u128)) % (modulus as u128);
            }
            residues.insert(val as u64);
        }
        residues
    }

    /// Tests whether a parameterized function f(p) = p^2 + (2^k * p + 1) has modular obstructions mod 8
    pub fn analyze_cunningham_mod8_obstruction(&self, k: u32) -> Option<ResidueObstruction> {
        let modulus = 8;
        let power_exponent = 2;
        let valid_sq_mod8 = Self::compute_power_residues(modulus, power_exponent); // {0, 1, 4}

        let mut obstructed = Vec::new();

        // Check each p mod 4 class
        for p_rem in 0..4 {
            let sample_p = p_rem;
            // Compute (p^2 + 2^k * p + 1) mod 8
            let p2 = (sample_p * sample_p) % modulus;
            let two_k = if k == 2 {
                4
            } else {
                0 // 2^k is 0 mod 8 for k >= 3
            };
            let affine_term = (two_k * sample_p + 1) % modulus;
            let total_rem = (p2 + affine_term) % modulus;

            if !valid_sq_mod8.contains(&total_rem) {
                obstructed.push(CongruenceClassObstruction {
                    variable: "p".to_string(),
                    class_modulus: 4,
                    residue_value: p_rem,
                    resulting_residue: total_rem,
                });
            }
        }

        if !obstructed.is_empty() {
            let valid_vec: Vec<u64> = {
                let mut v: Vec<u64> = valid_sq_mod8.into_iter().collect();
                v.sort_unstable();
                v
            };

            let summary = format!(
                "For k={}, p^2 + 2^k*p + 1 is never a square when p mod 4 is in {:?} because resulting residue is in {:?} (valid squares mod 8 are {:?}).",
                k,
                obstructed.iter().map(|o| o.residue_value).collect::<Vec<_>>(),
                obstructed.iter().map(|o| o.resulting_residue).collect::<Vec<_>>(),
                valid_vec
            );

            let lean_snippet = format!(
                "theorem cunningham_mod8_obstruction_k{k} (p z : Nat) (hp : p % 4 ≠ 0) : p^2 + (2^{k} * p + 1) ≠ z^2",
            );

            Some(ResidueObstruction {
                modulus,
                power_exponent,
                valid_residues: valid_vec,
                obstructed_classes: obstructed,
                summary_theorem: summary,
                lean4_lemma_snippet: lean_snippet,
            })
        } else {
            None
        }
    }

    /// Generic modular obstruction scanner for any arbitrary integer polynomial/exponential function
    pub fn scan_univariate_obstruction<F>(&self, expr: F, exponent: u32, var_name: &str) -> Vec<ResidueObstruction>
    where
        F: Fn(u64) -> u64,
    {
        let mut results = Vec::new();

        for &m in &self.candidate_moduli {
            let valid_res = Self::compute_power_residues(m, exponent);
            let mut obstructed = Vec::new();

            for r in 0..m {
                let val = expr(r);
                let rem = val % m;
                if !valid_res.contains(&rem) {
                    obstructed.push(CongruenceClassObstruction {
                        variable: var_name.to_string(),
                        class_modulus: m,
                        residue_value: r,
                        resulting_residue: rem,
                    });
                }
            }

            if !obstructed.is_empty() && obstructed.len() < (m as usize) {
                let mut valid_vec: Vec<u64> = valid_res.into_iter().collect();
                valid_vec.sort_unstable();

                let summary = format!(
                    "Modulo {} obstruction: {} classes {:?} yield non-residues mod {}.",
                    m,
                    var_name,
                    obstructed.iter().map(|o| o.residue_value).collect::<Vec<_>>(),
                    m
                );

                results.push(ResidueObstruction {
                    modulus: m,
                    power_exponent: exponent,
                    valid_residues: valid_vec,
                    obstructed_classes: obstructed,
                    summary_theorem: summary,
                    lean4_lemma_snippet: format!("-- Modulo {m} non-residue obstruction for {var_name}"),
                });
            }
        }

        results
    }
}
