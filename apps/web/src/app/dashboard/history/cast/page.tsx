"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type CastJobRow = {
  id: string;
  topic: string;
  studio_job_id: string | null;
  status: string;
  cost_usd: number | null;
  duration_seconds: number | null;
  video_url: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "대기", cls: "bg-foreground/10 text-foreground" },
  running: { label: "처리 중", cls: "bg-blue-500/10 text-blue-300" },
  rendering: { label: "HeyGen 렌더링", cls: "bg-amber-500/10 text-amber-300" },
  completed: { label: "완료", cls: "bg-emerald-500/10 text-emerald-300" },
  failed: { label: "실패", cls: "bg-red-500/10 text-red-300" },
};

export default function CastHistoryPage() {
  const [jobs, setJobs] = useState<CastJobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cast/jobs?limit=50", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setJobs(data.jobs ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            내 영상
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cast 영상 — 총 <span className="font-mono tabular-nums text-foreground">{total}</span>건
          </p>
        </div>
        <Link
          href="/cast"
          className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          + 새 영상
        </Link>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-8 flex gap-2 border-b border-border/60">
        <Link href="/dashboard/history" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          📝 Studio
        </Link>
        <Link href="/dashboard/history/cast" className="border-b-2 border-foreground px-4 py-2 text-sm font-semibold">
          🎬 Cast
        </Link>
        <Link href="/dashboard/history/tutor" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          🤖 Tutor
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-12 text-center text-sm text-muted-foreground">
          불러오는 중…
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 생성한 Cast 영상이 없습니다.{" "}
              <Link href="/cast" className="font-medium text-foreground underline-offset-4 hover:underline">
                /cast
              </Link>
              에서 첫 영상을 만들어보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-card/60">
              <tr className="text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">생성</th>
                <th className="px-4 py-3">주제</th>
                <th className="px-4 py-3">상태</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">길이</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">비용</th>
                <th className="px-4 py-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {jobs.map((j) => {
                const meta = STATUS_LABEL[j.status] ?? { label: j.status, cls: "bg-muted text-muted-foreground" };
                return (
                  <tr key={j.id} className="hover:bg-card/60">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(j.created_at).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-foreground">{j.topic}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                      {j.duration_seconds
                        ? `${Math.floor(j.duration_seconds / 60)}분 ${Math.round(j.duration_seconds % 60)}초`
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                      {j.cost_usd != null ? `$${Number(j.cost_usd).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.video_url ? (
                        <a
                          href={j.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-border bg-transparent px-3 py-1 text-xs font-medium text-foreground hover:bg-card"
                        >
                          영상 보기 →
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
