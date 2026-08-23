//! Red-to-Green Test Suite: Generalized Metaheuristic & Hybrid SMT/LNS Engine

use perqed_sandbox::search::lns::{DecomposableState, LnsOptimizer};
use perqed_sandbox::search::sa::{CoolingSchedule, SaConfig, SaIslandModel, StateSpace};
use rand::Rng;

/// Test state: 2-coloring of an even cycle graph C_{2n}
/// Global minimum energy is 0 (proper bipartite 2-coloring)
#[derive(Debug, Clone, PartialEq)]
struct CycleColoringState {
    num_vertices: usize,
    colors: Vec<u8>, // 0 or 1
}

impl CycleColoringState {
    fn new(num_vertices: usize) -> Self {
        let mut rng = rand::thread_rng();
        let colors = (0..num_vertices).map(|_| rng.gen_range(0..2)).collect();
        Self {
            num_vertices,
            colors,
        }
    }
}

impl StateSpace for CycleColoringState {
    fn energy(&self) -> f64 {
        let mut conflicts = 0.0;
        for i in 0..self.num_vertices {
            let next = (i + 1) % self.num_vertices;
            if self.colors[i] == self.colors[next] {
                conflicts += 1.0;
            }
        }
        conflicts
    }

    fn random_neighbor(&self, rng: &mut impl Rng) -> Self {
        let mut new_colors = self.colors.clone();
        let idx = rng.gen_range(0..self.num_vertices);
        new_colors[idx] = 1 - new_colors[idx];
        Self {
            num_vertices: self.num_vertices,
            colors: new_colors,
        }
    }
}

impl DecomposableState for CycleColoringState {
    fn num_variables(&self) -> usize {
        self.num_vertices
    }

    fn perturb_neighborhood(&self, free_indices: &[usize], rng: &mut impl Rng) -> Self {
        let mut new_colors = self.colors.clone();
        for &idx in free_indices {
            if rng.gen_bool(0.5) {
                new_colors[idx] = 1 - new_colors[idx];
            }
        }
        Self {
            num_vertices: self.num_vertices,
            colors: new_colors,
        }
    }
}

#[test]
fn test_simulated_annealing_island_model_convergence() {
    let initial_state = CycleColoringState::new(10); // Even cycle C_10
    assert!(initial_state.num_variables() == 10);

    let config = SaConfig {
        max_iterations: 2000,
        migration_interval: 100,
        num_workers: 4,
        initial_temp: 10.0,
        schedule: CoolingSchedule::Exponential {
            cooling_rate: 0.995,
        },
    };

    let island_model = SaIslandModel::new(config);
    let (best_state, best_energy) = island_model.run(initial_state);

    assert_eq!(
        best_energy, 0.0,
        "Simulated Annealing Island Model failed to reach zero conflict energy on C_10. Best energy: {}, state: {:?}",
        best_energy, best_state.colors
    );
}

#[test]
fn test_large_neighborhood_search_optimization() {
    let initial_state = CycleColoringState::new(12); // C_12

    let lns = LnsOptimizer::new(0.3, 1500); // 30% free neighborhood
    let (best_state, best_energy) = lns.optimize(initial_state);

    assert_eq!(
        best_energy, 0.0,
        "LNS failed to reach zero energy on C_12. Best energy: {}, colors: {:?}",
        best_energy, best_state.colors
    );
}
