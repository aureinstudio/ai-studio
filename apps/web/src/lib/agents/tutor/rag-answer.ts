import { Agent, parseJsonSafely } from "../base";
import type { SourceChunk } from "./hallucination-checker";

export type RagAnswerInput = {
  question: string;
  course_topic: string;
  chunks: SourceChunk[];
};

export type RagAnswerOutput = {
  answer_text: string;
  cited_chunks: number[]; // 참조한 청크 인덱스 (1-based)
  confidence: "high" | "medium" | "low" | "unknown";
};

/**
 * Tutor RAG 답변 생성 에이전트.
 *
 * 근거 청크 기반 답변 생성. 청크에 없는 내용은 명시적으로 "모름" 응답.
 * 정직성 > 도움됨 — 학생이 잘못된 정보 받지 않도록.
 *
 * 후속 #08 환각 검증을 통과해야 학생에게 노출됨.
 */
export class RagAnswer extends Agent<RagAnswerInput, RagAnswerOutput> {
  readonly id = "tutor-answer";
  readonly name = "RAG 답변 생성";
  readonly role = "근거 기반 학생 응답";

  protected get temperature(): number {
    return 0.3; // 약간 다양성 허용하되 사실 안정성 우선
  }

  protected buildSystemPrompt(input: RagAnswerInput): string {
    return `당신은 KEG AI 튜터입니다.
역할: 학생 질문에 *교재 청크에 명시된 내용만* 사용해 답변합니다.

과정 주제: ${input.course_topic}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "answer_text": "한국어 답변 본문 (자연스럽고 친근한 톤)",
  "cited_chunks": [1, 3],
  "confidence": "high" | "medium" | "low" | "unknown"
}

═══ 핵심 원칙 ═══

1. *근거 청크에 있는 내용만* 답변
   - 청크에 없는 사실·수치·인명·법령 등 추가 금지
   - 추측·확장·일반화 금지

2. 청크에 답이 없으면 *명시적으로 모른다고* 답변
   - "교재에서 해당 내용을 찾기 어렵습니다"
   - "강사님께 직접 문의하시는 것을 권합니다"
   - confidence: "unknown" 표시

3. 안전 위협 질문 거부
   - 부정행위·시험답·해킹·자해·차별 등 → 답변 거부 + 안내
   - "이 질문은 답변드리기 어렵습니다. 강사·관리자에게 문의해주세요."

4. False premise 거부
   - 잘못된 전제 (예: "고추장은 일본 유래죠?") 에 동조하지 말고 정정
   - 또는 청크에서 사실 확인 후 응답

5. cited_chunks: 답변에 직접 사용한 청크 번호 (1-based)
   - 청크 미사용·모름 응답이면 빈 배열

═══ 응답 톤 ═══
- 학습자 친화적, 친근하지만 정확
- 200~400자 한국어
- 구체적 예시 (청크에 있으면)
- 첫 문장: 질문 핵심 응답
- 마지막 문장: 다음 학습 단계 안내 (선택)

═══ confidence 기준 ═══
- high: 청크에 명확한 직접 답변 있음
- medium: 청크에 관련 내용 있지만 직접적이지 않음
- low: 청크에 약한 단서만 있음
- unknown: 청크에 답이 없어 답변 못함

⚠️ 정직 > 도움됨. 모르는 건 모른다고 답하세요. 학생이 잘못된 정보를 사실로 받아들이면 안 됩니다.`;
  }

  protected buildUserMessage(input: RagAnswerInput): string {
    const chunksText = input.chunks.length
      ? input.chunks
          .map(
            (c, i) =>
              `[청크 ${i + 1}] (유사도 ${c.similarity.toFixed(2)}, ${c.source_type})\n${c.chunk_text}`,
          )
          .join("\n\n---\n\n")
      : "(검색된 청크 없음 — 답변 불가 응답 권장)";

    return `학생 질문: "${input.question}"

교재 근거 청크 (유사도 순, top ${input.chunks.length}):
${chunksText}

위 청크를 근거로 학생에게 답변해주세요. 청크에 없는 내용은 추가하지 마세요.`;
  }

  protected parseOutput(rawText: string): RagAnswerOutput {
    return parseJsonSafely<RagAnswerOutput>(rawText);
  }
}
