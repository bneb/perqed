export class JsonHandler {
  /**
   * Removes markdown code blocks and inline language tags from the text.
   */
  static stripMarkdown(text: string): string {
    let clean = text.replace(/```(?:json|javascript|yaml)?/gi, "");
    clean = clean.replace(/```/g, "");
    // Remove inline conversational prefixes/suffixes
    return clean.trim();
  }

  /**
   * Finds the outermost brace or bracket and extracts the inner structure.
   * Applying an auto-repair heuristic to close unclosed JSON structures
   * that were truncated due to token limits.
   */
  static extractAndRepair(text: string): string {
    let cleaned = this.stripMarkdown(text);
    const startObj = cleaned.indexOf("{");
    const startArr = cleaned.indexOf("[");

    let startIndex = -1;
    if (startObj !== -1 && startArr !== -1) {
      startIndex = Math.min(startObj, startArr);
    } else {
      startIndex = Math.max(startObj, startArr);
    }

    if (startIndex === -1) {
      return cleaned; // No JSON structure found, just return stripped
    }

    let payload = cleaned.substring(startIndex).trim();
    
    // Auto-Close Heuristic for Truncated JSON
    // 1. Remove dangling commas
    payload = payload.replace(/,\s*$/, "");
    
    // 2. Count open vs closed brackets/braces inside string literals vs outside
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escape = false;

    // Fast pass to balance out the structure
    for (let i = 0; i < payload.length; i++) {
      const char = payload[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }
    }

    if (inString) {
      payload += '"';
    }
    
    // We append missing closures in the reverse order they were opened
    // However, since we simply tracked counts, we'll try a greedy append.
    // A more precise autoClose would maintain a stack, let's implement the stack:
    
    const stack: ("}" | "]")[] = [];
    inString = false;
    escape = false;
    for (let i = 0; i < payload.length; i++) {
      const char = payload[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') stack.push("}");
        else if (char === '[') stack.push("]");
        else if (char === '}' || char === ']') {
            stack.pop(); // Assume balanced matching to simplify
        }
      }
    }
    
    while (stack.length > 0) {
      payload += stack.pop();
    }

    return payload;
  }
}
