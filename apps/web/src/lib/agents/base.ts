import { anthropic, MODEL, MAX_TOKENS, DEFAULT_TEMPERATURE } from "@/lib/anthropic/client";
import { calculateClaudeCost } from "@/lib/cost-tracker";

/**
 * 에이전트 1회 실행 결과 (비용·로그 포함).
 */
export type AgentExecution<TOutput> = {
  output: TOutput;
  log: AgentLog;
};

/**
 * agent_logs jsonb 컬럼에 누적되는 단일 entry.
 * UI 타임라인·관측성 모두에서 동일 형식 사용.
 */
export type AgentLog = {
  agent_id: string;
  agent_name: string;
  status: "started" | "completed" | "failed" | "skipped";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  error?: string;
};

/**
 * 에이전트 추상 베이스 클래스.
 *
 * 하위 클래스는:
 *   1. id·name·systemPrompt 정의
 *   2. parseOutput(rawText) 구현 — Claude 응답 텍스트를 도메인 타입으로 변환
 *
 * 공통 책임 (베이스 처리):
 *   - Claude API 호출 + retry
 *   - 마크다운 fence 제거
 *   - 비용·시간·토큰 계측
 *   - AgentLog 생성
 */
export abstract class Agent<TInput, TOutput> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly role: string;

  constructor(private readonly modelOverride?: string) {}

  protected abstract buildSystemPrompt(input: TInput): string;
  protected abstract buildUserMessage(input: TInput): string;
  protected abstract parseOutput(rawText: string): TOutput;

  /** 런타임 주입 모델 → 없으면 기본값 */
  protected get model(): string {
    return this.modelOverride ?? MODEL;
  }

  /** max_tokens override 포인트 */
  protected get maxTokens(): number {
    return MAX_TOKENS;
  }

  /** temperature override 포인트 */
  protected get temperature(): number {
    return DEFAULT_TEMPERATURE;
  }

  async execute(
    input: TInput,
    options?: { onProgress?: (tokensOut: number) => void | Promise<void> },
  ): Promise<AgentExecution<TOutput>> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    let response;
    try {
      // 스트리밍 — 진행 상황을 onProgress로 노출 (UI 실시간 토큰 카운트)
      const stream = anthropic.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: [
          {
            type: "text" as const,
            text: this.buildSystemPrompt(input),
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: this.buildUserMessage(input) }],
      });

      let charsSoFar = 0;
      let lastProgressMs = 0;
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          charsSoFar += event.delta.text.length;
          if (options?.onProgress) {
            const now = Date.now();
            if (now - lastProgressMs > 1500) {
              // 한국어 평균 ~3자/토큰 근사. 정확한 값은 finalMessage에서.
              await options.onProgress(Math.floor(charsSoFar / 3));
              lastProgressMs = now;
            }
          }
        }
      }
      response = await stream.finalMessage();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const completedAt = new Date().toISOString();
      const log: AgentLog = {
        agent_id: this.id,
        agent_name: this.name,
        status: "failed",
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: Date.now() - startMs,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        error: message,
      };
      throw new AgentError(this.id, message, log);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new AgentError(this.id, "No text block in Claude response");
    }

    // max_tokens 한도 도달 → JSON 잘림 경고
    if (response.stop_reason === "max_tokens") {
      console.warn(
        `[${this.id}] stop_reason=max_tokens reached — output likely truncated (` +
          `${response.usage.output_tokens} tokens). Consider raising MAX_TOKENS.`,
      );
    }

    let output: TOutput;
    try {
      output = this.parseOutput(textBlock.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 디버깅용 raw 본문 로깅 (앞 800자만 — 전체는 너무 길어)
      console.error(
        `[${this.id}] parse failed. stop_reason=${response.stop_reason}, ` +
          `tokens_out=${response.usage.output_tokens}. Raw start:\n` +
          textBlock.text.slice(0, 800),
      );
      console.error(`[${this.id}] Raw end:\n` + textBlock.text.slice(-400));
      throw new AgentError(
        this.id,
        `Output parse failed (stop_reason=${response.stop_reason}): ${message}`,
      );
    }

    const completedAt = new Date().toISOString();
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = calculateClaudeCost(this.model, tokensIn, tokensOut);

    const log: AgentLog = {
      agent_id: this.id,
      agent_name: this.name,
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startMs,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
    };

    return { output, log };
  }
}

/** 에이전트 실행 실패 — 오케스트레이터가 catch하여 agent_logs에 failed 기록 */
export class AgentError extends Error {
  constructor(
    public readonly agentId: string,
    message: string,
    public readonly partialLog?: AgentLog,
  ) {
    super(`[${agentId}] ${message}`);
    this.name = "AgentError";
  }
}

/**
 * Claude 응답에서 JSON 객체를 견고하게 추출 + 파싱.
 *
 * 처리하는 케이스:
 * - 마크다운 fence (```json ... ```)
 * - JSON 앞·뒤의 설명 텍스트 ("다음 결과입니다: {...}", "{...}\n\n위 JSON은...")
 * - 중첩된 { } 도 정확히 매칭 (depth counting)
 */
export function parseJsonSafely<T>(rawText: string): T {
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\s*\n?/, "");
  text = text.replace(/\n?```\s*$/, "");
  text = text.trim();

  // depth counting으로 첫 객체의 시작·끝 추출
  const start = text.indexOf("{");
  if (start < 0) return JSON.parse(text) as T;

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text) as T;
}
