import { Agent, parseJsonSafely } from "../base";
import type { OutlineOutput } from "../team1-planning/outline-writer";

export type LearningStep = {
  step_number: number;
  type: "concept_introduction" | "practice" | "reflection" | "assessment";
  duration_minutes: number;
  cognitive_load: "low" | "medium" | "high";
  scaffolding_strategy: string;
};

export type LearningProcessOutput = {
  learning_sequence: LearningStep[];
  difficulty_progression: "linear" | "spiral" | "case-based";
  engagement_techniques: string[];
};

export type LearningProcessInput = {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  outline: OutlineOutput;
};

const LEVEL_LABEL: Record<LearningProcessInput["level"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

/**
 * Studio Agent #05 — 학습프로세스 큐레이터 (TEAM 2-Production).
 * Outline Writer(#04) 산출물 → 학습 흐름·난이도 시퀀스 설계.
 * ContentCurator(#06)의 입력으로 추가됨.
 */
export class LearningProcessCurator extends Agent<LearningProcessInput, LearningProcessOutput> {
  readonly id = "studio-05";
  readonly name = "학습프로세스 큐레이터";
  readonly role = "학습 흐름·난이도 조정";
  protected get maxTokens(): number { return 3072; }

  protected buildSystemPrompt(input: LearningProcessInput): string {
    return `당신은 학습프로세스 큐레이터입니다.
역할: 챕터 개요를 받아 학습 흐름과 난이도를 조정합니다.

주제: ${input.topic}
수준: ${LEVEL_LABEL[input.level]}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "learning_sequence": [
    {
      "step_number": 1,
      "type": "concept_introduction|practice|reflection|assessment",
      "duration_minutes": 5,
      "cognitive_load": "low|medium|high",
      "scaffolding_strategy": "..."
    }
  ],
  "difficulty_progression": "linear|spiral|case-based",
  "engagement_techniques": [...]
}

제약:
- 한 단계의 cognitive_load가 high면 다음은 low~medium
- 30분당 최소 1회 reflection 또는 practice
- 자격증 과정은 assessment 비중 40%+
- engagement_techniques는 3~5개
- 한국어`;
  }

  protected buildUserMessage(input: LearningProcessInput): string {
    return `다음 챕터 개요를 바탕으로 학습 흐름과 난이도를 설계해주세요.

=== 챕터 개요 (#04) ===
${JSON.stringify(input.outline, null, 2)}`;
  }

  protected parseOutput(rawText: string): LearningProcessOutput {
    return parseJsonSafely<LearningProcessOutput>(rawText);
  }
}
