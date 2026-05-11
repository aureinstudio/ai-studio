import { Agent, parseJsonSafely } from "../base";
import type { SlideAnalyzerOutput, SlideInputMeta } from "./slide-analyzer";

export type ScriptWriterInput = {
  topic: string;
  slides: SlideInputMeta[];
  analysis: SlideAnalyzerOutput;
  is_certification?: boolean;
};

export type ScriptEntry = {
  slide_number: number;
  script_text: string;
  language: "ko";
  tone: "professional" | "casual" | "enthusiastic";
  emphasis_markers: string[];
};

export type ScriptWriterOutput = {
  scripts: ScriptEntry[];
  total_word_count: number;
};

/**
 * Cast Agent #02 — 스크립트 생성 (TEAM 1).
 * 슬라이드 분석 + speaker_notes → TTS 친화 강의 스크립트.
 */
export class ScriptWriter extends Agent<ScriptWriterInput, ScriptWriterOutput> {
  readonly id = "cast-02";
  readonly name = "스크립트 생성";
  readonly role = "TTS 친화 강의 스크립트 작성";

  protected buildSystemPrompt(input: ScriptWriterInput): string {
    return `당신은 스크립트 생성 에이전트입니다.
역할: 슬라이드 메타데이터와 발표자 노트를 받아 TTS로 변환할 강의 스크립트를 작성합니다.

주제: ${input.topic}
${input.is_certification ? "✓ 자격증 과정 — 차분한 톤 권장" : ""}
권장 페이싱: ${input.analysis.recommended_pacing}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "scripts": [
    {
      "slide_number": 1,
      "script_text": "TTS로 변환될 실제 텍스트",
      "language": "ko",
      "tone": "professional|casual|enthusiastic",
      "emphasis_markers": ["강조 어구 1", "강조 어구 2"]
    }
  ],
  "total_word_count": 5000
}

제약:
- 한 슬라이드 스크립트(script_text)는 60~150 단어 (한국어 어절 기준)
- 자연스러운 한국어 — TTS가 어색하게 읽지 않도록 다음 규칙 준수:
  · 줄임말·외래어는 한국어 발음으로 풀어쓰기 (예: "AI" → "에이아이", "DB" → "데이터베이스")
  · 숫자는 한글로 (예: "1000" → "천", "2026년" → "이천이십육년")
  · 영문 약어는 한국어 음역 (예: "VLOOKUP" → "브이룩업")
  · 문장은 짧고 명확하게 (한 문장 50자 이내 권장)
- 학습자 친화적 톤 — 자격증 과정은 차분한 "professional" 톤
- emphasis_markers는 슬라이드당 1~3개, *반드시 script_text 안에 등장하는 어구*
- 모든 스크립트는 한국어`;
  }

  protected buildUserMessage(input: ScriptWriterInput): string {
    return `다음 슬라이드 분석 결과와 발표자 노트를 바탕으로 강의 스크립트를 작성해주세요.

=== 슬라이드 분석 (#01 결과) ===
${JSON.stringify(input.analysis, null, 2)}

=== 원본 슬라이드 (speaker_notes 포함) ===
${JSON.stringify(input.slides, null, 2)}`;
  }

  protected parseOutput(rawText: string): ScriptWriterOutput {
    return parseJsonSafely<ScriptWriterOutput>(rawText);
  }
}
