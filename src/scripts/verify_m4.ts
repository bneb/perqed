/**
 * Sprint 27: Independent Verifier — Knuth's m=4 Decomposition
 *
 * Performs a rigorous independent verification of the SA-discovered
 * decomposition, checking all properties required for a valid
 * 3-Hamiltonian-cycle decomposition of the 4×4×4 directed torus.
 *
 * This mirrors the Lean 4 proof logic in TypeScript for immediate
 * execution without requiring a Lean toolchain.
 *
 * Usage: bun run src/scripts/verify_m4.ts
 */

const PAYLOAD = [
  2,3,1,3,1,3,4,0,4,1,5,3,3,0,1,4,
  3,4,0,0,0,5,0,1,2,3,3,5,4,1,3,2,
  5,2,1,3,1,4,1,2,0,3,4,3,1,0,5,3,
  3,0,3,4,3,1,2,1,3,1,5,4,4,3,0,1,
];

const M = 4;
const V = 64;

// 3! = 6 permutations: maps [X,Y,Z] → [Color0, Color1, Color2]
const PERMS: number[][] = [
  [0, 1, 2], [0, 2, 1],
  [1, 0, 2], [1, 2, 0],
  [2, 0, 1], [2, 1, 0],
];

function successor(vertex: number, color: number): number {
  const i = Math.floor(vertex / 16);
  const j = Math.floor(vertex / 4) % 4;
  const k = vertex % 4;
  const perm = PERMS[PAYLOAD[vertex]!]!;

  // Find which direction carries this color
  if (perm[0] === color) return ((i + 1) % M) * 16 + j * 4 + k;       // +X
  if (perm[1] === color) return i * 16 + ((j + 1) % M) * 4 + k;       // +Y
  return i * 16 + j * 4 + ((k + 1) % M);                               // +Z
}

function verifyCycle(color: number): { length: number; vertices: Set<number> } {
  const visited = new Set<number>();
  let node = 0;
  while (!visited.has(node)) {
    visited.add(node);
    node = successor(node, color);
  }
  return { length: visited.size, vertices: visited };
}

// ═══════════════════════════════════════════
//  VERIFICATION
// ═══════════════════════════════════════════

console.log("═══════════════════════════════════════════════");
console.log("  🔬 INDEPENDENT VERIFICATION: Knuth m=4");
console.log("═══════════════════════════════════════════════\n");

let allPassed = true;

// Check 1: Payload validity
console.log("  Check 1: Payload format");
const payloadValid = PAYLOAD.length === 64 && PAYLOAD.every(v => v >= 0 && v <= 5);
console.log(`    Length = ${PAYLOAD.length} ${PAYLOAD.length === 64 ? "✅" : "❌"}`);
console.log(`    All values in [0,5] ${payloadValid ? "✅" : "❌"}`);
allPassed &&= payloadValid;

// Check 2: Each color forms a single Hamiltonian cycle
for (let color = 0; color < 3; color++) {
  console.log(`\n  Check 2.${color}: Color ${color} Hamiltonian cycle`);
  const { length, vertices } = verifyCycle(color);
  const isHamiltonian = length === 64;
  console.log(`    Cycle length = ${length} ${isHamiltonian ? "✅" : "❌"} (need 64)`);
  console.log(`    Distinct vertices = ${vertices.size} ${vertices.size === 64 ? "✅" : "❌"}`);

  // Verify the cycle returns to start
  let node = 0;
  for (let step = 0; step < 64; step++) node = successor(node, color);
  const returnsToStart = node === 0;
  console.log(`    Returns to vertex 0 after 64 steps ${returnsToStart ? "✅" : "❌"}`);

  allPassed &&= isHamiltonian && vertices.size === 64 && returnsToStart;
}

// Check 3: Edge coverage — every directed arc is used exactly once
console.log("\n  Check 3: Edge coverage (192 arcs, no overlap)");
const edgeColors = new Map<string, number>();
let edgeConflicts = 0;
for (let v = 0; v < V; v++) {
  const perm = PERMS[PAYLOAD[v]!]!;
  const i = Math.floor(v / 16);
  const j = Math.floor(v / 4) % 4;
  const k = v % 4;

  const targets = [
    ((i + 1) % M) * 16 + j * 4 + k,       // +X
    i * 16 + ((j + 1) % M) * 4 + k,        // +Y
    i * 16 + j * 4 + ((k + 1) % M),        // +Z
  ];

  for (let dir = 0; dir < 3; dir++) {
    const edge = `${v}->${targets[dir]}`;
    if (edgeColors.has(edge)) {
      edgeConflicts++;
    }
    edgeColors.set(edge, perm[dir]!);
  }
}
console.log(`    Total edges assigned = ${edgeColors.size} ${edgeColors.size === 192 ? "✅" : "❌"} (need 192)`);
console.log(`    Edge conflicts = ${edgeConflicts} ${edgeConflicts === 0 ? "✅" : "❌"}`);
allPassed &&= edgeColors.size === 192 && edgeConflicts === 0;

// Check 4: Per-vertex in-degree and out-degree
console.log("\n  Check 4: Degree regularity check");
let degreeValid = true;
for (let color = 0; color < 3; color++) {
  const outDeg = new Array(V).fill(0);
  const inDeg = new Array(V).fill(0);
  for (let v = 0; v < V; v++) {
    const next = successor(v, color);
    outDeg[v]++;
    inDeg[next]++;
  }
  const allOut1 = outDeg.every(d => d === 1);
  const allIn1 = inDeg.every(d => d === 1);
  if (!allOut1 || !allIn1) degreeValid = false;
}
console.log(`    Every vertex: out-degree 1, in-degree 1 per color ${degreeValid ? "✅" : "❌"}`);
allPassed &&= degreeValid;

// Final verdict
console.log("\n═══════════════════════════════════════════════");
if (allPassed) {
  console.log("  ✅✅✅ ALL CHECKS PASSED — DECOMPOSITION VALID ✅✅✅");
} else {
  console.log("  ❌ VERIFICATION FAILED");
}
console.log("═══════════════════════════════════════════════\n");

process.exit(allPassed ? 0 : 1);
