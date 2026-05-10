use clap::Parser;
use perqed_core::agent::Agent;
use perqed_core::mcts::ProofTree;
use perqed_core::orchestrator::Orchestrator;
use perqed_core::TheoremProver;
use perqed_lean::{LeanProver, LeanState};
use perqed_agents::GeminiAgent;
use std::env;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct CliArgs {
    #[arg(short, long)]
    pub prompt: String,
    
    #[arg(long, default_value_t = false)]
    pub wiles: bool,

    #[arg(long)]
    pub api_key: Option<String>,
}

pub struct PerqedApp<P: TheoremProver, A: Agent> {
    orchestrator: Orchestrator<P, A>,
}

impl<P, A> PerqedApp<P, A>
where
    P: TheoremProver,
    A: Agent<Context = String>,
    P::State: Clone,
    P::Tactic: Clone + From<String>,
{
    pub fn new(prover: P, agent: A) -> Self {
        Self {
            orchestrator: Orchestrator::new(prover, agent),
        }
    }

    pub async fn run(&self, initial_state: P::State, max_steps: usize) -> Result<Option<usize>, anyhow::Error> {
        let tree = ProofTree::new(initial_state);
        Ok(self.orchestrator.run(tree, max_steps).await)
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args = CliArgs::parse();
    println!("Perqed Rust Native Engine");
    println!("Prompt: {}", args.prompt);

    let api_key = args.api_key.or_else(|| env::var("GEMINI_API_KEY").ok())
        .expect("GEMINI_API_KEY must be set via --api-key or env var");

    let mut prover = LeanProver::new(env::current_dir()?)?;
    prover.start().await?;

    let agent = GeminiAgent::new(api_key, "gemini-3.1-pro".to_string());
    
    let app = PerqedApp::new(prover, agent);
    
    println!("🚀 Launching autonomous proof search...");
    let initial_state = LeanState { env: 0, goals: vec![args.prompt.clone()] };
    let result = app.run(initial_state, 20).await?;

    if let Some(node_id) = result {
        println!("✅ Proof search converged on node {}", node_id);
    } else {
        println!("❌ Search exhausted budget without convergence.");
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use perqed_core::agent::AgentAction;
    
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
    async fn test_end_to_end_perqed_app() {
        let app = PerqedApp::new(MockProver, MockAgent);
        
        let result = app.run(0, 10).await;
        
        assert!(result.is_ok());
        let final_node = result.unwrap();
        assert!(final_node.is_some());
    }
}
