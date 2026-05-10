export interface CodeBlock {
  lang: string;
  code: string;
}

export interface ParsedLLMResponse {
  think: string | null;
  jsonString: string | null;
  codeBlocks: CodeBlock[];
}

let nativeModule: any;

try {
  // Try to load the native Rust parser
  // In a real app we'd load the correct arch, but for local dev we just load what was built
  nativeModule = require("../../crates/perqed_parser/perqed_parser.darwin-arm64.node");
} catch (e) {
  console.warn("Failed to load native perqed_parser. Using stub.");
}

export function parseLLMResponse(rawText: string): {
  think: string | null;
  json: any | null;
  codeBlocks: CodeBlock[];
} {
  if (nativeModule && nativeModule.parseLLMResponseNative) {
    const result: ParsedLLMResponse = nativeModule.parseLLMResponseNative(rawText);
    let parsedJson = null;
    if (result.jsonString) {
      try {
        parsedJson = JSON.parse(result.jsonString);
      } catch (e) {
        console.error("Failed to parse repaired JSON from native module:", e);
      }
    }
    return {
      think: result.think,
      json: parsedJson,
      codeBlocks: result.codeBlocks || [],
    };
  }

  return {
    think: null,
    json: null,
    codeBlocks: []
  };
}
