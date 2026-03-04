import { basename, extname } from "path";
import { stat } from "fs/promises";
import { createHash } from "crypto";

// --- File kind detection ---

export type FileKind = "text" | "markdown" | "code" | "unsupported";

const EXTENSION_MAP: Record<string, FileKind> = {
  // text
  ".txt": "text",
  ".rtf": "text",
  ".csv": "text",
  ".tsv": "text",
  ".log": "text",
  // markdown
  ".md": "markdown",
  ".mdx": "markdown",
  // code
  ".ts": "code",
  ".tsx": "code",
  ".js": "code",
  ".jsx": "code",
  ".mjs": "code",
  ".cjs": "code",
  ".py": "code",
  ".java": "code",
  ".go": "code",
  ".rs": "code",
  ".c": "code",
  ".cc": "code",
  ".cpp": "code",
  ".h": "code",
  ".hpp": "code",
  ".css": "code",
  ".scss": "code",
  ".html": "code",
  ".htm": "code",
  ".sql": "code",
  ".json": "code",
  ".xml": "code",
  ".yaml": "code",
  ".yml": "code",
  ".toml": "code",
  ".sh": "code",
  ".bash": "code",
  ".zsh": "code",
  ".php": "code",
  ".rb": "code",
  ".swift": "code",
  ".kt": "code",
};

export function detectFileKind(filePath: string): FileKind {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? "unsupported";
}

// --- File extraction ---

export interface ExtractedContent {
  text: string;
  title: string;
  contentHash: string;
  fileMtime: number;
}

export async function extractFile(filePath: string): Promise<ExtractedContent> {
  const kind = detectFileKind(filePath);

  if (kind === "unsupported") {
    throw new Error(
      `Unsupported file type: ${extname(filePath) || "(no extension)"}. ` +
        "Only text, markdown, and code files are supported."
    );
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  const text = await file.text();
  if (text.trim().length === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }

  const hash = createHash("sha256").update(text).digest("hex");
  const fileStat = await stat(filePath);

  return {
    text,
    title: basename(filePath),
    contentHash: hash,
    fileMtime: fileStat.mtimeMs,
  };
}
