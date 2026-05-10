
import { expect, test, describe } from "bun:test";
import { AlgebraicBuilder } from "../src/search/algebraic_builder";

describe("AlgebraicBuilder Dependency Injection", () => {
  test("buildAndVerify calls journal.record when journal is provided", async () => {
    let recorded = "";
    const mockJournal = {
      record: (obs: string) => { recorded = obs; }
    };

    const config = {
      vertices: 10,
      description: "testing record",
      edge_rule_js: "return (i + j) % 2 === 0"
    };

    await AlgebraicBuilder.buildAndVerify(
      config, 4, 6, mockJournal, null
    );

    expect(recorded).toContain("AlgebraicBuilder");
  });

  test("buildAndVerify works when journal is null", async () => {
    const config = {
      vertices: 10,
      description: "testing null journal",
      edge_rule_js: "return (i + j) % 2 === 0"
    };

    // Should not throw
    await AlgebraicBuilder.buildAndVerify(
      config, 4, 6, null, null
    );
  });
});
