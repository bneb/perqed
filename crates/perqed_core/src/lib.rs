pub mod agent;
pub mod mcts;
pub mod orchestrator;

use async_trait::async_trait;

#[async_trait]
pub trait TheoremProver {
    type State;
    type Tactic;
    type Error;
    
    async fn verify(&self, state: &Self::State, tactic: &Self::Tactic) -> Result<Self::State, Self::Error>;
    fn extract_goal(&self, state: &Self::State) -> String;
}

pub trait SearchDomain {
    type Candidate;
    
    fn calculate_energy(&self, state: &Self::Candidate) -> u64;
    fn mutate(&self, state: &mut Self::Candidate);
}

pub struct UniversalEngine<D: SearchDomain> {
    domain: D,
}

impl<D: SearchDomain> UniversalEngine<D> {
    pub fn new(domain: D) -> Self {
        Self { domain }
    }
    
    pub fn search(&self, mut state: D::Candidate, max_iters: usize) -> Option<D::Candidate> {
        let mut current_energy = self.domain.calculate_energy(&state);
        if current_energy == 0 {
            return Some(state);
        }
        
        for _ in 0..max_iters {
            self.domain.mutate(&mut state);
            current_energy = self.domain.calculate_energy(&state);
            if current_energy == 0 {
                return Some(state);
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockDomain;
    impl SearchDomain for MockDomain {
        type Candidate = i32;
        fn calculate_energy(&self, state: &Self::Candidate) -> u64 {
            if *state == 42 { 0 } else { 1 }
        }
        fn mutate(&self, state: &mut Self::Candidate) {
            *state += 1;
        }
    }

    #[test]
    fn test_universal_engine_finds_witness() {
        let domain = MockDomain;
        let engine = UniversalEngine::new(domain);
        let result = engine.search(0, 100);
        assert_eq!(result, Some(42));
    }
    
    #[test]
    fn test_universal_engine_fails_if_max_iters_reached() {
        let domain = MockDomain;
        let engine = UniversalEngine::new(domain);
        let result = engine.search(0, 10);
        assert_eq!(result, None);
    }
}
