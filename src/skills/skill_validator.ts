/**
 * SKILL file validator.
 *
 * Validates that a SKILL.md file produced by SkillBuilder has the required
 * YAML frontmatter and section headers. Returns a structured result so
 * callers can choose whether to throw or log.
 */

// ──────────────────────────────────────────────────────────────────────────
// Required structure
// ──────────────────────────────────────────────────────────────────────────

const REQUIRED_FRONTMATTER_FIELDS = ["name", "description"] as const;

const REQUIRED_SECTIONS = [
  "## Technique",
  "## When to Apply",
  "## Worked Example",
  "## Key References",
] as const;

// ──────────────────────────────────────────────────────────────────────────
// Result type
// ──────────────────────────────────────────────────────────────────────────

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────────────────

/**
 * Validates the content of a SKILL.md file.
 *
 * Checks:
 *   1. File starts with a YAML frontmatter block (--- ... ---)
 *   2. Frontmatter contains `name:` and `description:` fields
 *   3. All required section headers are present (## Technique, etc.)
 *
 * @param content - Raw string content of the SKILL.md file
 */
export function validateSkillFile(content: string): SkillValidationResult {
  const errors: string[] = [];

  // ── Frontmatter check ───────────────────────────────────────────────────
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    errors.push("Missing YAML frontmatter (expected --- ... --- at the top of the file)");
  } else {
    const fm = frontmatterMatch[1]!;
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      // Accept both `field: value` and `field: "value"` forms
      if (!new RegExp(`^${field}\\s*:`, "m").test(fm)) {
        errors.push(`Frontmatter missing required field: "${field}"`);
      }
    }
  }

  // ── Section headers check ────────────────────────────────────────────────
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Like validateSkillFile but throws a descriptive Error on invalid content.
 */
export function assertValidSkillFile(content: string, filePath?: string): void {
  const { valid, errors } = validateSkillFile(content);
  if (!valid) {
    const where = filePath ? ` (${filePath})` : "";
    throw new Error(`Invalid SKILL.md${where}:\n  ${errors.join("\n  ")}`);
  }
}
