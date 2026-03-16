/**
 * Proof Registry — Skill-driven proof generation.
 *
 * Maps problem classes → proof generators. Each generator produces:
 *   1. Lean 4 source code (for kernel verification)
 *   2. LaTeX proof document (for human-readable output)
 *
 * Extensible: register(new SRGProofGenerator()) to add SRG support.
 */

import { AdjacencyMatrix } from "../math/graph/AdjacencyMatrix";
import { generateRamseyLean } from "../codegen/lean_codegen";
import { adjToMatrix } from "./ramsey_worker";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ProofGenInput {
  theoremName: string;
  witness: AdjacencyMatrix;
  params: Record<string, number>;
}

export interface LatexGenInput extends ProofGenInput {
  problemDescription: string;
  wallTimeSeconds: number;
  iterations: number;
  ips: number;
}

export interface ProofGenerator {
  canHandle(type: string): boolean;
  generateLean(input: ProofGenInput): string;
  generateLatex(input: LatexGenInput): string;
}

// ──────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────

export class ProofRegistry {
  private generators: ProofGenerator[] = [];

  register(gen: ProofGenerator): void {
    this.generators.push(gen);
  }

  getGenerator(type: string): ProofGenerator | null {
    return this.generators.find(g => g.canHandle(type)) ?? null;
  }

  static withDefaults(): ProofRegistry {
    const reg = new ProofRegistry();
    reg.register(new RamseyProofGenerator());
    return reg;
  }
}

// ──────────────────────────────────────────────
// Ramsey Proof Generator
// ──────────────────────────────────────────────

export class RamseyProofGenerator implements ProofGenerator {
  canHandle(type: string): boolean {
    return type === "ramsey";
  }

  generateLean(input: ProofGenInput): string {
    const { theoremName, witness, params } = input;
    const matrix = adjToMatrix(witness);
    return generateRamseyLean(theoremName, params.n!, params.r!, params.s!, matrix);
  }

  generateLatex(input: LatexGenInput): string {
    const { theoremName, witness, params, wallTimeSeconds, iterations, ips } = input;
    const n = params.n!;
    const r = params.r!;
    const s = params.s!;
    const matrix = adjToMatrix(witness);

    // Build adjacency matrix rows
    const adjRows: string[] = [];
    for (let i = 0; i < n; i++) {
      const row: string[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) row.push("\\cdot");
        else row.push(matrix[i]![j]! ? "1" : "0");
      }
      adjRows.push(`    ${row.join(" & ")} \\\\`);
    }

    // Count edges
    let edgeCount = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (matrix[i]![j]!) edgeCount++;

    const date = new Date().toISOString().split("T")[0]!;

    // For large matrices (n>20), use tabular instead of pmatrix
    let matrixBlock: string;
    if (n <= 20) {
      matrixBlock = [
        "{\\small",
        "\\[",
        "A = \\begin{pmatrix}",
        ...adjRows,
        "\\end{pmatrix}",
        "\\]}",
      ].join("\n");
    } else {
      matrixBlock = [
        "{\\tiny",
        "\\begin{center}",
        `\\begin{tabular}{${"c".repeat(n)}}`,
        ...adjRows,
        "\\end{tabular}",
        "\\end{center}}",
      ].join("\n");
    }

    const lines = [
      "\\documentclass[11pt]{article}",
      "\\usepackage[margin=1in]{geometry}",
      "\\usepackage{amsmath, amssymb, amsthm}",
      "\\usepackage{booktabs}",
      "\\usepackage{array}",
      "",
      "\\newtheorem{theorem}{Theorem}",
      "\\newtheorem{lemma}[theorem]{Lemma}",
      "",
      `\\title{Computer-Verified Proof: \\( R(${r},${s}) \\geq ${n + 1} \\)}`,
      "\\author{Perqed Autonomous Proof Engine}",
      `\\date{${date}}`,
      "",
      "\\begin{document}",
      "\\maketitle",
      "",
      "\\begin{abstract}",
      `We prove \\( R(${r},${s}) \\geq ${n + 1} \\) by constructing a ${n}-vertex graph \\( G \\)`,
      `that contains no clique of size~${r} and no independent set of size~${s}.`,
      `The witness was discovered by simulated annealing (${iterations.toLocaleString()} iterations,`,
      `${ips.toLocaleString()} iterations/sec) and verified by the Lean~4 kernel`,
      `via \\texttt{native\\_decide} in ${wallTimeSeconds.toFixed(1)}s.`,
      "\\end{abstract}",
      "",
      "\\section{Statement}",
      "",
      "\\begin{theorem}",
      `\\( R(${r},${s}) \\geq ${n + 1} \\).`,
      "\\end{theorem}",
      "",
      "\\begin{proof}",
      `We exhibit a graph \\( G \\) on \\( ${n} \\) vertices with \\( ${edgeCount} \\) edges such that:`,
      "\\begin{enumerate}",
      `  \\item \\( G \\) contains no complete subgraph \\( K_{${r}} \\) (no ${r}-clique), and`,
      `  \\item the complement \\( \\overline{G} \\) contains no complete subgraph \\( K_{${s}} \\)`,
      `        (equivalently, \\( G \\) has no independent set of size~${s}).`,
      "\\end{enumerate}",
      "Both properties are verified computationally by exhaustive enumeration",
      `of all \\( \\binom{${n}}{${r}} \\) and \\( \\binom{${n}}{${s}} \\) subsets respectively,`,
      "executed within the Lean~4 trusted kernel.",
      "\\end{proof}",
      "",
      "\\section{Witness: Adjacency Matrix}",
      "",
      `The adjacency matrix \\( A \\) of the witness graph \\( G \\) on \\( ${n} \\) vertices:`,
      "",
      matrixBlock,
      "",
      "\\section{Verification}",
      "",
      "\\begin{table}[h]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\toprule",
      "Property & Value \\\\",
      "\\midrule",
      `Lean 4 theorem & \\texttt{${theoremName}} \\\\`,
      "Verification method & \\texttt{native\\_decide} \\\\",
      `Wall time & ${wallTimeSeconds.toFixed(1)}s \\\\`,
      `SA iterations & ${iterations.toLocaleString()} \\\\`,
      `Throughput & ${ips.toLocaleString()} IPS \\\\`,
      `Vertices & ${n} \\\\`,
      `Edges & ${edgeCount} \\\\`,
      "\\bottomrule",
      "\\end{tabular}",
      "\\end{table}",
      "",
      "\\end{document}",
      "",
    ];

    return lines.join("\n");
  }
}
