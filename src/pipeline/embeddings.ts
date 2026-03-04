import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { getLlama, createModelDownloader } from "node-llama-cpp";
import type { Llama, LlamaModel, LlamaEmbeddingContext } from "node-llama-cpp";

const QUERY_PREFIX =
  "Instruct: Given a query, retrieve documents that answer the query \nQuery: ";

export class EmbeddingProvider {
  private llama!: Llama;
  private model!: LlamaModel;
  private context!: LlamaEmbeddingContext;
  private dimension!: number;

  async init(modelPath: string, dimension: number = 512): Promise<void> {
    this.dimension = dimension;
    this.llama = await getLlama();
    this.model = await this.llama.loadModel({ modelPath });
    this.context = await this.model.createEmbeddingContext();
  }

  async embed(
    texts: string[],
    inputType: "document" | "query"
  ): Promise<Float32Array[]> {
    const prefix = inputType === "query" ? QUERY_PREFIX : "";
    const results = await Promise.all(
      texts.map((text) => this.context.getEmbeddingFor(prefix + text))
    );
    return results.map((r) => this.truncateAndNormalize(r.vector));
  }

  private truncateAndNormalize(vector: readonly number[]): Float32Array {
    const truncated = vector.slice(0, this.dimension);
    let norm = 0;
    for (let i = 0; i < truncated.length; i++) {
      norm += truncated[i] * truncated[i];
    }
    norm = Math.sqrt(norm);
    const result = new Float32Array(truncated.length);
    if (norm > 0) {
      for (let i = 0; i < truncated.length; i++) {
        result[i] = truncated[i] / norm;
      }
    }
    return result;
  }

  async dispose(): Promise<void> {
    await this.context?.dispose();
    await this.model?.dispose();
  }
}

export async function ensureModel(
  home: string,
  modelUrl: string
): Promise<string> {
  const modelsDir = join(home, "models");
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }

  // Derive filename from URL
  const urlParts = modelUrl.split("/");
  const fileName = urlParts[urlParts.length - 1];
  const modelPath = join(modelsDir, fileName);

  if (existsSync(modelPath)) {
    return modelPath;
  }

  console.log(`Downloading embedding model to ${modelsDir}...`);
  console.log(`This is a one-time download (~12.6 GB).`);

  const downloader = await createModelDownloader({
    modelUri: modelUrl,
    dirPath: modelsDir,
    fileName,
    showCliProgress: true,
  });

  await downloader.download();
  return modelPath;
}
