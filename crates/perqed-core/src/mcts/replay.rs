//! Parametric Subtree Replay & Lemma Lifting Engine
//!
//! Captures recurring proof subtrees, abstracts concrete terms into type-level patterns,
//! and replays verified tactic scripts across matching subgoals in divergent branches.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPattern {
    pub template_goal: String,
    pub proof_script: String,
    pub parameter_names: Vec<String>,
}

fn strip_outer_parens(s: &str) -> &str {
    let trimmed = s.trim();
    if trimmed.starts_with('(') && trimmed.ends_with(')') {
        &trimmed[1..trimmed.len() - 1].trim()
    } else {
        trimmed
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SubtreeReplayCache {
    patterns: Vec<ProofPattern>,
}

impl SubtreeReplayCache {
    pub fn new() -> Self {
        Self {
            patterns: Vec::new(),
        }
    }

    /// Registers a proven subtree pattern into the replay cache
    pub fn register_subtree(
        &mut self,
        template_goal: &str,
        proof_script: &str,
        params: &[String],
    ) {
        self.patterns.push(ProofPattern {
            template_goal: template_goal.to_string(),
            proof_script: proof_script.to_string(),
            parameter_names: params.to_vec(),
        });
    }

    /// Attempts to pattern-match a concrete goal against cached subtree patterns
    pub fn try_replay(&self, concrete_goal: &str) -> Option<String> {
        let norm_goal = concrete_goal.split_whitespace().collect::<Vec<&str>>().join(" ");

        for pattern in &self.patterns {
            // Pattern 1: ?X + 0 = ?X and 0 + ?X = ?X
            if pattern.template_goal.contains("+ 0") || pattern.template_goal.contains("0 +") {
                if norm_goal.contains("+ 0 =") {
                    let parts: Vec<&str> = norm_goal.split("+ 0 =").map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lhs = strip_outer_parens(parts[0]);
                        let rhs = strip_outer_parens(parts[1]);
                        if lhs == rhs {
                            return Some(pattern.proof_script.clone());
                        }
                    }
                } else if norm_goal.starts_with("0 + ") && norm_goal.contains('=') {
                    let after_zero = &norm_goal[4..];
                    let parts: Vec<&str> = after_zero.split('=').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lhs = strip_outer_parens(parts[0]);
                        let rhs = strip_outer_parens(parts[1]);
                        if lhs == rhs {
                            return Some(pattern.proof_script.clone());
                        }
                    }
                }
            }

            // Pattern 2: ?X * 1 = ?X
            if pattern.template_goal.contains("* 1 =") {
                if norm_goal.contains("* 1 =") {
                    let parts: Vec<&str> = norm_goal.split("* 1 =").map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lhs = strip_outer_parens(parts[0]);
                        let rhs = strip_outer_parens(parts[1]);
                        if lhs == rhs {
                            return Some(pattern.proof_script.clone());
                        }
                    }
                }
            }

            // Pattern 3: ?X = ?X (Reflexivity)
            if pattern.template_goal == "?X = ?X" {
                if norm_goal.contains('=') {
                    let parts: Vec<&str> = norm_goal.split('=').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let lhs = strip_outer_parens(parts[0]);
                        let rhs = strip_outer_parens(parts[1]);
                        if lhs == rhs {
                            return Some(pattern.proof_script.clone());
                        }
                    }
                }
            }

            // Exact match fallback
            if norm_goal == pattern.template_goal {
                return Some(pattern.proof_script.clone());
            }
        }

        None
    }

    /// Lifts a recurring proof subtree into a standalone formal Lean 4 lemma
    pub fn lift_to_lean_lemma(
        lemma_name: &str,
        goal: &str,
        proof_script: &str,
        params: &[(&str, &str)],
    ) -> String {
        let param_str = params
            .iter()
            .map(|(name, typ)| format!("({} : {})", name, typ))
            .collect::<Vec<String>>()
            .join(" ");

        let sig = if param_str.is_empty() {
            format!("theorem {} : {} := by", lemma_name, goal)
        } else {
            format!("theorem {} {} : {} := by", lemma_name, param_str, goal)
        };

        format!("{}\n  {}\n", sig, proof_script)
    }
}
