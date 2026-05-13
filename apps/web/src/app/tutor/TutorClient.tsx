"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TutorProgress } from "@/components/TutorProgress";

type CourseOption = {
  id: string;
  topic: string;
  level: string;
  is_indexed: boolean;
};

type Source = {
  index: number;
  similarity: number;
  source_type: string;
  preview: string;
};

type AssistantMessage = {
  role: "assistant";
  content: string;
  verdict: "approved" | "rejected" | "needs_revision";
  confidence_score: number;
  block_reason?: string | null;
  sources: Source[];
  cost_usd: number;
  // v1 추가 메타
  intent?: string;
  complexity?: string;
  detected_language?: string;
  response_language?: string;
  suggested_next_step?: string | null;
  duration_ms?: number;
};

type UserMessage = {
  role: "user";
  content: string;
};

type ChatMessage = UserMessage | AssistantMessage;

export function TutorClient({ courseOptions }: { courseOptions: CourseOption[] }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    courseOptions.find((c) => c.is_indexed)?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedCourse = courseOptions.find((c) => c.id === selectedJobId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleEvaluate() {
    if (!conversationId) {
      setError("4번 이상 대화 후 평가 가능합니다");
      return;
    }
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ?? data?.error ?? `HTTP ${res.status}`);
      // /dashboard/learning으로 이동
      window.location.href = "/dashboard/learning";
    } catch (err) {
      setError(err instanceof Error ? err.message : "평가 실패");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleIndex() {
    if (!selectedJobId) return;
    setIndexing(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio_job_id: selectedJobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail ?? data?.error ?? `HTTP ${res.status}`);
      // 페이지 새로고침으로 is_indexed 상태 반영
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIndexing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJobId || !input.trim() || sending) return;
    if (!selectedCourse?.is_indexed) {
      setError("선택한 과정이 아직 인덱싱되지 않았습니다. 먼저 '인덱싱' 버튼을 클릭하세요.");
      return;
    }

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          studio_job_id: selectedJobId,
          // null 대신 undefined 명시 (Zod .optional() 호환)
          ...(conversationId ? { conversation_id: conversationId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(data?.issues)
          ? data.issues.map((i: { message: string; path?: string[] }) =>
              `${i.path?.join(".") ?? ""}: ${i.message}`,
            ).join(", ")
          : null;
        throw new Error(data?.detail ?? issues ?? data?.message ?? data?.error ?? `HTTP ${res.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          verdict: data.verdict,
          confidence_score: data.confidence_score,
          block_reason: data.block_reason,
          sources: data.sources ?? [],
          cost_usd: data.cost_usd ?? 0,
          intent: data.intent,
          complexity: data.complexity,
          detected_language: data.detected_language,
          response_language: data.response_language,
          suggested_next_step: data.suggested_next_step,
          duration_ms: data.duration_ms,
        },
      ]);
      if (data.conversation_id) setConversationId(data.conversation_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "응답 실패");
      // 사용자 메시지는 유지하되 에러 표시
    } finally {
      setSending(false);
    }
  }

  if (courseOptions.length === 0) {
    return (
      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          학습 가능한 과정이 없습니다.{" "}
          <a href="/studio" className="text-foreground underline">
            /studio
          </a>{" "}
          에서 교재를 먼저 생성해주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* 과정 선택 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            1 · 학습 과정 선택
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {courseOptions.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                selectedJobId === c.id
                  ? "border-foreground bg-foreground/5"
                  : "border-border bg-transparent hover:bg-card"
              }`}
            >
              <input
                type="radio"
                name="course"
                checked={selectedJobId === c.id}
                onChange={() => {
                  setSelectedJobId(c.id);
                  setMessages([]);
                  setConversationId(null);
                }}
                className="h-4 w-4 accent-foreground"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{c.topic}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {c.level}
                </p>
              </div>
              {c.is_indexed ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  ✓ 인덱싱됨
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  인덱싱 필요
                </span>
              )}
            </label>
          ))}

          {selectedCourse && !selectedCourse.is_indexed && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-2 text-xs text-amber-300">
                이 과정은 아직 RAG 인덱싱되지 않았습니다. 질문 답변 전 인덱싱 필요 (~30~60초, ~$0.01).
              </p>
              <Button
                type="button"
                onClick={handleIndex}
                disabled={indexing}
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                {indexing ? "인덱싱 중..." : "지금 인덱싱하기"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 채팅 */}
      {selectedCourse && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              2 · {selectedCourse.topic.replace(/^\[샘플\]\s/, "")} · 질문하기
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 메시지 히스토리 */}
            <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  교재 내용에 대해 질문해보세요. AI 튜터가 근거를 들어 답변합니다.
                </p>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {sending && <TutorProgress />}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 */}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending || !selectedCourse.is_indexed}
                placeholder={
                  selectedCourse.is_indexed
                    ? "교재 내용에 대해 질문하세요..."
                    : "먼저 인덱싱이 필요합니다"
                }
                maxLength={500}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={sending || !input.trim() || !selectedCourse.is_indexed}
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                {sending ? "..." : "전송"}
              </Button>
            </form>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                {error}
              </p>
            )}

            {/* 이해도 평가 버튼 (대화 4턴 이상일 때) */}
            {conversationId && messages.length >= 4 && (
              <div className="border-t border-border/40 pt-3">
                <Button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  size="sm"
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  {evaluating
                    ? "이해도 평가 중... (~10초)"
                    : "📊 이해도 평가 + 학습 권장 받기 (~$0.03)"}
                </Button>
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  #05 ComprehensionEvaluator + #06 RecommendationEngine 실행 →
                  결과는 <a href="/dashboard/learning" className="underline">/dashboard/learning</a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-md bg-foreground px-3 py-2 text-sm text-background">
          {message.content}
        </div>
      </div>
    );
  }

  const isRejected = message.verdict === "rejected";
  const isRevision = message.verdict === "needs_revision";

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className={`max-w-[85%] rounded-md border px-3 py-2.5 text-sm ${
          isRejected
            ? "border-red-500/30 bg-red-500/10 text-red-200"
            : isRevision
              ? "border-amber-500/30 bg-amber-500/10 text-foreground"
              : "border-border bg-background/40 text-foreground"
        }`}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-widest">
          <span
            className={
              isRejected
                ? "text-red-300"
                : isRevision
                  ? "text-amber-300"
                  : "text-emerald-300"
            }
          >
            AI 튜터 ·{" "}
            {isRejected ? "차단됨" : isRevision ? "수정됨" : "승인"}
          </span>
          <span className="font-mono text-muted-foreground">
            신뢰도 {message.confidence_score}/100
          </span>
          {message.intent && (
            <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-muted-foreground">
              {message.intent}
            </span>
          )}
          {message.detected_language && message.detected_language !== "ko" && (
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
              {message.detected_language} → {message.response_language}
            </span>
          )}
          {message.duration_ms != null && (
            <span className="font-mono text-muted-foreground/60">
              {(message.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.suggested_next_step && !isRejected && (
          <p className="mt-2 border-t border-border/30 pt-2 text-[11px] italic text-muted-foreground">
            💡 다음 단계: {message.suggested_next_step}
          </p>
        )}
      </div>

      {/* 영상으로 받기 (Tutor → Cast Mode B 트리거) */}
      {!isRejected && message.content.length > 50 && (
        <a
          href={`/cast/ask?q=${encodeURIComponent(message.content.slice(0, 400))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-500/20"
        >
          🎬 이 답변을 영상으로 받기 (~$0.50, 3분)
        </a>
      )}

      {/* 출처 */}
      {message.sources.length > 0 && !isRejected && (
        <details className="ml-2 max-w-[85%] text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            📚 출처 {message.sources.length}건 (RAG 검색)
          </summary>
          <div className="mt-2 space-y-1.5">
            {message.sources.map((s) => (
              <div
                key={s.index}
                className="rounded-md border border-border/40 bg-background/40 p-2"
              >
                <p className="mb-1 font-mono text-[9px] text-muted-foreground">
                  [{s.index}] {s.source_type} · 유사도 {s.similarity.toFixed(2)}
                </p>
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  {s.preview}…
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="ml-2 font-mono text-[9px] text-muted-foreground/60">
        비용 ${message.cost_usd.toFixed(4)}
      </p>
    </div>
  );
}
