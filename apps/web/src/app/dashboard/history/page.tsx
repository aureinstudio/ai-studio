"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type JobRow = {
  id: string;
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  length: string;
  status: "pending" | "running" | "completed" | "failed";
  cost_usd: number | null;
  duration_seconds: number | null;
  created_at: string;
};

type ListResponse = {
  jobs: JobRow[];
  total: number;
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const LEVEL_LABEL: Record<JobRow["level"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const STATUS_LABEL: Record<JobRow["status"], string> = {
  pending: "대기",
  running: "진행 중",
  completed: "완료",
  failed: "실패",
};

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 검색어 debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchJobs = useCallback(
    async (currentOffset: number, q: string, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (q) params.set("q", q);
        const res = await fetch(`/api/studio/jobs?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListResponse;
        setJobs((prev) => (append ? [...prev, ...data.jobs] : data.jobs));
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch {
        // 네트워크 오류는 무시 (재시도는 사용자 액션으로 트리거)
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 검색어 변경 시 offset 초기화 + 새로 fetch
  useEffect(() => {
    setOffset(0);
    fetchJobs(0, debouncedSearch, false);
  }, [debouncedSearch, fetchJobs]);

  async function handleDelete(id: string) {
    if (!confirm("이 작업을 삭제하시겠습니까? 복구 불가능합니다.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/studio/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchJobs(next, debouncedSearch, true);
  }

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            내 작업
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Studio 작업 — 총{" "}
            <span className="font-mono tabular-nums text-foreground">{total}</span>건
          </p>
        </div>

        <Link
          href="/studio"
          className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          + 새 작업
        </Link>
      </div>

      <div className="mb-6">
        <Input
          placeholder="주제로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && jobs.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-12 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 작업이 없습니다.{" "}
              <Link
                href="/studio"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                /studio
              </Link>
              에서 첫 콘텐츠를 만들어보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
            <table className="w-full text-sm">
              <thead className="border-b border-border/40 bg-card/60">
                <tr className="text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3">생성</th>
                  <th className="px-4 py-3">주제</th>
                  <th className="hidden px-4 py-3 sm:table-cell">수준</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">비용</th>
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
                    <td className="max-w-xs truncate px-4 py-3 text-foreground">
                      {j.topic}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {LEVEL_LABEL[j.level]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                          j.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : j.status === "failed"
                              ? "bg-red-500/10 text-red-300"
                              : "bg-foreground/10 text-foreground"
                        }`}
                      >
                        {STATUS_LABEL[j.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                      {j.cost_usd != null ? `$${j.cost_usd.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/history/${j.id}`)}
                          className="rounded-md border border-border bg-transparent px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
                        >
                          보기
                        </button>
                        <button
                          onClick={() => handleDelete(j.id)}
                          disabled={deletingId === j.id}
                          className="rounded-md border border-red-500/30 bg-transparent px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {deletingId === j.id ? "..." : "삭제"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
                className="border-border bg-transparent text-foreground hover:bg-card"
              >
                {loading ? "..." : "더 보기"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
