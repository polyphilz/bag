import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parse } from "smol-toml";

export interface BagConfig {
  embeddings: {
    model_path: string;
    model_url: string;
    embedding_dimension: number;
  };
  extraction: {
    twitter_bearer_token: string;
    github_token: string;
  };
  directories: {
    paths: string[];
  };
  processing: {
    concurrency: number;
  };
}

const DEFAULT_CONFIG = `# bag configuration

[embeddings]
# KaLM-Embedding-Gemma3-12B-2511 (MTEB #1)
model_path = ""                  # Auto-downloaded GGUF model path (~/.bag/models/)
model_url = "https://huggingface.co/mradermacher/KaLM-Embedding-Gemma3-12B-2511-GGUF/resolve/main/KaLM-Embedding-Gemma3-12B-2511.Q8_0.gguf"
embedding_dimension = 1024       # MRL dimension (full=3840, options: 3840/2048/1024/512/256/128/64)

[extraction]
twitter_bearer_token = ""        # Optional: for Twitter/X extraction
github_token = ""                # Optional: for higher GitHub API rate limits

[directories]
# Indexed directories — checked for changes on startup
# paths = ["~/Documents", "~/projects"]

[processing]
concurrency = 8                  # Max parallel extraction jobs
`;

function getHome(): string {
  return process.env.BAG_HOME || join(homedir(), ".bag");
}

export function ensureHome(): string {
  const home = getHome();
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true });
  }
  const configPath = join(home, "config.toml");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG);
  }
  return home;
}

export function loadConfig(): { home: string; config: BagConfig } {
  const home = ensureHome();
  const configPath = join(home, "config.toml");
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw) as unknown as BagConfig;
  return { home, config: parsed };
}

export function getDbPath(): string {
  const { home } = loadConfig();
  return join(home, "bag.db");
}
