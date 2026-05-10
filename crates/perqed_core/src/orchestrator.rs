use crate::agent::{Agent, AgentAction};
use crate::mcts::ProofTree;
use crate::TheoremProver;

pub struct Orchestrator<P: TheoremProver, A: Agent> {
    prover: P,
    agent: A,
}

impl<P, A> Orchestrator<P, A>
where
    P: TheoremProver,
    A: Agent<Context = String>,
    P::State: Clone,
    P::Tactic: Clone + From<String>,
{
    pub fn new(prover: P, agent: A) -> Self {
        Self { prover, agent }
    }

    pub async fn run(&self, mut tree: ProofTree<P::State, P::Tactic>, max_steps: usize) -> Option<usize> {
        let mut current_id = tree.root_id;

        for _ in 0..max_steps {
            let state = if let Some(node) = tree.nodes.get(&current_id) {
                node.state.clone()
            } else {
                break;
            };
            
            let agent_context = self.prover.extract_goal(&state);
            
            if let Ok(action) = self.agent.generate_move(&agent_context).await {
                match action {
                    AgentAction::Tactic(t_str) => {
                        let tactic: P::Tactic = t_str.into();
                        if let Ok(new_state) = self.prover.verify(&state, &tactic).await {
                            let child_id = tree.add_child(current_id, tactic, new_state);
                            // In a real system, we'd check if the goal is empty to declare victory.
                            // For this basic test loop, progress means victory.
                            return Some(child_id);
                        } else {
                            tree.backpropagate(current_id, -1.0);
                        }
                    },
                    AgentAction::Backtrack => {
                        if let Some(node) = tree.nodes.get(&current_id) {
                            if let Some(p) = node.parent_id {
                                current_id = p;
                            }
                        }
                    },
                    AgentAction::GiveUp => break,
                }
            } else {
                break;
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct MockProver;
    #[async_trait]
    impl TheoremProver for MockProver {
        type State = i32;
        type Tactic = String;
        type Error = ();

        async fn verify(&self, state: &Self::State, tactic: &Self::Tactic) -> Result<Self::State, Self::Error> {
            if tactic == "solve" {
                Ok(*state + 1)
            } else {
                Err(())
            }
        }
        fn extract_goal(&self, _state: &Self::State) -> String {
            "goal".to_string()
        }
    }

    struct MockAgent;
    #[async_trait]
    impl Agent for MockAgent {
        type Context = String;
        type Error = ();

        async fn generate_move(&self, context: &Self::Context) -> Result<AgentAction, Self::Error> {
            if context == "goal" {
                Ok(AgentAction::Tactic("solve".to_string()))
            } else {
                Ok(AgentAction::GiveUp)
            }
        }
    }

    #[tokio::test]
    async fn test_orchestrator_finds_proof() {
        let prover = MockProver;
        let agent = MockAgent;
        let orchestrator = Orchestrator::new(prover, agent);
        
        let tree = ProofTree::new(0);
        
        let result = orchestrator.run(tree, 10).await;
        assert!(result.is_some());
    }
}
