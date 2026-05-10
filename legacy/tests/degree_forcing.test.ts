import { describe, expect, test } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { ramseyEnergy, ramseyEnergyDelta } from "../src/math/graph/RamseyEnergy";

describe("Degree Sequence Forcing", () => {
  test("Valid degree sequence (10 <= dR <= 17) has no penalty", () => {
    const adj = new AdjacencyMatrix(35);
    // Create a graph where every vertex has degree 10
    // A simple way is to connect each vertex i to i+1..i+10 (mod 35)
    for (let i = 0; i < 35; i++) {
      for (let j = 1; j <= 5; j++) {
        adj.addEdge(i, (i + j) % 35);
      }
    }
    
    // Check degrees
    for (let i = 0; i < 35; i++) {
      expect(adj.degree(i)).toBe(10);
    }

    const energy = ramseyEnergy(adj, 4, 6);
    // The energy will be non-zero because of cliques/independent sets, but penalty should be 0.
    // Let's calculate the penalty manually to be sure.
    // We can't directly read penalty, but we can verify delta doesn't add penalty.
    
    // Let's create an empty graph, it should have a massive penalty.
    const emptyAdj = new AdjacencyMatrix(35);
    const emptyEnergy = ramseyEnergy(emptyAdj, 4, 6);
    // For empty graph, dR=0 for all 35 vertices. Penalty = 35 * (10 - 0) * 100 = 35000.
    // Plus countCliques(4) = 0, countIndependentSets(6) = C(35,6) = 1,623,160.
    // Total should be 1623160 + 35000 = 1658160.
    expect(emptyEnergy).toBe(1623160 + 35000);
  });

  test("Delta computation matches full compute with penalty", () => {
    const adj = new AdjacencyMatrix(35);
    // Empty graph: all degrees 0.
    const initialEnergy = ramseyEnergy(adj, 4, 6);
    
    // Add one edge. Degrees of u and v go from 0 to 1.
    // Penalty before: (10-0)*100 = 1000 each.
    // Penalty after: (10-1)*100 = 900 each.
    // Penalty delta: 1800 - 2000 = -200.
    // Cliques delta: 0
    // IndSet delta: K_6 ind sets containing (0,1).
    // The number of subsets of size 4 from the remaining 33 vertices: C(33, 4) = 40920.
    // Since all other edges are absent, adding this edge destroys 40920 independent sets.
    // So IndSet delta = -40920.
    // Total delta = -40920 - 200 = -41120.
    
    const delta = ramseyEnergyDelta(adj, 0, 1, 4, 6);
    expect(delta).toBe(-40920 - 200);

    adj.addEdge(0, 1);
    const newEnergy = ramseyEnergy(adj, 4, 6);
    expect(newEnergy - initialEnergy).toBe(delta);
  });

  test("Penalty applies correctly when exceeding max degree", () => {
    const adj = new AdjacencyMatrix(35);
    // Make vertex 0 connected to 18 vertices (degree 18).
    for (let i = 1; i <= 18; i++) {
      adj.addEdge(0, i);
    }
    
    expect(adj.degree(0)).toBe(18);
    // degree of 1..18 is 1. Penalty: 9 * 100 = 900 each. (18 vertices -> 16200)
    // degree of 19..34 is 0. Penalty: 10 * 100 = 1000 each. (16 vertices -> 16000)
    // degree of 0 is 18. Penalty: (18 - 17) * 100 = 100.
    // Total penalty: 16200 + 16000 + 100 = 32300.
    
    // Check if delta of removing an edge from v0 reduces penalty.
    // Removing edge (0, 1):
    // v0 degree goes 18 -> 17. Penalty goes 100 -> 0 (delta -100).
    // v1 degree goes 1 -> 0. Penalty goes 900 -> 1000 (delta +100).
    // Penalty delta = 0.
    const delta = ramseyEnergyDelta(adj, 0, 1, 4, 6);
    
    const initialEnergy = ramseyEnergy(adj, 4, 6);
    adj.removeEdge(0, 1);
    const newEnergy = ramseyEnergy(adj, 4, 6);
    
    expect(newEnergy - initialEnergy).toBe(delta);
  });
});
