import { Agent, parseJsonSafely } from "../base";

export type AnalysisInput = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: "short" | "medium" | "long";
};

export type LearningObjective = {
  primary: string;
  secondary: string[];
};

export type AnalysisOutput = {
  course_overview: string;
  target_learners: string;
  prerequisites: string[];
  learning_objective_tree: LearningObjective[];
  estimated_chapters: number;
  difficulty_factors: string[];
};

const LEVEL_LABEL: Record<AnalysisInput["level"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

/**
 * Studio Agent #01 — 종합 분석 (TEAM 1).
 * 사용자 입력 → 학습 목표 트리 + 학습자 프로파일 + 챕터 추정.
 */
export class ComprehensiveAnalysis extends Agent<AnalysisInput, AnalysisOutput> {
  readonly id = "studio-01";
  readonly name = "종합 분석";
  readonly role = "학습 목표 트리 + 학습자 프로파일";
  protected get maxTokens(): number { return 4096; }

  protected buildSystemPrompt(input: AnalysisInput): string {
    const prereqGuide =
      input.level === "beginner"
        ? "0~1개 (사실상 무전제 또는 기초 1개)"
        : input.level === "intermediate"
          ? "2~3개"
          : "3~5개";

    return `당신은 KEG 종합 분석 에이전트입니다.
역할: 사용자가 입력한 과정 정보를 분석하여 학습 목표 트리를 도출합니다.

주제: ${input.topic}
대상 수준: ${LEVEL_LABEL[input.level]}
길이: ${input.length}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "course_overview": "1~2문장 과정 요약",
  "target_learners": "예: '한식 요리 입문자, 조리기능사 자격증 준비자'",
  "prerequisites": ["선수 지식 1", "선수 지식 2"],
  "learning_objective_tree": [
    {
      "primary": "최상위 학습 목표 (Bloom 동사로 시작)",
      "secondary": ["하위 목표 1", "하위 목표 2", "하위 목표 3"]
    }
  ],
  "estimated_chapters": 5,
  "difficulty_factors": ["난이도 요인 1", "난이도 요인 2"]
}

제약:
- learning_objective_tree는 *최소 3개*의 primary 목표 (서로 중복 없이)
- 각 primary는 secondary *2~4개*
- prerequisites는 ${prereqGuide}
- 모든 목표는 Bloom 동사 시작 (이해한다·적용한다·분석한다·평가한다·창출한다)
- estimated_chapters는 length 기반 추정 (short=3~5, medium=6~10, long=10~15)
- 본문 한국어`;
  }

  protected buildUserMessage(_input: AnalysisInput): string {
    return "위 구조에 따라 종합 분석 JSON을 생성해주세요.";
  }

  protected parseOutput(rawText: string): AnalysisOutput {
    return parseJsonSafely<AnalysisOutput>(rawText);
  }
}
