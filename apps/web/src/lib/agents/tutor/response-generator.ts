import { Agent, parseJsonSafely } from "../base";
import type { IntentClassifierOutput } from "./intent-classifier";
import type { LanguageHandlerOutput } from "./language-handler";
import type { SourceChunk } from "./hallucination-checker";

export type ResponseGeneratorInput = {
  question: string;
  question_translated_korean: string;
  course_topic: string;
  intent: IntentClassifierOutput;
  language: LanguageHandlerOutput;
  rag_chunks: SourceChunk[];
  conversation_summary?: string;
};

export type ResponseGeneratorOutput = {
  answer_text: string;
  cited_chunks: number[];
  suggested_next_step: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
};

const INTENT_TONE_GUIDE: Record<string, string> = {
  concept_question: "차분하고 명확하게, 단계별 설명. 핵심 → 부연 → 예시 순.",
  example_request: "구체적 예시 1~2개. 청크에서 발췌하거나 참고해 변형.",
  exam_prep: "격려 + 실용 팁. '~할 가능성이 높다' 같은 과도한 단정 금지.",
  feedback_request: "잘한 점 먼저, 개선점은 구체적으로 1~2개.",
  personal_emotion: "공감 1문장 → 강사·관리자 연락 안내. 답변 시도하지 말 것.",
  off_topic: "친절히 거절 + 교재 범위 안내. RAG 사용 안 함.",
};

const LANG_LABEL: Record<string, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
};

/**
 * Tutor Agent #04 — 응답 생성 (Sonnet, 품질 우선).
 *
 * 입력: intent + language + RAG + 대화 맥락 → 학생 응답
 *
 * 원칙:
 *   - RAG 청크에 근거 (출처 명시)
 *   - 학생 언어로 응답 (response_language)
 *   - intent별 톤 차등
 *   - 소크라테스식 질문 활용 (정답 직접 X)
 *   - 모르는 건 모른다고 (환각 방지)
 *   - 200~500자 (학습자 이탈 방지)
 *
 * 후속 #08이 검증. rejected 시 학생에게 노출 안 됨.
 */
export class ResponseGenerator extends Agent<ResponseGeneratorInput, ResponseGeneratorOutput> {
  readonly id = "tutor-04";
  readonly name = "응답 생성";
  readonly role = "RAG 근거 다국어 학생 응답";

  protected get temperature(): number {
    return 0.4;
  }

  protected buildSystemPrompt(input: ResponseGeneratorInput): string {
    const responseLangLabel = LANG_LABEL[input.language.response_language] ?? input.language.response_language;
    const toneGuide = INTENT_TONE_GUIDE[input.intent.intent] ?? "차분하고 명확하게.";

    return `당신은 KEG 1:1 AI 튜터입니다.
역할: 학생 질문에 *교재 청크 근거*로 답변합니다.

과정 주제: ${input.course_topic}
응답 언어: ${responseLangLabel}
학생 의도: ${input.intent.intent} (${input.intent.complexity})
${input.language.cultural_notes ? `문화적 맥락: ${input.language.cultural_notes}` : ""}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "answer_text": "학생에게 노출될 ${responseLangLabel} 답변 본문 (200~500자)",
  "cited_chunks": [1, 3],
  "suggested_next_step": "다음 학습 권장 (1문장, 학생 언어로) 또는 null",
  "confidence": "high | medium | low | unknown"
}

═══ 톤 가이드 (intent별) ═══
${toneGuide}

═══ 핵심 원칙 ═══

1. *RAG 청크에 있는 내용만* 답변
   - 청크에 없는 사실·수치·인명 추가 금지
   - 추측·확장·일반화 금지

2. 청크에 답이 없으면 *명시적으로 모른다고* 답변
   - 응답 언어로 "교재에서 해당 내용을 찾기 어렵습니다 (또는 동등 표현)"
   - "강사님께 문의 권장"
   - confidence: "unknown"

3. 안전 위협 거부
   - 부정행위·시험답·자해·차별·범죄 유도 → 답변 거부
   - "이 질문은 답변드리기 어렵습니다. 강사·관리자에게 문의해주세요."

4. False premise 거부
   - 잘못된 전제 (예: "고추장은 일본 유래죠?")에 동조 X
   - 청크에서 사실 확인 후 정중히 정정

5. 다국어 응답 — *학생 질문 언어로*
   - 전문 용어는 한국어 병기 가능 (예: "장(jang, 醤)")
   - 자연스러운 해당 언어 (번역체 X)

6. 출처 (cited_chunks)
   - 답변에 직접 활용한 청크 번호 1-based 배열
   - 모름·거부 응답이면 빈 배열

7. suggested_next_step:
   - 자연스러운 후속 학습 제안 (1문장)
   - off_topic·거부·모름 응답이면 null

═══ 길이·구조 ═══
- 200~500자 (응답 언어 기준 어절·단어)
- 첫 문장: 질문 핵심 응답
- 중간: 청크 근거로 부연
- 마지막: 정리 또는 다음 단계

⚠️ 정직 > 도움됨. 모르면 모른다고 답하세요.`;
  }

  protected buildUserMessage(input: ResponseGeneratorInput): string {
    const chunksText = input.rag_chunks.length
      ? input.rag_chunks
          .map(
            (c, i) =>
              `[청크 ${i + 1}] (유사도 ${c.similarity.toFixed(2)}, ${c.source_type})\n${c.chunk_text}`,
          )
          .join("\n\n---\n\n")
      : "(검색된 청크 없음 — \"모름\" 응답 권장)";

    const lines = [
      `학생 원문 질문: "${input.question}"`,
      `한국어 번역 (RAG용): "${input.question_translated_korean}"`,
      "",
      "교재 근거 청크 (유사도 순):",
      chunksText,
    ];
    if (input.conversation_summary) {
      lines.push("", `이전 대화 요약: ${input.conversation_summary}`);
    }
    lines.push(
      "",
      `위 청크를 근거로 학생에게 ${LANG_LABEL[input.language.response_language] ?? "한국어"}로 답변해주세요.`,
    );

    return lines.join("\n");
  }

  protected parseOutput(rawText: string): ResponseGeneratorOutput {
    return parseJsonSafely<ResponseGeneratorOutput>(rawText);
  }
}
