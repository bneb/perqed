import * as fs from 'fs';
import * as path from 'path';

function fixTests(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixTests(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.test.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;

      content = content.replace(/}, undefined as any, undefined as any\);/g, "});");
      content = content.replace(/}, failingLLM, mockArchitect\);/g, "});");
      content = content.replace(/}, solvingLLM, noopArchitect\);/g, "});");
      content = content.replace(/}, trackingLLM, mockArchitect\);/g, "});");
      content = content.replace(/}, givingUpLLM, mockArchitect\);/g, "});");
      content = content.replace(/}, infiniteTactics, noopArchitect\);/g, "});");
      content = content.replace(/}, noopLLM, noopArchitect\);/g, "});");

      if (content.includes("maxGlobalIterations:") && !content.includes("z3TimeoutMs:") && !content.includes("z3TimeoutMs :")) {
         content = content.replace(/maxGlobalIterations:\s*([^,]+),/g, "maxGlobalIterations: $1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, ");
      }
      if (content.includes("maxLocalRetries:") && !content.includes("z3TimeoutMs:") && !content.includes("z3TimeoutMs :")) {
          content = content.replace(/maxLocalRetries:\s*([^,]+),/g, "maxLocalRetries: $1, z3TimeoutMs: 30000, leanTimeoutMs: 60000, contextWindowTokens: 4096, ");
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log("Fixed " + fullPath);
      }
    }
  }
}

fixTests('./tests');

let r = fs.readFileSync('src/orchestration/runner.ts', 'utf8');
r = r.replace(/\s*crossPollinate: config\.crossPollinate \?\? false,/g, '');
fs.writeFileSync('src/orchestration/runner.ts', r);

console.log("Done");
