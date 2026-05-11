"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type StudioJobOption = {
  id: string;
  topic: string;
  level: string;
  slideCount: number;
  duration_seconds: number | null;
  created_at: string;
};

type CostEstimate = {
  llm: number;
  tts: number;
  video: number;
  total: number;
  estimated_duration_sec: number;
  total_chars: number;
};

type CastJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent_logs: any[];
  cost_usd: number | null;
  duration_seconds: number | null;
  error_message: string | null;
};

export function CastClient({ studioJobs }: { studioJobs: StudioJobOption[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CastJob | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = studioJobs.find((j) => j.id === selectedId);

  // 선택 시 비용 추정 미리 받아오기 (approve_cost=false → 추정만 반환)
  useEffect(() => {
    if (!selectedId) {
      setEstimate(null);
      return;
    }
    setEstimateLoading(true);
    setEstimate(null);
    setApproved(false);
    (async () => {
      try {
        const res = await fetch("/api/cast/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studio_job_id: selectedId,
            mode: "batch",
            approve_cost: false,
          }),
        });
        const data = await res.json();
        if (data?.estimate) setEstimate(data.estimate);
        else if (data?.error) setError(data.message ?? data.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown");
      } finally {
        setEstimateLoading(false);
      }
    })();
  }, [selectedId]);

  // Polling
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
        const res = await fetch(`/api/cast/jobs/${job.id}`, { cache: "no-store" });
        if (res.ok) setJob(await res.json());
      } catch {
        // ignore
      }
    }, 1500);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job]);

  const inProgress = job !== null && job.status !== "completed" && job.status !== "failed";

  async function handleSubmit() {
    if (!selectedId || !approved) return;
    setSubmitting(true);
    setError(null);
    setJob(null);
    try {
      const res = await fetch("/api/cast/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_job_id: selectedId,
          mode: "batch",
          approve_cost: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
      setJob({
        id: data.cast_job_id,
        status: "pending",
        output: null,
        agent_logs: [],
        cost_usd: null,
        duration_seconds: null,
        error_message: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (studioJobs.length === 0) {
    return (
      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          변환할 Studio 작업이 없습니다.{" "}
          <a href="/studio" className="text-foreground underline">
            /studio
          </a>{" "}
          에서 콘텐츠를 먼저 생성해주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio 작업 선택 */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            1 · Studio 작업 선택
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {studioJobs.map((j) => (
            <label
              key={j.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                selectedId === j.id
                  ? "border-foreground bg-foreground/5"
                  : "border-border bg-transparent hover:bg-card"
              } ${inProgress ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="studio_job"
                checked={selectedId === j.id}
                onChange={() => setSelectedId(j.id)}
                disabled={inProgress}
                className="h-4 w-4 accent-foreground"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{j.topic}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  슬라이드 {j.slideCount}장 · {j.level}
                </p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* 비용 추정 */}
      {selected && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              2 · 비용 추정
            </p>
          </CardHeader>
          <CardContent>
            {estimateLoading ? (
              <p className="text-sm text-muted-foreground">계산 중...</p>
            ) : estimate ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="슬라이드" value={`${selected.slideCount}장`} />
                  <Stat label="예상 영상 길이" value={`${Math.floor(estimate.estimated_duration_sec / 60)}분 ${estimate.estimated_duration_sec % 60}초`} />
                  <Stat label="예상 글자 수" value={estimate.total_chars.toLocaleString()} />
                  <Stat label="총 예상 비용" value={`$${estimate.total.toFixed(2)}`} highlight />
                </div>

                <div className="rounded-md border border-border/40 bg-background/40 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    비용 구성
                  </p>
                  <div className="space-y-1 font-mono text-xs">
                    <Row label="LLM (TEAM 1 — 분석·스크립트)" value={`$${estimate.llm.toFixed(4)}`} active />
                    <Row label="TTS (TEAM 2 — 음성, 다음 단계)" value={`$${estimate.tts.toFixed(4)}`} muted />
                    <Row label="Avatar Video (TEAM 3 — 영상, 다음 단계)" value={`$${estimate.video.toFixed(4)}`} muted />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    이번 단계는 LLM 비용 (~${estimate.llm.toFixed(2)})만 발생합니다. 음성·영상은 다음 단계에서 별도 승인.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                    disabled={inProgress}
                    className="mt-0.5 h-4 w-4 accent-foreground"
                  />
                  <span>
                    위 비용 (LLM ${estimate.llm.toFixed(2)}) 사용을 승인합니다.
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">작업을 선택하면 비용을 계산합니다.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 실행 버튼 */}
      {selected && estimate && (
        <Button
          onClick={handleSubmit}
          disabled={!approved || submitting || inProgress}
          size="lg"
          className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
        >
          {submitting
            ? "작업 접수 중..."
            : inProgress
              ? "변환 중..."
              : approved
                ? "변환 시작"
                : "비용 승인 필요"}
        </Button>
      )}

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* 진행 상황 */}
      {job && (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                진행 상황
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
                {job.status === "pending" && "✓ 접수됨"}
                {job.status === "running" && "⏳ 실행 중"}
                {job.status === "completed" && "✅ 완료"}
                {job.status === "failed" && "❌ 실패"}
              </span>
            </div>

            <ol className="space-y-3">
              {[
                { id: "cast-01", name: "슬라이드 분석" },
                { id: "cast-02", name: "스크립트 생성" },
              ].map((agent, i) => {
                const log = job.agent_logs.find((l) => l.agent_id === agent.id);
                const done = log?.status === "completed";
                const failed = log?.status === "failed";
                const started = log?.status === "started";
                return (
                  <li key={agent.id} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                        done
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : failed
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : started
                              ? "animate-pulse border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : failed ? "✗" : i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${done || started ? "text-foreground" : "text-muted-foreground"}`}>
                        #{agent.id} {agent.name}
                      </p>
                      {started && (
                        <p className="mt-1 font-mono text-xs text-foreground/70">
                          ⏳ 생성 중… {log!.tokens_out > 0 ? `~${log!.tokens_out.toLocaleString()} tokens` : "응답 대기"}
                        </p>
                      )}
                      {done && log?.duration_ms != null && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground/60">
                          {(log.duration_ms / 1000).toFixed(1)}s · ${log.cost_usd.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {job.error_message && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {job.error_message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {job?.status === "completed" && job.output?.scripts && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              생성된 스크립트
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              총 {job.output.scripts.total_word_count?.toLocaleString() ?? 0} 단어 ·
              {" "}예상 발화 길이 {Math.floor((job.output.analysis?.total_estimated_duration ?? 0) / 60)}분
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(job.output.scripts.scripts ?? []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: any) => (
                <div key={s.slide_number} className="rounded-md border border-border/60 bg-background/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      Slide {s.slide_number.toString().padStart(2, "0")}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s.tone}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{s.script_text}</p>
                  {s.emphasis_markers?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.emphasis_markers.map((m: string, i: number) => (
                        <span
                          key={i}
                          className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            <p className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              ✓ 스크립트 검토 후 음성·영상 생성으로 진행하세요 (다음 단계).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-base font-semibold ${highlight ? "text-foreground" : "text-foreground/80"}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, active, muted }: { label: string; value: string; active?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground/60" : active ? "text-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
