/**
 * LeanASTValidator
 * 
 * Enforces the programmatic Mathlib Definition Guardrail.
 * Before submitting LLM-generated conjectures or proofs to the Lean 4 compiler,
 * this acts as a pre-compiler heuristic parser to detect invented mathematical
 * primitives, unauthorized namespaces, or 'sorry' macros.
 */

export interface ValidationSuccess {
  isValid: true;
}

export interface ValidationError {
  isValid: false;
  error: string;
  violatingTerm?: string;
}

export type ValidationResult = ValidationSuccess | ValidationError;

export class LeanASTValidator {
  private allowedNamespaces: Set<string>;

  constructor(allowedNamespaces: string[] = ["Mathlib", "Init", "Std"]) {
    // Root namespaces allowed to be imported
    this.allowedNamespaces = new Set(allowedNamespaces);
  }

  /**
   * Pre-compilation check to ensure LLMs do not invent synthetic proofs
   * or mathlib definitions.
   * 
   * @param leanCode The fully formatted Lean 4 source file
   */
  public validate(leanCode: string): ValidationResult {
    // 1. Enforce that there are no synthetic arbitrary `def`s masquerading as proof helpers
    // The LLM should only ever emit `theorem` or `lemma` if it's proving, and should 
    // rely entirely on existing Mathlib primes rather than inventing continuous functions.
    if (/^\s*def\s+/m.test(leanCode)) {
      return {
        isValid: false,
        error: "HALLUCINATION_DETECTED: Synthetic `def` detected. You must use existing Mathlib definitions instead of inventing new structures.",
        violatingTerm: "def",
      };
    }

    // 2. Enforce that it only imports from allowed namespaces
    const importRegex = /^\s*import\s+([a-zA-Z0-9_.]+)/gm;
    let match;
    while ((match = importRegex.exec(leanCode)) !== null) {
      if (match[1]) {
        const rootNamespace = match[1].split('.')[0];
        if (rootNamespace && !this.allowedNamespaces.has(rootNamespace)) {
          return {
            isValid: false,
            error: `HALLUCINATION_DETECTED: Unauthorized import namespace '${rootNamespace}'. Only ${Array.from(this.allowedNamespaces).join(", ")} are allowed.`,
            violatingTerm: match[1],
          };
        }
      }
    }

    // 3. Prevent 'sorry' macros that bypass actual verification
    if (leanCode.includes("sorry")) {
      return {
        isValid: false,
        error: "HALLUCINATION_DETECTED: 'sorry' macro found. Proofs must be fully derived.",
        violatingTerm: "sorry",
      };
    }

    return { isValid: true };
  }
}
