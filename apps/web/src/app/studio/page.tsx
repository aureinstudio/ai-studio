"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Level = "beginner" | "intermediate" | "advanced";
type Length = "short" | "medium" | "long";
type JobStatus = "pending" | "running" | "completed" | "failed";

type AgentLog = {
  agent_id: string;
  agent_name: string;
  status: "started" | "completed" | "failed";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  error?: string;
};

type CuratorOutput = {
  chapter_title: string;
  learning_objectives: string[];
  main_content: { section: string; paragraphs: string[] }[];
  examples: { title: string; type: string; body: string }[];
};

type SlideMeta = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

type PlannerOutput = { slides: SlideMeta[] };

type StudioJob = {
  id: string;
  status: JobStatus;
  agent_logs: AgentLog[];
  content: { curator: CuratorOutput; planner: PlannerOutput } | null;
  cost_usd: number | null;
  duration_seconds: number | null;
  error: string | null;
  topic: string;
  level: Level;
  length: Length;
  created_at: string;
};

const LEVEL_LABEL: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const AGENT_PIPELINE = [
  { id: "studio-06", name: "핵심 자료 큐레이터", role: "본문 작성" },
  { id: "studio-07", name: "시각 디자인 기획", role: "슬라이드 재구조화" },
];

type ResultTab = "content" | "slides" | "logs";

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [length, setLength] = useState<Length>("short");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<StudioJob | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("content");
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

  const inProgress = job !== null && job.status !== "completed" && job.status !== "failed";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setJob(null);
    setActiveTab("content");

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      // 즉시 jobId 받음 — polling으로 진행 상태 추적 시작
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
                      {len === "short" ? "짧음" : len === "medium" ? "보통 (예정)" : "김 (예정)"}
                    </button>
                  );
                })}
              </div>
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
              {submitting ? "작업 접수 중..." : inProgress ? "에이전트 작업 중..." : "생성하기"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ═══ Pipeline 진행 상태 ═══ */}
      {job && (
        <div className="mt-6 rounded-lg border border-border/60 bg-card/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pipeline
            </p>
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
              const prevCompleted =
                i === 0 ||
                job.agent_logs.find((l) => l.agent_id === AGENT_PIPELINE[i - 1].id)?.status ===
                  "completed";
              const running = !log && job.status === "running" && prevCompleted;
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
                      className={`font-medium ${
                        done || running ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-mono text-xs text-muted-foreground">#{agent.id}</span>{" "}
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground/70">{agent.role}</p>
                    {log?.duration_ms != null && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground/60">
                        {(log.duration_ms / 1000).toFixed(1)}s ·{" "}
                        {log.tokens_in.toLocaleString()} in /{" "}
                        {log.tokens_out.toLocaleString()} out · ${log.cost_usd.toFixed(4)}
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

      {/* ═══ 결과 (탭 분리) ═══ */}
      {job?.status === "completed" && job.content && (
        <div className="mt-10 space-y-5">
          {/* 메타 */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              ⚡{" "}
              <span className="font-mono tabular-nums text-foreground">
                {job.duration_seconds?.toFixed(1) ?? "-"}s
              </span>
            </span>
            <span>
              💵{" "}
              <span className="font-mono tabular-nums text-foreground">
                ${job.cost_usd?.toFixed(4) ?? "-"}
              </span>
            </span>
            <span className="font-mono text-muted-foreground/60">
              job: {job.id.slice(0, 8)}…
            </span>
          </div>

          {/* 탭 헤더 */}
          <div className="flex gap-1 border-b border-border/60">
            {(["content", "slides", "logs"] as ResultTab[]).map((t) => {
              const label =
                t === "content"
                  ? "본문"
                  : t === "slides"
                    ? `슬라이드 (${job.content!.planner.slides.length})`
                    : "에이전트 로그";
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`-mb-px rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === t
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 탭 내용: 본문 */}
          {activeTab === "content" && (
            <div className="space-y-5">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    챕터 제목
                  </p>
                  <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                    {job.content.curator.chapter_title}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    학습 목표
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {job.content.curator.learning_objectives.map((obj, i) => (
                      <li key={i} className="flex gap-3 text-sm text-foreground">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {job.content.curator.main_content.map((section, i) => (
                <Card key={i} className="border-border/60 bg-card/80">
                  <CardHeader>
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      섹션 {i + 1}
                    </p>
                    <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
                      {section.section}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
                      {section.paragraphs.map((p, j) => (
                        <p key={j}>{p}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {job.content.curator.examples.map((ex, i) => (
                <Card key={i} className="border-border/60 bg-card/80">
                  <CardHeader>
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      예제 · {ex.type}
                    </p>
                    <CardTitle className="text-base font-semibold text-foreground">
                      {ex.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap rounded-md bg-secondary/50 p-3 font-mono text-xs text-foreground/90">
                      {ex.body}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 탭 내용: 슬라이드 */}
          {activeTab === "slides" && (
            <div className="space-y-4">
              {job.content.planner.slides.map((slide) => (
                <Card key={slide.slide_number} className="border-border/60 bg-card/80">
                  <CardHeader>
                    <p className="font-mono text-xs text-muted-foreground">
                      Slide {slide.slide_number.toString().padStart(2, "0")}
                    </p>
                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
                      {slide.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Content
                      </p>
                      <ul className="space-y-1 text-sm text-foreground/90">
                        {slide.content_blocks.map((block, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground/60">•</span>
                            <span>{block}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Visual
                      </p>
                      <p className="text-sm italic text-muted-foreground">
                        {slide.visual_suggestions}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Speaker Notes
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/80">
                        {slide.speaker_notes}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 탭 내용: 에이전트 로그 (타임라인) */}
          {activeTab === "logs" && (
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {job.agent_logs.map((log, i) => {
                    const startTime = new Date(log.started_at);
                    const endTime = new Date(log.completed_at);
                    return (
                      <div key={i} className="relative pl-8">
                        {i < job.agent_logs.length - 1 && (
                          <span className="absolute left-2.5 top-6 h-full w-px bg-border" />
                        )}
                        <span
                          className={`absolute left-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background ${
                            log.status === "completed"
                              ? "bg-emerald-400"
                              : log.status === "failed"
                                ? "bg-red-400"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{log.agent_id}
                            </span>
                            <span className="text-base font-semibold text-foreground">
                              {log.agent_name}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                                log.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : log.status === "failed"
                                    ? "bg-red-500/10 text-red-300"
                                    : "bg-muted-foreground/10 text-muted-foreground"
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground/70">
                            {startTime.toLocaleTimeString("ko-KR")} →{" "}
                            {endTime.toLocaleTimeString("ko-KR")} (
                            {(log.duration_ms / 1000).toFixed(2)}s)
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                            <span className="text-muted-foreground">
                              tokens:{" "}
                              <span className="text-foreground">
                                {log.tokens_in.toLocaleString()}
                              </span>{" "}
                              in /{" "}
                              <span className="text-foreground">
                                {log.tokens_out.toLocaleString()}
                              </span>{" "}
                              out
                            </span>
                            <span className="text-muted-foreground">
                              cost:{" "}
                              <span className="text-foreground">
                                ${log.cost_usd.toFixed(4)}
                              </span>
                            </span>
                          </div>
                          {log.error && <p className="text-xs text-red-300">{log.error}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {job.agent_logs.length > 1 && (
                  <div className="mt-6 border-t border-border/40 pt-4">
                    <p className="font-mono text-xs text-muted-foreground">
                      total:{" "}
                      <span className="text-foreground">
                        {job.duration_seconds?.toFixed(2)}s
                      </span>{" "}
                      ·{" "}
                      <span className="text-foreground">
                        ${job.cost_usd?.toFixed(4)}
                      </span>{" "}
                      · {job.agent_logs.length} agents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
