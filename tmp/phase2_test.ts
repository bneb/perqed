import { ExplorerAgent } from "../src/agents/explorer";

// Toy algorithmic seed for R(3,3)
const seed1 = `
import itertools

def is_triangle_free(edges, n):
    for combo in itertools.combinations(range(n), 3):
        e1 = (combo[0], combo[1]) in edges
        e2 = (combo[1], combo[2]) in edges
        e3 = (combo[0], combo[2]) in edges
        if e1 and e2 and e3:
            return False
    return True

def find_r33_bound():
    best_n = 3
    for n in range(3, 7):
        found_witness = False
        all_pairs = list(itertools.combinations(range(n), 2))
        
        # very tiny heuristic search
        for L in range(1, len(all_pairs)):
            for edge_set in itertools.combinations(all_pairs, L):
                red_edges = set(edge_set)
                
                # Check red is triangle free
                if not is_triangle_free(red_edges, n): continue
                
                # Check blue is triangle free
                blue_edges = set(all_pairs) - red_edges
                if not is_triangle_free(blue_edges, n): continue
                
                found_witness = True
                break
            
            if found_witness: break
            
        if found_witness:
            best_n = n
        else:
            break
            
    # The score is the largest n we found a witnessing 2-coloring for
    print(f"SCORE: {best_n}")

if __name__ == "__main__":
    find_r33_bound()
`;

// Seed 2: Just random dummy
const seed2 = `
print("SCORE: 4")
`;

async function main() {
    console.log("Starting evolutionary toy run for R(3,3)...");
    
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY must be set in .env");
    }

    const explorer = new ExplorerAgent({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-2.5-pro",
        sandboxTimeoutMs: 15_000 // fast timeout for toys
    });

    try {
        const bestHeuristic = await explorer.evolveDomain("Ramsey R(3,3) Triangle-Free Coloring", [seed1, seed2], 2);
        console.log("Evolution finished! Best score:", bestHeuristic.score);
        console.log("Best program layout length:", bestHeuristic.code.length);
    } catch (e: any) {
        console.error("Test failed:", e);
    }
}

main();
