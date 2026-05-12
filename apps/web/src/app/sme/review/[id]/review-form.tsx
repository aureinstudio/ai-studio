"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  accuracy: number;
  suitability: number;
  exam: number;
  improvements: string;
} | null;

export default function ReviewForm({ studioJobId, initial }: { studioJobId: string; initial: Initial }) {
  const router = useRouter();
  const [acc, setAcc] = useState(initial?.accuracy ?? 0);
  const [suit, setSuit] = useState(initial?.suitability ?? 0);
  const [exam, setExam] = useState(initial?.exam ?? 0);
  const [improvements, setImprovements] = useState(initial?.improvements ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const avg = [acc, suit, exam].every((n) => n >= 1)
    ? ((acc + suit + exam) / 3).toFixed(1)
    : "—";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (acc === 0 || suit === 0 || exam === 0) {
      setErr("3가지 점수를 모두 매겨주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/sme/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_job_id: studioJobId,
          accuracy_score: acc,
          suitability_score: suit,
          exam_alignment_score: exam,
          improvements: improvements || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/sme/dashboard"), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="text-lg font-bold text-emerald-900">검토 제출 완료</h3>
        <p className="text-sm text-emerald-800 mt-2">평균 {avg}/5 · 대시보드로 이동합니다…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-card border rounded-lg p-6 space-y-6">
      <h2 className="text-lg font-semibold">3축 평가</h2>

      <ScoreInput label="정확성" value={acc} onChange={setAcc} hint="사실 오류·왜곡 없는가" />
      <ScoreInput label="학습자 적합성" value={suit} onChange={setSuit} hint="대상 수준·표현 적절한가" />
      <ScoreInput label="시험 출제 부합도" value={exam} onChange={setExam} hint="자격증 출제 범위·난이도 부합" />

      <div className="text-center py-3 bg-muted rounded">
        <div className="text-xs text-muted-foreground">평균</div>
        <div className="text-3xl font-bold">{avg} <span className="text-lg text-muted-foreground">/ 5</span></div>
        <div className="text-xs mt-1">{Number(avg) >= 4 ? "✓ 합격선" : Number(avg) > 0 ? "⚠ 합격선 미달 (자동 보완 트리거)" : ""}</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">개선 의견 (선택)</label>
        <textarea
          rows={4}
          maxLength={2000}
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          placeholder="구체적인 보완점을 알려주세요. 예: 슬라이드 3 출처 추가 필요, 슬라이드 7 용어 정정…"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {busy ? "제출 중…" : initial ? "검토 갱신" : "검토 제출"}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
    </form>
  );
}

function ScoreInput({
  label, value, onChange, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; hint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded border text-sm font-semibold ${
              value === n
                ? n >= 4 ? "bg-emerald-500 text-white border-emerald-500"
                  : n >= 3 ? "bg-amber-500 text-white border-amber-500"
                  : "bg-red-500 text-white border-red-500"
                : "bg-background hover:bg-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
