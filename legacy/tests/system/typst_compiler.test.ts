import { expect, test, describe } from "bun:test";
import { TypstCompiler } from "../../src/system/typst_compiler";
import * as path from "node:path";
import * as fs from "node:fs/promises";

describe("Typst Academic Scribe Compiler Engine", () => {
  const mockWorkspaceDir = path.join(process.cwd(), "agent_workspace_test_typst");
  
  test("Successfully processes parameters into a .typ document", async () => {
    // 1. Arrange a mock payload bridging XState context into Typst parameters
    const payload = {
        workspaceDir: mockWorkspaceDir,
        approvedConjecture: { signature: "R(5,5) < 43", description: "" },
        hypothesis: "N >= 43 implies Clique or Independent Set >= 5",
        saEnergy: 0,
        flagAlgebraLimits: { lowerBound: 42.0, upperBound: 43.1 },
        leanAst: { status: "valid AST" },
        leanProof: null,
        proofStatus: "PROVED"
    };

    // 2. Act
    const reportLoc = await TypstCompiler.compileReport(payload);
    
    // 3. Assert
    expect(reportLoc).toBeDefined();
    
    // Check fallback logic triggers (since the runner might not have typst globally installed)
    const ext = path.extname(reportLoc);
    expect([".pdf", ".typ"]).toContain(ext);
    
    // Assert the base template was indeed parsed
    if (ext === ".typ") {
        const fileContent = await fs.readFile(reportLoc, "utf-8");
        expect(fileContent).toContain("R(5,5) < 43");
        expect(fileContent).toContain("42.0");
        expect(fileContent).toContain("PROVED");
        expect(fileContent).toContain("Energy Threshold Hit: 0");
    }
  });
});
