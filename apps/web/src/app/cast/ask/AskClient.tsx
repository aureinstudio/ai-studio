"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function getInitialQuestion(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("q")?.slice(0, 500) ?? "";
}

type AvatarOption = {
  id: string;
  label: string;
  gender: "male" | "female" | null;
  source_image_url: string | null;
};

type CastJob = {
  id: string;
  status: "pending" | "running" | "rendering" | "completed" | "failed";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent_logs: any[];
  cost_usd: number | null;
  video_url: string | null;
  error_message: string | null;
};

export function AskClient({ avatars }: { avatars: AvatarOption[] }) {
  const [question, setQuestion] = useState("");
  const [courseContext, setCourseContext] = useState("");
  // URL ?q= 으로 들어온 경우 (Tutor → Cast Mode B 핸드오프)
  const [generateVideo, setGenerateVideo] = useState(false);

  // mount 후 ?q= 반영 (SSR hydration 안전)
  useEffect(() => {
    const initial = getInitialQuestion();
    if (initial) {
      setQuestion(initial);
      setGenerateVideo(true); // Tutor 핸드오프는 영상이 목적
    }
  }, []);

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(
    avatars[0]?.id ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CastJob | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inProgress =
    job !== null && job.status !== "completed" && job.status !== "failed";

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
    }, 2000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [job]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (generateVideo && !selectedAvatarId) {
      setError("영상 생성 시 아바타가 필요합니다. /cast 페이지에서 먼저 생성하세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setJob(null);
    try {
      const res = await fetch("/api/cast/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          course_context: courseContext.trim() || undefined,
          generate_video: generateVideo,
          avatar_selection: generateVideo && selectedAvatarId ? `user:${selectedAvatarId}` : undefined,
          max_duration_seconds: 120,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
      }
      setJob({
        id: data.cast_job_id,
        status: "pending",
        output: null,
        agent_logs: [],
        cost_usd: null,
        video_url: null,
        error_message: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (avatars.length === 0) {
    return (
      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          아바타가 없습니다.{" "}
          <a href="/cast" className="text-foreground underline">
            /cast
          </a>{" "}
          → AI 생성 탭에서 강사 avatar를 먼저 만들어주세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 입력 폼 */}
      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="question"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                학생 질문 (필수)
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={submitting || inProgress}
                rows={3}
                maxLength={500}
                placeholder="예: 한식 양념 5가지가 뭐예요?"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-50"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {question.length}/500자
              </p>
            </div>

            <div>
              <label
                htmlFor="context"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                과정 컨텍스트 (선택)
              </label>
              <input
                id="context"
                type="text"
                value={courseContext}
                onChange={(e) => setCourseContext(e.target.value)}
                disabled={submitting || inProgress}
                maxLength={300}
                placeholder="예: 조리기능사 자격증 - 한식 기초"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* 영상 생성 토글 */}
            <div>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  generateVideo
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-background/40 hover:bg-card"
                } ${inProgress ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={generateVideo}
                  onChange={(e) => setGenerateVideo(e.target.checked)}
                  disabled={inProgress}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    영상으로 받기{" "}
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                      generateVideo ? "bg-amber-500/20 text-amber-300" : "bg-muted-foreground/10 text-muted-foreground"
                    }`}>
                      선택 · 추가 비용
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    체크 해제: <span className="text-foreground">텍스트 답변만 (~$0.01, 10초)</span> · 체크: <span className="text-amber-300">영상 추가 (+$0.50~1.00, +3~5분)</span>
                  </p>
                </div>
              </label>
            </div>

            {/* 아바타 선택 — generate_video=true 일 때만 */}
            {generateVideo && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  강사 아바타 ({avatars.length}개)
                </label>
                <div className="space-y-2">
                  {avatars.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                        selectedAvatarId === a.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border bg-transparent hover:bg-card"
                      } ${inProgress ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="avatar"
                        checked={selectedAvatarId === a.id}
                        onChange={() => setSelectedAvatarId(a.id)}
                        disabled={inProgress}
                        className="h-4 w-4 accent-foreground"
                      />
                      {a.source_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.source_image_url}
                          alt={a.label}
                          className="h-10 w-10 rounded-md border border-border object-cover"
                        />
                      )}
                      <span className="flex-1 text-sm text-foreground">
                        {a.label}
                        {a.gender && (
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            {a.gender === "female" ? "여성" : "남성"}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={
                submitting ||
                inProgress ||
                !question.trim() ||
                (generateVideo && !selectedAvatarId)
              }
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {submitting
                ? "전송 중..."
                : inProgress
                  ? "응답 생성 중..."
                  : generateVideo
                    ? "텍스트 + 영상 받기 (~$0.50, 3~5분)"
                    : "텍스트 답변 받기 (~$0.01, ~10초)"}
            </Button>

            <p className="text-[10px] text-muted-foreground">
              {generateVideo
                ? "Mode B 영상 한도: 일일 5회. 텍스트는 무제한."
                : "텍스트 답변은 매우 저렴하고 빠릅니다."}
            </p>
          </form>
        </CardContent>
      </Card>

      {/* 진행 상태 */}
      {job && (
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                진행 상태
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  job.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : job.status === "failed"
                      ? "bg-red-500/10 text-red-300"
                      : job.status === "rendering"
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-foreground/10 text-foreground"
                }`}
              >
                {job.status === "pending" && "✓ 접수됨"}
                {job.status === "running" && "⏳ 답변 생성 중"}
                {job.status === "rendering" && "🎬 영상 렌더링 중 (~3분)"}
                {job.status === "completed" && "✅ 완료"}
                {job.status === "failed" && "❌ 실패"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.output?.answer_text && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  답변 (스크립트)
                </p>
                <p className="rounded-md border border-border/40 bg-background/40 p-3 text-sm leading-relaxed text-foreground/90">
                  {job.output.answer_text}
                </p>
              </div>
            )}

            {job.error_message && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {job.error_message}
              </p>
            )}

            {job.status === "completed" && job.video_url && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  영상 답변
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={job.video_url}
                  controls
                  className="w-full rounded-md border border-border bg-black"
                />
                <a
                  href={job.video_url}
                  download
                  className="mt-2 inline-block text-xs text-foreground underline"
                >
                  ⬇ MP4 다운로드
                </a>
              </div>
            )}

            {job.cost_usd !== null && (
              <p className="font-mono text-xs text-muted-foreground">
                비용: ${job.cost_usd.toFixed(4)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
