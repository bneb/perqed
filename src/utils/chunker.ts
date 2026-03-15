/**
 * TextChunker — Semantic Text Splitting for arXiv Abstracts
 *
 * Splits large text blocks into smaller, context-dense chunks
 * (~500 chars by default) at sentence boundaries so that
 * nomic-embed-text generates high-quality vectors.
 */

export class TextChunker {
  /**
   * Splits text into chunks based on sentence boundaries.
   *
   * @param text - The input text (arXiv abstract, etc.)
   * @param maxChars - Target maximum characters per chunk (default: 500)
   * @returns Array of text chunks
   */
  public static chunkAbstract(text: string, maxChars: number = 500): string[] {
    if (!text || text.trim().length === 0) return [];

    // Normalize newlines to spaces, then split on sentence boundaries
    const normalized = text.replace(/\n/g, " ").trim();
    const sentences = normalized.split(/(?<=\.)\s+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > maxChars &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk += sentence + " ";
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
