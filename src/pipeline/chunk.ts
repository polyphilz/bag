import { basename } from "path";

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Source URI for contextual header (e.g., "/path/to/file.md") */
  sourceUri?: string;
  /** Content type to select separator hierarchy */
  contentType?: "markdown" | "code" | "text";
  /** Max characters per chunk content (~4 chars/token, default 2048 = ~512 tokens) */
  maxChars?: number;
}

const TEXT_SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", " "];

/**
 * Split text into chunks using recursive character splitting with
 * content-type-aware separators and contextual chunk headers.
 */
export function chunkText(text: string, opts?: ChunkOptions): TextChunk[] {
  const maxChars = opts?.maxChars ?? 2048;
  const contentType = opts?.contentType ?? "text";
  const sourceLabel = opts?.sourceUri ? basename(opts.sourceUri) : undefined;

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  if (contentType === "markdown") {
    return chunkMarkdown(trimmed, maxChars, sourceLabel);
  }

  // Generic text/code path
  const pieces = recursiveSplit(trimmed, TEXT_SEPARATORS, maxChars);
  return pieces.map((piece, i) => {
    const content = prependHeader(piece, sourceLabel);
    return {
      content,
      chunkIndex: i,
      tokenCount: estimateTokens(content),
    };
  });
}

// --- Markdown chunking ---

interface MarkdownSection {
  breadcrumb: string[];
  content: string;
}

function chunkMarkdown(
  text: string,
  maxChars: number,
  sourceLabel?: string
): TextChunk[] {
  const sections = parseMarkdownSections(text);

  // Markdown with no headings — fall back to generic splitting
  if (sections.length === 0) {
    const pieces = recursiveSplit(text, TEXT_SEPARATORS, maxChars);
    return pieces.map((piece, i) => ({
      content: prependHeader(piece, sourceLabel),
      chunkIndex: i,
      tokenCount: estimateTokens(prependHeader(piece, sourceLabel)),
    }));
  }

  const chunks: TextChunk[] = [];
  let index = 0;

  for (const section of sections) {
    const pieces = recursiveSplit(section.content, TEXT_SEPARATORS, maxChars);
    for (const piece of pieces) {
      const breadcrumb =
        section.breadcrumb.length > 0
          ? section.breadcrumb.join(" > ")
          : undefined;
      const content = prependHeader(piece, sourceLabel, breadcrumb);
      chunks.push({
        content,
        chunkIndex: index,
        tokenCount: estimateTokens(content),
      });
      index++;
    }
  }

  return chunks;
}

/**
 * Parse markdown into sections keyed by heading hierarchy.
 * Tracks heading stack so each section gets a breadcrumb path
 * like ["Title", "Section A", "Subsection 1"].
 */
function parseMarkdownSections(text: string): MarkdownSection[] {
  const lines = text.split("\n");
  const sections: MarkdownSection[] = [];
  const headingStack: { level: number; text: string }[] = [];
  let contentLines: string[] = [];

  const flush = () => {
    const content = contentLines.join("\n").trim();
    if (content) {
      sections.push({
        breadcrumb: headingStack.map((h) => h.text),
        content,
      });
    }
    contentLines = [];
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      flush();
      const level = match[1].length;
      const heading = match[2].trim();
      // Pop headings at same or deeper level
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop();
      }
      headingStack.push({ level, text: heading });
    } else {
      contentLines.push(line);
    }
  }
  flush();

  return sections;
}

// --- Core recursive splitting ---

/**
 * Recursively split text using a hierarchy of separators.
 * Tries the first separator; if pieces are small enough, merges adjacent
 * ones up to maxChars. If a piece is still too large, recurses with the
 * remaining (finer-grained) separators.
 */
function recursiveSplit(
  text: string,
  separators: string[],
  maxChars: number
): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  if (separators.length === 0) {
    // Hard cut as last resort
    const pieces: string[] = [];
    for (let i = 0; i < trimmed.length; i += maxChars) {
      const piece = trimmed.slice(i, i + maxChars).trim();
      if (piece) pieces.push(piece);
    }
    return pieces;
  }

  const [sep, ...rest] = separators;
  const parts = trimmed.split(sep);

  // Separator didn't split anything — try the next one
  if (parts.length === 1) {
    return recursiveSplit(trimmed, rest, maxChars);
  }

  const result: string[] = [];
  let current = "";

  for (const part of parts) {
    const merged = current ? current + sep + part : part;

    if (merged.length <= maxChars) {
      current = merged;
    } else {
      if (current) {
        result.push(current.trim());
        current = "";
      }
      if (part.length > maxChars) {
        result.push(...recursiveSplit(part, rest, maxChars));
      } else {
        current = part;
      }
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

// --- Helpers ---

function prependHeader(
  content: string,
  sourceLabel?: string,
  breadcrumb?: string
): string {
  if (!sourceLabel && !breadcrumb) return content;

  let header = "[Source: " + (sourceLabel ?? "unknown");
  if (breadcrumb) {
    header += " | " + breadcrumb;
  }
  header += "]";

  return header + "\n\n" + content;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
