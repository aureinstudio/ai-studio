import { Agent, parseJsonSafely } from "../base";

export type EnvironmentResearchInput = {
  topic: string;
  target_learners: string;
};

export type EnvironmentResearchOutput = {
  domain_context: string;
  current_trends: string[];
  industry_keywords: string[];
  common_misconceptions: string[];
  real_world_applications: string[];
  market_relevance: "high" | "medium" | "low";
};

/**
 * Studio Agent #02 — 환경 조사 (TEAM 1).
 * 시장·트렌드·산업 컨텍스트를 학습 콘텐츠 작성 *전에* 확보.
 */
export class EnvironmentResearch extends Agent<
  EnvironmentResearchInput,
  EnvironmentResearchOutput
> {
  readonly id = "studio-02";
  readonly name = "환경 조사";
  readonly role = "시장·트렌드·산업 컨텍스트";

  protected buildSystemPrompt(input: EnvironmentResearchInput): string {
    return `당신은 KEG 환경 조사 에이전트입니다.
역할: 과정 도메인의 시장·경쟁·산업 트렌드를 조사합니다.

주제: ${input.topic}
대상 학습자: ${input.target_learners}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "domain_context": "도메인 개요 (한국 시장 우선)",
  "current_trends": ["트렌드 1", "트렌드 2", "트렌드 3"],
  "industry_keywords": ["핵심 키워드 1", "...", "키워드 10"],
  "common_misconceptions": ["오해 1", "오해 2", "오해 3"],
  "real_world_applications": ["실무 사례 1", "실무 사례 2", "실무 사례 3"],
  "market_relevance": "high|medium|low"
}

제약:
- 추측 정보보다 *일반적으로 알려진 사실* 기반 (확실하지 않은 통계 수치 X)
- *한국 시장 컨텍스트* 우선 (글로벌 사례는 보조)
- 자격증 과정인 경우 *출제 경향*도 trends 또는 keywords에 포함
- industry_keywords는 *정확히 10개* (학습자가 검색·표시할 단어)
- common_misconceptions는 *학습자가 빠지기 쉬운 함정* 중심
- 한국어`;
  }

  protected buildUserMessage(_input: EnvironmentResearchInput): string {
    return "위 구조에 따라 환경 조사 JSON을 생성해주세요.";
  }

  protected parseOutput(rawText: string): EnvironmentResearchOutput {
    return parseJsonSafely<EnvironmentResearchOutput>(rawText);
  }
}
