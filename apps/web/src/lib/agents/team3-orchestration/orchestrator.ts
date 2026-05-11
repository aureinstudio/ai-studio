import { Agent, parseJsonSafely } from "../base";

export type OrchestratorInput = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: "short" | "medium" | "long";
  constraints?: string[];
};

export type OrchestratorPlan = {
  skipped_agents: string[];
  skip_reasons: Record<string, string>;
  estimated_total_time_seconds: number;
  estimated_total_cost_usd: number;
  routing_notes: string;
};

const LEVEL_LABEL: Record<OrchestratorInput["level"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

/**
 * Studio Agent #09 — 오케스트레이터 (TEAM 3-Orchestration).
 * 입력 특성 분석 → 최적 실행 계획 수립.
 * 스킵 가능 에이전트: studio-05, studio-08 (하위 필수 에이전트는 스킵 불가).
 */
export class StudioOrchestrator extends Agent<OrchestratorInput, OrchestratorPlan> {
  readonly id = "studio-09";
  readonly name = "오케스트레이터";
  readonly role = "실행 계획 수립·라우팅 결정";

  protected buildSystemPrompt(input: OrchestratorInput): string {
    return `당신은 13개 에이전트 협업의 오케스트레이터입니다.
역할: 입력을 분석하여 최적 실행 계획을 수립합니다.

주제: ${input.topic}
수준: ${LEVEL_LABEL[input.level]}
길이: ${input.length}

스킵 가능 에이전트 (이것만 스킵 가능, 나머지는 스킵 불가):
- "studio-05": 학습프로세스 큐레이터 — 학습 흐름 설계 (품질에 영향 낮음)
- "studio-08": 인포그래픽 디자이너 — 시각화 명세 (없어도 본문 완성)

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "skipped_agents": ["studio-05"],
  "skip_reasons": { "studio-05": "스킵 이유" },
  "estimated_total_time_seconds": 180,
  "estimated_total_cost_usd": 0.35,
  "routing_notes": "라우팅 결정 요약 1문장"
}

스킵 판단 기준:
- studio-05 스킵: length=short 이거나 단순 개념 주제 (자격증·심화 과정은 유지)
- studio-08 스킵: 텍스트 중심 주제 (코딩·수학·어학은 시각화 효과 낮음)
- 두 에이전트 모두 스킵 가능

비용 추정 기준 (sonnet-4-5 기준):
- 기본 체인(전체): $0.40~$0.55
- studio-05 스킵: -$0.03
- studio-08 스킵: -$0.04
- 시간 추정: 기본 220초, 스킵당 -20초`;
  }

  protected buildUserMessage(_input: OrchestratorInput): string {
    return "위 입력을 분석하여 최적 실행 계획을 JSON으로 출력해주세요.";
  }

  protected parseOutput(rawText: string): OrchestratorPlan {
    return parseJsonSafely<OrchestratorPlan>(rawText);
  }
}
