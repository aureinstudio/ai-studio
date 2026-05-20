"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type Job = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  created_at: string;
  studio_job_id: string | null;
  cast_job_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨",
  extracting: "추출 중",
  enhancing: "AI 보강 중",
  synthesizing_video: "영상 합성 중",
  completed: "완료",
  failed: "실패",
};

const STATUS_CLASS: Record<string, string> = {
  uploaded: "bg-foreground/10 text-foreground",
  extracting: "bg-blue-500/10 text-blue-300",
  enhancing: "bg-purple-500/10 text-purple-300",
  synthesizing_video: "bg-amber-500/10 text-amber-300",
  completed: "bg-emerald-500/10 text-emerald-300",
  failed: "bg-red-500/10 text-red-300",
};

export default function StudioProHistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/studio-pro/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { jobs: Job[] };
      setJobs(data.jobs);
    } catch {
      // 무시 — 빈 목록 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(id: string) {
    if (!confirm("이 Studio Pro 작업을 삭제하시겠습니까? 복구 불가능합니다.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/studio-pro/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Studio Pro 작업
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            강사 자료 → AI 보강 → 영상 합성 — 총{" "}
            <span className="font-mono tabular-nums text-foreground">{jobs.length}</span>건
          </p>
        </div>
        <Link
          href="/studio-pro"
          className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          + 새 작업
        </Link>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-12 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 Studio Pro 작업이 없습니다.{" "}
              <Link
                href="/studio-pro"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                /studio-pro
              </Link>
              에서 강의 자료를 업로드하세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-card/60">
              <tr className="text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">생성</th>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">상태</th>
                <th className="hidden px-4 py-3 md:table-cell">결과</th>
                <th className="px-4 py-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-card/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(j.created_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-foreground">
                    <div className="truncate">{j.title}</div>
                    {j.error && (
                      <div className="mt-1 truncate text-xs text-red-300">{j.error}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${STATUS_CLASS[j.status] ?? STATUS_CLASS.uploaded}`}
                    >
                      {STATUS_LABEL[j.status] ?? j.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs md:table-cell">
                    <div className="flex flex-col gap-1">
                      {j.studio_job_id && (
                        <Link
                          href={`/dashboard/history/${j.studio_job_id}`}
                          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Studio 결과 →
                        </Link>
                      )}
                      {j.cast_job_id && (
                        <Link
                          href="/dashboard/history/cast"
                          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Cast 영상 →
                        </Link>
                      )}
                      {!j.studio_job_id && !j.cast_job_id && (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(j.id)}
                      disabled={deletingId === j.id}
                      className="rounded-md border border-red-500/30 bg-transparent px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === j.id ? "..." : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
