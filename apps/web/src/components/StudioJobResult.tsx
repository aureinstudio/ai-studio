"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AgentLogEntry = {
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

export type CuratorOutput = {
  chapter_title: string;
  learning_objectives: string[];
  main_content: { section: string; paragraphs: string[] }[];
  examples: { title: string; type: string; body: string }[];
};

export type SlideMeta = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

export type PlannerOutput = { slides: SlideMeta[] };

export type StudioJobResultProps = {
  content: { curator: CuratorOutput; planner: PlannerOutput };
  agentLogs: AgentLogEntry[];
  meta: {
    durationSeconds: number | null;
    costUsd: number | null;
    jobId: string | null;
  };
};

type ResultTab = "content" | "slides" | "logs";

/**
 * Studio job 결과 렌더링 — /studio (라이브)와 /dashboard/history/[id] (과거) 양쪽에서 재사용.
 * 3탭: 본문 (Curator) · 슬라이드 (Planner) · 에이전트 로그 (timeline)
 */
export function StudioJobResult({ content, agentLogs, meta }: StudioJobResultProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("content");

  return (
    <div className="space-y-5">
      {/* 메타 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          ⚡{" "}
          <span className="font-mono tabular-nums text-foreground">
            {meta.durationSeconds?.toFixed(1) ?? "-"}s
          </span>
        </span>
        <span>
          💵{" "}
          <span className="font-mono tabular-nums text-foreground">
            ${meta.costUsd?.toFixed(4) ?? "-"}
          </span>
        </span>
        {meta.jobId && (
          <span className="font-mono text-muted-foreground/60">
            job: {meta.jobId.slice(0, 8)}…
          </span>
        )}
      </div>

      {/* 탭 헤더 */}
      <div className="flex gap-1 border-b border-border/60">
        {(["content", "slides", "logs"] as ResultTab[]).map((t) => {
          const label =
            t === "content"
              ? "본문"
              : t === "slides"
                ? `슬라이드 (${content.planner.slides.length})`
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

      {/* 본문 탭 */}
      {activeTab === "content" && (
        <div className="space-y-5">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                챕터 제목
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                {content.curator.chapter_title}
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
                {content.curator.learning_objectives.map((obj, i) => (
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

          {content.curator.main_content.map((section, i) => (
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

          {content.curator.examples.map((ex, i) => (
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

      {/* 슬라이드 탭 */}
      {activeTab === "slides" && (
        <div className="space-y-4">
          {content.planner.slides.map((slide) => (
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

      {/* 에이전트 로그 탭 (타임라인) */}
      {activeTab === "logs" && (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-6">
            <div className="space-y-6">
              {agentLogs.map((log, i) => {
                const startTime = new Date(log.started_at);
                const endTime = new Date(log.completed_at);
                return (
                  <div key={i} className="relative pl-8">
                    {i < agentLogs.length - 1 && (
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
            {agentLogs.length > 1 && (
              <div className="mt-6 border-t border-border/40 pt-4">
                <p className="font-mono text-xs text-muted-foreground">
                  total:{" "}
                  <span className="text-foreground">
                    {meta.durationSeconds?.toFixed(2)}s
                  </span>{" "}
                  ·{" "}
                  <span className="text-foreground">${meta.costUsd?.toFixed(4)}</span>{" "}
                  · {agentLogs.length} agents
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
