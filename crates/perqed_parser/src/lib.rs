#[cfg(feature = "napi")]
use napi_derive::napi;
use regex::Regex;
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;

lazy_static! {
    static ref THINK_RE: Regex = Regex::new(r"(?s)<think>(.*?)</think>").unwrap();
    static ref THINK_START_RE: Regex = Regex::new(r"(?s)<think>(.*)").unwrap();
    static ref CODE_RE: Regex = Regex::new(r"(?s)```(\w+)?\n(.*?)```").unwrap();
    static ref TRAIL_BRACE: Regex = Regex::new(r",(\s*\})").unwrap();
    static ref TRAIL_BRACKET: Regex = Regex::new(r",(\s*\])").unwrap();
    static ref FIX_QUOTES_3: Regex = Regex::new(r#"\(([^"]*)"([^"]*)"([^"]*)\)"#).unwrap();
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct CodeBlock {
    pub lang: String,
    pub code: String,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ParsedLLMResponse {
    pub think: Option<String>,
    pub json_string: Option<String>,
    pub code_blocks: Vec<CodeBlock>,
}

#[cfg_attr(feature = "napi", napi(js_name = "parseLLMResponseNative"))]
pub fn parse_llm_response(raw: String) -> ParsedLLMResponse {
    let mut think: Option<String> = None;
    let mut code_blocks: Vec<CodeBlock> = Vec::new();
    let mut json_string: Option<String> = None;

    let raw_str = raw.as_str();

    // 1. Extract <think>...</think>
    if let Some(caps) = THINK_RE.captures(raw_str) {
        think = Some(caps.get(1).unwrap().as_str().to_string());
    } else {
        // Handle unclosed <think>
        if let Some(caps) = THINK_START_RE.captures(raw_str) {
            let inner = caps.get(1).unwrap().as_str();
            if let Some(idx) = inner.find('{') {
                think = Some(inner[..idx].to_string());
            } else {
                think = Some(inner.to_string());
            }
        }
    }

    // 2. Extract code blocks ```lang\ncode\n```
    for caps in CODE_RE.captures_iter(raw_str) {
        let lang = caps.get(1).map_or("", |m| m.as_str()).to_string();
        let code = caps.get(2).map_or("", |m| m.as_str()).to_string();
        code_blocks.push(CodeBlock { lang, code });
    }

    // 3. Extract and repair JSON
    let first_brace = raw_str.find('{');
    let last_brace = raw_str.rfind('}');
    
    if let Some(start) = first_brace {
        let mut end_idx = raw_str.len();
        if let Some(end) = last_brace {
            if end >= start {
                end_idx = end + 1;
            }
        }
        let json_raw = &raw_str[start..end_idx];
        let repaired = repair_json(json_raw);
        json_string = Some(repaired);
    }

    ParsedLLMResponse {
        think,
        json_string,
        code_blocks,
    }
}

fn repair_json(raw: &str) -> String {
    let mut s = String::new();
    let mut open_braces = 0;
    let mut open_brackets = 0;
    let mut in_string = false;
    let mut escape = false;

    let chars: Vec<char> = raw.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if escape {
            escape = false;
            s.push(c);
            continue;
        }
        match c {
            '\\' => {
                escape = true;
                s.push(c);
            }
            '"' => {
                in_string = !in_string;
                s.push(c);
            }
            '{' if !in_string => {
                open_braces += 1;
                s.push(c);
            }
            '}' if !in_string => {
                open_braces -= 1;
                s.push(c);
            }
            '[' if !in_string => {
                open_brackets += 1;
                s.push(c);
            }
            ']' if !in_string => {
                open_brackets -= 1;
                s.push(c);
            }
            ',' if !in_string => {
                // Look ahead for trailing comma
                let mut next_char = None;
                for &lookahead in chars.iter().skip(i + 1) {
                    if !lookahead.is_whitespace() {
                        next_char = Some(lookahead);
                        break;
                    }
                }
                if next_char == Some('}') || next_char == Some(']') {
                    // Skip the comma
                } else {
                    s.push(c);
                }
            }
            _ => {
                s.push(c);
            }
        }
    }

    if in_string {
        s.push('"');
    }
    while open_brackets > 0 {
        s.push(']');
        open_brackets -= 1;
    }
    while open_braces > 0 {
        s.push('}');
        open_braces -= 1;
    }

    // Fix unescaped inner quotes inside parenthesis: `(x: "type")`
    s = FIX_QUOTES_3.replace_all(&s, "($1\\\"$2\\\"$3)").to_string();

    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extracts_standard_json() {
        let raw = r#"
            Sure, here is the JSON:
            {
              "action": "DIRECTIVE",
              "target": "node_1"
            }
        "#;
        let result = parse_llm_response(raw.to_string());
        assert_eq!(
            result.json_string.unwrap().replace(" ", "").replace("\n", ""),
            r#"{"action":"DIRECTIVE","target":"node_1"}"#
        );
        assert_eq!(result.think, None);
        assert!(result.code_blocks.is_empty());
    }

    #[test]
    fn test_extracts_think_and_code() {
        let raw = r#"
            <think>
            I need to use induction.
            </think>
            { "action": "PROPOSE_SUBGOAL" }
            ```lean
            lemma base_case : 0 = 0 := by rfl
            ```
        "#;
        let result = parse_llm_response(raw.to_string());
        assert_eq!(result.think.unwrap().trim(), "I need to use induction.");
        assert_eq!(
            result.json_string.unwrap().replace(" ", ""),
            r#"{"action":"PROPOSE_SUBGOAL"}"#
        );
        assert_eq!(result.code_blocks.len(), 1);
        assert_eq!(result.code_blocks[0].lang, "lean");
        assert_eq!(result.code_blocks[0].code.trim(), "lemma base_case : 0 = 0 := by rfl");
    }

    #[test]
    fn test_repairs_trailing_commas() {
        let raw = r#"
            {
              "key1": "value1",
              "key2": "value2",
            }
        "#;
        let result = parse_llm_response(raw.to_string());
        assert_eq!(
            result.json_string.unwrap().replace(" ", "").replace("\n", ""),
            r#"{"key1":"value1","key2":"value2"}"#
        );
    }

    #[test]
    fn test_repairs_missing_braces() {
        let raw = r#"{"action": "DIRECTIVE", "reasoning": "We should split"#;
        let result = parse_llm_response(raw.to_string());
        let rep = result.json_string.unwrap();
        // It should append the missing closing quote and closing brace
        assert!(rep.ends_with("\"}"));
    }

    #[test]
    fn test_repairs_unescaped_quotes_inside_string() {
        let raw = r#"{ "code": "theorem foo (x: "type")" }"#;
        let result = parse_llm_response(raw.to_string());
        let rep = result.json_string.unwrap();
        assert!(rep.contains(r#"theorem foo (x: \"type\")"#));
    }

    #[test]
    fn test_adversarial_trailing_comma_in_string() {
        // We do not want to strip commas that are inside string literals!
        let raw = r#"{ "text": "Hello, }", "array": [1, 2, ] }"#;
        let result = parse_llm_response(raw.to_string());
        let rep = result.json_string.unwrap();
        assert!(rep.contains(r#""Hello, }""#), "Data corruption: stripped comma inside string!");
        assert!(rep.contains(r#"[1, 2 ]"#) || rep.contains(r#"[1, 2]"#), "Failed to repair actual array trailing comma");
    }
}
