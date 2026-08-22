//! Perqed v2 Core Orchestration Library

pub mod autoformalize;
pub mod conjecture;
pub mod falsification;
pub mod ingestion;
pub mod mcts;
pub mod model_client;
pub mod pipeline;
pub mod publication;
pub mod tactic_generator;
pub mod types;

pub use autoformalize::{AutoformalizationResult, Autoformalizer};
pub use conjecture::{ConjectureGenerator, SynthesisStrategy};
pub use falsification::{FalsificationGate, PredicateSpec};
pub use ingestion::{PremiseIndex, PremiseItem, TexAstParser};
pub use mcts::{MctsError, MctsNode, MctsOrchestrator, ProofSearchResult, SubLemma, SubLemmaIsolator};
pub use model_client::{ModelMessage, ModelProvider, ModelRequest, ModelResponse, ModelRouter};
pub use pipeline::{FrontierPipeline, PipelineError, PipelineResult};
pub use publication::PublicationPipeline;
pub use tactic_generator::TacticGenerator;
pub use types::{AuditReport, Conjecture, MctsConfig, ParsedTheorem, ProofState, PublicationDraft, TacticCandidate};
