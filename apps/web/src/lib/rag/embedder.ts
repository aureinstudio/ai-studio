/**
 * Gemini text embeddings — gemini-embedding-001 (1536 dim).
 *
 * 한국어 우수 + 기존 GEMINI_API_KEY 재사용 (별도 OpenAI/Voyage 키 불필요).
 * 가격: ~$0.000025 / 1K 글자 (매우 저렴).
 *
 * taskType:
 *   - RETRIEVAL_DOCUMENT: 인덱싱할 청크 (rag_embeddings.embedding)
 *   - RETRIEVAL_QUERY: 검색 쿼리 (학생 질문)
 *   - SEMANTIC_SIMILARITY: FAQ 캐싱·유사도 비교
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-embedding-001";

export type EmbeddingTaskType =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION";

export type EmbeddingResult = {
  vector: number[];
  cost_usd: number;
  model: string;
};

export async function createEmbedding(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<EmbeddingResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const url = `${API_BASE}/models/${MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: 1536,
      taskType,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini embedding ${res.status}: ${txt.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const vector = json.embedding?.values;
  if (!vector || vector.length === 0) {
    throw new Error("Gemini embedding response missing values");
  }

  // 비용: $0.000025 / 1K chars (대략, 한국어 평균)
  const cost = Math.max(0.00001, (text.length / 1000) * 0.000025);

  return { vector, cost_usd: cost, model: MODEL };
}

/**
 * 배치 임베딩 (인덱싱 가속). Gemini API는 batchEmbedContents 지원.
 * 실패 시 sequential fallback.
 */
export async function createEmbeddingsBatch(
  texts: string[],
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<EmbeddingResult[]> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  if (texts.length === 0) return [];

  const url = `${API_BASE}/models/${MODEL}:batchEmbedContents?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: 1536,
        taskType,
      })),
    }),
  });

  if (!res.ok) {
    // Batch 실패 시 sequential fallback
    console.warn(`[embedder] batch ${res.status}, falling back to sequential`);
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      results.push(await createEmbedding(text, taskType));
    }
    return results;
  }

  const json = (await res.json()) as {
    embeddings?: { values?: number[] }[];
  };
  const embeddings = json.embeddings ?? [];

  return texts.map((text, i) => {
    const vector = embeddings[i]?.values ?? [];
    if (vector.length === 0) throw new Error(`Embedding ${i} missing values`);
    const cost = Math.max(0.00001, (text.length / 1000) * 0.000025);
    return { vector, cost_usd: cost, model: MODEL };
  });
}
