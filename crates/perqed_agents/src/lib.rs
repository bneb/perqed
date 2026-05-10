use async_trait::async_trait;
use perqed_core::agent::{Agent, AgentAction};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use perqed_parser::parse_llm_response;

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("HTTP Error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Parse Error: {0}")]
    Parse(String),
    #[error("JSON Error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Serialize)]
pub struct Content {
    pub parts: Vec<Part>,
}

#[derive(Serialize)]
pub struct Part {
    pub text: String,
}

#[derive(Serialize)]
pub struct GeminiRequest {
    pub contents: Vec<Content>,
}

#[derive(Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<Candidate>,
}

#[derive(Deserialize)]
pub struct Candidate {
    pub content: ResponseContent,
}

#[derive(Deserialize)]
pub struct ResponseContent {
    pub parts: Vec<ResponsePart>,
}

#[derive(Deserialize)]
pub struct ResponsePart {
    pub text: String,
}

pub struct GeminiAgent {
    api_key: String,
    model_name: String,
    base_url: String,
    client: Client,
}

impl GeminiAgent {
    pub fn new(api_key: String, model_name: String) -> Self {
        Self {
            api_key,
            model_name: if model_name.is_empty() { "gemini-3.1-pro".to_string() } else { model_name },
            base_url: "https://generativelanguage.googleapis.com".to_string(),
            client: Client::new(),
        }
    }

    pub fn with_base_url(mut self, url: String) -> Self {
        self.base_url = url;
        self
    }
}

// ... (Agent impl for GeminiAgent)

pub struct OllamaAgent {
    model_name: String,
    base_url: String,
    client: Client,
}

impl OllamaAgent {
    pub fn new(model_name: String) -> Self {
        Self {
            model_name: if model_name.is_empty() { "gemma4:26b".to_string() } else { model_name },
            base_url: "http://localhost:11434".to_string(),
            client: Client::new(),
        }
    }

    pub fn with_base_url(mut self, url: String) -> Self {
        self.base_url = url;
        self
    }
}

#[derive(Serialize)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
}

#[derive(Deserialize)]
pub struct OllamaResponse {
    pub response: String,
}

#[async_trait]
impl Agent for OllamaAgent {
    type Context = String;
    type Error = AgentError;

    async fn generate_move(&self, context: &Self::Context) -> Result<AgentAction, Self::Error> {
        let url = format!("{}/api/generate", self.base_url);
        
        let req_body = OllamaRequest {
            model: self.model_name.clone(),
            prompt: context.clone(),
            stream: false,
        };

        let res = self.client.post(&url)
            .json(&req_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await?;
            return Err(AgentError::Parse(format!("Ollama error: {}", err_text)));
        }

        let resp: OllamaResponse = res.json().await?;
        
        // Use our native Rust parser!
        let parsed = parse_llm_response(resp.response);
        
        if let Some(json) = parsed.json_string {
            let val: serde_json::Value = serde_json::from_str(&json)?;
            let action_str = val["action"].as_str().unwrap_or("");
            match action_str {
                "DIRECTIVE" => {
                    if let Some(code) = parsed.code_blocks.first() {
                        Ok(AgentAction::Tactic(code.code.clone()))
                    } else if let Some(tactics) = val["tactics"].as_str() {
                        Ok(AgentAction::Tactic(tactics.to_string()))
                    } else {
                        Ok(AgentAction::Tactic(json)) // fallback to raw json if no block
                    }
                },
                "BACKTRACK" => Ok(AgentAction::Backtrack),
                "GIVE_UP" => Ok(AgentAction::GiveUp),
                _ => Ok(AgentAction::Tactic(json)), // fallback
            }
        } else if let Some(code) = parsed.code_blocks.first() {
            Ok(AgentAction::Tactic(code.code.clone()))
        } else {
            Err(AgentError::Parse("No usable output found".to_string()))
        }
    }
}

#[async_trait]
impl Agent for GeminiAgent {
    type Context = String;
    type Error = AgentError;

    async fn generate_move(&self, context: &Self::Context) -> Result<AgentAction, Self::Error> {
        let url = format!(
            "{}/v1beta/models/{}:generateContent?key={}",
            self.base_url, self.model_name, self.api_key
        );

        let req_body = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part {
                    text: context.clone(),
                }],
            }],
        };

        let res = self.client.post(&url)
            .json(&req_body)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await?;
            return Err(AgentError::Parse(format!("Gemini API error: {}", err_text)));
        }

        let resp: GeminiResponse = res.json().await?;
        let raw_text = resp.candidates.first()
            .and_then(|c| c.content.parts.first())
            .map(|p| p.text.clone())
            .ok_or_else(|| AgentError::Parse("Empty response from Gemini".to_string()))?;

        // Use our native Rust parser!
        let parsed = parse_llm_response(raw_text);
        
        if let Some(json) = parsed.json_string {
            let val: serde_json::Value = serde_json::from_str(&json)?;
            
            // Map the schema to AgentAction
            let action_str = val["action"].as_str().unwrap_or("");
            match action_str {
                "DIRECTIVE" => {
                    if let Some(code) = parsed.code_blocks.first() {
                        Ok(AgentAction::Tactic(code.code.trim().to_string()))
                    } else if let Some(tactics) = val["tactics"].as_str() {
                        Ok(AgentAction::Tactic(tactics.trim().to_string()))
                    } else {
                        Err(AgentError::Parse("Directive missing tactic code".to_string()))
                    }
                },
                "BACKTRACK" => Ok(AgentAction::Backtrack),
                "GIVE_UP" => Ok(AgentAction::GiveUp),
                _ => Err(AgentError::Parse(format!("Unknown action: {}", action_str))),
            }
        } else {
            Err(AgentError::Parse("No JSON payload found in model response".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    #[tokio::test]
    async fn test_gemini_agent_calls_api_and_parses_action() {
        let mut server = Server::new_async().await;
        let url = server.url();
        
        let mock_response = r#"{
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": "{ \"action\": \"DIRECTIVE\", \"reasoning\": \"test\" }\n```lean\nexact h\n```"
                    }]
                }
            }]
        }"#;

        let _m = server.mock("POST", mockito::Matcher::Any)
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(mock_response)
            .create_async()
            .await;

        let agent = GeminiAgent::new("fake_key".to_string(), "gemini-1.5-pro".to_string())
            .with_base_url(url);

        let result = agent.generate_move(&"prove 1=1".to_string()).await;
        
        // This will fail in Red state
        assert!(result.is_ok(), "Expected success but got {:?}", result);
        if let Ok(AgentAction::Tactic(t)) = result {
            assert_eq!(t, "exact h");
        } else {
            panic!("Expected Tactic action");
        }
    }
}
