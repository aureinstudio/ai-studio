import { Agent, parseJsonSafely } from "../base";
import type { LearningObjective } from "./comprehensive-analysis";

export type TopicResearchInput = {
  topic: string;
  learning_objective_tree: LearningObjective[];
};

export type TopicPoolEntry = {
  objective_id: string;
  primary_objective: string;
  core_concepts: string[];
  supporting_facts: string[];
  useful_examples: string[];
  common_pitfalls: string[];
};

export type TopicResearchOutput = {
  topic_pool: TopicPoolEntry[];
  cross_topic_connections: string[];
};

/**
 * Studio Agent #03 — 주제 조사 (TEAM 1).
 * 학습 목표별 도메인 지식 풀 — 큐레이터(#06)의 본문 작성 입력.
 *
 * 병렬 동작: #02와 동시 실행 (#01 결과만 의존, #02 출력 미사용).
 */
export class TopicResearch extends Agent<TopicResearchInput, TopicResearchOutput> {
  readonly id = "studio-03";
  readonly name = "주제 조사";
  readonly role = "학습 목표별 도메인 지식 풀";
  protected get maxTokens(): number { return 8192; }

  protected buildSystemPrompt(input: TopicResearchInput): string {
    const objectivesList = input.learning_objective_tree
      .map(
        (obj, i) =>
          `  primary-${i + 1}: ${obj.primary}\n` +
          obj.secondary.map((s, j) => `    secondary-${i + 1}-${j + 1}: ${s}`).join("\n"),
      )
      .join("\n");

    return `당신은 KEG 주제 조사 에이전트입니다.
역할: 학습 목표별로 필요한 도메인 지식과 자료 풀을 구성합니다.

주제: ${input.topic}

학습 목표 트리:
${objectivesList}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "topic_pool": [
    {
      "objective_id": "primary-1",
      "primary_objective": "위 트리의 primary 목표를 그대로 복사",
      "core_concepts": ["핵심 개념 1", ..., "핵심 개념 5~7개"],
      "supporting_facts": ["보조 사실 1", ..., "사실 3~5개"],
      "useful_examples": ["활용 가능 예제 1", ..., "예제 2~3개"],
      "common_pitfalls": ["학습자 함정 1", "함정 2"]
    }
  ],
  "cross_topic_connections": ["주제 간 연결 1", "연결 2"]
}

제약:
- topic_pool은 위 트리의 *각 primary 목표*에 대해 1개 entry (총 entry 수 = primary 수)
- core_concepts는 5~7개, 추상 이론과 구체 사례의 균형
- useful_examples는 *실생활 예* 또는 *코드/데이터 사례*
- common_pitfalls는 1~2개, 한국어 학습자가 자주 빠지는 오해
- cross_topic_connections는 primary 간 *논리적 연결*
- 자격증 과정이면 *한국 시험 형식* 고려 (예: 객관식 보기 패턴)
- 한국어`;
  }

  protected buildUserMessage(_input: TopicResearchInput): string {
    return "위 구조에 따라 주제 조사 JSON을 생성해주세요.";
  }

  protected parseOutput(rawText: string): TopicResearchOutput {
    return parseJsonSafely<TopicResearchOutput>(rawText);
  }
}
