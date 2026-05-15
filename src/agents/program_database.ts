import crypto from "node:crypto";

export type TopologicalIsland = 
  | "spectral" 
  | "algebraic" 
  | "probabilistic" 
  | "combinatorial" 
  | "analytic" 
  | "hybrid";

export interface HeuristicProgram {
  code: string;
  score: number;
  island?: TopologicalIsland;
}

export interface ProgramDatabaseConfig {
  capacity?: number;
}

export class ProgramDatabase {
  private pool: Map<string, HeuristicProgram> = new Map();
  private capacity: number;

  constructor(config?: ProgramDatabaseConfig) {
    this.capacity = config?.capacity ?? 64;
  }

  private hash(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  /**
   * Classify the topological structure of the Python heuristic to assign it to an evolutionary island.
   */
  private classifyIsland(code: string): TopologicalIsland {
    if (/linalg|eigenval|eigvec|spectral/i.test(code)) return "spectral";
    if (/sympy|Galois|FiniteField|Group|Algebra/i.test(code)) return "algebraic";
    if (/random|np\.random|probabilit/i.test(code)) return "probabilistic";
    if (/itertools|networkx|combinations|permutations/i.test(code)) return "combinatorial";
    if (/scipy\.optimize|integrate|gradient|epsilon/i.test(code)) return "analytic";
    return "hybrid";
  }

  public registerProgram(program: HeuristicProgram, semanticTrace?: string): void {
    // If semantic trace is provided, use it for behavioral hashing instead of raw AST
    const key = semanticTrace ? this.hash(semanticTrace) : this.hash(program.code);
    program.island = this.classifyIsland(program.code);
    
    if (this.pool.has(key)) {
      const existing = this.pool.get(key)!;
      // Replace if score is higher, OR if scores are equal but new code is shorter (Occam's Razor)
      if (program.score > existing.score || (program.score === existing.score && program.code.length < existing.code.length * 0.9)) {
        this.pool.set(key, program);
      }
      return;
    }

    this.pool.set(key, program);
    this.enforceCapacity();
  }

  public getPrograms(): HeuristicProgram[] {
    return Array.from(this.pool.values()).sort((a, b) => b.score - a.score);
  }

  private enforceCapacity(): void {
    if (this.pool.size <= this.capacity) return;

    // Sort by descending score
    const programs = this.getPrograms();
    
    // Evict the lowest scoring ones
    const toEvict = programs.slice(this.capacity);
    for (const p of toEvict) {
      this.pool.delete(this.hash(p.code));
    }
  }

  /**
   * Performs tournament selection to sample two unique parents.
   * Promotes cross-pollination between different topological islands.
   */
  public sampleParents(tournamentSize: number = 3): { parentA: HeuristicProgram; parentB: HeuristicProgram } {
    const programs = Array.from(this.pool.values());
    if (programs.length < 2) {
      throw new Error("Not enough programs in the database to sample parents");
    }

    const selectOne = (): HeuristicProgram => {
      let best: HeuristicProgram | null = null;
      for (let i = 0; i < tournamentSize; i++) {
        const candidate = programs[Math.floor(Math.random() * programs.length)]!;
        if (!best || candidate.score > best.score) {
          best = candidate;
        }
      }
      return best!;
    };

    const parentA = selectOne();
    let parentB = selectOne();
    
    // Attempt to ensure uniqueness AND topological diversity
    let retries = 15;
    while (retries > 0) {
      if (this.hash(parentA.code) !== this.hash(parentB.code)) {
        // We found unique parents. Give a strong preference if they are from different islands
        if (parentA.island !== parentB.island || retries < 5) {
          break;
        }
      }
      parentB = selectOne();
      retries--;
    }

    return { parentA, parentB };
  }
}
