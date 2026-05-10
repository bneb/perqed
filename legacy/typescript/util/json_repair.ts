/**
 * JSON Repair Utility
 *
 * Handles the most common LLM JSON truncation failure:
 * - Truncated mid-string  (e.g. `{"reasoning": "The proof req`)
 * - Missing closing braces/brackets
 * - Trailing comma before close
 *
 * Algorithm:
 *   Walk the text character-by-character tracking string/structure depth.
 *   After the walk, close any open string, then close remaining
 *   open structures in reverse order. Retry JSON.parse on the result.
 *
 * Returns the parsed object, or null if unrepairable.
 */
export function repairJSON(text: string): any | null {
  // 1. Try as-is first (no repair needed)
  try { return JSON.parse(text); } catch {}

  // 2. Trace the structure to find what needs closing
  const stack: Array<'}' | ']'> = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }

    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // 3. Close open string
  let repaired = text.trimEnd();
  if (inString) repaired += '"';

  // 4. Strip trailing comma before close (e.g. `...,"` → `...`)
  repaired = repaired.replace(/,\s*$/, '');

  // 5. Close remaining open structures (innermost first)
  repaired += stack.reverse().join('');

  try { return JSON.parse(repaired); } catch {}

  // 6. Last resort: extract known fields via regex
  return extractKnownFields(text);
}

/**
 * Regex extraction for when structural repair fails.
 * Returns a partial object with whatever fields were parseable.
 */
function extractKnownFields(text: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  const fieldPattern = /"(\w+)"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/g;
  let match;
  let found = false;

  while ((match = fieldPattern.exec(text)) !== null) {
    result[match[1]!] = match[2]!;
    found = true;
  }

  // Also capture numeric/boolean fields
  const numPattern = /"(\w+)"\s*:\s*([0-9.]+|true|false)/g;
  while ((match = numPattern.exec(text)) !== null) {
    if (!(match[1]! in result)) {
      result[match[1]!] = match[2]!;
      found = true;
    }
  }

  return found ? result : null;
}
