import { Agent, parseJsonSafely } from "../base";

export type SupportedLanguage = "ko" | "en" | "zh" | "vi" | "id";

export type LanguageHandlerInput = {
  question: string;
  declared_language?: SupportedLanguage;
};

export type LanguageHandlerOutput = {
  detected_language: SupportedLanguage;
  confidence: number;
  translated_to_korean: string;
  response_language: SupportedLanguage;
  cultural_notes: string;
};

/**
 * Tutor Agent #03 — 언어 감지 + 한국어 번역.
 *
 * 학습 자료는 한국어 → RAG 검색은 한국어로 수행 (translated_to_korean 사용).
 * 응답은 학생 질문 언어로 (response_language).
 *
 * 지원 언어: 한국어·영어·중국어·베트남어·인도네시아어 (KEG 주요 학생 분포).
 * Haiku 4.5 사용 (~$0.001, 1~2초).
 */
export class LanguageHandler extends Agent<LanguageHandlerInput, LanguageHandlerOutput> {
  readonly id = "tutor-03";
  readonly name = "언어 감지·번역";
  readonly role = "다국어 처리·한국어 번역";

  protected get temperature(): number {
    return 0.1;
  }

  protected buildSystemPrompt(input: LanguageHandlerInput): string {
    return `당신은 다국어 처리 에이전트입니다.
역할: 학생 질문의 언어를 감지하고, RAG 검색용 한국어 번역을 제공합니다.

지원 언어: ko (한국어), en (영어), zh (중국어), vi (베트남어), id (인도네시아어)
${input.declared_language ? `학생이 선언한 언어: ${input.declared_language}` : ""}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "detected_language": "ko | en | zh | vi | id",
  "confidence": 0~100,
  "translated_to_korean": "한국어 번역 (RAG 검색용, 자연스러운 한국어)",
  "response_language": "ko | en | zh | vi | id",
  "cultural_notes": "응답 시 고려할 문화적 맥락 1~2문장 (없으면 빈 문자열)"
}

처리 원칙:
1. detected_language: 질문 문장 기준 감지. 코드 스위칭이면 우세한 언어.
2. translated_to_korean:
   - 한국어이면 그대로 복사
   - 다른 언어이면 자연스러운 한국어로 번역 (RAG 검색 정확도가 핵심)
   - 학습 용어는 한국어 학습 자료에서 사용할 법한 표현으로
3. response_language: 기본 detected_language. declared_language가 명시되면 그것 우선.
4. cultural_notes: 학생 문화권에서 주의할 점 (예: 베트남어 → 호칭·존댓말 차이, 영어 → 직설적 표현 선호)

예시:
- 입력: "What are the types of Korean seasonings?" (en)
- 출력:
  · detected_language: "en"
  · translated_to_korean: "한식 양념의 종류는 무엇인가요?"
  · response_language: "en"
  · cultural_notes: "영어권 학생 — 직접적이고 명료한 설명 선호, 전문 용어는 영어 병기"`;
  }

  protected buildUserMessage(input: LanguageHandlerInput): string {
    return `학생 질문: "${input.question}"

위 질문의 언어를 감지하고 한국어로 번역해주세요.`;
  }

  protected parseOutput(rawText: string): LanguageHandlerOutput {
    return parseJsonSafely<LanguageHandlerOutput>(rawText);
  }
}
