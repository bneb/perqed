import { SketcherAgent } from "./src/agents/sketcher";

async function run() {
  try {
    const sketcher = new SketcherAgent(process.env.GEMINI_API_KEY || "", process.cwd());
    const sketch = await sketcher.sketchFormalOutline("The sum of two even numbers is even.");
  } catch (e: any) {
    console.error("Test failed:", e.message);
  }
}

run();
