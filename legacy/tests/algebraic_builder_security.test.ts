import { expect, test, describe } from "bun:test";
import { compileEdgeRule, SandboxError } from "../src/search/algebraic_builder";

describe("AlgebraicBuilder Security", () => {
  test("rejects rules containing process", () => {
    expect(() => compileEdgeRule("process.exit(1);")).toThrow(SandboxError);
  });

  test("rejects rules containing require", () => {
    expect(() => compileEdgeRule("const fs = require('fs'); return true;")).toThrow(SandboxError);
  });

  test("rejects rules containing globalThis", () => {
    expect(() => compileEdgeRule("globalThis.Math.random() > 0.5")).toThrow(SandboxError);
  });

  test("allows legitimate math rules", () => {
    const fn = compileEdgeRule("return (i + j) % 2 === 0");
    expect(fn(1, 1)).toBe(true);
    expect(fn(1, 2)).toBe(false);
  });
});
