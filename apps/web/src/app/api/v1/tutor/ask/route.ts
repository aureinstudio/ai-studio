import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiV1, recordApiUsage } from "@/lib/api/v1/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/v1/tutor/ask
 * body: { message, conversation_id?, course_topic?, studio_job_id? }
 *
 * Tutor 응답 동기 반환 (간단형). 본격 RAG는 conversation_id 기반 후속.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiV1(request, "tutor:write");
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    await recordApiUsage(ctx, "POST /api/v1/tutor/ask", 400);
    return NextResponse.json({ error: "invalid_body", message: "message (string) required" }, { status: 400 });
  }

  // 내부 /api/tutor/ask와 동일 LLM 호출. 단순화를 위해 별도 conversation 없이 1회성 응답.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await recordApiUsage(ctx, "POST /api/v1/tutor/ask", 500);
    return NextResponse.json({ error: "tutor_unavailable" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: `당신은 ai-studio Tutor입니다. 학습자 질문에 명료하고 친절하게 답변하세요.${body.course_topic ? ` 현재 학습 주제: ${body.course_topic}` : ""}`,
        messages: [{ role: "user", content: body.message }],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      await recordApiUsage(ctx, "POST /api/v1/tutor/ask", 502);
      return NextResponse.json({ error: "upstream_error", detail: json.error?.message }, { status: 502 });
    }

    const answer = json.content?.[0]?.text ?? "";
    const inputTokens = json.usage?.input_tokens ?? 0;
    const outputTokens = json.usage?.output_tokens ?? 0;
    // Haiku 4.5 비용 (대략): $1/M input, $5/M output
    const cost = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5;

    // cost_log 기록
    const admin = createAdminClient();
    await admin.from("cost_log").insert({
      user_id: ctx.userId,
      service: "tutor_api",
      cost_usd: cost,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
    });

    await recordApiUsage(ctx, "POST /api/v1/tutor/ask", 200, cost);
    return NextResponse.json({
      answer,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost },
    });
  } catch (e) {
    await recordApiUsage(ctx, "POST /api/v1/tutor/ask", 500);
    return NextResponse.json({ error: "internal", detail: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
