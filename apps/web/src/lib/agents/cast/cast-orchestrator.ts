import { Agent, parseJsonSafely } from "../base";

export type CastOrchestratorInput = {
  mode: "mode-b";
  question: string;
  course_context?: string;
  max_duration_seconds?: number;
};

export type CastOrchestratorOutput = {
  is_appropriate: boolean;
  reason: string;
  answer_text: string;
  estimated_duration_seconds: number;
  estimated_cost_usd: number;
  optimization_notes: string[];
};

/**
 * Cast Agent #06 — 오케스트레이터 + ResponseGenerator (Mode B 통합).
 *
 * Mode B (실시간 학생 질문 → 영상 응답) 진입점.
 * 단일 LLM 호출로:
 *   1. 질문 적절성 판정 (욕설·관련 없는 질문 차단)
 *   2. 200~500자 한국어 답변 생성 (TTS 친화)
 *   3. 예상 영상 길이·비용 추정
 *
 * 출력 answer_text는 단일 슬라이드 영상에 사용됨.
 */
export class CastOrchestrator extends Agent<CastOrchestratorInput, CastOrchestratorOutput> {
  readonly id = "cast-06";
  readonly name = "Cast 오케스트레이터";
  readonly role = "Mode B 질문 검증·답변·비용 추정";

  protected buildSystemPrompt(input: CastOrchestratorInput): string {
    const maxSec = input.max_duration_seconds ?? 180;

    return `당신은 Cast 오케스트레이터입니다.
역할: KEG 학생 질문에 대한 짧은 영상 응답을 기획합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "is_appropriate": true | false,
  "reason": "판정 사유 (1문장)",
  "answer_text": "TTS로 변환될 한국어 답변 (200~500자, 자연스러운 한국어)",
  "estimated_duration_seconds": 90,
  "estimated_cost_usd": 0.80,
  "optimization_notes": ["최적화 노트 1", "노트 2"]
}

is_appropriate 판정:
- false: 욕설·차별·과제 대신 답·관련 없는 질문 (코딩 과정에 요리 질문 등)
- false: 답변이 ${maxSec}초로는 충분히 설명 불가한 광범위한 질문 ("전체 강의 요약해줘" 등)
- true: 위 조건에 해당하지 않는 일반 학습 질문

answer_text 작성 규칙 (is_appropriate=true 일 때만):
- 200~500자 한국어 (영상 60~150초 분량)
- 자연스러운 강사 톤 — 친근하고 명료
- TTS 친화: 줄임말·외래어는 한글 발음, 숫자도 한글 ("3" → "세 가지")
- 첫 문장은 인사·맥락 ("좋은 질문이에요. 한식 양념은...")
- 마지막 문장은 정리·다음 행동 유도

비용 추정:
- HeyGen 영상: 1초 = ~$0.0083 (분당 $0.50)
- estimated_cost_usd = estimated_duration_seconds × 0.0083

optimization_notes:
- 1~3개. 예: "기초 학습자에게 친근한 톤 적용", "예시 1개로 압축"`;
  }

  protected buildUserMessage(input: CastOrchestratorInput): string {
    return `학생 질문: "${input.question}"
${input.course_context ? `\n과정 컨텍스트: ${input.course_context}` : ""}

위 질문에 대한 ${input.max_duration_seconds ?? 180}초 이내 영상 응답을 기획해주세요.`;
  }

  protected parseOutput(rawText: string): CastOrchestratorOutput {
    return parseJsonSafely<CastOrchestratorOutput>(rawText);
  }
}
