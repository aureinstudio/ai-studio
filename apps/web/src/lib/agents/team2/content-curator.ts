import { Agent, parseJsonSafely } from "../base";

export type CuratorInput = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: "short" | "medium" | "long";
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
 * 챕터 본문을 학습자 수준에 맞춰 작성.
 */
export class ContentCurator extends Agent<CuratorInput, CuratorOutput> {
  readonly id = "studio-06";
  readonly name = "핵심 자료 큐레이터";
  readonly role = "챕터 본문 작성 (학습자 수준 맞춤)";

  protected buildSystemPrompt(input: CuratorInput): string {
    return `당신은 KEG 콘텐츠 큐레이터 에이전트입니다.
역할: 챕터 본문을 학습자 수준에 맞춰 작성합니다.

주제: ${input.topic}
대상: ${LEVEL_LABEL[input.level]} 수준

다음 JSON 구조로만 출력하세요. 마크다운 fence(\`\`\`) 사용 금지, 추가 설명 금지:
{
  "chapter_title": "한 문장의 명확한 제목",
  "learning_objectives": ["목표1", "목표2", "목표3"],
  "main_content": [
    {
      "section": "섹션 제목",
      "paragraphs": ["문단1", "문단2", "문단3"]
    }
  ],
  "examples": [
    {
      "title": "예제 제목",
      "type": "code | case_study | diagram",
      "body": "예제 본문 (코드 또는 사례 설명)"
    }
  ]
}

제약:
- learning_objectives 정확히 3개, Bloom 동사로 시작
- main_content는 learning_objectives 1개당 최소 1개 섹션 (총 3섹션 이상)
- 각 섹션 paragraphs는 3~5문단
- examples 최소 1개, code 타입은 실제 동작 코드, case_study는 실생활 사례
- 본문 모두 한국어, 전문용어는 한글(영문) 병기`;
  }

  protected buildUserMessage(_input: CuratorInput): string {
    return "위 구조에 따라 챕터 콘텐츠 JSON을 생성해주세요.";
  }

  protected parseOutput(rawText: string): CuratorOutput {
    return parseJsonSafely<CuratorOutput>(rawText);
  }
}
