//! arXiv Literature Ingestion Engine
//!
//! Fetches, parses, and extracts mathematical claims, conjectures, and definitions
//! from scientific preprints via the arXiv API.

use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{info, warn};

#[derive(Error, Debug)]
pub enum LibrarianError {
    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("XML parsing error: {0}")]
    Xml(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArxivPaper {
    pub arxiv_id: String,
    pub title: String,
    pub summary: String,
    pub published: String,
    pub authors: Vec<String>,
    pub categories: Vec<String>,
}

pub struct ArxivLibrarian {
    base_url: String,
}

impl Default for ArxivLibrarian {
    fn default() -> Self {
        Self::new()
    }
}

impl ArxivLibrarian {
    pub fn new() -> Self {
        Self {
            base_url: "https://export.arxiv.org/api/query".to_string(),
        }
    }

    /// Parses an arXiv Atom XML feed into structured ArxivPaper objects
    pub fn parse_arxiv_atom_feed(xml_content: &str) -> Result<Vec<ArxivPaper>, LibrarianError> {
        let mut papers = Vec::new();

        let entry_re = Regex::new(r"(?s)<entry>(.*?)</entry>").unwrap();
        let id_re = Regex::new(r"<id>(.*?)</id>").unwrap();
        let title_re = Regex::new(r"(?s)<title>(.*?)</title>").unwrap();
        let summary_re = Regex::new(r"(?s)<summary>(.*?)</summary>").unwrap();
        let published_re = Regex::new(r"<published>(.*?)</published>").unwrap();
        let author_re = Regex::new(r"<author>\s*<name>(.*?)</name>").unwrap();
        let category_re = Regex::new(r#"<category[^>]*term="([^"]+)""#).unwrap();

        for cap in entry_re.captures_iter(xml_content) {
            let entry_text = &cap[1];

            let id = id_re
                .captures(entry_text)
                .map(|c| c[1].trim().to_string())
                .unwrap_or_default();
            
            let title = title_re
                .captures(entry_text)
                .map(|c| c[1].trim().replace('\n', " "))
                .unwrap_or_default();

            let summary = summary_re
                .captures(entry_text)
                .map(|c| c[1].trim().replace('\n', " "))
                .unwrap_or_default();

            let published = published_re
                .captures(entry_text)
                .map(|c| c[1].trim().to_string())
                .unwrap_or_default();

            let mut authors = Vec::new();
            for a_cap in author_re.captures_iter(entry_text) {
                authors.push(a_cap[1].trim().to_string());
            }

            let mut categories = Vec::new();
            for c_cap in category_re.captures_iter(entry_text) {
                categories.push(c_cap[1].trim().to_string());
            }

            if !title.is_empty() {
                papers.push(ArxivPaper {
                    arxiv_id: id,
                    title,
                    summary,
                    published,
                    authors,
                    categories,
                });
            }
        }

        Ok(papers)
    }

    /// Fetches papers from arXiv API matching a search query
    pub async fn search_arxiv(&self, query: &str, max_results: usize) -> Result<Vec<ArxivPaper>, LibrarianError> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()?;

        let url = format!(
            "{}?search_query=all:{}&start=0&max_results={}&sortBy=submittedDate&sortOrder=descending",
            self.base_url,
            urlencoding_simple(query),
            max_results
        );

        info!("Querying arXiv API: {}", url);
        match client.get(&url).send().await {
            Ok(resp) => {
                let xml = resp.text().await?;
                Self::parse_arxiv_atom_feed(&xml)
            }
            Err(e) => {
                warn!("Failed to query arXiv API: {}", e);
                Err(LibrarianError::Http(e))
            }
        }
    }

    /// Extracts mathematical theorems, conjectures, and key bounds from paper abstracts
    pub fn extract_candidate_claims(paper: &ArxivPaper) -> Vec<String> {
        let text = format!("{}. {}", paper.title, paper.summary);
        let mut claims = Vec::new();

        // Split sentences by periods, question marks, or exclamation marks
        let sentences: Vec<&str> = text
            .split(|c: char| c == '.' || c == '?' || c == '!')
            .map(|s| s.trim())
            .filter(|s| s.len() > 15)
            .collect();

        let indicators = [
            "theorem",
            "conjecture",
            "lemma",
            "we prove",
            "we show",
            "we establish",
            "bound",
            "chromatic",
            "for all",
            "there exists",
            "is at least",
            "is at most",
            "upper bound",
            "lower bound",
        ];

        for sent in sentences {
            let sent_lower = sent.to_lowercase();
            if indicators.iter().any(|&ind| sent_lower.contains(ind)) {
                claims.push(sent.to_string());
            }
        }

        if claims.is_empty() {
            claims.push(paper.title.clone());
        }

        claims
    }
}

fn urlencoding_simple(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}
