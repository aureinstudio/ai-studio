import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding } from "@/lib/rag/embedder";
import { logCost } from "@/lib/cost-tracker";
import { IntentClassifier, type IntentClassifierOutput } from "./intent-classifier";
import { LanguageHandler, type LanguageHandlerOutput, type SupportedLanguage } from "./language-handler";
import { ResponseGenerator, type ResponseGeneratorOutput } from "./response-generator";
import { HallucinationChecker, type HallucinationCheckerOutput, type SourceChunk } from "./hallucination-checker";
import { retrieveContext } from "./context-retriever";

export type TutorChainInput = {
  question: string;
  studio_job_id: string;
  course_topic: string;
  conversation_id: string | null;
  declared_language?: SupportedLanguage;
  user_id: string;
};

export type TutorChainResult = {
  // 학생에게 노출될 최종 답변
  answer: string;
  verdict: "approved" | "rejected" | "needs_revision";
  // 진단 정보
  intent: IntentClassifierOutput;
  language: LanguageHandlerOutput;
  generator: ResponseGeneratorOutput;
  hallucination: HallucinationCheckerOutput;
  // RAG
  sources: SourceChunk[];
  conversation_summary: string;
  // 메트릭
  total_cost_usd: number;
  total_duration_ms: number;
};

const BLOCKED_RESPONSES: Record<SupportedLanguage, string> = {
  ko: "이 질문은 교재에 명확한 근거가 없거나 안전상 답변하기 어렵습니다. 강사·관리자에게 직접 문의해 주세요.",
  en: "This question lacks a clear basis in the course material or may pose safety concerns. Please contact your instructor or administrator directly.",
  zh: "此问题在教材中没有明确依据或存在安全顾虑。请直接联系您的导师或管理员。",
  vi: "Câu hỏi này không có cơ sở rõ ràng trong tài liệu khóa học hoặc có thể gây ra mối lo ngại về an toàn. Vui lòng liên hệ trực tiếp với giảng viên hoặc quản trị viên của bạn.",
  id: "Pertanyaan ini tidak memiliki dasar yang jelas dalam materi kursus atau dapat menimbulkan masalah keamanan. Silakan hubungi instruktur atau administrator Anda secara langsung.",
};

const HANDOFF_RESPONSES: Record<SupportedLanguage, string> = {
  ko: "이 부분은 강사님과 직접 상담하시는 것이 좋겠습니다. 학습 지원팀에 연락해 주세요.",
  en: "This is best discussed directly with your instructor. Please contact the learning support team.",
  zh: "这个问题最好与您的导师直接讨论。请联系学习支持团队。",
  vi: "Vấn đề này nên được thảo luận trực tiếp với giảng viên. Vui lòng liên hệ với nhóm hỗ trợ học tập.",
  id: "Hal ini lebih baik didiskusikan langsung dengan instruktur Anda. Silakan hubungi tim dukungan pembelajaran.",
};

/**
 * Tutor 응답 체인 v1.
 *
 * 흐름 (병렬 가능 단계 표시):
 *   ① IntentClassifier (Haiku)    ─┐
 *                                   ├─ 병렬
 *   ③ LanguageHandler (Haiku)     ─┘
 *      ↓ (한국어 번역 확보)
 *   ② Embedding + ContextRetriever (Gemini + SQL)
 *      ↓
 *   ④ ResponseGenerator (Sonnet)
 *      ↓
 *   ⑧ HallucinationChecker (Sonnet) — 안전 게이트
 *      ↓
 *   학생 응답 (verdict별 처리)
 *
 * 평균 시간: 5초 이내 (병렬 활용)
 * 평균 비용: ~$0.02
 */
export async function runTutorChain(
  admin: SupabaseClient,
  input: TutorChainInput,
): Promise<TutorChainResult> {
  const start = Date.now();
  let totalCost = 0;

  // ① + ③ 병렬 — 의도 분류 + 언어 감지 (Haiku, 빠름)
  const [intentResult, langResult] = await Promise.all([
    new IntentClassifier("claude-haiku-4-5").execute({
      question: input.question,
    }),
    new LanguageHandler("claude-haiku-4-5").execute({
      question: input.question,
      declared_language: input.declared_language,
    }),
  ]);
  totalCost += intentResult.log.cost_usd + langResult.log.cost_usd;

  await Promise.all([
    logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/ask",
      userId: input.user_id,
      tokensIn: intentResult.log.tokens_in,
      tokensOut: intentResult.log.tokens_out,
      costUsd: intentResult.log.cost_usd,
      metadata: { stage: "intent", studio_job_id: input.studio_job_id, intent: intentResult.output.intent },
    }),
    logCost({
      supabase: admin,
      service: "tutor",
      endpoint: "/api/tutor/ask",
      userId: input.user_id,
      tokensIn: langResult.log.tokens_in,
      tokensOut: langResult.log.tokens_out,
      costUsd: langResult.log.cost_usd,
      metadata: { stage: "language", studio_job_id: input.studio_job_id, detected: langResult.output.detected_language },
    }),
  ]);

  // 특수 분기: off_topic / personal_emotion → 즉시 응답, RAG·답변·검증 스킵
  const lang = langResult.output.response_language;
  if (intentResult.output.intent === "off_topic") {
    const offTopicMsg = BLOCKED_RESPONSES[lang];
    return buildEarlyExit({
      answer: offTopicMsg,
      verdict: "rejected",
      intent: intentResult.output,
      language: langResult.output,
      reason: "off_topic — RAG 스킵",
      totalCost,
      start,
    });
  }
  if (
    intentResult.output.intent === "personal_emotion" ||
    intentResult.output.requires_human_handoff
  ) {
    const handoffMsg = HANDOFF_RESPONSES[lang];
    return buildEarlyExit({
      answer: handoffMsg,
      verdict: "needs_revision",
      intent: intentResult.output,
      language: langResult.output,
      reason: "human handoff 권장",
      totalCost,
      start,
    });
  }

  // ② 임베딩 + RAG 검색 (한국어 번역 사용)
  const emb = await createEmbedding(
    langResult.output.translated_to_korean,
    "RETRIEVAL_QUERY",
  );
  totalCost += emb.cost_usd;
  await logCost({
    supabase: admin,
    service: "gemini",
    endpoint: "/v1beta/embedContent",
    userId: input.user_id,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: emb.cost_usd,
    metadata: { stage: "query_embed", studio_job_id: input.studio_job_id },
  });

  const context = await retrieveContext(
    admin,
    input.studio_job_id,
    emb.vector,
    input.conversation_id,
    5,
  );

  // ④ 응답 생성 (Sonnet, 품질)
  const respResult = await new ResponseGenerator().execute({
    question: input.question,
    question_translated_korean: langResult.output.translated_to_korean,
    course_topic: input.course_topic,
    intent: intentResult.output,
    language: langResult.output,
    rag_chunks: context.rag_results,
    conversation_summary: context.conversation_summary || undefined,
  });
  totalCost += respResult.log.cost_usd;
  await logCost({
    supabase: admin,
    service: "tutor",
    endpoint: "/api/tutor/ask",
    userId: input.user_id,
    tokensIn: respResult.log.tokens_in,
    tokensOut: respResult.log.tokens_out,
    costUsd: respResult.log.cost_usd,
    metadata: { stage: "response_gen", studio_job_id: input.studio_job_id },
  });

  // ⑧ 환각 검증 (Sonnet, 안전 게이트)
  const checkResult = await new HallucinationChecker().execute({
    question: langResult.output.translated_to_korean, // 한국어 기준 검증 (자료가 한국어이므로)
    response_text: respResult.output.answer_text,
    source_chunks: context.rag_results,
  });
  totalCost += checkResult.log.cost_usd;
  await logCost({
    supabase: admin,
    service: "tutor",
    endpoint: "/api/tutor/ask",
    userId: input.user_id,
    tokensIn: checkResult.log.tokens_in,
    tokensOut: checkResult.log.tokens_out,
    costUsd: checkResult.log.cost_usd,
    metadata: { stage: "hallucination", studio_job_id: input.studio_job_id, verdict: checkResult.output.verdict },
  });

  // verdict별 최종 답변 결정
  let finalAnswer: string;
  if (checkResult.output.verdict === "rejected") {
    finalAnswer = `${BLOCKED_RESPONSES[lang]}\n\n(${checkResult.output.block_reason ?? "근거 부족"})`;
  } else if (
    checkResult.output.verdict === "needs_revision" &&
    checkResult.output.suggested_revision
  ) {
    finalAnswer = checkResult.output.suggested_revision;
  } else {
    finalAnswer = respResult.output.answer_text;
  }

  return {
    answer: finalAnswer,
    verdict: checkResult.output.verdict,
    intent: intentResult.output,
    language: langResult.output,
    generator: respResult.output,
    hallucination: checkResult.output,
    sources: context.rag_results,
    conversation_summary: context.conversation_summary,
    total_cost_usd: totalCost,
    total_duration_ms: Date.now() - start,
  };
}

function buildEarlyExit(opts: {
  answer: string;
  verdict: "rejected" | "needs_revision";
  intent: IntentClassifierOutput;
  language: LanguageHandlerOutput;
  reason: string;
  totalCost: number;
  start: number;
}): TutorChainResult {
  return {
    answer: opts.answer,
    verdict: opts.verdict,
    intent: opts.intent,
    language: opts.language,
    generator: {
      answer_text: opts.answer,
      cited_chunks: [],
      suggested_next_step: null,
      confidence: "unknown",
    },
    hallucination: {
      verdict: opts.verdict,
      confidence_score: 0,
      groundedness: { fully_supported: [], partially_supported: [], unsupported: [] },
      missing_citations: [],
      suggested_revision: null,
      block_reason: opts.reason,
    },
    sources: [],
    conversation_summary: "",
    total_cost_usd: opts.totalCost,
    total_duration_ms: Date.now() - opts.start,
  };
}
