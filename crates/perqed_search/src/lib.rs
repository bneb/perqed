pub mod sa;

use perqed_core::SearchDomain;
use rand::Rng;

pub struct PartitionDomain {
    pub domain_size: usize,
    pub num_partitions: usize,
}

#[derive(Clone)]
pub struct PartitionState {
    pub colors: Vec<i8>, // 1-indexed, size domain_size + 1
}

impl PartitionDomain {
    pub fn new(domain_size: usize, num_partitions: usize) -> Self {
        Self {
            domain_size,
            num_partitions,
        }
    }
}

impl SearchDomain for PartitionDomain {
    type Candidate = PartitionState;

    fn calculate_energy(&self, state: &Self::Candidate) -> u64 {
        if self.domain_size == 0 {
            return 0;
        }

        let mut classes: Vec<Vec<usize>> = vec![Vec::new(); self.num_partitions];

        for i in 1..=self.domain_size {
            let color = state.colors[i];
            if color >= 0 && (color as usize) < self.num_partitions {
                classes[color as usize].push(i);
            }
        }

        let mut energy = 0;

        for (c, members) in classes.iter().enumerate().take(self.num_partitions) {
            if members.len() < 2 {
                continue;
            }

            for (xi, &x) in members.iter().enumerate() {
                for &y in &members[xi..] {
                    let z = x + y;

                    if z > self.domain_size {
                        break;
                    }

                    if state.colors[z] as usize == c {
                        energy += 1;
                    }
                }
            }
        }

        energy
    }

    fn mutate(&self, state: &mut Self::Candidate) {
        if self.domain_size == 0 || self.num_partitions == 0 {
            return;
        }
        let mut rng = rand::thread_rng();
        let idx = rng.gen_range(1..=self.domain_size);
        let new_color = rng.gen_range(0..self.num_partitions) as i8;
        state.colors[idx] = new_color;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sum_free_energy_empty_partition() {
        let domain = PartitionDomain::new(4, 2);
        let state = PartitionState {
            colors: vec![-1; 5],
        };
        assert_eq!(domain.calculate_energy(&state), 0);
    }

    #[test]
    fn test_sum_free_energy_violation() {
        let domain = PartitionDomain::new(3, 2);
        let state = PartitionState {
            colors: vec![-1, 0, 0, 0], // {1, 2, 3} are in partition 0. 1+1=2 and 1+2=3, so E=2
        };
        assert_eq!(domain.calculate_energy(&state), 2);
    }

    #[test]
    fn test_sum_free_energy_no_violation() {
        let domain = PartitionDomain::new(4, 2);
        let state = PartitionState {
            colors: vec![-1, 0, 1, 1, 0], // S(2)=4 partition: {1,4} and {2,3}. E=0
        };
        assert_eq!(domain.calculate_energy(&state), 0);
    }
}
