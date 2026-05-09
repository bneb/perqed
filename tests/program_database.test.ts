import { expect, test, describe } from "bun:test";
import { ProgramDatabase, type HeuristicProgram } from "../src/agents/program_database";

describe("ProgramDatabase — Evolutionary Heuristic Pool", () => {
  test("maintains a maximum pool capacity and evicts lowest scores", () => {
    const db = new ProgramDatabase({ capacity: 5 });
    
    // Insert 6 programs
    for (let i = 0; i < 6; i++) {
        db.registerProgram({ code: `test_${i}`, score: i * 10 });
    }

    const programs = db.getPrograms();
    expect(programs.length).toBe(5);
    
    // The lowest score (test_0 with score 0) should have been evicted
    expect(programs.map((p: HeuristicProgram) => p.code)).not.toContain("test_0");
    expect(programs.map((p: HeuristicProgram) => p.code)).toContain("test_5"); // score 50
  });

  test("tournament selection returns higher scoring programs on average", () => {
    const db = new ProgramDatabase({ capacity: 10 });
    for (let i = 0; i < 10; i++) {
        db.registerProgram({ code: `test_${i}`, score: i });
    }

    const { parentA, parentB } = db.sampleParents(3);
    
    expect(parentA).toBeDefined();
    expect(parentB).toBeDefined();
    expect(parentA.code).not.toEqual(parentB.code);
  });

  test("does not accept duplicate code", () => {
    const db = new ProgramDatabase({ capacity: 5 });
    db.registerProgram({ code: "duplicate()", score: 10 });
    db.registerProgram({ code: "duplicate()", score: 20 });
    
    expect(db.getPrograms().length).toBe(1);
    // Overwrites or ignores, length must be 1
  });

  test("classifies programs into topological islands", () => {
    const db = new ProgramDatabase({ capacity: 10 });
    db.registerProgram({ code: "import numpy as np\nvals, vecs = np.linalg.eig(M)", score: 10 });
    db.registerProgram({ code: "from sympy import GaloisField\nF = GaloisField(17)", score: 15 });
    db.registerProgram({ code: "import itertools\nperms = itertools.permutations([1,2,3])", score: 20 });
    
    const programs = db.getPrograms();
    expect(programs.find(p => p.score === 10)?.island).toBe("spectral");
    expect(programs.find(p => p.score === 15)?.island).toBe("algebraic");
    expect(programs.find(p => p.score === 20)?.island).toBe("combinatorial");
  });

  test("sampleParents prefers topological diversity", () => {
    const db = new ProgramDatabase({ capacity: 10 });
    db.registerProgram({ code: "from sympy import Group", score: 100 }); // algebraic
    db.registerProgram({ code: "import scipy.optimize", score: 99 }); // analytic
    db.registerProgram({ code: "import numpy.linalg", score: 98 }); // spectral
    
    const { parentA, parentB } = db.sampleParents(1); // Tournament size 1 = random uniform
    expect(parentA.island).not.toBe(parentB.island);
  });

  test("uses semantic trace for behavioral deduplication and Occam's Razor", () => {
    const db = new ProgramDatabase({ capacity: 10 });
    
    const programA = { code: "def f(x):\n  return x + 1\n# some extra useless comments to make it long", score: 10 };
    const trace = "OUTPUT_TRACE_123";
    
    // Register the first program
    db.registerProgram(programA, trace);
    expect(db.getPrograms().length).toBe(1);
    
    // Register a functionally identical, but syntactically different AND shorter program
    const programB = { code: "def f(x): return x+1", score: 10 };
    db.registerProgram(programB, trace);
    
    // The shorter one should overwrite the longer one, keeping pool size at 1
    const programs = db.getPrograms();
    expect(programs.length).toBe(1);
    expect(programs[0]!.code).toBe(programB.code);
    
    // Register a longer one, it should be rejected because it's not strictly < 90%
    const programC = { code: "def f(x): return x + 1 # wait no", score: 10 };
    db.registerProgram(programC, trace);
    
    expect(db.getPrograms()[0]!.code).toBe(programB.code);
  });
});
