//! Dense Vector Embeddings & Subgoal Vectorizer for Mathlib 4 Premise Retrieval
//!
//! Generates normalized dense vector representations (d=128) over subword n-grams,
//! mathematical head symbols, and Lean 4 type signatures with fast cosine similarity ranking.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub const EMBEDDING_DIM: usize = 128;

/// Dense vector embedding (unit-normalized)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DenseVector(pub Vec<f32>);

impl DenseVector {
    pub fn zero() -> Self {
        Self(vec![0.0; EMBEDDING_DIM])
    }

    pub fn normalize(&mut self) {
        let norm: f32 = self.0.iter().map(|&x| x * x).sum::<f32>().sqrt();
        if norm > 1e-8 {
            for x in self.0.iter_mut() {
                *x /= norm;
            }
        }
    }

    pub fn cosine_similarity(&self, other: &DenseVector) -> f32 {
        if self.0.len() != other.0.len() {
            return 0.0;
        }
        let dot: f32 = self.0.iter().zip(other.0.iter()).map(|(a, b)| a * b).sum();
        dot.max(-1.0).min(1.0)
    }
}

/// Configuration for the deterministic subword and mathematical feature embedder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedderConfig {
    pub token_weight: f32,
    pub subword_ngram_weight: f32,
    pub min_ngram: usize,
    pub max_ngram: usize,
    pub math_features: Vec<(String, f32)>,
}

impl Default for EmbedderConfig {
    fn default() -> Self {
        Self {
            token_weight: 2.0,
            subword_ngram_weight: 0.5,
            min_ngram: 2,
            max_ngram: 4,
            math_features: vec![
                ("add".to_string(), 1.5),
                ("zero".to_string(), 1.5),
                ("mul".to_string(), 1.5),
                ("comm".to_string(), 1.8),
                ("assoc".to_string(), 1.8),
                ("distrib".to_string(), 1.8),
                ("le".to_string(), 1.5),
                ("lt".to_string(), 1.5),
                ("eq".to_string(), 1.2),
                ("dist".to_string(), 2.0),
                ("metric".to_string(), 2.0),
                ("continuous".to_string(), 2.0),
                ("triangle".to_string(), 2.0),
                ("graph".to_string(), 2.0),
                ("chromatic".to_string(), 2.2),
                ("color".to_string(), 2.0),
                ("clique".to_string(), 2.0),
                ("prime".to_string(), 2.0),
                ("dvd".to_string(), 1.8),
                ("group".to_string(), 1.8),
                ("ring".to_string(), 1.8),
                ("field".to_string(), 1.8),
                ("set".to_string(), 1.5),
                ("subset".to_string(), 1.8),
                ("union".to_string(), 1.8),
                ("inter".to_string(), 1.8),
            ],
        }
    }
}

/// Deterministic subword and n-gram vectorizer for Lean 4 mathematical goals
pub struct SubwordEmbedder;

impl SubwordEmbedder {
    /// Compute a normalized d=128 embedding vector using default configuration
    pub fn embed(text: &str) -> DenseVector {
        let config = EmbedderConfig::default();
        Self::embed_with_config(text, &config)
    }

    /// Compute a normalized d=128 embedding vector from arbitrary text with custom config
    pub fn embed_with_config(text: &str, config: &EmbedderConfig) -> DenseVector {
        let mut vec = vec![0.0f32; EMBEDDING_DIM];
        let clean = text.to_lowercase();
        let tokens: Vec<&str> = clean
            .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '.')
            .filter(|s| !s.is_empty())
            .collect();

        // 1. Whole token feature hashing
        for tok in &tokens {
            let mut hasher = DefaultHasher::new();
            tok.hash(&mut hasher);
            let h = hasher.finish();
            let idx = (h as usize) % EMBEDDING_DIM;
            let sign = if ((h >> 32) & 1) == 1 { 1.0f32 } else { -1.0f32 };
            vec[idx] += sign * config.token_weight;

            // Character n-grams for subword morpho-semantic features
            let chars: Vec<char> = tok.chars().collect();
            for n in config.min_ngram..=config.max_ngram {
                if chars.len() >= n {
                    for window in chars.windows(n) {
                        let sub: String = window.iter().collect();
                        let mut sub_hasher = DefaultHasher::new();
                        sub.hash(&mut sub_hasher);
                        let sub_h = sub_hasher.finish();
                        let sub_idx = (sub_h as usize) % EMBEDDING_DIM;
                        let sub_sign = if ((sub_h >> 32) & 1) == 1 { 1.0f32 } else { -1.0f32 };
                        vec[sub_idx] += sub_sign * config.subword_ngram_weight;
                    }
                }
            }
        }

        // 2. Mathematical operator & head symbol feature injection
        for (feat, weight) in &config.math_features {
            if clean.contains(feat) {
                let mut feat_hasher = DefaultHasher::new();
                feat.hash(&mut feat_hasher);
                let fh = feat_hasher.finish();
                let f_idx = (fh as usize) % EMBEDDING_DIM;
                vec[f_idx] += *weight;
            }
        }

        let mut res = DenseVector(vec);
        res.normalize();
        res
    }
}

/// In-memory dense premise embedding index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DensePremiseStore<T: Clone> {
    entries: Vec<(DenseVector, T)>,
}

impl<T: Clone> Default for DensePremiseStore<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Clone> DensePremiseStore<T> {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn insert(&mut self, text: &str, item: T) {
        let embedding = SubwordEmbedder::embed(text);
        self.entries.push((embedding, item));
    }

    pub fn insert_with_embedding(&mut self, embedding: DenseVector, item: T) {
        self.entries.push((embedding, item));
    }

    pub fn query_top_k(&self, query: &str, top_k: usize) -> Vec<(f32, &T)> {
        let query_vec = SubwordEmbedder::embed(query);
        self.query_vector_top_k(&query_vec, top_k)
    }

    pub fn query_vector_top_k(&self, query_vec: &DenseVector, top_k: usize) -> Vec<(f32, &T)> {
        let mut scored: Vec<(f32, &T)> = self
            .entries
            .iter()
            .map(|(emb, item)| {
                let sim = query_vec.cosine_similarity(emb);
                (sim, item)
            })
            .collect();

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored.into_iter().take(top_k).collect()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dense_vector_normalization() {
        let mut vec = DenseVector(vec![3.0, 4.0]
            .into_iter()
            .chain(std::iter::repeat(0.0).take(EMBEDDING_DIM - 2))
            .collect());
        vec.normalize();
        let norm: f32 = vec.0.iter().map(|&x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-5);
    }

    #[test]
    fn test_embedder_semantic_similarity() {
        let v1 = SubwordEmbedder::embed("Nat.add_comm (a b : Nat) : a + b = b + a");
        let v2 = SubwordEmbedder::embed("addition commutativity a + b = b + a");
        let v3 = SubwordEmbedder::embed("SimpleGraph.chromaticNumber G <= 4");

        let sim_12 = v1.cosine_similarity(&v2);
        let sim_13 = v1.cosine_similarity(&v3);

        assert!(sim_12 > sim_13, "Semantic match (add_comm) must score higher than graph theory!");
        assert!(sim_12 > 0.3, "Semantic similarity between related phrases must be positive");
    }

    #[test]
    fn test_dense_store_query_top_k() {
        let mut store = DensePremiseStore::new();
        store.insert("Nat.add_comm", "Nat.add_comm");
        store.insert("Nat.add_assoc", "Nat.add_assoc");
        store.insert("dist_triangle", "dist_triangle");

        let results = store.query_top_k("triangle inequality in metric space", 1);
        assert_eq!(results.len(), 1);
        assert_eq!(*results[0].1, "dist_triangle");
    }
}
