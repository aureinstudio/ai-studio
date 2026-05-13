"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type ConvRow = {
  id: string;
  topic: string;
  studio_job_id: string;
  total_messages: number;
  rejected_count: number;
  cost_usd: number;
  language: string;
  last_active_at: string;
  created_at: string;
};

const LANG_LABEL: Record<string, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  vi: "Tiếng Việt",
  id: "Bahasa",
};

export default function TutorHistoryPage() {
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tutor/conversations?limit=50", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setConvs(data.conversations ?? []);
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
            내 학습 대화
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tutor 세션 — 총 <span className="font-mono tabular-nums text-foreground">{total}</span>건
          </p>
        </div>
        <Link
          href="/tutor"
          className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
        >
          + 새 질문
        </Link>
      </div>

      {/* 탭 */}
      <div className="mb-8 flex gap-2 border-b border-border/60">
        <Link href="/dashboard/history" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          📝 Studio
        </Link>
        <Link href="/dashboard/history/cast" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          🎬 Cast
        </Link>
        <Link href="/dashboard/history/tutor" className="border-b-2 border-foreground px-4 py-2 text-sm font-semibold">
          🤖 Tutor
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-12 text-center text-sm text-muted-foreground">
          불러오는 중…
        </div>
      ) : convs.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 Tutor 대화가 없습니다.{" "}
              <Link href="/tutor" className="font-medium text-foreground underline-offset-4 hover:underline">
                /tutor
              </Link>
              에서 첫 질문을 해보세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-card/60">
              <tr className="text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">최근 활성</th>
                <th className="px-4 py-3">과정</th>
                <th className="hidden px-4 py-3 sm:table-cell">언어</th>
                <th className="px-4 py-3 text-right">메시지</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">차단</th>
                <th className="hidden px-4 py-3 text-right md:table-cell">비용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {convs.map((c) => (
                <tr key={c.id} className="hover:bg-card/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(c.last_active_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-foreground">{c.topic}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {LANG_LABEL[c.language] ?? c.language}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {c.total_messages}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                    {c.rejected_count > 0 ? (
                      <span className="text-amber-300">{c.rejected_count}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted-foreground md:table-cell">
                    ${Number(c.cost_usd).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
