import { Agent, parseJsonSafely } from "../base";
import type { LearningProcessOutput } from "../team2-production/learning-process-curator";
import type { CuratorOutput } from "../team2/content-curator";
import type { PlannerOutput } from "../team2/visual-planner";
import type { InfographicOutput } from "../team2-production/infographic-designer";

export type PolisherInput = {
  learning_sequence: LearningProcessOutput;
  curator: CuratorOutput;
  planner: PlannerOutput;
  infographics: InfographicOutput;
  topic: string;
};

export type PolishedOutput = {
  learning_sequence: LearningProcessOutput;
  curator: CuratorOutput;
  planner: PlannerOutput;
  infographics: InfographicOutput;
};

/**
 * Studio Agent #13 — 최종 품질 최적화 에이전트 (TEAM 4-Quality).
 * 검증 통과 산출물 → 가독성·표현·완성도 마감.
 * 구조는 동일, 텍스트만 다듬음.
 */
export class FinalPolisher extends Agent<PolisherInput, PolishedOutput> {
  readonly id = "studio-13";
  readonly name = "최종 품질 최적화";
  readonly role = "가독성·완성도 마감";

  protected buildSystemPrompt(_input: PolisherInput): string {
    return `당신은 최종 품질 최적화 에이전트입니다.
역할: 모든 검증을 통과한 콘텐츠를 받아 가독성·표현·완성도를 최종 마감합니다.

입력과 동일한 JSON 구조를 반환하되 텍스트만 다듬습니다:
{
  "learning_sequence": { ... },
  "curator": { ... },
  "planner": { ... },
  "infographics": { ... }
}

마크다운 fence 금지. 추가 키 생성 금지.

마감 작업:
- 어색한 표현 자연스럽게 수정
- 반복 표현 제거
- 한국어 어법 점검 (조사·어미 통일)
- 전문 용어 일관성 확인
- 학습자 친화적 톤 유지 (딱딱하지 않게)

주의:
- JSON 구조는 절대 변경 금지 — 필드명·배열 순서 동일 유지
- 숫자 값(score, duration_minutes 등)은 변경 금지
- 의미 변경 금지 — 표현만 다듬음
- 한국어`;
  }

  protected buildUserMessage(input: PolisherInput): string {
    return `주제: "${input.topic}"

다음 콘텐츠의 텍스트를 최종 마감해주세요. 구조는 그대로, 텍스트만 자연스럽게 다듬으세요.

=== 학습 시퀀스 (#05) ===
${JSON.stringify(input.learning_sequence, null, 2)}

=== 본문 (#06) ===
${JSON.stringify(input.curator, null, 2)}

=== 슬라이드 (#07) ===
${JSON.stringify(input.planner, null, 2)}

=== 인포그래픽 (#08) ===
${JSON.stringify(input.infographics, null, 2)}`;
  }

  protected parseOutput(rawText: string): PolishedOutput {
    return parseJsonSafely<PolishedOutput>(rawText);
  }
}
