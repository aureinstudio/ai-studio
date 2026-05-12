"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SelfCheckForm({ week }: { week: string }) {
  const router = useRouter();
  const [sat, setSat] = useState(0);
  const [tutorH, setTutorH] = useState(0);
  const [hardest, setHardest] = useState("");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sat === 0) {
      setErr("학습 만족도를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/self-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_iso: week,
          satisfaction: sat,
          tutor_helpful: tutorH || null,
          hardest_part: hardest || null,
          comments: comments || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "제출 실패");
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
      <Scale label="이번 주 학습 만족도 *" value={sat} onChange={setSat} />
      <Scale label="AI Tutor가 도움이 되었나요?" value={tutorH} onChange={setTutorH} />

      <div>
        <label className="block text-sm font-medium mb-1.5">어떤 부분이 가장 어려웠나요?</label>
        <textarea
          rows={3}
          maxLength={1000}
          value={hardest}
          onChange={(e) => setHardest(e.target.value)}
          placeholder="예: 칼 다루는 기본기 단원의 손목 각도 부분이 헷갈렸습니다…"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">기타 의견 (선택)</label>
        <textarea
          rows={3}
          maxLength={1000}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {busy ? "제출 중…" : "제출"}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
    </form>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded border text-sm font-semibold ${
              value === n ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>매우 부정</span><span>중립</span><span>매우 긍정</span>
      </div>
    </div>
  );
}
