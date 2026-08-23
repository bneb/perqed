//! Metaheuristic & Combinatorial Search Engine
//!
//! Provides Simulated Annealing (SA) Island Models, Large Neighborhood Search (LNS),
//! and energy optimization for mathematical witness generation.

pub mod lns;
pub mod sa;

pub use lns::{DecomposableState, LnsOptimizer};
pub use sa::{CoolingSchedule, SaConfig, SaIslandModel, StateSpace};
