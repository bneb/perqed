pub mod anatomy;
pub mod autoformalize;
pub mod benchmark;
pub mod conjecture;
pub mod dag;
pub mod dual_engine;
pub mod embeddings;
pub mod falsification;
pub mod ingestion;
pub mod invariant_search;
pub mod librarian;
pub mod mcts;
pub mod model_client;
pub mod pipeline;
pub mod program_search;
pub mod publication;
pub mod registry;
pub mod roi;
pub mod router;
pub mod skills;
pub mod tactic_generator;
pub mod types;

pub use anatomy::{IntegerAnatomy, IntegerAnatomyInspector};
pub use autoformalize::{AutoformalizationResult, Autoformalizer};
pub use benchmark::{BenchmarkItemResult, BenchmarkRunner, BenchmarkSummary};
pub use conjecture::{ConjectureGenerator, SynthesisStrategy};
pub use dag::{MathlibDag, MathlibNode};
pub use dual_engine::{DecisionProcedure, DualEngineProver};
pub use embeddings::{DensePremiseStore, DenseVector, EmbedderConfig, SubwordEmbedder};
pub use falsification::{FalsificationConfig, FalsificationGate, PredicateSpec};
pub use ingestion::{HybridPremiseWeights, PremiseIndex, PremiseItem, TexAstParser};
pub use invariant_search::{AlgebraicInvariantSearchEngine, AlgebraicInvariantTemplate, ParameterizedCandidate};
pub use librarian::{ArxivLibrarian, ArxivPaper, LibrarianError};
pub use mcts::{MctsError, MctsNode, MctsOrchestrator, ProofSearchResult, SubLemma, SubLemmaIsolator};
pub use model_client::{ModelMessage, ModelProvider, ModelRequest, ModelResponse, ModelRouter};
pub use pipeline::{FrontierPipeline, PipelineError, PipelineResult};
pub use program_search::{
    BoundCandidate, FunSearchCrossover, GeneticSearchConfig, HeuristicProgram, OeisSequence,
    ProgramDatabase, ProgramInvariantSearch,
};
pub use publication::PublicationPipeline;
pub use registry::{ConjectureStatus, EmpiricalDiscoveryRegistry, RegistryEntry};
pub use roi::{IntelligencePerDollarMetrics, PowerCostModel, RoiEvaluator, RoiScore, RoiWeights};
pub use router::{BudgetTracker, TaskType, TierConfig, TieredModelRouter};
pub use skills::{MathematicalSkill, SkillCategory, SkillMatcher, SkillRegistry};
pub use tactic_generator::TacticGenerator;
pub use types::{
    AuditReport, Conjecture, MctsConfig, MctsHeuristicWeights, ParsedTheorem, ProofState,
    PublicationDraft, TacticCandidate, TacticPriorScores,
};
