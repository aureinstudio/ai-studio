import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ai-studio-drab-nine.vercel.app");

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "ai-studio Public API",
      version: "1.0.0",
      description: "AI 콘텐츠 생성·영상 합성·튜터 답변 — B2B 통합용 REST API.",
      contact: { name: "ai-studio Support", email: "aureinstudio@gmail.com" },
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: "Production" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API key in format `ak_live_<32 hex>`. Get one at /admin/api-keys.",
        },
      },
      schemas: {
        StudioJob: {
          type: "object",
          properties: {
            job_id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
            topic: { type: "string" },
            level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            length: { type: "string", enum: ["short", "medium", "long"] },
            course_category: { type: "string", enum: ["certification", "professional", "language", "hobby", "academic"] },
            content: { type: "object", nullable: true },
            cost_usd: { type: "number", nullable: true },
            error: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            completed_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            detail: { type: "string" },
          },
        },
      },
    },
    paths: {
      "/studio/jobs": {
        post: {
          summary: "Studio 작업 생성",
          description: "AI가 강의 자료(텍스트 + 슬라이드 + 퀴즈)를 생성합니다. 비동기 — job_id 즉시 반환.",
          security: [{ bearerAuth: [] }],
          "x-scope-required": "studio:write",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["topic"],
                  properties: {
                    topic: { type: "string", example: "React Hooks 입문" },
                    level: { type: "string", enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
                    length: { type: "string", enum: ["short", "medium", "long"], default: "medium" },
                    course_category: { type: "string", enum: ["certification", "professional", "language", "hobby", "academic"], default: "certification" },
                    model: { type: "string", default: "claude-sonnet-4-5" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "작업 생성됨", content: { "application/json": { schema: { $ref: "#/components/schemas/StudioJob" } } } },
            "400": { description: "잘못된 요청", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "인증 실패" },
            "429": { description: "Rate limit 또는 월 비용 한도 초과" },
          },
        },
      },
      "/studio/jobs/{id}": {
        get: {
          summary: "Studio 작업 상태 조회",
          security: [{ bearerAuth: [] }],
          "x-scope-required": "studio:read",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": { description: "작업 정보", content: { "application/json": { schema: { $ref: "#/components/schemas/StudioJob" } } } },
            "404": { description: "작업 없음" },
          },
        },
      },
      "/tutor/ask": {
        post: {
          summary: "Tutor 단발 질문",
          security: [{ bearerAuth: [] }],
          "x-scope-required": "tutor:write",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string", example: "useEffect와 useLayoutEffect 차이가 뭔가요?" },
                    course_topic: { type: "string", description: "학습 주제 (응답 정합성 향상)" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tutor 응답",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      answer: { type: "string" },
                      usage: {
                        type: "object",
                        properties: {
                          input_tokens: { type: "integer" },
                          output_tokens: { type: "integer" },
                          cost_usd: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/analytics": {
        get: {
          summary: "본인 테넌트 누적 통계",
          security: [{ bearerAuth: [] }],
          "x-scope-required": "analytics:read",
          parameters: [{ name: "days", in: "query", schema: { type: "integer", default: 30, minimum: 1, maximum: 365 } }],
          responses: {
            "200": {
              description: "KPI",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      period_days: { type: "integer" },
                      students: { type: "integer" },
                      instructors: { type: "integer" },
                      studio_jobs: { type: "integer" },
                      studio_jobs_completed: { type: "integer" },
                      cast_jobs: { type: "integer" },
                      tutor_conversations: { type: "integer" },
                      total_cost_usd: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
