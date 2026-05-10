import { Agent, parseJsonSafely } from "../base";
import type { AnalysisOutput } from "../team1-planning/comprehensive-analysis";
import type { EnvironmentResearchOutput } from "../team1-planning/environment-research";
import type { TopicResearchOutput } from "../team1-planning/topic-research";
import type { OutlineOutput } from "../team1-planning/outline-writer";

export type PlanningContext = {
  analysis: AnalysisOutput;
  environment: EnvironmentResearchOutput;
  topicResearch: TopicResearchOutput;
  outline: OutlineOutput;
};

export type CuratorInput = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: "short" | "medium" | "long";
  /** TEAM 1 (Agent #01~#04) 산출물. v0.9.0+ 필수. 미제공 시 v0.6 fallback */
  planning?: PlanningContext;
};

export type CuratorOutput = {
  chapter_title: string;
  learning_objectives: string[];
  main_content: {
    section: string;
    paragraphs: string[];
  }[];
  examples: {
    title: string;
    type: "code" | "case_study" | "diagram";
    body: string;
  }[];
};

const LEVEL_LABEL: Record<CuratorInput["level"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

/**
 * Studio Agent #06 — 핵심 자료 큐레이터 (TEAM 2).
 * v0.9.0부터 TEAM 1 outline을 *구조적 backbone*으로 사용.
 */
export class ContentCurator extends Agent<CuratorInput, CuratorOutput> {
  readonly id = "studio-06";
  readonly name = "핵심 자료 큐레이터";
  readonly role = "챕터 본문 작성 (TEAM1 outline 기반)";

  protected buildSystemPrompt(input: CuratorInput): string {
    const base = `당신은 KEG 콘텐츠 큐레이터 에이전트입니다.
역할: 챕터 본문을 학습자 수준에 맞춰 작성합니다.

주제: ${input.topic}
대상: ${LEVEL_LABEL[input.level]} 수준

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "chapter_title": "한 문장의 명확한 제목",
  "learning_objectives": ["목표1", "목표2", "목표3"],
  "main_content": [
    { "section": "섹션 제목", "paragraphs": ["문단1", "문단2", "문단3"] }
  ],
  "examples": [
    { "title": "예제 제목", "type": "code | case_study | diagram", "body": "본문" }
  ]
}

제약:
- learning_objectives 정확히 3개, Bloom 동사로 시작
- main_content는 learning_objectives 1개당 최소 1개 섹션 (총 3섹션 이상)
- 각 섹션 paragraphs는 3~5문단
- examples 최소 1개
- 본문 모두 한국어, 전문용어는 한글(영문) 병기`;

    if (!input.planning) return base;

    // TEAM 1 산출물이 있을 때 — outline의 *첫 챕터*를 기준으로 본문 작성
    const firstChapter = input.planning.outline.chapter_outline[0];
    return `${base}

⚠️ TEAM 1 기획 산출물이 제공되었습니다. 다음을 *반드시* 반영하세요:

[과정 개요] ${input.planning.analysis.course_overview}
[학습자] ${input.planning.analysis.target_learners}

[현 챕터 정보 — outline의 첫 챕터]
- 제목: ${firstChapter?.title ?? "(미정)"}
- 학습 목표 IDs: ${firstChapter?.learning_objective_ids.join(", ") ?? ""}
- 섹션 수: ${firstChapter?.sections.length ?? 0}

[챕터 섹션 목차]
${(firstChapter?.sections ?? [])
  .map(
    (s) =>
      `  ${s.section_number} ${s.title} — 핵심 개념: ${s.key_concepts.join(", ")}`,
  )
  .join("\n")}

[관련 학습 목표 트리]
${input.planning.analysis.learning_objective_tree
  .map((o, i) => `  primary-${i + 1}: ${o.primary} → ${o.secondary.join(" / ")}`)
  .join("\n")}

[활용 가능 예제 풀 (#03 주제 조사)]
${input.planning.topicResearch.topic_pool
  .flatMap((p) => p.useful_examples.map((e) => `  • ${e}`))
  .slice(0, 8)
  .join("\n")}

[학습자 흔한 오해 (#02 환경 조사)]
${input.planning.environment.common_misconceptions.map((m) => `  • ${m}`).join("\n")}

[활용 가능 트렌드·키워드 (#02)]
- 트렌드: ${input.planning.environment.current_trends.join(", ")}
- 키워드: ${input.planning.environment.industry_keywords.slice(0, 5).join(", ")}

추가 제약:
- chapter_title은 outline의 첫 챕터 제목을 *그대로* 사용 (제목 변경 금지)
- main_content의 section들은 outline의 sections 순서·제목 *그대로* 매칭
- 각 섹션 본문에 *해당 section의 key_concepts 모두 등장* 필수
- examples는 위 *활용 가능 예제 풀*에서 선택 (최소 1개)
- common_misconceptions 중 1개는 본문 어딘가에서 *명시적으로 교정* (예: "흔히 X로 알려져 있지만 실제로는 Y입니다")`;
  }

  protected buildUserMessage(_input: CuratorInput): string {
    return "위 구조와 제약에 따라 챕터 콘텐츠 JSON을 생성해주세요.";
  }

  protected parseOutput(rawText: string): CuratorOutput {
    return parseJsonSafely<CuratorOutput>(rawText);
  }
}
