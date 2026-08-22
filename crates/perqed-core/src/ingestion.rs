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

/// Mathlib Premise Index Item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PremiseItem {
    pub name: String,
    pub signature: String,
    pub docstring: String,
    pub domain: String,
    pub complexity_weight: f64,
}

pub struct PremiseIndex {
    items: Vec<PremiseItem>,
    by_name: HashMap<String, PremiseItem>,
}

impl PremiseIndex {
    pub fn new() -> Self {
        let mut index = Self {
            items: Vec::new(),
            by_name: HashMap::new(),
        };
        index.load_builtin_mathlib_premises();
        index
    }

    fn load_builtin_mathlib_premises(&mut self) {
        let default_premises = vec![
            PremiseItem {
                name: "Nat.add_zero".to_string(),
                signature: "∀ (n : Nat), n + 0 = n".to_string(),
                docstring: "Addition of zero on the right".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
            },
            PremiseItem {
                name: "Nat.zero_add".to_string(),
                signature: "∀ (n : Nat), 0 + n = n".to_string(),
                docstring: "Addition of zero on the left".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.0,
            },
            PremiseItem {
                name: "Nat.add_comm".to_string(),
                signature: "∀ (a b : Nat), a + b = b + a".to_string(),
                docstring: "Commutativity of natural addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.2,
            },
            PremiseItem {
                name: "Nat.add_assoc".to_string(),
                signature: "∀ (a b c : Nat), (a + b) + c = a + (b + c)".to_string(),
                docstring: "Associativity of natural addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.3,
            },
            PremiseItem {
                name: "Nat.left_distrib".to_string(),
                signature: "∀ (a b c : Nat), a * (b + c) = a * b + a * c".to_string(),
                docstring: "Left distributivity of multiplication over addition".to_string(),
                domain: "algebra.nat".to_string(),
                complexity_weight: 1.5,
            },
            PremiseItem {
                name: "Classical.em".to_string(),
                signature: "∀ (P : Prop), P ∨ ¬P".to_string(),
                docstring: "Excluded middle".to_string(),
                domain: "logic".to_string(),
                complexity_weight: 2.0,
            },
        ];

        for p in default_premises {
            self.by_name.insert(p.name.clone(), p.clone());
            self.items.push(p);
        }
    }

    /// Search premises by query keywords and domain
    pub fn search(&self, query: &str, limit: usize) -> Vec<PremiseItem> {
        let q_lower = query.to_lowercase();
        let mut matches: Vec<(f64, &PremiseItem)> = self
            .items
            .iter()
            .map(|item| {
                let mut score = 0.0;
                if item.name.to_lowercase().contains(&q_lower) {
                    score += 5.0;
                }
                if item.signature.to_lowercase().contains(&q_lower) {
                    score += 3.0;
                }
                if item.docstring.to_lowercase().contains(&q_lower) {
                    score += 2.0;
                }
                (score, item)
            })
            .filter(|(s, _)| *s > 0.0)
            .collect();

        matches.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        matches.into_iter().take(limit).map(|(_, i)| i.clone()).collect()
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
