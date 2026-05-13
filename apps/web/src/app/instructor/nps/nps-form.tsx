"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  efficiency_score: number | null;
  value_elevation_score: number | null;
  recommend_score: number | null;
  comments: string | null;
} | null;

const QUESTIONS = [
  { key: "efficiency_score" as const, label: "ai-studio로 강의 효율이 좋아졌나요?" },
  { key: "value_elevation_score" as const, label: "ai-studio가 본인 가치를 격상시켰나요?" },
  { key: "recommend_score" as const, label: "이 도구를 동료 강사에게 추천하시겠어요?" },
];

export default function NpsForm({ period, initial }: { period: string; initial: Initial }) {
  const router = useRouter();
  const [efficiency, setEfficiency] = useState(initial?.efficiency_score ?? 5);
  const [value, setValue] = useState(initial?.value_elevation_score ?? 5);
  const [recommend, setRecommend] = useState(initial?.recommend_score ?? 5);
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/instructor/nps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          period,
          efficiency_score: efficiency,
          value_elevation_score: value,
          recommend_score: recommend,
          comments,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 제출 완료");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error ?? "실패"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const values = { efficiency_score: efficiency, value_elevation_score: value, recommend_score: recommend };
  const setters = { efficiency_score: setEfficiency, value_elevation_score: setValue, recommend_score: setRecommend };

  return (
    <form onSubmit={submit} className="space-y-6 rounded-lg border bg-card p-6">
      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <div className="mb-2 font-medium">{q.label}</div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setters[q.key](i)}
                className={`h-10 w-10 rounded-md border text-sm font-medium ${
                  values[q.key] === i ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>전혀 아님 (0)</span>
            <span>매우 그러함 (10)</span>
          </div>
        </div>
      ))}

      <div>
        <div className="mb-2 font-medium">의견 / 개선 제안 (선택)</div>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="구체적인 개선 제안이나 느낀 점을 자유롭게 작성해주세요."
        />
      </div>

      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy} className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "제출 중..." : initial ? "업데이트" : "제출"}
        </button>
      </div>
    </form>
  );
}
