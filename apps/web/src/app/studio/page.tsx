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
import { AgentCollaborationView } from "@/components/AgentCollaborationView";

type Level = "beginner" | "intermediate" | "advanced";
type Length = "short" | "medium" | "long";
type ModelId = "claude-sonnet-4-5" | "claude-opus-4-7" | "claude-haiku-4-5";
type JobStatus = "pending" | "running" | "completed" | "failed";

type ExecutionPlan = {
  skipped_agents: string[];
  skip_reasons: Record<string, string>;
  estimated_total_time_seconds: number;
  estimated_total_cost_usd: number;
  routing_notes: string;
};

type StudioJob = {
  id: string;
  status: JobStatus;
  agent_logs: AgentLogEntry[];
  content: {
    curator: CuratorOutput;
    planner: PlannerOutput;
    plan?: ExecutionPlan;
  } | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  error: string | null;
  topic: string;
  level: Level;
  length: Length;
  model: ModelId;
  created_at: string;
};

type ModelOption = {
  id: ModelId;
  label: string;
  estTime: string;
  estCost: string;
  note: string;
  badge?: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    estTime: "~80~120초",
    estCost: "$0.06~0.12",
    note: "빠름 · 시연 적합 · 품질 일부 양보",
    badge: "빠름",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Sonnet 4.5",
    estTime: "~200~280초",
    estCost: "$0.30~0.50",
    note: "기본 · 품질·속도 균형",
    badge: "기본",
  },
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    estTime: "~300~400초",
    estCost: "$1.50~2.00",
    note: "고품질 · 느림 · Sonnet 5×",
    badge: "고품질",
  },
];

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const AGENT_PIPELINE = [
  { id: "studio-09", name: "오케스트레이터", role: "실행 계획 수립", stage: 0, team: "T3" },
  { id: "studio-01", name: "종합 분석", role: "학습 목표 트리", stage: 1, team: "T1" },
  { id: "studio-02", name: "환경 조사", role: "트렌드·키워드", stage: 2, parallel: true, team: "T1" },
  { id: "studio-03", name: "주제 조사", role: "지식 풀", stage: 2, parallel: true, team: "T1" },
  { id: "studio-04", name: "개요 작성", role: "챕터·섹션 구조", stage: 3, team: "T1" },
  { id: "studio-05", name: "학습프로세스 큐레이터", role: "학습 흐름·난이도 조정", stage: 4, team: "T2" },
  { id: "studio-06", name: "핵심 자료 큐레이터", role: "본문 작성", stage: 5, team: "T2" },
  { id: "studio-07", name: "시각 디자인 기획", role: "슬라이드 재구조화", stage: 6, team: "T2" },
  { id: "studio-08", name: "인포그래픽 디자이너", role: "도표·인포그래픽 명세", stage: 7, team: "T2" },
  { id: "studio-10", name: "검토", role: "내용 정확성·일관성 검증", stage: 8, parallel: true, team: "T4" },
  { id: "studio-11", name: "형식 확인", role: "구조·표준 준수 검증", stage: 8, parallel: true, team: "T4" },
  { id: "studio-12", name: "종합 검토", role: "학습 목표 부합도 평가", stage: 9, team: "T4" },
  { id: "studio-13", name: "최종 품질 최적화", role: "가독성·완성도 마감", stage: 10, team: "T4" },
];

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [length, setLength] = useState<Length>("short");
  const [model, setModel] = useState<ModelId>("claude-sonnet-4-5");
  const [courseCategory, setCourseCategory] = useState<
    "certification" | "professional" | "language" | "hobby" | "academic"
  >("certification");
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
        body: JSON.stringify({ topic, level, length, model, course_category: courseCategory }),
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
      {/* 강사 안내 배너 — 본인 자료가 있다면 Studio Pro로 */}
      <a
        href="/studio-pro"
        className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 text-sm transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
      >
        <div>
          <span className="font-semibold text-amber-900 dark:text-amber-200">⭐ 강사이신가요?</span>
          <span className="ml-2 text-amber-800 dark:text-amber-300">
            본인 강의 자료가 있으면 <b>Studio Pro</b>에서 AI 보강 + 본인 얼굴·목소리로 영상까지.
          </span>
        </div>
        <span className="shrink-0 text-xs font-semibold text-amber-900 dark:text-amber-200">바로가기 →</span>
      </a>

      <div className="mb-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Studio · Multi-Agent Chain
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          콘텐츠 생성
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          12개 에이전트(TEAM 1 기획 → TEAM 2 제작 → TEAM 4 품질검증)가 순차 협업합니다.
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
                과정 카테고리
              </label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  { v: "certification", l: "자격증", e: "조리, IT 등" },
                  { v: "professional", l: "직무", e: "포토샵, 엑셀" },
                  { v: "language", l: "언어", e: "토익, 일본어" },
                  { v: "hobby", l: "취미", e: "요리, 사진" },
                  { v: "academic", l: "학술", e: "수능, 고등" },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    disabled={submitting || inProgress}
                    onClick={() => setCourseCategory(c.v as typeof courseCategory)}
                    className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors ${
                      courseCategory === c.v
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent text-foreground hover:bg-card"
                    } disabled:opacity-50`}
                  >
                    <span className="text-sm font-medium">{c.l}</span>
                    <span className={`text-[10px] ${courseCategory === c.v ? "text-background/70" : "text-muted-foreground"}`}>
                      {c.e}
                    </span>
                  </button>
                ))}
              </div>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {MODEL_OPTIONS.map((opt) => {
                  const active = model === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting || inProgress}
                      onClick={() => setModel(opt.id)}
                      className={`flex flex-col items-start rounded-md border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-transparent text-foreground hover:bg-card"
                      } disabled:opacity-50`}
                    >
                      <span className="flex w-full items-center justify-between gap-1.5">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
                              active
                                ? "bg-background/20 text-background"
                                : opt.id === "claude-haiku-4-5"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : opt.id === "claude-opus-4-7"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-foreground/10 text-muted-foreground"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </span>
                      <span
                        className={`mt-2 flex items-center gap-1 font-mono text-[11px] ${active ? "text-background/80" : "text-foreground/80"}`}
                      >
                        ⏱ {opt.estTime}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-mono text-[11px] ${active ? "text-background/80" : "text-foreground/80"}`}
                      >
                        💵 {opt.estCost}
                      </span>
                      <span
                        className={`mt-1.5 text-[10px] leading-tight ${active ? "text-background/60" : "text-muted-foreground"}`}
                      >
                        {opt.note}
                      </span>
                    </button>
                  );
                })}
              </div>
              {model === "claude-opus-4-7" && (
                <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  Opus는 Sonnet 대비 약 5배 비용 + 더 긴 시간. Vercel Hobby 60초 한도 시 timeout 위험.
                </p>
              )}
              {model === "claude-haiku-4-5" && (
                <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  Haiku는 가장 빠르고 저렴 — 시연·반복 테스트 적합. 콘텐츠 품질은 Sonnet 대비 다소 떨어질 수 있습니다.
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

          {/* 실행 계획 요약 (#09 완료 후) */}
          {job.content?.plan && (
            <div className="mb-4 rounded-md border border-border/40 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">실행 계획</span>
              {" · "}
              <span className="font-mono">
                예상 ${job.content.plan.estimated_total_cost_usd.toFixed(2)} / {job.content.plan.estimated_total_time_seconds}초
              </span>
              {job.content.plan.skipped_agents.length > 0 && (
                <span className="ml-2 text-amber-300/80">
                  스킵: {job.content.plan.skipped_agents.map((a) => a.replace("studio-", "#")).join(", ")}
                </span>
              )}
              {job.content.plan.routing_notes && (
                <p className="mt-0.5 text-muted-foreground/60 italic">{job.content.plan.routing_notes}</p>
              )}
            </div>
          )}

          <ol className="space-y-3">
            {AGENT_PIPELINE.map((agent, i) => {
              const log = job.agent_logs.find((l) => l.agent_id === agent.id);
              const done = log?.status === "completed";
              const failed = log?.status === "failed";
              const skipped = log?.status === "skipped";
              const started = log?.status === "started";
              const prevStageDone = AGENT_PIPELINE.filter(
                (a) => a.stage < agent.stage,
              ).every(
                (a) => {
                  const aLog = job.agent_logs.find((l) => l.agent_id === a.id);
                  return aLog?.status === "completed" || aLog?.status === "skipped";
                },
              );
              const running = started || (!log && job.status === "running" && prevStageDone);
              return (
                <li key={agent.id} className={`flex items-start gap-3 text-sm ${skipped ? "opacity-40" : ""}`}>
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-mono ${
                      done
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : failed
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : skipped
                            ? "border-border/40 text-muted-foreground/40"
                            : running
                              ? "animate-pulse border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : failed ? "✗" : skipped ? "–" : i + 1}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`flex items-center gap-2 font-medium ${
                        done || running ? "text-foreground" : skipped ? "text-muted-foreground/40 line-through" : "text-muted-foreground"
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
                      {skipped && (
                        <span className="rounded-full bg-muted-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60">
                          스킵
                        </span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
                        agent.team === "T1" ? "bg-blue-500/10 text-blue-400" :
                        agent.team === "T2" ? "bg-violet-500/10 text-violet-400" :
                        agent.team === "T3" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-amber-500/10 text-amber-400"
                      }`}>
                        {agent.team}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground/70">{agent.role}</p>
                    {started && (
                      <p className="mt-1 font-mono text-xs text-foreground/70">
                        ⏳ 생성 중… {log!.tokens_out > 0 ? `~${log!.tokens_out.toLocaleString()} tokens` : "응답 대기"}
                      </p>
                    )}
                    {done && log?.duration_ms != null && (
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

          {/* 협업 시각화 */}
          <div className="mt-4 border-t border-border/40 pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              에이전트 협업 현황
            </p>
            <AgentCollaborationView
              agentLogs={job.agent_logs}
              skippedAgents={job.content?.plan?.skipped_agents ?? []}
              jobStatus={job.status}
            />
          </div>

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
