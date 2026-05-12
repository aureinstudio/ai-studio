import { Agent, parseJsonSafely } from "../base";
import type { ScriptEntry } from "./script-writer";

export type QualityCheckerInput = {
  topic: string;
  scripts: ScriptEntry[];
  expected_duration_seconds: number;
};

export type QualityScoreDetail = {
  score: number;
  notes: string;
};

export type QualityCheckerOutput = {
  naturalness_score: number;
  pacing_score: number;
  clarity_score: number;
  issues: string[];
  regenerate_recommended: boolean;
  overall_pass: boolean;
  per_slide_assessments?: {
    slide_number: number;
    score: number;
    note?: string;
  }[];
};

/**
 * Cast Agent #07 — 영상 품질 검증 (스크립트 사전 검증).
 *
 * HeyGen에 영상 제출하기 *전* 스크립트가 TTS·영상으로 만들었을 때 자연스러운지 평가.
 * HeyGen 비용 발생 전에 품질 문제 차단 → 비용·시간 절감.
 *
 * 평가 차원:
 *   - naturalness: 한국어 자연스러움 (TTS 친화)
 *   - pacing: 영상 길이·발화 속도 적절성
 *   - clarity: 메시지 명료성·교육적 가치
 *
 * 기각 (overall_pass=false) 시: 자동 1회 재생성 (ScriptWriter / CastOrchestrator)
 */
export class QualityChecker extends Agent<QualityCheckerInput, QualityCheckerOutput> {
  readonly id = "cast-07";
  readonly name = "영상 품질 검증";
  readonly role = "스크립트 자연성·페이싱·명료성 평가";

  protected buildSystemPrompt(input: QualityCheckerInput): string {
    return `당신은 영상 품질 검증 에이전트입니다.
역할: TTS 스크립트가 영상으로 만들었을 때 자연스러운지 평가합니다.

주제: ${input.topic}
스크립트 슬라이드 수: ${input.scripts.length}
예상 영상 길이: ${input.expected_duration_seconds}초

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "naturalness_score": 0~100,
  "pacing_score": 0~100,
  "clarity_score": 0~100,
  "issues": ["구체적 문제 1", "문제 2"],
  "regenerate_recommended": true | false,
  "overall_pass": true | false,
  "per_slide_assessments": [
    { "slide_number": 1, "score": 85, "note": "선택, 슬라이드별 메모" }
  ]
}

평가 기준:
- naturalness (한국어 자연스러움):
  · TTS가 읽었을 때 어색하지 않은가?
  · 줄임말·영문 약어가 한글로 풀어졌는가? (예: "AI" → "에이아이")
  · 숫자가 한글로 표기됐는가? ("3" → "세 가지")
  · 한국어 어법 (조사·어미) 올바른가?
- pacing (발화 속도·길이):
  · 슬라이드별 60~150자 한국어 어절 범위인가?
  · 너무 짧거나 (학습 부족) 길지 (지루) 않은가?
  · 전체 영상이 예상 길이와 ±20% 범위인가?
- clarity (명료성·교육적 가치):
  · 핵심 메시지가 명확한가?
  · 학습자가 이해할 수 있는 수준인가?
  · 첫·마지막 문장이 도입·정리 역할 하는가?

판정:
- 세 점수 모두 70 이상 + critical issue 없음 → overall_pass: true
- 한 점수라도 50 미만 → overall_pass: false, regenerate_recommended: true
- naturalness가 60 미만 → 반드시 false (TTS가 어색하면 사용자 경험 망침)

issues는 각 영역에서 가장 중요한 1~3개. 구체적으로 작성 (예: "슬라이드 3: '20kg'를 한글로 풀어쓰지 않음 — TTS가 어색하게 읽음").

한국어`;
  }

  protected buildUserMessage(input: QualityCheckerInput): string {
    return `다음 스크립트의 품질을 검증해주세요. 각 슬라이드별로 평가하고 종합 점수를 산출하세요.

=== 스크립트 ===
${input.scripts
  .map((s) => `[Slide ${s.slide_number}] tone=${s.tone}\n${s.script_text}`)
  .join("\n\n")}`;
  }

  protected parseOutput(rawText: string): QualityCheckerOutput {
    return parseJsonSafely<QualityCheckerOutput>(rawText);
  }
}
