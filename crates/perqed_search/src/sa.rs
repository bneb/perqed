use crate::{PartitionDomain, PartitionState};
use perqed_core::SearchDomain;
use rand::Rng;
use rayon::prelude::*;

pub fn run_sa_island_model(
    domain: &PartitionDomain,
    initial_state: &PartitionState,
    workers: usize,
    iterations_per_worker: usize,
) -> Option<PartitionState> {
    let best_state = (0..workers)
        .into_par_iter()
        .map(|_| {
            let mut rng = rand::thread_rng();
            let mut state = initial_state.clone();
            let mut energy = domain.calculate_energy(&state);

            let mut best_local_state = state.clone();
            let mut best_local_energy = energy;

            let initial_temp = 10.0;
            let mut temp = initial_temp;
            let cooling_rate = if iterations_per_worker > 0 {
                (0.01_f64 / initial_temp).powf(1.0 / (iterations_per_worker as f64))
            } else {
                0.99
            };

            for _ in 0..iterations_per_worker {
                if best_local_energy == 0 {
                    break;
                }

                let mut new_state = state.clone();
                domain.mutate(&mut new_state);
                let new_energy = domain.calculate_energy(&new_state);

                let accept = if new_energy < energy {
                    true
                } else {
                    let delta = (new_energy as f64) - (energy as f64);
                    let p = (-delta / temp).exp();
                    rng.gen::<f64>() < p
                };

                if accept {
                    state = new_state;
                    energy = new_energy;
                    if energy < best_local_energy {
                        best_local_energy = energy;
                        best_local_state = state.clone();
                    }
                }
                temp *= cooling_rate;
            }
            (best_local_state, best_local_energy)
        })
        .min_by_key(|(_, e)| *e);

    best_state.map(|(s, _)| s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_island_model_finds_schur_s2() {
        let domain = PartitionDomain::new(4, 2);
        // Start from a terrible state (everything in class 0) -> E > 0
        let initial_state = PartitionState {
            colors: vec![-1, 0, 0, 0, 0],
        };
        
        let result = run_sa_island_model(&domain, &initial_state, 4, 10_000);
        assert!(result.is_some(), "SA should find a witness (E=0)");
        
        if let Some(witness) = result {
            assert_eq!(domain.calculate_energy(&witness), 0);
        }
    }
}
