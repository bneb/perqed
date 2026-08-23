//! Ingestion & Direct TeX AST Parsing Engine
//!
//! Extracts mathematical notation, hypotheses, and targets directly from raw TeX ASTs
//! and maintains a searchable Premise Index for Mathlib definitions.

use crate::types::ParsedTheorem;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IngestionError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("No theorem or lemma environments discovered in TeX source")]
    NoTheoremsFound,
}

use crate::embeddings::{DensePremiseStore, SubwordEmbedder};

/// Configuration weights for hybrid premise retrieval combining dense cosine, lexical, and topological signals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridPremiseWeights {
    pub dense_cosine_scale: f64,
    pub lexical_name_weight: f64,
    pub lexical_signature_weight: f64,
    pub lexical_docstring_weight: f64,
    pub head_symbol_bonus: f64,
    pub default_retrieval_limit: usize,
}

impl Default for HybridPremiseWeights {
    fn default() -> Self {
        Self {
            dense_cosine_scale: 10.0,
            lexical_name_weight: 4.0,
            lexical_signature_weight: 2.5,
            lexical_docstring_weight: 1.5,
            head_symbol_bonus: 3.0,
            default_retrieval_limit: 6,
        }
    }
}

/// Mathlib Premise Index Item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PremiseItem {
    pub name: String,
    pub signature: String,
    pub docstring: String,
    pub domain: String,
    pub complexity_weight: f64,
    pub head_symbol: Option<String>,
}

pub struct PremiseIndex {
    items: Vec<PremiseItem>,
    by_name: HashMap<String, PremiseItem>,
    dense_store: DensePremiseStore<usize>,
    pub weights: HybridPremiseWeights,
}

impl Default for PremiseIndex {
    fn default() -> Self {
        Self::new()
    }
}

impl PremiseIndex {
    pub fn new() -> Self {
        Self::with_weights(HybridPremiseWeights::default())
    }

    pub fn with_weights(weights: HybridPremiseWeights) -> Self {
        let mut index = Self {
            items: Vec::new(),
            by_name: HashMap::new(),
            dense_store: DensePremiseStore::new(),
            weights,
        };
        index.load_builtin_mathlib_premises();
        index
    }

    pub fn insert(&mut self, item: PremiseItem) {
        let text_repr = format!("{} {} {} {}", item.name, item.signature, item.docstring, item.domain);
        let idx = self.items.len();
        self.dense_store.insert(&text_repr, idx);
        self.by_name.insert(item.name.clone(), item.clone());
        self.items.push(item);
    }

    fn load_builtin_mathlib_premises(&mut self) {
        let default_premises = vec![
            // --- Algebra: Natural Numbers ---
            PremiseItem {
                name: "Nat.add_zero".to_string(),
                signature: "∀ (n : Nat), n + 0 = n".to_string(),
                docstring: "Addition of zero on the right for natural numbers".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.add".to_string()),
            },
            PremiseItem {
                name: "Nat.zero_add".to_string(),
                signature: "∀ (n : Nat), 0 + n = n".to_string(),
                docstring: "Addition of zero on the left for natural numbers".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.add".to_string()),
            },
            PremiseItem {
                name: "Nat.add_comm".to_string(),
                signature: "∀ (a b : Nat), a + b = b + a".to_string(),
                docstring: "Commutativity of natural addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("Nat.add".to_string()),
            },
            PremiseItem {
                name: "Nat.add_assoc".to_string(),
                signature: "∀ (a b c : Nat), (a + b) + c = a + (b + c)".to_string(),
                docstring: "Associativity of natural addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.3,
                head_symbol: Some("Nat.add".to_string()),
            },
            PremiseItem {
                name: "Nat.mul_zero".to_string(),
                signature: "∀ (n : Nat), n * 0 = 0".to_string(),
                docstring: "Multiplication by zero on the right".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.zero_mul".to_string(),
                signature: "∀ (n : Nat), 0 * n = 0".to_string(),
                docstring: "Multiplication by zero on the left".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.mul_one".to_string(),
                signature: "∀ (n : Nat), n * 1 = n".to_string(),
                docstring: "Multiplication by one on the right".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.one_mul".to_string(),
                signature: "∀ (n : Nat), 1 * n = n".to_string(),
                docstring: "Multiplication by one on the left".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.mul_comm".to_string(),
                signature: "∀ (a b : Nat), a * b = b * a".to_string(),
                docstring: "Commutativity of natural multiplication".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.mul_assoc".to_string(),
                signature: "∀ (a b c : Nat), (a * b) * c = a * (b * c)".to_string(),
                docstring: "Associativity of natural multiplication".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.3,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.left_distrib".to_string(),
                signature: "∀ (a b c : Nat), a * (b + c) = a * b + a * c".to_string(),
                docstring: "Left distributivity of multiplication over addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.5,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.right_distrib".to_string(),
                signature: "∀ (a b c : Nat), (a + b) * c = a * c + b * c".to_string(),
                docstring: "Right distributivity of multiplication over addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.5,
                head_symbol: Some("Nat.mul".to_string()),
            },
            PremiseItem {
                name: "Nat.succ_inj".to_string(),
                signature: "∀ (a b : Nat), Nat.succ a = Nat.succ b → a = b".to_string(),
                docstring: "Successor function injectivity".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.1,
                head_symbol: Some("Nat.succ".to_string()),
            },
            PremiseItem {
                name: "Nat.le_refl".to_string(),
                signature: "∀ (n : Nat), n ≤ n".to_string(),
                docstring: "Reflexivity of natural ordering".to_string(),
                domain: "order.nat".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("LE.le".to_string()),
            },
            PremiseItem {
                name: "Nat.le_trans".to_string(),
                signature: "∀ (a b c : Nat), a ≤ b → b ≤ c → a ≤ c".to_string(),
                docstring: "Transitivity of natural ordering".to_string(),
                domain: "order.nat".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("LE.le".to_string()),
            },
            PremiseItem {
                name: "Nat.le_antisymm".to_string(),
                signature: "∀ (a b : Nat), a ≤ b → b ≤ a → a = b".to_string(),
                docstring: "Antisymmetry of natural ordering".to_string(),
                domain: "order.nat".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("LE.le".to_string()),
            },
            PremiseItem {
                name: "Nat.add_le_add_left".to_string(),
                signature: "∀ (a b c : Nat), a ≤ b → c + a ≤ c + b".to_string(),
                docstring: "Monotonicity of addition on the left".to_string(),
                domain: "order.nat".to_string(),
                complexity_weight: 1.4,
                head_symbol: Some("LE.le".to_string()),
            },

            // --- Algebra: Integers & Reals ---
            PremiseItem {
                name: "Int.add_comm".to_string(),
                signature: "∀ (a b : Int), a + b = b + a".to_string(),
                docstring: "Commutativity of integer addition".to_string(),
                domain: "algebra.int".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("HAdd.hAdd".to_string()),
            },
            PremiseItem {
                name: "Int.add_assoc".to_string(),
                signature: "∀ (a b c : Int), (a + b) + c = a + (b + c)".to_string(),
                docstring: "Associativity of integer addition".to_string(),
                domain: "algebra.int".to_string(),
                complexity_weight: 1.3,
                head_symbol: Some("HAdd.hAdd".to_string()),
            },
            PremiseItem {
                name: "Int.mul_comm".to_string(),
                signature: "∀ (a b : Int), a * b = b * a".to_string(),
                docstring: "Commutativity of integer multiplication".to_string(),
                domain: "algebra.int".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("HMul.hMul".to_string()),
            },
            PremiseItem {
                name: "Int.neg_add_cancel".to_string(),
                signature: "∀ (a : Int), -a + a = 0".to_string(),
                docstring: "Additive inverse cancellation in integers".to_string(),
                domain: "algebra.int".to_string(),
                complexity_weight: 1.4,
                head_symbol: Some("Neg.neg".to_string()),
            },
            PremiseItem {
                name: "Real.add_comm".to_string(),
                signature: "∀ (a b : Real), a + b = b + a".to_string(),
                docstring: "Commutativity of real addition".to_string(),
                domain: "analysis.real".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("HAdd.hAdd".to_string()),
            },
            PremiseItem {
                name: "Real.add_assoc".to_string(),
                signature: "∀ (a b c : Real), (a + b) + c = a + (b + c)".to_string(),
                docstring: "Associativity of real addition".to_string(),
                domain: "analysis.real".to_string(),
                complexity_weight: 1.3,
                head_symbol: Some("HAdd.hAdd".to_string()),
            },
            PremiseItem {
                name: "Real.mul_comm".to_string(),
                signature: "∀ (a b : Real), a * b = b * a".to_string(),
                docstring: "Commutativity of real multiplication".to_string(),
                domain: "analysis.real".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("HMul.hMul".to_string()),
            },
            PremiseItem {
                name: "Complex.I_sq".to_string(),
                signature: "Complex.I ^ 2 = -1".to_string(),
                docstring: "Square of the imaginary unit is minus one".to_string(),
                domain: "analysis.complex".to_string(),
                complexity_weight: 1.5,
                head_symbol: Some("Complex.I".to_string()),
            },

            // --- Logic & Foundation ---
            PremiseItem {
                name: "Classical.em".to_string(),
                signature: "∀ (P : Prop), P ∨ ¬P".to_string(),
                docstring: "Law of the excluded middle".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.0,
                head_symbol: Some("Or".to_string()),
            },
            PremiseItem {
                name: "Classical.byContradiction".to_string(),
                signature: "∀ (P : Prop), (¬P → False) → P".to_string(),
                docstring: "Proof by contradiction".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.0,
                head_symbol: Some("Classical".to_string()),
            },
            PremiseItem {
                name: "propext".to_string(),
                signature: "∀ {p q : Prop}, (p ↔ q) → p = q".to_string(),
                docstring: "Propositional extensionality axiom".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.2,
                head_symbol: Some("Eq".to_string()),
            },
            PremiseItem {
                name: "funext".to_string(),
                signature: "∀ {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x}, (∀ x, f x = g x) → f = g".to_string(),
                docstring: "Function extensionality".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.0,
                head_symbol: Some("Eq".to_string()),
            },
            PremiseItem {
                name: "Quot.sound".to_string(),
                signature: "∀ {α : Sort u} {r : α → α → Prop} {a b : α}, r a b → Quot.mk r a = Quot.mk r b".to_string(),
                docstring: "Quotient soundness axiom".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.2,
                head_symbol: Some("Quot.mk".to_string()),
            },
            PremiseItem {
                name: "And.intro".to_string(),
                signature: "∀ {a b : Prop}, a → b → a ∧ b".to_string(),
                docstring: "Conjunction introduction rule".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("And".to_string()),
            },
            PremiseItem {
                name: "And.left".to_string(),
                signature: "∀ {a b : Prop}, a ∧ b → a".to_string(),
                docstring: "Conjunction elimination left".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("And".to_string()),
            },
            PremiseItem {
                name: "And.right".to_string(),
                signature: "∀ {a b : Prop}, a ∧ b → b".to_string(),
                docstring: "Conjunction elimination right".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("And".to_string()),
            },
            PremiseItem {
                name: "Or.inl".to_string(),
                signature: "∀ {a b : Prop}, a → a ∨ b".to_string(),
                docstring: "Disjunction introduction left".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Or".to_string()),
            },
            PremiseItem {
                name: "Or.inr".to_string(),
                signature: "∀ {a b : Prop}, b → a ∨ b".to_string(),
                docstring: "Disjunction introduction right".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.0,
                head_symbol: Some("Or".to_string()),
            },
            PremiseItem {
                name: "not_not".to_string(),
                signature: "∀ (p : Prop), ¬¬p ↔ p".to_string(),
                docstring: "Double negation elimination".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 1.5,
                head_symbol: Some("Iff".to_string()),
            },

            // --- Metric Spaces & Topology ---
            PremiseItem {
                name: "dist_self".to_string(),
                signature: "∀ {α : Type u} [MetricSpace α] (x : α), dist x x = 0".to_string(),
                docstring: "Distance from a point to itself is zero".to_string(),
                domain: "topology.metric".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("dist".to_string()),
            },
            PremiseItem {
                name: "dist_comm".to_string(),
                signature: "∀ {α : Type u} [MetricSpace α] (x y : α), dist x y = dist y x".to_string(),
                docstring: "Symmetry of metric distance".to_string(),
                domain: "topology.metric".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("dist".to_string()),
            },
            PremiseItem {
                name: "dist_triangle".to_string(),
                signature: "∀ {α : Type u} [MetricSpace α] (x y z : α), dist x z ≤ dist x y + dist y z".to_string(),
                docstring: "Triangle inequality for metric distance".to_string(),
                domain: "topology.metric".to_string(),
                complexity_weight: 1.6,
                head_symbol: Some("dist".to_string()),
            },
            PremiseItem {
                name: "dist_nonneg".to_string(),
                signature: "∀ {α : Type u} [MetricSpace α] (x y : α), 0 ≤ dist x y".to_string(),
                docstring: "Non-negativity of metric distance".to_string(),
                domain: "topology.metric".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("dist".to_string()),
            },
            PremiseItem {
                name: "continuous_id".to_string(),
                signature: "∀ {α : Type u} [TopologicalSpace α], Continuous (id : α → α)".to_string(),
                docstring: "Identity function is continuous".to_string(),
                domain: "topology.continuity".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("Continuous".to_string()),
            },
            PremiseItem {
                name: "continuous_const".to_string(),
                signature: "∀ {α β : Type u} [TopologicalSpace α] [TopologicalSpace β] (c : β), Continuous (fun _ => c)".to_string(),
                docstring: "Constant function is continuous".to_string(),
                domain: "topology.continuity".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("Continuous".to_string()),
            },

            // --- Graph Theory & Combinatorics ---
            PremiseItem {
                name: "SimpleGraph.Adj.symm".to_string(),
                signature: "∀ {V : Type u} {G : SimpleGraph V} {u v : V}, G.Adj u v → G.Adj v u".to_string(),
                docstring: "Symmetry of adjacency in simple undirected graphs".to_string(),
                domain: "combinatorics.graph".to_string(),
                complexity_weight: 1.2,
                head_symbol: Some("SimpleGraph.Adj".to_string()),
            },
            PremiseItem {
                name: "SimpleGraph.cliqueNum_le_chromaticNumber".to_string(),
                signature: "∀ {V : Type u} (G : SimpleGraph V), G.cliqueNum ≤ G.chromaticNumber".to_string(),
                docstring: "Clique number lower-bounds chromatic number".to_string(),
                domain: "combinatorics.graph".to_string(),
                complexity_weight: 1.8,
                head_symbol: Some("SimpleGraph.chromaticNumber".to_string()),
            },
            PremiseItem {
                name: "is_3ap_free".to_string(),
                signature: "∀ (vecs : List (List Int)), is_3ap_free vecs = true ↔ (∀ u v w ∈ vecs, u + v + w = 0 → u = v ∧ v = w)".to_string(),
                docstring: "Definition and characterization of 3-AP free cap sets in affine space F_3^n".to_string(),
                domain: "combinatorics.cap_set".to_string(),
                complexity_weight: 2.0,
                head_symbol: Some("is_3ap_free".to_string()),
            },
        ];

        for p in default_premises {
            self.insert(p);
        }
    }

    /// Hybrid dense + lexical search combining cosine similarity and keyword matching
    pub fn hybrid_search(&self, query: &str, limit: usize) -> Vec<PremiseItem> {
        let eff_limit = if limit == 0 { self.weights.default_retrieval_limit } else { limit };
        self.hybrid_search_with_weights(query, eff_limit, &self.weights)
    }

    /// Parameterized hybrid search using custom retrieval weights
    pub fn hybrid_search_with_weights(
        &self,
        query: &str,
        limit: usize,
        weights: &HybridPremiseWeights,
    ) -> Vec<PremiseItem> {
        let q_lower = query.to_lowercase();
        let query_vec = SubwordEmbedder::embed(query);
        let q_tokens: Vec<&str> = q_lower
            .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '.')
            .filter(|s| s.len() > 1)
            .collect();

        let mut scored: Vec<(f64, &PremiseItem)> = self
            .items
            .iter()
            .map(|item| {
                let item_text = format!("{} {} {} {}", item.name, item.signature, item.docstring, item.domain);
                let item_vec = SubwordEmbedder::embed(&item_text);
                let cos_sim = query_vec.cosine_similarity(&item_vec) as f64;

                // Lexical BM25 component
                let mut lexical_score = 0.0;
                let name_l = item.name.to_lowercase();
                let sig_l = item.signature.to_lowercase();
                let doc_l = item.docstring.to_lowercase();

                for tok in &q_tokens {
                    if name_l.contains(tok) {
                        lexical_score += weights.lexical_name_weight;
                    }
                    if sig_l.contains(tok) {
                        lexical_score += weights.lexical_signature_weight;
                    }
                    if doc_l.contains(tok) {
                        lexical_score += weights.lexical_docstring_weight;
                    }
                }

                // Head symbol bonus
                let head_bonus = if let Some(ref hs) = item.head_symbol {
                    if q_lower.contains(&hs.to_lowercase()) { weights.head_symbol_bonus } else { 0.0 }
                } else {
                    0.0
                };

                // Combined Hybrid Formula
                let total_score = (cos_sim * weights.dense_cosine_scale) + lexical_score + head_bonus;
                (total_score, item)
            })
            .collect();

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(limit).map(|(_, i)| i.clone()).collect()
    }

    /// Backward-compatible search delegating to hybrid_search
    pub fn search(&self, query: &str, limit: usize) -> Vec<PremiseItem> {
        self.hybrid_search(query, limit)
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

pub struct TexAstParser;

impl TexAstParser {
    /// Parses raw LaTeX TeX string directly into structured `ParsedTheorem`s
    pub fn parse_tex_source(tex_source: &str, source_file: &str) -> Result<Vec<ParsedTheorem>, IngestionError> {
        let mut results = Vec::new();

        let env_types = ["theorem", "lemma", "proposition", "corollary", "conjecture"];
        let label_re = Regex::new(r"\\label\{([^}]+)\}").unwrap();
        let hyp_re = Regex::new(r"(?:Assume|Let|Suppose|Given)\s+([^,.;]+)[,.;]").unwrap();

        for env_type in env_types {
            let pattern = format!(
                r"(?s)\\begin\{{{}\}}(?:\[(.*?)\])?(.*?)\\end\{{{}\}}",
                env_type, env_type
            );
            if let Ok(env_re) = Regex::new(&pattern) {
                for cap in env_re.captures_iter(tex_source) {
                    let env_title = cap.get(1).map(|m| m.as_str()).unwrap_or("").to_string();
                    let body = cap.get(2).map(|m| m.as_str()).unwrap_or("").trim().to_string();

                    let label = if let Some(lcap) = label_re.captures(&body) {
                        lcap.get(1).map(|m| m.as_str()).unwrap_or("thm").to_string()
                    } else if !env_title.is_empty() {
                        env_title.replace(' ', "_").to_lowercase()
                    } else {
                        format!("thm_{}", results.len() + 1)
                    };

                    // Extract hypotheses
                    let mut hypotheses = Vec::new();
                    for hcap in hyp_re.captures_iter(&body) {
                        if let Some(h) = hcap.get(1) {
                            hypotheses.push(h.as_str().trim().to_string());
                        }
                    }

                    let clean_claim = body
                        .replace("\\label{", "%label:")
                        .replace('$', "")
                        .replace('\n', " ")
                        .trim()
                        .to_string();

                    results.push(ParsedTheorem {
                        label,
                        env_type: env_type.to_string(),
                        raw_latex: body.clone(),
                        informal_claim: clean_claim,
                        hypotheses,
                        conclusion: body,
                        source_file: source_file.to_string(),
                    });
                }
            }
        }

        if results.is_empty() {
            // Check if file has equation blocks \[ ... \]
            let eq_re = Regex::new(r"(?s)\\\[(.*?)\\\]").unwrap();
            for (idx, cap) in eq_re.captures_iter(tex_source).enumerate() {
                let eq_body = cap.get(1).map(|m| m.as_str()).unwrap_or("").trim().to_string();
                results.push(ParsedTheorem {
                    label: format!("eq_{}", idx + 1),
                    env_type: "equation".to_string(),
                    raw_latex: eq_body.clone(),
                    informal_claim: eq_body.clone(),
                    hypotheses: vec![],
                    conclusion: eq_body,
                    source_file: source_file.to_string(),
                });
            }
        }

        if results.is_empty() {
            return Err(IngestionError::NoTheoremsFound);
        }

        Ok(results)
    }

    /// Read TeX file from disk and parse AST
    pub fn parse_file<P: AsRef<Path>>(path: P) -> Result<Vec<ParsedTheorem>, IngestionError> {
        let content = fs::read_to_string(&path)?;
        Self::parse_tex_source(&content, &path.as_ref().to_string_lossy())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tex_ast_parsing() {
        let sample_tex = r#"
\documentclass{article}
\begin{document}
\section{Number Theory}

\begin{theorem}[Even Addition]
\label{thm:even_add}
Let $a$ and $b$ be even natural numbers. Then $a + b$ is even.
\end{theorem}

\begin{lemma}
Let $n \ge 0$. Then $n + 0 = n$.
\end{lemma}

\end{document}
"#;

        let thms = TexAstParser::parse_tex_source(sample_tex, "sample.tex").unwrap();
        assert_eq!(thms.len(), 2);
        assert_eq!(thms[0].label, "thm:even_add");
        assert_eq!(thms[0].env_type, "theorem");
        assert_eq!(thms[1].env_type, "lemma");
    }

    #[test]
    fn test_premise_index_search() {
        let index = PremiseIndex::new();
        let hits = index.search("add_comm", 5);
        assert!(!hits.is_empty());
        assert_eq!(hits[0].name, "Nat.add_comm");
    }
}
