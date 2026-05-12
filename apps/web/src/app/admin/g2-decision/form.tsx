"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Decision = "GO" | "HOLD" | "NO-GO";

export default function DecisionForm({
  recommended,
  recommendedRationale,
  kpiSnapshot,
}: {
  recommended: Decision;
  recommendedRationale: string;
  kpiSnapshot: Record<string, unknown>;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>(recommended);
  const [rationale, setRationale] = useState(recommendedRationale);
  const [nextActions, setNextActions] = useState("");
  const [attendees, setAttendees] = useState("CEO, COO, 본부장, TF 리드");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rationale.trim().length < 20) {
      setErr("결정 사유는 20자 이상 입력해 주세요.");
      return;
    }
    if (!confirm(`G2 결정을 "${decision}"로 영구 기록합니다. 진행하시겠습니까?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/g2-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rationale,
          next_actions: nextActions || null,
          attendees: attendees.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
          kpi_snapshot: kpiSnapshot,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      setDone(true);
      setTimeout(() => router.refresh(), 1500);
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
        <h3 className="text-lg font-bold text-emerald-900">결정 기록 완료</h3>
        <p className="text-sm text-emerald-800 mt-2">decision_log에 영구 저장되었습니다. CEO·이사회에 알림 발송 완료.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-card border rounded-lg p-6 space-y-5">
      <h2 className="text-lg font-semibold">최종 결정 입력</h2>

      <div>
        <label className="block text-sm font-medium mb-2">결정 *</label>
        <div className="grid grid-cols-3 gap-2">
          {(["GO", "HOLD", "NO-GO"] as Decision[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              className={`py-3 rounded border text-sm font-bold ${
                decision === d
                  ? d === "GO" ? "bg-emerald-500 text-white border-emerald-500"
                    : d === "HOLD" ? "bg-amber-500 text-white border-amber-500"
                    : "bg-red-500 text-white border-red-500"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">참석자 (쉼표 구분)</label>
        <input
          type="text"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">결정 사유 * (최소 20자)</label>
        <textarea
          rows={5}
          maxLength={3000}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">{rationale.length} / 3000</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">다음 단계 액션</label>
        <textarea
          rows={4}
          maxLength={2000}
          value={nextActions}
          onChange={(e) => setNextActions(e.target.value)}
          placeholder="예: Phase 3 SCALE 킥오프 일정 확정, 4개 일반 과정 선정, 강사 추가 영입…"
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded bg-foreground text-background font-bold disabled:opacity-50"
      >
        {busy ? "기록 중…" : `${decision} 결정 영구 기록`}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
    </form>
  );
}
