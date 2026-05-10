
import { JSDOM } from "jsdom";

export interface ErdosProblem {
  id: string;
  title: string;
  content: string;
  remarks: string[];
  tags: string[];
  url: string;
}

export async function fetchErdosProblem(query: string): Promise<ErdosProblem | null> {
  let id: string | null = null;

  // 1. Try to extract ID from query
  const urlMatch = query.match(/erdosproblems\.com\/(\d+)/);
  if (urlMatch) {
    id = urlMatch[1];
  } else {
    const idMatch = query.match(/(?:Erdos\s*)?(?:#)?(\d+)/i);
    if (idMatch) {
      id = idMatch[1];
    }
  }

  if (!id) {
    return null;
  }

  const baseUrl = "https://www.erdosproblems.com";
  const url = `${baseUrl}/${id}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[ErdosProblems] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // The main problem text is in <div id="content">
    const contentEl = doc.querySelector("#content");
    const content = contentEl?.innerHTML?.trim() || "";
    
    const title = doc.querySelector("title")?.textContent?.trim() || `Erdos Problem #${id}`;
    
    const remarks: string[] = [];
    doc.querySelectorAll(".problem-additional-text").forEach(el => {
      // Clone to avoid modifying the original DOM
      const clone = el.cloneNode(true) as HTMLElement;
      
      // Remove known junk: navigation links, LaTeX source links, history links, image containers
      clone.querySelectorAll("#previous_id, #next_id, p, .image-container, #image-container" + id).forEach(junk => {
        const text = junk.textContent?.toLowerCase() || "";
        const isMetaLink = text.includes("view the latex source") || text.includes("view history");
        const isNav = junk.id === "previous_id" || junk.id === "next_id";
        const isImage = junk.classList.contains("image-container") || junk.id.startsWith("image-container");
        
        if (isMetaLink || isNav || isImage) {
          junk.remove();
        }
      });

      // After removing junk elements, get the text and normalize whitespace
      const text = clone.textContent?.replace(/\s+/g, ' ').trim();
      if (text && text.length > 20) { 
        remarks.push(text);
      }
    });

    const tags: string[] = [];
    doc.querySelectorAll("#tags a").forEach(el => {
      const tag = el.textContent?.trim();
      if (tag) tags.push(tag);
    });

    // ── Forum Comments ─────────────────────────────────────────────
    // If there are forum comments, fetch them from /forum/discuss/[id]
    const commentCountLink = doc.querySelector(".comment-count a");
    if (commentCountLink) {
      const forumPath = commentCountLink.getAttribute("href");
      if (forumPath) {
        const forumUrl = forumPath.startsWith("http") ? forumPath : `${baseUrl}${forumPath}`;
        try {
          console.log(`💬 [ErdosProblems] Fetching forum comments from ${forumUrl}...`);
          const forumResponse = await fetch(forumUrl);
          if (forumResponse.ok) {
            const forumHtml = await forumResponse.text();
            const forumDom = new JSDOM(forumHtml);
            const forumDoc = forumDom.window.document;
            
            // Forum posts are typically in .post-content, .post-body, .comment-text, etc.
            const posts = forumDoc.querySelectorAll(".post-text, .post-content, .post-body, .comment-text");
            let commentCount = 0;
            posts.forEach(post => {
              // Extract text, but try to keep some structure (like newlines for paragraphs)
              const clone = post.cloneNode(true) as HTMLElement;
              // Remove meta info if it's inside post-body (sometimes user names or dates are nested)
              clone.querySelectorAll(".post-meta, .reaction-bar, script, style").forEach(el => el.remove());
              
              const postText = clone.textContent?.trim();
              if (postText && postText.length > 5) {
                remarks.push(`[Forum Comment] ${postText.replace(/\s+/g, ' ')}`);
                commentCount++;
              }
            });
            if (commentCount > 0) {
              console.log(`✅ [ErdosProblems] Extracted ${commentCount} forum comments.`);
            }
          }
        } catch (err) {
          console.warn(`[ErdosProblems] Failed to fetch forum comments:`, err);
        }
      }
    }

    return {
      id,
      title,
      content,
      remarks,
      tags,
      url,
    };
  } catch (error) {
    console.error(`[ErdosProblems] Error fetching problem ${id}:`, error);
    return null;
  }
}

export function isErdosProblemQuery(query: string): boolean {
  return /erdosproblems\.com\/\d+/.test(query) || /Erdos\s*(?:#)?\d+/i.test(query);
}

export function formatErdosProblemForPrompt(problem: ErdosProblem): string {
  let p = `## Erdős Problem #${problem.id}\n\n`;
  p += `**URL:** ${problem.url}\n\n`;
  p += `**Problem Statement:**\n${problem.content}\n\n`;
  if (problem.remarks.length > 0) {
    p += `**Remarks:**\n${problem.remarks.join("\n\n")}\n\n`;
  }
  if (problem.tags.length > 0) {
    p += `**Tags:** ${problem.tags.join(", ")}\n\n`;
  }
  return p;
}
