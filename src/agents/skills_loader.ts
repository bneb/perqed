import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Parses the .agents/skills/ directory and statically builds a Markdown index 
 * of available capabilities to inject into the ExplorerAgent prompt.
 */
export function loadSkillsIndex(
  skillsRoot: string = ".agents/skills", 
  onlyNames?: string[]
): string {
  if (!existsSync(skillsRoot)) {
    return "";
  }

  const entries = readdirSync(skillsRoot, { withFileTypes: true });
  const indexLines: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillName = entry.name;
    
    // Only include requested skills if a filter is provided
    if (onlyNames && !onlyNames.includes(skillName)) {
      continue;
    }

    const skillMdPath = join(skillsRoot, skillName, "SKILL.md");

    if (!existsSync(skillMdPath)) continue;

    const content = readFileSync(skillMdPath, "utf-8");
    const description = extractDescription(content);

    indexLines.push(`- **${skillName}**: ${description}`);
  }

  return indexLines.join("\n");
}

function extractDescription(content: string): string {
  // Extract strictly from the YAML frontmatter
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "(No description provided)";
  }

  const fm = frontmatterMatch[1]!;
  // Look for `description: <value>` or `description: "<value>"`
  const descMatch = fm.match(/^description\s*:\s*(.*)/m);
  
  if (!descMatch || !descMatch[1]) {
    // If it's missing entirely but we want a fallback
    return "(No description provided)";
  }

  // Strip possible quotes
  let parsedDesc = descMatch[1].trim();
  if (parsedDesc.startsWith('"') && parsedDesc.endsWith('"')) {
    parsedDesc = parsedDesc.slice(1, -1);
  } else if (parsedDesc.startsWith("'") && parsedDesc.endsWith("'")) {
    parsedDesc = parsedDesc.slice(1, -1);
  }

  return parsedDesc || "(No description provided)";
}
