use async_trait::async_trait;

#[derive(Debug, PartialEq, Clone)]
pub enum AgentAction {
    Tactic(String),
    Backtrack,
    GiveUp,
}

#[async_trait]
pub trait Agent {
    type Context;
    type Error;

    async fn generate_move(&self, context: &Self::Context) -> Result<AgentAction, Self::Error>;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockAgent;

    #[async_trait]
    impl Agent for MockAgent {
        type Context = String;
        type Error = ();

        async fn generate_move(&self, context: &Self::Context) -> Result<AgentAction, Self::Error> {
            if context == "stuck" {
                Ok(AgentAction::Backtrack)
            } else {
                Ok(AgentAction::Tactic("simp".to_string()))
            }
        }
    }

    #[tokio::test]
    async fn test_agent_returns_tactic() {
        let agent = MockAgent;
        let action = agent.generate_move(&"normal".to_string()).await.unwrap();
        assert_eq!(action, AgentAction::Tactic("simp".to_string()));
    }
}
