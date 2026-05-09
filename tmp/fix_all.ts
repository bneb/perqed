import * as fs from 'fs';
import * as path from 'path';

function findTestFiles(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files = files.concat(findTestFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const testFiles = findTestFiles('./tests');

let replacedTargetContent = 0;
let replacedSubgoal = 0;
let replacedRunProver = 0;

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Fix the `maxLocalRetries` literal injection that broke Premise
  const badLiteral = "maxLocalRetries: 3, z3TimeoutMs: 1000, leanTimeoutMs: 10000, contextWindowTokens: 4096, theoremSignature:";
  if (content.includes(badLiteral)) {
    content = content.replace(new RegExp(badLiteral, 'g'), "theoremSignature:");
    replacedTargetContent++;
  }

  // 2. Fix the `hasSubgoalProposal?` literal issue
  const returnPattern = /    identicalErrorCount:\s*\d+,\n\s*totalTacticianCalls:\s*\d+,\n\s*\.\.\.overrides,\n\s*};/g;
  if (returnPattern.test(content)) {
    content = content.replace(
      /    identicalErrorCount:\s*(\d+),\n\s*totalTacticianCalls:\s*(\d+),\n\s*\.\.\.overrides,\n\s*};/g,
      "    identicalErrorCount: $1,\n    totalTacticianCalls: $2,\n    hasSubgoalProposal: false,\n    ...overrides,\n  };"
    );
    replacedSubgoal++;
  }

  // 3. Fix runProverLoop arguments (tests/resilience.test.ts, tests/dual_engine.test.ts, etc.)
  // It replaces }, someVar, someOtherVar); with }, undefined as any, undefined as any);
  if (content.includes("runProverLoop(wm, solver, {")) {
    content = content.replace(
        /},\s*[a-zA-Z0-9_]+,\s*[a-zA-Z0-9_]+\);/g,
        "}, undefined as any, undefined as any);"
    );
    replacedRunProver++;
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}

console.log(`Done. Fixed premises: ${replacedTargetContent}, subgoals: ${replacedSubgoal}, runProvers: ${replacedRunProver}`);
