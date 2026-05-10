import { Agent, parseJsonSafely } from "../base";
import type { AnalysisOutput } from "./comprehensive-analysis";
import type { EnvironmentResearchOutput } from "./environment-research";
import type { TopicResearchOutput } from "./topic-research";

export type OutlineInput = {
  analysis: AnalysisOutput;
  environment: EnvironmentResearchOutput;
  topicResearch: TopicResearchOutput;
};

export type SectionOutline = {
  section_number: string;
  title: string;
  key_concepts: string[];
  examples_needed: string[];
  assessment_focus: string;
};

export type ChapterOutline = {
  chapter_number: number;
  title: string;
  duration_minutes: number;
  learning_objective_ids: string[];
  sections: SectionOutline[];
};

export type OutlineOutput = {
  chapter_outline: ChapterOutline[];
  logical_flow_rationale: string;
  total_duration_minutes: number;
};

/**
 * Studio Agent #04 — 개요 작성 (TEAM 1).
 * TEAM 1 모든 결과를 통합하여 챕터·섹션 구조 설계.
 * 후속 ContentCurator(#06)의 *구조적 backbone* 제공.
 */
export class OutlineWriter extends Agent<OutlineInput, OutlineOutput> {
  readonly id = "studio-04";
  readonly name = "개요 작성";
  readonly role = "챕터·섹션 구조 설계";

  protected buildSystemPrompt(input: OutlineInput): string {
    return `당신은 KEG 개요 작성 에이전트입니다.
역할: 종합 분석·환경 조사·주제 조사 결과를 통합하여 챕터·세부 목차를 설계합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "chapter_outline": [
    {
      "chapter_number": 1,
      "title": "챕터 제목",
      "duration_minutes": 30,
      "learning_objective_ids": ["primary-1", "primary-2"],
      "sections": [
        {
          "section_number": "1.1",
          "title": "섹션 제목",
          "key_concepts": ["개념 1", "개념 2"],
          "examples_needed": ["예제 유형 1"],
          "assessment_focus": "이 섹션에서 평가할 핵심"
        }
      ]
    }
  ],
  "logical_flow_rationale": "챕터 순서 근거 1~2문장",
  "total_duration_minutes": 90
}

제약:
- chapter_outline은 분석 결과의 *estimated_chapters*에 맞춤
- 챕터 순서 = 인지 부하 *점진 증가* (쉬운 → 어려운, 구체 → 추상)
- 각 챕터는 *학습 목표 1~2개*에 집중 (너무 많으면 분산)
- 각 챕터의 sections는 *2~5개*
- 섹션 번호는 "{chapter}.{section}" 형식
- examples_needed는 #03 주제 조사의 useful_examples 참고
- assessment_focus는 한국 시험 형식 고려 (객관식 평가 가능 형태)
- total_duration_minutes는 모든 챕터 duration_minutes 합계
- 한국어`;
  }

  protected buildUserMessage(input: OutlineInput): string {
    return `다음 TEAM 1 산출물 3종을 통합하여 챕터 구조를 설계해주세요.

=== 종합 분석 (#01) ===
${JSON.stringify(input.analysis, null, 2)}

=== 환경 조사 (#02) ===
${JSON.stringify(input.environment, null, 2)}

=== 주제 조사 (#03) ===
${JSON.stringify(input.topicResearch, null, 2)}

위 입력의 *학습 목표 트리*와 *주제 풀*을 챕터·섹션으로 매핑해주세요.`;
  }

  protected parseOutput(rawText: string): OutlineOutput {
    return parseJsonSafely<OutlineOutput>(rawText);
  }
}
