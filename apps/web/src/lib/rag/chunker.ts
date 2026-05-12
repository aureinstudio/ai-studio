/**
 * Studio 출력 → RAG 인덱싱용 청크.
 *
 * 청크 크기: ~1500자 (한국어 ~750 토큰)
 * 오버랩: ~200자 (문맥 연속성)
 * 경계: 문단 우선 (의미 보존)
 */

export type Chunk = {
  text: string;
  source_type: "curator" | "planner" | "planning" | "example";
  chunk_index: number;
  metadata: Record<string, unknown>;
};

const MAX_CHARS = 1500;
const OVERLAP = 200;

/**
 * Studio 작업의 content → 청크 배열.
 *
 * 인덱싱 대상:
 *   - curator.main_content: 섹션별 본문 (긴 섹션은 분할)
 *   - curator.examples: 예제별 1청크
 *   - planner.slides: 슬라이드별 1청크 (제목 + content + speaker_notes)
 *   - planning.outline.chapter_outline: 챕터 구조 (요약 1청크, 선택)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chunkStudioContent(content: any): Chunk[] {
  const chunks: Chunk[] = [];
  let idx = 0;

  // ─── curator 본문 ────────────────────────────────
  const curator = content?.curator ?? content?.team2?.curator;
  if (curator) {
    // 학습 목표 — 1청크 (검색에서 자주 참조됨)
    if (Array.isArray(curator.learning_objectives) && curator.learning_objectives.length) {
      chunks.push({
        text: `[학습 목표]\n${(curator.learning_objectives as string[]).map((o, i) => `${i + 1}. ${o}`).join("\n")}`,
        source_type: "curator",
        chunk_index: idx++,
        metadata: { kind: "learning_objectives", chapter_title: curator.chapter_title },
      });
    }

    // 각 섹션
    for (const section of curator.main_content ?? []) {
      const paragraphs: string[] = section.paragraphs ?? [];
      const sectionHeader = `[${section.section}]`;
      const fullText = `${sectionHeader}\n\n${paragraphs.join("\n\n")}`;
      const parts = splitLong(fullText, MAX_CHARS, OVERLAP);
      for (const part of parts) {
        chunks.push({
          text: part,
          source_type: "curator",
          chunk_index: idx++,
          metadata: { kind: "section", section_title: section.section },
        });
      }
    }

    // 예제
    for (const ex of curator.examples ?? []) {
      chunks.push({
        text: `[예제: ${ex.title}] (type=${ex.type})\n${ex.body}`,
        source_type: "example",
        chunk_index: idx++,
        metadata: { kind: "example", title: ex.title, type: ex.type },
      });
    }
  }

  // ─── planner 슬라이드 ────────────────────────────
  const planner = content?.planner ?? content?.team2?.planner;
  if (planner?.slides) {
    for (const slide of planner.slides) {
      const text = [
        `[슬라이드 ${slide.slide_number}] ${slide.title}`,
        Array.isArray(slide.content_blocks) ? slide.content_blocks.join("\n") : "",
        slide.speaker_notes ? `\n발표자 노트: ${slide.speaker_notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      chunks.push({
        text,
        source_type: "planner",
        chunk_index: idx++,
        metadata: {
          kind: "slide",
          slide_number: slide.slide_number,
          slide_title: slide.title,
        },
      });
    }
  }

  // ─── planning (chapter outline) — 요약 1청크 ──────
  const planning = content?.planning;
  if (planning?.outline?.chapter_outline?.length) {
    const summary = planning.outline.chapter_outline
      .map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ch: any) =>
          `[챕터 ${ch.chapter_number}] ${ch.title} (${ch.duration_minutes}분, ${ch.sections?.length ?? 0}섹션)`,
      )
      .join("\n");
    chunks.push({
      text: `[강의 개요]\n${summary}\n\n총 ${planning.outline.total_duration_minutes}분`,
      source_type: "planning",
      chunk_index: idx++,
      metadata: { kind: "outline_summary" },
    });
  }

  return chunks;
}

/**
 * 긴 텍스트를 maxChars 단위로 분할. 가능하면 문단 경계 보존.
 */
function splitLong(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + maxChars);

    // 끝이 문단 경계 (\n\n) 가까이 있으면 거기서 자르기
    if (end < text.length) {
      const lookback = text.lastIndexOf("\n\n", end);
      if (lookback > pos + maxChars * 0.6) {
        end = lookback;
      }
    }

    chunks.push(text.slice(pos, end).trim());
    if (end >= text.length) break;
    pos = Math.max(end - overlap, pos + 1);
  }
  return chunks;
}
