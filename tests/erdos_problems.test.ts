
import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { fetchErdosProblem, isErdosProblemQuery, formatErdosProblemForPrompt } from "../src/utils/erdos_problems";
import { asFetch } from "./helpers/fetch_mock";

describe("ErdosProblems Utility", () => {
  const originalFetch = globalThis.fetch;

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe("isErdosProblemQuery", () => {
    test("detects erdosproblems.com URLs", () => {
      expect(isErdosProblemQuery("https://www.erdosproblems.com/265")).toBe(true);
      expect(isErdosProblemQuery("erdosproblems.com/123")).toBe(true);
    });

    test("detects 'Erdos ID' references", () => {
      expect(isErdosProblemQuery("Erdos 265")).toBe(true);
      expect(isErdosProblemQuery("Erdos #265")).toBe(true);
      expect(isErdosProblemQuery("erdos 1")).toBe(true);
    });

    test("returns false for unrelated queries", () => {
      expect(isErdosProblemQuery("Prove Goldbach's conjecture")).toBe(false);
      expect(isErdosProblemQuery("Ramsey theory")).toBe(false);
    });
  });

  describe("fetchErdosProblem", () => {
    test("successfully parses a problem page and fetches forum comments with relative and absolute URLs", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div id="content">Problem statement.</div>
            <div class="comment-count">
              <a href="/forum/discuss/1002">Comments</a>
            </div>
          </body>
        </html>
      `;

      const mockForumHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="post-text">Relevant insight.</div>
          </body>
        </html>
      `;

      globalThis.fetch = asFetch(async (url) => {
        if (url.toString() === "https://www.erdosproblems.com/forum/discuss/1002") {
          return new Response(mockForumHtml, { status: 200 });
        }
        return new Response(mockHtml, { status: 200 });
      });

      const problem = await fetchErdosProblem("1002");
      expect(problem?.remarks).toContain("[Forum Comment] Relevant insight.");
    });

    test("handles forum fetch failure gracefully while keeping main problem data", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div id="content">Problem statement.</div>
            <div class="comment-count">
              <a href="/forum/discuss/failed">Comments</a>
            </div>
          </body>
        </html>
      `;

      globalThis.fetch = asFetch(async (url) => {
        if (url.toString().includes("/forum/discuss/failed")) {
          return new Response("Not Found", { status: 404 });
        }
        return new Response(mockHtml, { status: 200 });
      });

      const problem = await fetchErdosProblem("265");
      expect(problem).not.toBeNull();
      expect(problem?.content).toBe("Problem statement.");
      expect(problem?.remarks).toEqual([]); // No comments because of 404
    });

    test("filters out specific UI junk from remarks", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div id="content">Problem.</div>
            <div class="problem-additional-text">
              Actual mathematical remark.
              <p>View the LaTeX source</p>
              <div id="previous_id">Previous</div>
              <div class="image-container">Some image</div>
            </div>
          </body>
        </html>
      `;

      globalThis.fetch = asFetch(async () => new Response(mockHtml, { status: 200 }));

      const problem = await fetchErdosProblem("265");
      expect(problem?.remarks).toEqual(["Actual mathematical remark."]);
    });

    test("extracts multiple types of forum comment classes", async () => {
      const mockForumHtml = `
        <div class="post-text">Post text</div>
        <div class="post-content">Post content</div>
        <div class="comment-text">Comment text</div>
      `;

      globalThis.fetch = asFetch(async (url) => {
        if (url.toString().includes("/forum/discuss/")) {
          return new Response(mockForumHtml, { status: 200 });
        }
        return new Response(`
          <div id="content">Problem.</div>
          <div class="comment-count"><a href="/forum/discuss/1">Link</a></div>
        `, { status: 200 });
      });

      const problem = await fetchErdosProblem("1");
      expect(problem?.remarks).toContain("[Forum Comment] Post text");
      expect(problem?.remarks).toContain("[Forum Comment] Post content");
      expect(problem?.remarks).toContain("[Forum Comment] Comment text");
    });

    test("handles fetch failure (non-200)", async () => {
      globalThis.fetch = asFetch(async () => new Response("Not Found", { status: 404 }));
      const problem = await fetchErdosProblem("Erdos 999");
      expect(problem).toBeNull();
    });

    test("handles fetch exception", async () => {
      globalThis.fetch = asFetch(async () => { throw new Error("Network Down"); });
      const problem = await fetchErdosProblem("Erdos 265");
      expect(problem).toBeNull();
    });

    test("handles missing content gracefully", async () => {
      const mockHtml = `<html><head><title>Empty</title></head><body></body></html>`;
      globalThis.fetch = asFetch(async () => new Response(mockHtml, { status: 200 }));
      const problem = await fetchErdosProblem("265");
      expect(problem).not.toBeNull();
      expect(problem?.content).toBe("");
      expect(problem?.remarks).toEqual([]);
    });

    test("extracts ID correctly from various formats", async () => {
      globalThis.fetch = asFetch(async () => new Response("<html></html>", { status: 200 }));
      
      const p1 = await fetchErdosProblem("https://erdosproblems.com/123");
      expect(p1?.id).toBe("123");

      const p2 = await fetchErdosProblem("#456");
      expect(p2?.id).toBe("456");

      const p3 = await fetchErdosProblem("789");
      expect(p3?.id).toBe("789");
    });
  });

  describe("formatErdosProblemForPrompt", () => {
    test("formats problem data into a markdown string", () => {
      const mockProblem = {
        id: "265",
        title: "265 | Erdős Problems",
        content: "Statement here.",
        remarks: ["Remark 1", "Remark 2"],
        tags: ["tag1", "tag2"],
        url: "https://www.erdosproblems.com/265"
      };

      const formatted = formatErdosProblemForPrompt(mockProblem);
      expect(formatted).toContain("## Erdős Problem #265");
      expect(formatted).toContain("**URL:** https://www.erdosproblems.com/265");
      expect(formatted).toContain("Statement here.");
      expect(formatted).toContain("Remark 1");
      expect(formatted).toContain("Remark 2");
      expect(formatted).toContain("**Tags:** tag1, tag2");
    });

    test("skips remarks/tags if empty", () => {
      const mockProblem = {
        id: "265",
        title: "265 | Erdős Problems",
        content: "Statement here.",
        remarks: [],
        tags: [],
        url: "https://www.erdosproblems.com/265"
      };

      const formatted = formatErdosProblemForPrompt(mockProblem);
      expect(formatted).not.toContain("**Remarks:**");
      expect(formatted).not.toContain("**Tags:**");
    });
  });
});
