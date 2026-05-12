/**
 * 악성 입력 감지 — 프롬프트 인젝션·DoS·시스템 추출 패턴.
 *
 * Layer 1 — 규칙 기반(본 모듈): 빠른 차단(즉시 응답).
 * Layer 2 — LLM 기반(추후): 미묘한 우회 감지.
 *
 * 차단된 입력은 audit_log에 기록되어 /admin/security에서 확인.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ThreatCategory =
  | "prompt_injection"
  | "system_extraction"
  | "infinite_loop"
  | "excessive_length"
  | "binary_payload";

export type FilterResult = {
  blocked: boolean;
  threats: { category: ThreatCategory; pattern: string; severity: "low" | "medium" | "high" }[];
  sanitized: string;
};

const PROMPT_INJECTION_PATTERNS: { rx: RegExp; severity: "low" | "medium" | "high" }[] = [
  { rx: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, severity: "high" },
  { rx: /disregard\s+(all\s+)?(previous|prior|above)/i, severity: "high" },
  { rx: /\bforget\s+(everything|all)\s+(above|before)/i, severity: "high" },
  { rx: /이전(의)?\s*(지시|명령|프롬프트).{0,15}(무시|잊)/i, severity: "high" },
  { rx: /you\s+are\s+now\s+(a|an)\s+/i, severity: "medium" },
  { rx: /이제부터\s+(너|당신)는/i, severity: "medium" },
  { rx: /act\s+as\s+(if\s+you\s+were\s+)?(a|an|the)\s+\w+/i, severity: "low" },
  { rx: /<\s*\/?(system|admin|root|sudo)\s*>/i, severity: "high" },
  { rx: /\[\[\s*system\s*\]\]/i, severity: "high" },
  { rx: /---\s*end\s+of\s+(prompt|instructions)\s*---/i, severity: "high" },
];

const SYSTEM_EXTRACTION_PATTERNS: { rx: RegExp; severity: "low" | "medium" | "high" }[] = [
  { rx: /(show|print|reveal|tell\s+me)\s+(your|the)\s+(system\s+)?(prompt|instructions)/i, severity: "high" },
  { rx: /시스템\s*프롬프트(를|을)?\s*(보여|알려|출력)/i, severity: "high" },
  { rx: /what\s+(are|were)\s+your\s+(initial\s+)?instructions/i, severity: "medium" },
  { rx: /repeat\s+the\s+text\s+above/i, severity: "high" },
];

const INFINITE_LOOP_PATTERNS: { rx: RegExp; severity: "low" | "medium" | "high" }[] = [
  { rx: /repeat\s+(this|that|the\s+(following|word))\s+\d{3,}\s+times/i, severity: "high" },
  { rx: /print\s+\d{4,}\s+(copies|times)/i, severity: "high" },
  { rx: /(\b\w+\b\s+){200,}/i, severity: "medium" }, // 200+ 반복 토큰
];

const MAX_QUESTION_LEN = 4000;

export function detectThreats(input: string): FilterResult {
  const threats: FilterResult["threats"] = [];

  if (!input || typeof input !== "string") {
    return { blocked: false, threats: [], sanitized: "" };
  }

  // 길이
  if (input.length > MAX_QUESTION_LEN) {
    threats.push({
      category: "excessive_length",
      pattern: `length=${input.length}`,
      severity: "medium",
    });
  }

  // 바이너리·제어문자 (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input)) {
    threats.push({ category: "binary_payload", pattern: "control_chars", severity: "high" });
  }

  for (const { rx, severity } of PROMPT_INJECTION_PATTERNS) {
    const m = input.match(rx);
    if (m) threats.push({ category: "prompt_injection", pattern: m[0].slice(0, 80), severity });
  }
  for (const { rx, severity } of SYSTEM_EXTRACTION_PATTERNS) {
    const m = input.match(rx);
    if (m) threats.push({ category: "system_extraction", pattern: m[0].slice(0, 80), severity });
  }
  for (const { rx, severity } of INFINITE_LOOP_PATTERNS) {
    const m = input.match(rx);
    if (m) threats.push({ category: "infinite_loop", pattern: m[0].slice(0, 80), severity });
  }

  const highSeverity = threats.some((t) => t.severity === "high");
  const sanitized = input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .slice(0, MAX_QUESTION_LEN);

  return { blocked: highSeverity, threats, sanitized };
}

/**
 * audit_log 기록 — 위협 감지 시 (차단·통과 무관).
 */
export async function logThreat(
  supabase: SupabaseClient,
  params: {
    userId: string | null;
    endpoint: string;
    ip?: string | null;
    input: string;
    result: FilterResult;
  },
): Promise<void> {
  if (params.result.threats.length === 0) return;
  try {
    await supabase.from("audit_log").insert({
      user_id: params.userId,
      endpoint: params.endpoint,
      ip: params.ip ?? null,
      blocked: params.result.blocked,
      threats: params.result.threats,
      input_preview: params.input.slice(0, 500),
    });
  } catch (err) {
    console.warn("[input-filter] audit_log insert failed:", err);
  }
}

export function threatBlockResponse(result: FilterResult): Response {
  return new Response(
    JSON.stringify({
      error: "input_blocked",
      message: "입력이 보안 정책에 의해 차단되었습니다.",
      categories: [...new Set(result.threats.map((t) => t.category))],
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}
