import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { anthropic, MODEL, MAX_TOKENS, DEFAULT_TEMPERATURE } from "@/lib/anthropic/client";
import { calculateClaudeCost, logCost } from "@/lib/cost-tracker";

// Vercel Hobby tier — 함수 최대 60s. Claude 응답이 30s+ 가능하므로 명시.
export const maxDuration = 60;
// Anthropic SDK는 Node.js 런타임 필요 (Edge runtime fetch 호환 안 됨)
export const runtime = "nodejs";

const requestSchema = z.object({
  topic: z.string().min(1, "주제를 입력해주세요").max(200, "주제가 너무 깁니다"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  length: z.enum(["short", "medium", "long"]),
});

const SYSTEM_PROMPT_TEMPLATE = (topic: string, level: string) => `당신은 KEG의 시니어 교재 PD입니다.
주제: ${topic}
대상: ${level} 수준

다음 구조로 학습 콘텐츠 1챕터를 작성하세요:
1. 챕터 제목 (chapter_title) — 명확하고 흥미로운 한 문장
2. 학습 목표 3개 (learning_objectives) — Bloom 동사 시작 (이해한다·적용한다·분석한다 등)
3. 핵심 개념 설명 (core_concepts) — 3~5문단의 한국어 본문, 각 문단은 string 배열의 한 원소
4. 실습 예제 1개 (practical_example) — { problem: 문제 진술, solution: 풀이 또는 정답 코드/풀이 과정 }
5. 단원 평가 문항 3개 (assessment) — 객관식, 각 문항은 { question, options: [4개 보기], answer: 정답 보기 텍스트 }

반드시 *유효한 JSON*으로만 출력하세요. 마크다운 코드 블록 \`\`\`json 사용 금지. 추가 설명·인사말 금지.
JSON 키 이름은 위 영문 그대로 사용. 값은 한국어로.`;

const USER_MESSAGE = "위 구조에 따라 콘텐츠 JSON을 생성해주세요.";

type StudioContent = {
  chapter_title: string;
  learning_objectives: string[];
  core_concepts: string[];
  practical_example: { problem: string; solution: string };
  assessment: { question: string; options: string[]; answer: string }[];
};

/**
 * Claude 응답 텍스트에서 마크다운 fence 제거 후 JSON 파싱.
 * Claude가 가끔 \`\`\`json ... \`\`\` 로 감싸는 경우 대비.
 */
function parseJsonContent(raw: string): StudioContent {
  let text = raw.trim();
  // 시작 fence 제거
  text = text.replace(/^```(?:json)?\s*\n?/, "");
  // 끝 fence 제거
  text = text.replace(/\n?```\s*$/, "");
  return JSON.parse(text) as StudioContent;
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  // 1. 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 요청 본문 검증
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }
  const { topic, level, length } = parsed.data;

  // 3. Claude 호출
  let claudeResponse;
  try {
    claudeResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      system: SYSTEM_PROMPT_TEMPLATE(topic, level),
      messages: [{ role: "user", content: USER_MESSAGE }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[studio/generate] Claude API error:", message);
    return NextResponse.json(
      { error: "claude_api_error", detail: message },
      { status: 502 },
    );
  }

  // 4. 응답 파싱
  const textBlock = claudeResponse.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "no_text_response" },
      { status: 502 },
    );
  }

  let content: StudioContent;
  try {
    content = parseJsonContent(textBlock.text);
  } catch (err) {
    console.error("[studio/generate] JSON parse error:", err);
    return NextResponse.json(
      {
        error: "json_parse_error",
        raw: textBlock.text.slice(0, 500), // 디버그용 일부만
      },
      { status: 502 },
    );
  }

  // 5. 비용·시간 산정
  const duration = (Date.now() - start) / 1000;
  const tokensIn = claudeResponse.usage.input_tokens;
  const tokensOut = claudeResponse.usage.output_tokens;
  const cost = calculateClaudeCost(MODEL, tokensIn, tokensOut);

  // 6. studio_jobs 저장
  const { data: job, error: jobError } = await supabase
    .from("studio_jobs")
    .insert({
      user_id: user.id,
      topic,
      level,
      length,
      content,
      status: "completed",
      cost_usd: cost,
      duration_seconds: duration,
    })
    .select("id")
    .single();

  if (jobError) {
    console.error("[studio/generate] studio_jobs insert error:", jobError);
    // job 저장 실패해도 사용자에게 결과는 반환 — 다음 호출 시 재시도 가능
  }

  // 7. 비용 로그 (실패 무시)
  await logCost({
    supabase,
    service: "anthropic",
    endpoint: "/api/studio/generate",
    userId: user.id,
    tokensIn,
    tokensOut,
    costUsd: cost,
    metadata: {
      model: MODEL,
      job_id: job?.id,
      topic_length: topic.length,
      level,
    },
  });

  return NextResponse.json({
    jobId: job?.id ?? null,
    content,
    cost_usd: cost,
    duration_seconds: duration,
    tokens: { input: tokensIn, output: tokensOut },
  });
}
