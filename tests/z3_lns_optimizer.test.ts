import { expect, test, describe } from "bun:test";
import { AdjacencyMatrix } from "../src/math/graph/AdjacencyMatrix";
import { cullClauses, ekey } from "../src/search/z3_clause_generator";
import { adaptiveZ3Solve } from "../src/search/z3_lns_optimizer";
import { SolverBridge } from "../src/solver";
import { countCliques } from "../src/math/graph/RamseyEnergy";

  test("RED Test 1: Generate K_4 clauses referencing ONLY 2 free edges", () => {
    // 10-vertex graph
    const graph = new AdjacencyMatrix(10);
    // Let's make it fully monochromatic blue (all 0s) to start
    // So every K_4 is all-blue. Wait, if it's all blue, then Blue K_6 is violated!
    // If Blue K_6 is violated and entirely locked, it returns preUnsat=true!
    // So let's intentionally color it to avoid static K_4 (red) and K_6 (blue).
    // Or simpler: just use 0s, but we'll check `redClauses` since K_4 red needs at least one blue edge.
    // If it's all blue, Red K_4 constraint implies "At least one must be blue", which is trivially SAT,
    // so `frozenBlueFound = true` and the clause is culled!
    // Ah! To actually emit red clauses, we need the locked edges to be red (1),
    // and the free edges to be the only ones that could potentially be blue (0) to save it.

    // Let's make an explicitly red graph!
    for (let u = 0; u < 10; u++) {
      for (let v = u + 1; v < 10; v++) {
        graph.addEdge(u, v);
      }
    }

    // Now every K_4 is red. It would be statically UNSAT.
    // Let's unlock exactly 2 edges.
    const freeEdgeKeys = new Set<string>();
    freeEdgeKeys.add(ekey(0, 1));
    freeEdgeKeys.add(ekey(0, 2));

    // If we only unlock those two edges, are there any K_4s that are NOT completely locked?
    // Any K_4 that contains (0,1) or (0,2) is partially free.
    // Any K_4 that DOES NOT contain either is completely locked and red -> STATIC UNSAT!
    // So the Clause Culler will return `isStaticallyUnsat: true` immediately upon finding a locked red K_4 (e.g., 3,4,5,6).

    const result1 = cullClauses(graph, freeEdgeKeys, 4, 6);
    expect(result1.isStaticallyUnsat).toBe(true);

    // Let's color the graph safely so there are NO static locked red K_4s or blue K_6s.
    // We only need to test that the culler logic filters correctly!
    graph.scatter(0.5); // Randomize
    
    // Instead of random, let's just make it a bipartite graph (triangle-free, so NO red K_3 let alone K_4).
    const bipartite = new AdjacencyMatrix(10);
    for (let i = 0; i < 5; i++) {
        for (let j = 5; j < 10; j++) {
            bipartite.addEdge(i, j); // Red edges across partition
        }
    }
    // Now there are NO red K_3s, hence no red K_4s.
    // Blue edges are within partitions: (0,1,2,3,4) is a blue K_5. (5,6,7,8,9) is a blue K_5.
    // Max blue is K_5, so there are NO blue K_6s!
    // Perfect! This graph has NO monochromatic K_4 (red) or K_6 (blue)!

    // Free 2 edges that are currently red: (0,5) and (0,6)
    const freeBipartiteKeys = new Set<string>([ekey(0, 5), ekey(0, 6)]);

    const result = cullClauses(bipartite, freeBipartiteKeys, 4, 6);

    expect(result.isStaticallyUnsat).toBe(false);

    // Now, does it emit red clauses?
    // A red K_4 clause requires that at least one edge in the K_4 is blue.
    // If a K_4 has a locked blue edge, the constraint is trivially satisfied (frozenBlueFound = true), so it's culled.
    // It only emits a clause if ALL locked edges in the K_4 are RED.
    // Bipartite graph only has red edges between partitions.
    // Any K_4 must have vertices distributed as (3,1) or (2,2) across partitions.
    // If (3,1), e.g. 0,1,2 on left and 5 on right. Red edges are (0,5), (1,5), (2,5). Blue edges are (0,1), (0,2), (1,2).
    // So there are locked blue edges! The red constraint is natively satisfied.
    // Therefore, no red clauses will be emitted unless there is a K_4 made ENTIRELY of red edges (which is impossible in bipartite).
    expect(result.redClauses.length).toBe(0);

    // Let's forcefully craft a K_4 that is ALL RED except one free edge!
    // Vertices 0, 1, 2, 3.
    const custom = new AdjacencyMatrix(10);
    custom.addEdge(0, 1);
    custom.addEdge(0, 2);
    // 0,3 is FREE
    custom.addEdge(1, 2);
    custom.addEdge(1, 3);
    custom.addEdge(2, 3);

    const freeCustomKeys = new Set<string>([ekey(0, 3)]);

    const customResult = cullClauses(custom, freeCustomKeys, 4, 100);
    expect(customResult.isStaticallyUnsat).toBe(false); // No static red K_4 because (0,3) is free, no other K_4s are made red.

    // It MUST emit a constraint for 0,1,2,3 because all its locked edges are red!
    expect(customResult.redClauses.length).toBeGreaterThan(0);
    // And that constraint MUST ONLY contain the free edge (0,3).
    const emittedClause = customResult.redClauses[0];
    expect(emittedClause).toBeDefined();
    expect(emittedClause!.length).toBe(1);
    expect(emittedClause![0]).toBe("0_3");
  });

  test("RED Test 2: Sub-Space Solve (Recover E=0 from E=1)", async () => {
    // 10-vertex graph, maxRed=3, maxBlue=100 (simplify for fast test)
    // We will build a graph that has exactly ONE K_3 (red), and no others.
    const N = 10;
    const r = 3;
    const s = 100;

    const graph = new AdjacencyMatrix(N);
    // Add path graph to keep triangles 0
    for(let i=0; i<N-1; i++) graph.addEdge(i, i+1);

    // Force precisely one K_3: (0,1,2)
    graph.addEdge(0, 2);

    expect(countCliques(graph, r)).toBe(1);

    // Initial cliques containing the hot zone
    const cliques = [[0, 1, 2]];

    const solver = new SolverBridge();

    // Call adaptiveZ3Solve!
    // It should unlock the clique edges + a halo of 10.
    // It should trivially find a configuration that breaks the K_3 without making new ones
    // (e.g. flipping (0,2) to blue = 0).
    const fixedGraph = await adaptiveZ3Solve(graph, cliques, solver, r, s);

    expect(fixedGraph).not.toBeNull();
    expect(countCliques(fixedGraph!, r)).toBe(0);
  });
});
