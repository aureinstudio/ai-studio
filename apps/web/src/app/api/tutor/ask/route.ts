import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { runTutorChain } from "@/lib/agents/tutor/orchestrator-v1";
import { SafetyDetector } from "@/lib/agents/tutor/safety-detector";
import { logCost } from "@/lib/cost-tracker";
import { notifyAdminAlert, notifyAdmin } from "@/lib/notifications/email";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/rate-limit";
import { checkCostBudget, costBlockResponse, recordCostWarnings } from "@/lib/cost-guard";
import { detectThreats, logThreat, threatBlockResponse } from "@/lib/security/input-filter";
import { resolveUser } from "@/lib/supabase/bearer-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  question: z.string().min(2).max(500),
  studio_job_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  declared_language: z
    .enum(["ko", "en", "zh", "vi", "id"])
    .nullable()
    .optional(),
});

/**
 * POST /api/tutor/ask
 *
 * Tutor v1 — 5 에이전트 체인 (병렬·다국어):
 *   #01 IntentClassifier + #03 LanguageHandler (병렬, Haiku)
 *   → #02 RAG 검색 → #04 ResponseGenerator → #08 HallucinationChecker
 *
 * 응답 시간 목표: 5초 이내 (병렬 활용).
 * 비용: ~$0.02/호출.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  const user = await resolveUser(request, cookieUser);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // admin 여부 — 모든 가드 면제 (시연·테스트용)
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin" || profile?.role === "keg_super_admin";

  // Rate limit — 분당 10회/사용자
  const rl = await checkRateLimit("tutor:ask", user.id, {
    isAdmin,
    ipFallback: getClientIp(request),
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  // 입력 위협 검사 — 프롬프트 인젝션·시스템 추출·DoS
  const threat = detectThreats(parsed.data.question);
  if (threat.threats.length > 0) {
    await logThreat(admin, {
      userId: user.id,
      endpoint: "/api/tutor/ask",
      ip: getClientIp(request),
      input: parsed.data.question,
      result: threat,
    });
  }
  if (threat.blocked) return threatBlockResponse(threat);

  // 비용 한도 검사 (per-user daily/monthly + global)
  const budget = await checkCostBudget(admin, {
    userId: user.id,
    service: "all",
    isAdmin,
  });
  if (!budget.allowed) return costBlockResponse(budget);
  if (budget.warnings.length > 0) {
    await recordCostWarnings(admin, user.id, budget.warnings, async (title, body) => {
      await notifyAdmin({ title, body, level: "warning" });
    });
  }

  // 권한·콘텐츠 검증
  const { data: job } = await admin
    .from("studio_jobs")
    .select("id, user_id, is_sample, topic")
    .eq("id", parsed.data.studio_job_id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.user_id !== user.id && !job.is_sample) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Tutor 체인 실행
    const result = await runTutorChain(admin, {
      question: parsed.data.question,
      studio_job_id: parsed.data.studio_job_id,
      course_topic: job.topic,
      conversation_id: parsed.data.conversation_id ?? null,
      declared_language: parsed.data.declared_language ?? undefined,
      user_id: user.id,
    });

    // 대화 저장 (append 또는 new)
    const userMessage = {
      role: "user" as const,
      content: parsed.data.question,
      timestamp: new Date().toISOString(),
    };
    const assistantMessage = {
      role: "assistant" as const,
      content: result.answer,
      verdict: result.verdict,
      intent: result.intent.intent,
      detected_language: result.language.detected_language,
      response_language: result.language.response_language,
      sources: result.sources.map((s) => ({
        similarity: s.similarity,
        source_type: s.source_type,
        preview: s.chunk_text.slice(0, 200),
      })),
      cost_usd: result.total_cost_usd,
      duration_ms: result.total_duration_ms,
      timestamp: new Date().toISOString(),
    };

    let conversationId = parsed.data.conversation_id ?? null;
    const isRejected = result.verdict === "rejected";

    if (conversationId) {
      const { data: conv } = await admin
        .from("tutor_conversations")
        .select("messages, total_messages, rejected_count, total_cost_usd")
        .eq("id", conversationId)
        .eq("student_id", user.id)
        .maybeSingle();
      if (conv) {
        const messages = [...(conv.messages ?? []), userMessage, assistantMessage];
        await admin
          .from("tutor_conversations")
          .update({
            messages,
            total_messages: (conv.total_messages ?? 0) + 2,
            rejected_count: (conv.rejected_count ?? 0) + (isRejected ? 1 : 0),
            total_cost_usd: Number(conv.total_cost_usd ?? 0) + result.total_cost_usd,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
      }
    } else {
      const { data: newConv } = await admin
        .from("tutor_conversations")
        .insert({
          student_id: user.id,
          studio_job_id: parsed.data.studio_job_id,
          messages: [userMessage, assistantMessage],
          total_messages: 2,
          rejected_count: isRejected ? 1 : 0,
          total_cost_usd: result.total_cost_usd,
          language: result.language.response_language,
        })
        .select("id")
        .single();
      conversationId = newConv?.id ?? null;
    }

    // 자동 안전 감지 — rejected이거나 5턴마다 백그라운드 트리거
    const shouldRunSafety =
      isRejected ||
      result.intent.intent === "personal_emotion" ||
      result.intent.intent === "off_topic" ||
      ((parsed.data.conversation_id ?? conversationId) &&
        ((((await admin
          .from("tutor_conversations")
          .select("total_messages")
          .eq("id", conversationId!)
          .maybeSingle()).data?.total_messages ?? 0) % 5) === 0));

    if (shouldRunSafety && conversationId) {
      after(async () => {
        try {
          const { data: convFull } = await admin
            .from("tutor_conversations")
            .select("messages, total_messages, rejected_count, last_active_at, student_id")
            .eq("id", conversationId!)
            .maybeSingle();
          if (!convFull) return;
          const detector = new SafetyDetector();
          const r09 = await detector.execute({
            student_label: `student-${convFull.student_id.slice(0, 8)}`,
            course_topic: job.topic,
            recent_messages: (convFull.messages ?? []) as { role: "user" | "assistant"; content: string }[],
            total_messages: convFull.total_messages ?? 0,
            rejected_count: convFull.rejected_count ?? 0,
            days_since_last_activity: 0,
          });
          await logCost({
            supabase: admin,
            service: "tutor",
            endpoint: "/api/tutor/ask",
            userId: convFull.student_id,
            tokensIn: r09.log.tokens_in,
            tokensOut: r09.log.tokens_out,
            costUsd: r09.log.cost_usd,
            metadata: { stage: "safety_auto", conversation_id: conversationId },
          });
          if (r09.output.alert_required && r09.output.alert_target !== "none") {
            for (const signal of r09.output.risk_signals) {
              await admin.from("admin_alerts").insert({
                alert_type: signal.type,
                severity: signal.severity,
                student_id: convFull.student_id,
                source_conversation_id: conversationId,
                evidence: { items: signal.evidence, trend: signal.trend, first_detected: signal.first_detected },
                recommended_intervention: r09.output.recommended_intervention,
                alert_target: r09.output.alert_target,
                dropout_risk_score: r09.output.dropout_risk_score,
              });
              // Slack 알림 (medium·high만 — low는 노이즈 회피)
              await notifyAdminAlert({
                alert_type: signal.type,
                severity: signal.severity,
                student_label: convFull.student_id.slice(0, 8),
                evidence: signal.evidence,
                intervention: r09.output.recommended_intervention,
                dropout_risk: r09.output.dropout_risk_score,
              });
            }
          }
        } catch (err) {
          console.warn("[tutor/ask] safety check failed (non-fatal):", err);
        }
      });
    }

    return NextResponse.json({
      answer: result.answer,
      verdict: result.verdict,
      intent: result.intent.intent,
      complexity: result.intent.complexity,
      detected_language: result.language.detected_language,
      response_language: result.language.response_language,
      translated_query: result.language.translated_to_korean,
      block_reason: result.hallucination.block_reason,
      confidence_score: result.hallucination.confidence_score,
      ai_confidence: result.generator.confidence,
      suggested_next_step: result.generator.suggested_next_step,
      sources: result.sources.map((s, i) => ({
        index: i + 1,
        similarity: s.similarity,
        source_type: s.source_type,
        preview: s.chunk_text.slice(0, 200),
      })),
      cited_chunks: result.generator.cited_chunks,
      conversation_id: conversationId,
      cost_usd: result.total_cost_usd,
      duration_ms: result.total_duration_ms,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tutor/ask v1] failed:", err);
    return NextResponse.json(
      { error: "ask_failed", detail: message },
      { status: 500 },
    );
  }
}
