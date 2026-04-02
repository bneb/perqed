import { ExplorerAgent } from "./src/agents/explorer";
import { geminiSequenceMock } from "./tests/helpers/fetch_mock";

const DEFAULT_SYNTHESIS = {
  synthesis: "Evidence is mixed.",
  anomalies: ["complex_analysis"],
  kills: ["number_theory", "algebraic_topology"],
};

const C_SIMPLE = {
  domain: "algebraic_topology",
  language: "c",
  purpose: "Compute Euler characteristic.",
  code: `#include <stdio.h>
int main() {
    int V = 4, E = 6, F = 4;
    printf("Euler: %d\\n", V - E + F);
    printf("HYPOTHESIS FALSIFIED IN THIS DOMAIN\\n");
    return 0;
}`,
};

globalThis.fetch = geminiSequenceMock([
  [C_SIMPLE],
  { ...DEFAULT_SYNTHESIS, kills: ["algebraic_topology"], anomalies: [] },
]);

const explorer = new ExplorerAgent({ apiKey: "k", domainDepth: 1 });
explorer.investigate("test", ["algebraic_topology"]).then(report => {
  const result = report.results[0];
  console.log("RESULT:", JSON.stringify(result, null, 2));
});
