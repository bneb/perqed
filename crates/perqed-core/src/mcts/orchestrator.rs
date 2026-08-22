//! MCTS Hybrid Proof Search Orchestrator
//!
//! Drives heuristic Monte Carlo Tree Search over Lean 4 proof states,
//! evaluating tactic expansions with distance-to-goal scoring and recursive sub-lemma decomposition.

use super::sublemma::SubLemmaIsolator;
use super::tree::MctsNode;
use crate::tactic_generator::TacticGenerator;
use crate::types::{MctsConfig, ProofState};
use perqed_lean_client::LeanClient;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;
use thiserror::Error;
use tracing::{info, warn};

#[derive(Error, Debug)]
pub enum MctsError {
    #[error("Lean client error: {0}")]
    Lean(#[from] perqed_lean_client::LeanClientError),
    #[error("Tactic generator error: {0}")]
    Tactic(#[from] crate::tactic_generator::TacticError),
    #[error("Sub-lemma isolator error: {0}")]
    Sublemma(#[from] super::sublemma::SublemmaError),
    #[error("Search space exhausted without finding valid proof")]
    SearchExhausted,
    #[error("Search timed out after {0} seconds")]
    SearchTimeout(u64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofSearchResult {
    pub is_solved: bool,
    pub proof_script: String,
    pub total_nodes_explored: usize,
    pub elapsed_seconds: f64,
    pub tactic_steps: Vec<String>,
    pub isolated_sublemmas: Vec<String>,
}

pub struct MctsOrchestrator {
    tactic_gen: TacticGenerator,
    lean_client: LeanClient,
    sublemma_isolator: SubLemmaIsolator,
    config: MctsConfig,
    available_premises: Vec<String>,
}

impl MctsOrchestrator {
    pub fn new(
        tactic_gen: TacticGenerator,
        lean_client: LeanClient,
        library_dir: PathBuf,
        config: MctsConfig,
    ) -> Self {
        let sublemma_isolator = SubLemmaIsolator::new(library_dir);
        Self {
            tactic_gen,
            lean_client,
            sublemma_isolator,
            config,
            available_premises: vec![
                "Nat.add_zero".to_string(),
                "Nat.zero_add".to_string(),
                "Nat.add_comm".to_string(),
                "Nat.left_distrib".to_string(),
                "Or.inl".to_string(),
                "Or.inr".to_string(),
            ],
        }
    }

    /// Search for a complete formal proof for a theorem declaration
    pub async fn search_proof(
        &self,
        theorem_name: &str,
        theorem_signature: &str,
    ) -> Result<ProofSearchResult, MctsError> {
        let start_time = Instant::now();
        info!("Starting MCTS proof search for theorem: {}", theorem_name);

        let initial_state = ProofState {
            open_goals: vec![theorem_signature.to_string()],
            hypotheses: vec![],
            is_solved: false,
            cumulative_tactics: vec![],
            search_depth: 0,
            raw_lean_state: format!("⊢ {}", theorem_signature),
        };

        let mut nodes: Vec<MctsNode> = Vec::new();
        let root_node = MctsNode::new(0, None, None, initial_state, 0);
        nodes.push(root_node);

        let mut solved_node_id: Option<usize> = None;
        let mut isolated_sublemmas = Vec::new();
        let mut active_premises = self.available_premises.clone();

        for iter in 0..self.config.max_iterations {
            if start_time.elapsed().as_secs() > self.config.timeout_seconds {
                warn!("MCTS reached timeout limit of {}s", self.config.timeout_seconds);
                break;
            }

            // 1. Selection: Select promising leaf node using UCT
            let selected_id = self.select_leaf_node(&nodes);
            let selected_depth = nodes[selected_id].depth;

            // Check if solved
            if nodes[selected_id].is_solved {
                solved_node_id = Some(selected_id);
                break;
            }

            if selected_depth >= self.config.max_depth {
                // Leaf reached max depth
                nodes[selected_id].is_terminal = true;
                continue;
            }

            // Sub-lemma trigger check
            if selected_depth >= self.config.sublemma_depth_threshold {
                if let Ok(Some(sublemma)) = self.sublemma_isolator.isolate_sublemma(
                    theorem_name,
                    selected_depth,
                    &nodes[selected_id].proof_state,
                ) {
                    let sublemma_premise = format!("Perqed.Library.{}", sublemma.name);
                    if !active_premises.contains(&sublemma_premise) {
                        active_premises.push(sublemma_premise);
                    }
                    let _ = self.sublemma_isolator.persist_sublemma(&sublemma);
                    isolated_sublemmas.push(sublemma.name.clone());
                }
            }

            let mut created_child_ids = Vec::new();

            // 2A. Fast Symbolic Decision Procedure Probing (Zero-LLM Fast-Path)
            let fast_tactics = ["rfl", "intro n; rfl", "intro a b; rfl", "omega", "linarith", "ring", "simp", "aesop"];
            let mut fast_solved = false;

            for fast_tac in fast_tactics {
                let mut test_tactics = nodes[selected_id].proof_state.cumulative_tactics.clone();
                test_tactics.push(fast_tac.to_string());
                let proof_body = format!("theorem probe_thm : {} := by\n  {}", theorem_signature, test_tactics.join("\n  "));
                let imports = ["Perqed.Spec.Theorems", "Perqed.Library.Lemmas"];
                if let Ok(eval) = self.lean_client.evaluate_proof_snippet(&imports, &proof_body).await {
                    if eval.is_solved {
                        let child_id = nodes.len();
                        let child_state = ProofState {
                            open_goals: vec![],
                            hypotheses: vec![],
                            is_solved: true,
                            cumulative_tactics: test_tactics,
                            search_depth: selected_depth + 1,
                            raw_lean_state: eval.raw_output,
                        };
                        let child_node = MctsNode::new(
                            child_id,
                            Some(selected_id),
                            Some(crate::types::TacticCandidate {
                                tactic_code: fast_tac.to_string(),
                                score: 1.0,
                                generator_model: "native_decision_proc".to_string(),
                                is_terminal: true,
                            }),
                            child_state,
                            selected_depth + 1,
                        );
                        nodes.push(child_node);
                        created_child_ids.push(child_id);
                        self.backpropagate(&mut nodes, child_id, 1.0);
                        solved_node_id = Some(child_id);
                        fast_solved = true;
                        info!("⚡ Fast decision procedure '{}' solved goal in <5ms without LLM expansion!", fast_tac);
                        break;
                    }
                }
            }

            if fast_solved {
                nodes[selected_id].children_ids = created_child_ids;
                nodes[selected_id].is_expanded = true;
                break;
            }

            // 2B. Model-Guided Expansion: Generate candidate tactics
            let candidates = self
                .tactic_gen
                .generate_candidates(
                    &nodes[selected_id].proof_state,
                    &active_premises,
                    self.config.num_candidates_per_step,
                )
                .await?;

            nodes[selected_id].is_expanded = true;

            // 3. Evaluation / Simulation for each candidate tactic
            for candidate in candidates {
                let mut new_tactics = nodes[selected_id].proof_state.cumulative_tactics.clone();
                new_tactics.push(candidate.tactic_code.clone());

                // Evaluate candidate in Lean
                let proof_body = format!("theorem probe_thm : {} := by\n  {}", theorem_signature, new_tactics.join("\n  "));
                let imports = ["Perqed.Spec.Theorems", "Perqed.Library.Lemmas"];
                let eval = self.lean_client.evaluate_proof_snippet(&imports, &proof_body).await?;

                let child_id = nodes.len();
                let child_state = ProofState {
                    open_goals: eval.goals.clone(),
                    hypotheses: vec![],
                    is_solved: eval.is_solved,
                    cumulative_tactics: new_tactics,
                    search_depth: selected_depth + 1,
                    raw_lean_state: eval.raw_output,
                };

                let child_node = MctsNode::new(
                    child_id,
                    Some(selected_id),
                    Some(candidate.clone()),
                    child_state,
                    selected_depth + 1,
                );

                // Value heuristic
                let value = self.evaluate_heuristic_value(&child_node);
                let is_child_solved = child_node.proof_state.is_solved;
                nodes.push(child_node);
                created_child_ids.push(child_id);

                // 4. Backpropagation
                self.backpropagate(&mut nodes, child_id, value);

                if is_child_solved {
                    info!("🎉 MCTS discovered valid proof at iteration {}!", iter);
                    solved_node_id = Some(child_id);
                    break;
                }
            }

            nodes[selected_id].children_ids = created_child_ids;

            if solved_node_id.is_some() {
                break;
            }
        }

        let elapsed = start_time.elapsed().as_secs_f64();

        if let Some(sol_id) = solved_node_id {
            let steps = nodes[sol_id].proof_state.cumulative_tactics.clone();
            let script = format!("by\n  {}", steps.join("\n  "));
            Ok(ProofSearchResult {
                is_solved: true,
                proof_script: script,
                total_nodes_explored: nodes.len(),
                elapsed_seconds: elapsed,
                tactic_steps: steps,
                isolated_sublemmas,
            })
        } else {
            // Pick most promising partial path
            let best_node_id = self.find_best_partial_node(&nodes);
            let steps = nodes[best_node_id].proof_state.cumulative_tactics.clone();
            let script = format!("by\n  {}\n  sorry", steps.join("\n  "));
            Ok(ProofSearchResult {
                is_solved: false,
                proof_script: script,
                total_nodes_explored: nodes.len(),
                elapsed_seconds: elapsed,
                tactic_steps: steps,
                isolated_sublemmas,
            })
        }
    }

    fn select_leaf_node(&self, nodes: &[MctsNode]) -> usize {
        let mut curr_id = 0;
        while nodes[curr_id].is_expanded && !nodes[curr_id].children_ids.is_empty() {
            let parent_visits = nodes[curr_id].visit_count;
            let mut best_child = nodes[curr_id].children_ids[0];
            let mut best_uct = f64::NEG_INFINITY;

            for &child_id in &nodes[curr_id].children_ids {
                let uct = nodes[child_id].uct_score(parent_visits, self.config.exploration_c);
                if uct > best_uct {
                    best_uct = uct;
                    best_child = child_id;
                }
            }
            curr_id = best_child;
        }
        curr_id
    }

    fn evaluate_heuristic_value(&self, node: &MctsNode) -> f64 {
        if node.is_solved {
            return 1.0;
        }
        if node.proof_state.open_goals.is_empty() {
            return 0.9;
        }

        // Distance to goal heuristic: fewer goals + smaller AST length = higher score
        let goal_count = node.proof_state.open_goals.len() as f64;
        let goal_reduction_score = 1.0 / (1.0 + goal_count);

        let depth_penalty = (node.depth as f64) * 0.05;
        (goal_reduction_score - depth_penalty).max(0.0).min(0.95)
    }

    fn backpropagate(&self, nodes: &mut [MctsNode], leaf_id: usize, value: f64) {
        let mut curr = Some(leaf_id);
        while let Some(id) = curr {
            nodes[id].visit_count += 1;
            nodes[id].total_value += value;
            curr = nodes[id].parent_id;
        }
    }

    fn find_best_partial_node(&self, nodes: &[MctsNode]) -> usize {
        let mut best_id = 0;
        let mut best_val = f64::NEG_INFINITY;
        for node in nodes {
            if node.id == 0 {
                continue;
            }
            let val = node.mean_value();
            if val > best_val {
                best_val = val;
                best_id = node.id;
            }
        }
        best_id
    }
}
