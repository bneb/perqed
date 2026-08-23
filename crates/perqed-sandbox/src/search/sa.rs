//! Parallel Simulated Annealing Island Model
//!
//! Multi-worker discrete optimization engine with independent cooling schedules
//! and periodic migration for mathematical witness search.

use rand::Rng;
use serde::{Deserialize, Serialize};

pub trait StateSpace: Clone + Send + Sync + 'static {
    fn energy(&self) -> f64;
    fn random_neighbor(&self, rng: &mut impl Rng) -> Self;
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CoolingSchedule {
    Exponential { cooling_rate: f64 },
    Cauchy { initial_temp: f64 },
    Logarithmic { initial_temp: f64 },
}

impl Default for CoolingSchedule {
    fn default() -> Self {
        Self::Exponential { cooling_rate: 0.99 }
    }
}

impl CoolingSchedule {
    pub fn temperature(&self, initial_temp: f64, step: usize) -> f64 {
        match self {
            CoolingSchedule::Exponential { cooling_rate } => {
                initial_temp * cooling_rate.powi(step as i32)
            }
            CoolingSchedule::Cauchy { initial_temp } => {
                *initial_temp / (1.0 + step as f64)
            }
            CoolingSchedule::Logarithmic { initial_temp } => {
                *initial_temp / (1.0 + (step as f64 + 1.0).ln())
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaConfig {
    pub max_iterations: usize,
    pub migration_interval: usize,
    pub num_workers: usize,
    pub initial_temp: f64,
    pub schedule: CoolingSchedule,
}

impl Default for SaConfig {
    fn default() -> Self {
        Self {
            max_iterations: 2000,
            migration_interval: 100,
            num_workers: 4,
            initial_temp: 10.0,
            schedule: CoolingSchedule::default(),
        }
    }
}

pub struct SaIslandModel {
    config: SaConfig,
}

impl SaIslandModel {
    pub fn new(config: SaConfig) -> Self {
        Self { config }
    }

    /// Executes multi-worker parallel simulated annealing with periodic migration
    pub fn run<S: StateSpace>(&self, initial_state: S) -> (S, f64) {
        let mut global_best_state = initial_state.clone();
        let mut global_best_energy = initial_state.energy();

        if global_best_energy <= 0.0 {
            return (global_best_state, global_best_energy);
        }

        // Initialize island states
        let mut island_states: Vec<S> = (0..self.config.num_workers)
            .map(|_| initial_state.clone())
            .collect();
        let mut island_current_energies: Vec<f64> = vec![global_best_energy; self.config.num_workers];

        let num_epochs = (self.config.max_iterations / self.config.migration_interval).max(1);
        let steps_per_epoch = self.config.migration_interval.max(1);

        let mut rng = rand::thread_rng();

        for epoch in 0..num_epochs {
            for worker_id in 0..self.config.num_workers {
                let mut current_state = island_states[worker_id].clone();
                let mut current_energy = island_current_energies[worker_id];

                // Vary cooling parameters slightly per worker to create explore vs exploit islands
                let worker_cooling = match self.config.schedule {
                    CoolingSchedule::Exponential { cooling_rate } => {
                        let adj = 1.0 - (1.0 - cooling_rate) * (0.8 + 0.1 * worker_id as f64);
                        CoolingSchedule::Exponential { cooling_rate: adj }
                    }
                    other => other,
                };

                for step_offset in 0..steps_per_epoch {
                    let total_step = epoch * steps_per_epoch + step_offset;
                    let temp = worker_cooling.temperature(self.config.initial_temp, total_step).max(1e-6);

                    let candidate = current_state.random_neighbor(&mut rng);
                    let candidate_energy = candidate.energy();

                    let delta = candidate_energy - current_energy;

                    if delta <= 0.0 || rng.gen_bool((-delta / temp).exp().min(1.0)) {
                        current_state = candidate;
                        current_energy = candidate_energy;

                        if current_energy < global_best_energy {
                            global_best_energy = current_energy;
                            global_best_state = current_state.clone();

                            if global_best_energy <= 0.0 {
                                return (global_best_state, global_best_energy);
                            }
                        }
                    }
                }

                island_states[worker_id] = current_state;
                island_current_energies[worker_id] = current_energy;
            }

            // Periodic Migration: Warm-start the hottest worker from the best global seed
            if let Some((worst_idx, _)) = island_current_energies.iter().enumerate().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()) {
                island_states[worst_idx] = global_best_state.clone();
                island_current_energies[worst_idx] = global_best_energy;
            }
        }

        (global_best_state, global_best_energy)
    }
}
