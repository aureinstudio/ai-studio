"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Gender = "male" | "female";
type AgeGroup = "20s" | "30s" | "40s" | "50s";
type AvatarSource = "preset" | "custom" | "upload" | "generate";

const AGE_LABELS: Record<AgeGroup, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
};

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
  video_url: string | null;
  captions_url: string | null;
};

const CAST_AGENTS = [
  { id: "cast-01", name: "슬라이드 분석", team: "T1" },
  { id: "cast-02", name: "스크립트 생성", team: "T1" },
  { id: "cast-03", name: "TTS 음성 생성", team: "T2" },
  { id: "cast-04", name: "아바타 영상 합성", team: "T2" },
  { id: "cast-05", name: "자막·챕터 생성", team: "T2" },
];

export function CastClient({ studioJobs }: { studioJobs: StudioJobOption[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CastJob | null>(null);
  // 아바타 선택
  const [gender, setGender] = useState<Gender>("female");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("30s");
  const [avatarSource, setAvatarSource] = useState<AvatarSource>("preset");
  const [customAvatarId, setCustomAvatarId] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const avatarSelection =
    avatarSource === "custom" && customAvatarId.trim()
      ? `custom:${customAvatarId.trim()}`
      : `${gender === "female" ? "f" : "m"}-${ageGroup}`;

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
          avatar_selection: avatarSelection,
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
        video_url: null,
        captions_url: null,
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

      {/* 아바타 선택 */}
      {selected && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              2 · 아바타 선택
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              정책: <span className="text-foreground">동양인 모델 고정</span> · 백인·흑인·라틴계 미허용
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 소스 토글 */}
            <div className="flex gap-2">
              {([
                { id: "preset", label: "프리셋", enabled: true },
                { id: "custom", label: "직접 ID 입력", enabled: true },
                { id: "upload", label: "사진 업로드", enabled: false },
                { id: "generate", label: "AI 생성", enabled: false },
              ] as { id: AvatarSource; label: string; enabled: boolean }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!opt.enabled || inProgress}
                  onClick={() => setAvatarSource(opt.id)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    avatarSource === opt.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-transparent text-foreground hover:bg-card"
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  {opt.label}
                  {!opt.enabled && (
                    <span className="ml-1 text-[9px] text-muted-foreground">(Phase 2)</span>
                  )}
                </button>
              ))}
            </div>

            {/* 프리셋 모드 — 성별 + 연령대 */}
            {avatarSource === "preset" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    성별
                  </label>
                  <div className="flex gap-2">
                    {(["female", "male"] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        disabled={inProgress}
                        onClick={() => setGender(g)}
                        className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                          gender === g
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-transparent text-foreground hover:bg-card"
                        } disabled:opacity-50`}
                      >
                        {g === "female" ? "여성" : "남성"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    연령대
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["20s", "30s", "40s", "50s"] as AgeGroup[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={inProgress}
                        onClick={() => setAgeGroup(a)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          ageGroup === a
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-transparent text-foreground hover:bg-card"
                        } disabled:opacity-50`}
                      >
                        {AGE_LABELS[a]}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  ⚠️ 베타: 프리셋 아바타 ID는 본부장이 HeyGen 대시보드에서 동양인 모델 확인 후
                  <code className="mx-1 rounded bg-foreground/10 px-1">avatar-presets.ts</code> 업데이트 필요.
                  현재는 임시 fallback (실제 동양인 아닐 수 있음).
                </p>
              </div>
            )}

            {/* 직접 입력 모드 */}
            {avatarSource === "custom" && (
              <div className="space-y-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  HeyGen Avatar ID
                </label>
                <Input
                  value={customAvatarId}
                  onChange={(e) => setCustomAvatarId(e.target.value)}
                  disabled={inProgress}
                  placeholder="예: Anna_public_3_20240108"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  HeyGen 대시보드 (
                  <a
                    href="https://app.heygen.com/avatars"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline"
                  >
                    app.heygen.com/avatars
                  </a>
                  ) 에서 *동양인 모델*만 선택 후 avatar_id 복사.
                </p>
              </div>
            )}

            {/* 업로드/생성 — Phase 2 안내 */}
            {(avatarSource === "upload" || avatarSource === "generate") && (
              <p className="rounded-md border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground">
                {avatarSource === "upload"
                  ? "사진 업로드로 Talking Photo 생성"
                  : "AI로 새 아바타 생성"}
                은 Phase 2에서 추가됩니다. 지금은 프리셋 또는 HeyGen Avatar ID 직접 입력을 사용해주세요.
              </p>
            )}

            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              현재 선택: {avatarSelection}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 비용 추정 */}
      {selected && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              3 · 비용 추정
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
              {CAST_AGENTS.map((agent, i) => {
                const log = job.agent_logs.find((l) => l.agent_id === agent.id);
                const done = log?.status === "completed";
                const failed = log?.status === "failed";
                const started = log?.status === "started";
                // 진행 메시지 (cast-03/04에서 사용) — error 필드를 임시 상태 표시용으로 활용
                const progressMsg = started ? log?.error : undefined;
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
                      <p className={`flex items-center gap-2 font-medium ${done || started ? "text-foreground" : "text-muted-foreground"}`}>
                        <span className="font-mono text-xs text-muted-foreground">#{agent.id}</span>
                        <span>{agent.name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
                          agent.team === "T1" ? "bg-blue-500/10 text-blue-400" : "bg-violet-500/10 text-violet-400"
                        }`}>
                          {agent.team}
                        </span>
                      </p>
                      {started && (
                        <p className="mt-1 font-mono text-xs text-foreground/70">
                          {progressMsg
                            ? `⏳ ${progressMsg}`
                            : agent.id === "cast-03"
                              ? `⏳ 슬라이드 ${log!.tokens_out}개 음성 생성 중…`
                              : `⏳ 생성 중… ${log!.tokens_out > 0 ? `~${log!.tokens_out.toLocaleString()} tokens` : "응답 대기"}`}
                        </p>
                      )}
                      {done && log?.duration_ms != null && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground/60">
                          {(log.duration_ms / 1000).toFixed(1)}s · ${log.cost_usd.toFixed(4)}
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

            {job.error_message && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {job.error_message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 결과: 영상 플레이어 + 다운로드 (TEAM 2 완료 시) */}
      {job?.status === "completed" && (job.video_url || job.captions_url || job.output?.tts) && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              생성 완료 — 영상·음성·자막
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              총 비용 ${job.cost_usd?.toFixed(2) ?? "-"} · 처리 시간 {job.duration_seconds ? `${(job.duration_seconds / 60).toFixed(1)}분` : "-"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.video_url && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  최종 영상
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={job.video_url}
                  controls
                  className="w-full rounded-md border border-border bg-black"
                  poster=""
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {job.captions_url && (
                <a
                  href={job.captions_url}
                  download
                  className="rounded-md border border-border bg-background/40 px-3 py-2 text-center text-xs text-foreground hover:bg-card"
                >
                  ⬇ SRT 자막
                </a>
              )}
              {job.output?.captions?.chapters_url && (
                <a
                  href={job.output.captions.chapters_url}
                  download
                  className="rounded-md border border-border bg-background/40 px-3 py-2 text-center text-xs text-foreground hover:bg-card"
                >
                  ⬇ 챕터 JSON
                </a>
              )}
              {job.output?.tts?.audio_files?.length > 0 && (
                <details className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-foreground">
                    🎵 슬라이드별 음성 ({job.output.tts.audio_files.length}개)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {job.output.tts.audio_files.map((af: any) => (
                      <li key={af.slide_number}>
                        <a
                          href={af.audio_url}
                          download
                          className="text-muted-foreground hover:text-foreground"
                        >
                          슬라이드 {String(af.slide_number).padStart(2, "0")} — mp3
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* 비용 분해 */}
            {job.output?.tts && (
              <div className="rounded-md border border-border/40 bg-background/30 p-3 font-mono text-xs">
                <p className="mb-1 text-muted-foreground">비용 분해</p>
                <Row label="LLM (cast)" value={`$${((job.cost_usd ?? 0) - (job.output.tts.total_cost_usd ?? 0) - (job.output.video?.cost_usd ?? 0)).toFixed(4)}`} active />
                <Row label="TTS (elevenlabs)" value={`$${job.output.tts.total_cost_usd?.toFixed(4) ?? "0"}`} active />
                <Row label="Video (heygen)" value={`$${job.output.video?.cost_usd?.toFixed(4) ?? "0"}`} active />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 스크립트 미리보기 */}
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
