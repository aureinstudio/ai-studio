"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WeeklyReportForm({
  week,
  instructorName,
}: {
  week: string;
  instructorName: string | null;
}) {
  const router = useRouter();
  const [used, setUsed] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [utility, setUtility] = useState(0);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (used === null) {
      setErr("AI 콘텐츠 활용 여부를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/instructor-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_iso: week,
          used_studio_content: used,
          content_count: used ? count : 0,
          utility_rating: utility || null,
          comments: comments || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 bg-card border rounded-lg p-6">
      {instructorName && <p className="text-sm text-muted-foreground">{instructorName} 강사님 주차 보고</p>}

      <div>
        <label className="block text-sm font-medium mb-3">
          이번 주 강의에 ai-studio AI 콘텐츠를 활용하셨나요? *
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUsed(true)}
            className={`flex-1 py-3 rounded border text-sm font-semibold ${
              used === true ? "bg-emerald-500 text-white border-emerald-500" : "bg-background hover:bg-muted"
            }`}
          >
            예, 활용했습니다
          </button>
          <button
            type="button"
            onClick={() => setUsed(false)}
            className={`flex-1 py-3 rounded border text-sm font-semibold ${
              used === false ? "bg-zinc-700 text-white border-zinc-700" : "bg-background hover:bg-muted"
            }`}
          >
            아니오
          </button>
        </div>
      </div>

      {used && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1.5">활용한 콘텐츠 수</label>
            <input
              type="number"
              min={0}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">유용성 평가 (1=별로 5=매우 유용)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUtility(n)}
                  className={`flex-1 py-3 rounded border text-sm font-semibold ${
                    utility === n ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">의견·개선 요청 (선택)</label>
        <textarea
          rows={4}
          maxLength={2000}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder={used
            ? "어떤 점이 도움되었나요? 어떤 점을 개선하면 더 자주 활용하시겠나요?"
            : "활용하지 않은 이유 + 어떤 기능이 있으면 활용하시겠나요?"}
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {busy ? "제출 중…" : "보고 제출"}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
    </form>
  );
}
