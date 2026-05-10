"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  StudioJobResult,
  type AgentLogEntry,
  type CuratorOutput,
  type PlannerOutput,
} from "@/components/StudioJobResult";

type Level = "beginner" | "intermediate" | "advanced";
type Length = "short" | "medium" | "long";
type ModelId = "claude-sonnet-4-5" | "claude-opus-4-7";
type JobStatus = "pending" | "running" | "completed" | "failed";

type StudioJob = {
  id: string;
  status: JobStatus;
  agent_logs: AgentLogEntry[];
  content: { curator: CuratorOutput; planner: PlannerOutput } | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  error: string | null;
  topic: string;
  level: Level;
  length: Length;
  model: ModelId;
  created_at: string;
};

const MODEL_OPTIONS: { id: ModelId; label: string; desc: string; badge?: string }[] = [
  {
    id: "claude-sonnet-4-5",
    label: "Sonnet 4.5",
    desc: "기본 · 빠름 · $3/M",
  },
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    desc: "고품질 · 느림 · $15/M (5×)",
    badge: "고품질",
  },
];

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const AGENT_PIPELINE = [
  { id: "studio-01", name: "종합 분석", role: "학습 목표 트리", stage: 1 },
  { id: "studio-02", name: "환경 조사", role: "트렌드·키워드", stage: 2, parallel: true },
  { id: "studio-03", name: "주제 조사", role: "지식 풀", stage: 2, parallel: true },
  { id: "studio-04", name: "개요 작성", role: "챕터·섹션 구조", stage: 3 },
  { id: "studio-06", name: "핵심 자료 큐레이터", role: "본문 작성", stage: 4 },
  { id: "studio-07", name: "시각 디자인 기획", role: "슬라이드 재구조화", stage: 5 },
];

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [length, setLength] = useState<Length>("short");
  const [model, setModel] = useState<ModelId>("claude-sonnet-4-5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling — 1초 간격으로 진행 상황 조회
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/studio/jobs/${job.id}`, { cache: "no-store" });
        if (res.ok) {
          const updated = (await res.json()) as StudioJob;
          setJob(updated);
        }
      } catch {
        // 일시적 네트워크 오류 — 다음 polling tick에서 재시도
      }
    }, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job]);

  const inProgress =
    job !== null && job.status !== "completed" && job.status !== "failed";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setJob(null);

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, length, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 일일 한도 도달은 별도 메시지로 노출
        if (res.status === 429 && data?.error === "daily_limit_reached") {
          throw new Error(
            data.message ??
              `일일 한도 도달: $${data.used_usd?.toFixed(4)} / $${data.limit_usd}`,
          );
        }
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      // 즉시 jobId 받음 — polling 시작
      setJob({
        id: data.jobId,
        status: "pending",
        agent_logs: [],
        content: null,
        cost_usd: null,
        duration_seconds: null,
        error: null,
        topic,
        level,
        length,
        model,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Studio · Multi-Agent Chain
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          콘텐츠 생성
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          2개 에이전트(핵심 자료 큐레이터 → 시각 디자인 기획)가 순차 협업합니다.
        </p>
      </div>

      {/* ═══ Form ═══ */}
      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label
                htmlFor="topic"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                주제
              </label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 조리기능사 자격증 - 칼 다루는 기본기"
                required
                disabled={submitting || inProgress}
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                수준
              </label>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled={submitting || inProgress}
                    onClick={() => setLevel(l)}
                    className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                      level === l
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent text-foreground hover:bg-card"
                    } disabled:opacity-50`}
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                길이
              </label>
              <div className="flex gap-2">
                {(["short", "medium", "long"] as Length[]).map((len) => {
                  const active = length === len;
                  const disabled = len !== "short";
                  return (
                    <button
                      key={len}
                      type="button"
                      disabled={submitting || disabled || inProgress}
                      onClick={() => setLength(len)}
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-transparent text-foreground hover:bg-card"
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      {len === "short"
                        ? "짧음"
                        : len === "medium"
                          ? "보통 (예정)"
                          : "김 (예정)"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                모델
              </label>
              <div className="flex gap-2">
                {MODEL_OPTIONS.map((opt) => {
                  const active = model === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting || inProgress}
                      onClick={() => setModel(opt.id)}
                      className={`flex flex-1 flex-col items-start rounded-md border px-4 py-2.5 text-left transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-transparent text-foreground hover:bg-card"
                      } disabled:opacity-50`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {opt.label}
                        {opt.badge && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
                              active
                                ? "bg-background/20 text-background"
                                : "bg-foreground/10 text-muted-foreground"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-0.5 font-mono text-[11px] ${active ? "text-background/70" : "text-muted-foreground"}`}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              {model === "claude-opus-4-7" && (
                <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  Opus는 Sonnet 대비 약 5배 비용이 발생합니다. 체인 1회 예상 비용: $0.50~$1.50
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !topic.trim() || inProgress}
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {submitting
                ? "작업 접수 중..."
                : inProgress
                  ? "에이전트 작업 중..."
                  : "생성하기"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ═══ Pipeline 진행 상태 ═══ */}
      {job && (
        <div className="mt-6 rounded-lg border border-border/60 bg-card/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Pipeline
              </p>
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {MODEL_OPTIONS.find((m) => m.id === job.model)?.label ?? job.model}
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                job.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : job.status === "failed"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-foreground/10 text-foreground"
              }`}
            >
              {job.status === "pending" && "✓ 작업 접수됨"}
              {job.status === "running" && "⏳ 실행 중"}
              {job.status === "completed" && "✅ 완료"}
              {job.status === "failed" && "❌ 실패"}
            </span>
          </div>

          <ol className="space-y-3">
            {AGENT_PIPELINE.map((agent, i) => {
              const log = job.agent_logs.find((l) => l.agent_id === agent.id);
              const done = log?.status === "completed";
              const failed = log?.status === "failed";
              // 모든 *이전 stage* 에이전트가 완료되었으면 이 에이전트는 실행 가능
              const prevStageDone = AGENT_PIPELINE.filter(
                (a) => a.stage < agent.stage,
              ).every(
                (a) =>
                  job.agent_logs.find((l) => l.agent_id === a.id)?.status ===
                  "completed",
              );
              const running = !log && job.status === "running" && prevStageDone;
              return (
                <li key={agent.id} className="flex items-start gap-3 text-sm">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-mono ${
                      done
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : failed
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : running
                            ? "animate-pulse border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : failed ? "✗" : i + 1}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`flex items-center gap-2 font-medium ${
                        done || running ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        #{agent.id}
                      </span>
                      <span>{agent.name}</span>
                      {agent.parallel && (
                        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                          병렬
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/70">{agent.role}</p>
                    {log?.duration_ms != null && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground/60">
                        {(log.duration_ms / 1000).toFixed(1)}s ·{" "}
                        {log.tokens_in.toLocaleString()} in /{" "}
                        {log.tokens_out.toLocaleString()} out · $
                        {log.cost_usd.toFixed(4)}
                      </p>
                    )}
                    {failed && log?.error && (
                      <p className="mt-1 text-xs text-red-300">{log.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {job.error && (
            <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {job.error}
            </p>
          )}
        </div>
      )}

      {/* ═══ 결과 (공유 컴포넌트) ═══ */}
      {job?.status === "completed" && job.content && (
        <div className="mt-10">
          <StudioJobResult
            content={job.content}
            agentLogs={job.agent_logs}
            meta={{
              durationSeconds: job.duration_seconds,
              costUsd: job.cost_usd,
              jobId: job.id,
            }}
          />
        </div>
      )}
    </div>
  );
}
