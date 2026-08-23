//! Large Neighborhood Search (LNS) Framework
//!
//! Iteratively freezes high-confidence core variables and solves/perturbs
//! unconstrained neighborhood windows for combinatorial discovery.

use super::sa::StateSpace;
use rand::seq::SliceRandom;
use rand::Rng;

pub trait DecomposableState: StateSpace {
    fn num_variables(&self) -> usize;
    fn perturb_neighborhood(&self, free_indices: &[usize], rng: &mut impl Rng) -> Self;
}

pub struct LnsOptimizer {
    pub alpha: f64, // fraction of variables in free neighborhood (e.g. 0.2 to 0.4)
    pub max_steps: usize,
}

impl LnsOptimizer {
    pub fn new(alpha: f64, max_steps: usize) -> Self {
        Self {
            alpha: alpha.clamp(0.01, 0.99),
            max_steps,
        }
    }

    /// Optimizes state by repeatedly selecting a random neighborhood to destroy and repair
    pub fn optimize<S: DecomposableState>(&self, initial: S) -> (S, f64) {
        let mut current_state = initial;
        let mut current_energy = current_state.energy();

        if current_energy <= 0.0 {
            return (current_state, current_energy);
        }

        let mut best_state = current_state.clone();
        let mut best_energy = current_energy;

        let num_vars = current_state.num_variables();
        let neighborhood_size = ((num_vars as f64 * self.alpha).round() as usize).max(1).min(num_vars);

        let mut rng = rand::thread_rng();
        let mut all_indices: Vec<usize> = (0..num_vars).collect();

        let mut non_improving_steps = 0;
        let mut temp = 1.0;

        for _ in 0..self.max_steps {
            // Adaptive restart from best_state if stagnating
            if non_improving_steps > 40 {
                current_state = best_state.clone();
                current_energy = best_energy;
                non_improving_steps = 0;
            }

            // Select random subset of variables as the active destruction window
            all_indices.shuffle(&mut rng);
            let free_indices = &all_indices[..neighborhood_size];

            // Destroy and repair the neighborhood
            let candidate = current_state.perturb_neighborhood(free_indices, &mut rng);
            let candidate_energy = candidate.energy();

            let delta = candidate_energy - current_energy;
            let accept = if delta <= 0.0 {
                true
            } else {
                let prob = (-delta / temp).exp();
                rng.gen_bool(prob.min(0.2).max(0.001))
            };

            if accept {
                current_state = candidate;
                current_energy = candidate_energy;

                if current_energy < best_energy {
                    best_energy = current_energy;
                    best_state = current_state.clone();
                    non_improving_steps = 0;

                    if best_energy <= 0.0 {
                        break;
                    }
                } else {
                    non_improving_steps += 1;
                }
            } else {
                non_improving_steps += 1;
            }

            temp = (temp * 0.998).max(0.01);
        }

        (best_state, best_energy)
    }
}
