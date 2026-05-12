import { Agent, parseJsonSafely } from "../base";

export type SourceChunk = {
  chunk_text: string;
  similarity: number;
  source_type: string;
};

export type HallucinationCheckerInput = {
  question: string;
  response_text: string;
  source_chunks: SourceChunk[];
};

export type HallucinationCheckerOutput = {
  verdict: "approved" | "rejected" | "needs_revision";
  confidence_score: number;
  groundedness: {
    fully_supported: string[];
    partially_supported: string[];
    unsupported: string[];
  };
  missing_citations: string[];
  suggested_revision: string | null;
  block_reason: string | null;
};

/**
 * Tutor Agent #08 — 환각 검증 (안전 게이트).
 *
 * KEG 학생이 직접 사용하는 시스템 — 모든 응답은 이 게이트를 통과 후 학생에게 전달.
 * rejected 응답은 차단되고 일반 안내 메시지로 대체됨.
 *
 * 판정 기준:
 *   - approved: 모든 사실 진술이 source_chunks에 근거 + 일반 상식 OK
 *   - needs_revision: 일부 근거 없지만 안전 무관 — 수정안 제시
 *   - rejected: 핵심 사실 오류·근거 없음, 자격증/법령/의학 false 정보,
 *               부정행위·시험답·자해·범죄 등 안전 위협
 *
 * Sonnet 4.5 사용 (정확성 우선). 비용: response당 ~$0.005~0.01.
 */
export class HallucinationChecker extends Agent<
  HallucinationCheckerInput,
  HallucinationCheckerOutput
> {
  readonly id = "tutor-08";
  readonly name = "환각 검증";
  readonly role = "응답 근거성·안전성 검증";

  protected get temperature(): number {
    return 0.1; // 일관성 우선 — 같은 입력이면 같은 판정
  }

  protected buildSystemPrompt(_input: HallucinationCheckerInput): string {
    return `당신은 환각 검증 에이전트입니다.
역할: KEG AI 튜터의 응답이 제공된 근거 자료에 충실한지 검증하고,
사실 오류·근거 없는 주장·안전 위협을 차단합니다.

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "verdict": "approved" | "rejected" | "needs_revision",
  "confidence_score": 0~100,
  "groundedness": {
    "fully_supported": ["근거 명확한 진술 1", "..."],
    "partially_supported": ["일부 근거 있는 진술 1"],
    "unsupported": ["근거 없는 진술 1"]
  },
  "missing_citations": ["출처가 필요한데 없는 진술"],
  "suggested_revision": "needs_revision 시 수정안 (또는 null)",
  "block_reason": "rejected 시 학생 노출용 차단 사유 (또는 null)"
}

═══ 판정 기준 ═══

[approved — 안전 통과]
- 모든 사실 진술이 source_chunks에 근거
- 일반 상식 (물의 끓는점, 기본 산수, 사회 통념) 은 source 없어도 허용
- "교재에 해당 내용이 없습니다", "모르겠습니다" 등 정직 응답
- 학습자에게 직접 질문 검토·강사 문의 유도

[needs_revision — 수정 권고]
- 일부 진술이 근거 없지만 안전·중요도 낮음
- 표현이 모호해 학습자가 오해할 위험
- 출처를 명시하면 acceptable한 진술

[rejected — 차단 ⚠️]
- 핵심 사실에 오류 또는 출처 없는 단정
- 수치·날짜·인명·법령·의학·재무·시험 정보 잘못
- false premise에 동조 (예: "고추장은 일본 유래죠?" → "네 맞아요")
- 부정행위·시험답·해킹·범죄·자해·차별 등 안전 위협
- 자격증·법령·의료 등 고위험 영역에서 출처 없는 단정
- 학생이 잘못된 정보를 사실로 받아들일 위험

═══ 매우 중요 (학생 안전) ═══

1. 의심되면 reject (false positive가 false negative보다 안전)
2. 자격증 시험·법령·의학 정보는 source에 명시된 내용만 허용
3. 부정행위·시험 정보 유출·해를 끼치는 행동 유도는 즉시 reject
4. "교재에 없는 내용"이라도 일반 상식이면 approved
5. 모르면 모른다고 답하도록 유도된 응답은 approved (정직성 보상)
6. False premise (질문 자체가 잘못된 전제) 동조는 reject

═══ 점수 가이드 ═══
- approved: 80~100
- needs_revision: 50~79
- rejected: 0~49

block_reason은 학생에게 노출되므로 친절하고 명확하게 작성 (한국어).
교재·강사·관리자 문의 유도가 좋음.`;
  }

  protected buildUserMessage(input: HallucinationCheckerInput): string {
    const chunksText = input.source_chunks.length
      ? input.source_chunks
          .map(
            (c, i) =>
              `[근거 ${i + 1}] (유사도 ${c.similarity.toFixed(2)}, ${c.source_type})\n${c.chunk_text}`,
          )
          .join("\n\n---\n\n")
      : "(근거 청크 없음 — RAG 검색 결과 0건)";

    return `학생 질문:
"${input.question}"

AI 응답:
${input.response_text}

근거 청크 (RAG 검색, 유사도 순):
${chunksText}

위 응답이 근거에 충실하고 안전한지 판정해주세요.`;
  }

  protected parseOutput(rawText: string): HallucinationCheckerOutput {
    return parseJsonSafely<HallucinationCheckerOutput>(rawText);
  }
}
