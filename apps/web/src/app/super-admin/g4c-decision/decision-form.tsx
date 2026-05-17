"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "go", label: "GO — 정식 출범", desc: "차년도 사업 계획 승인 · 25명 채용 · 분사 검토 · 베트남 진입" },
  { value: "hold", label: "HOLD — 1분기 보강", desc: "약점 영역 집중 보강 후 재평가" },
  { value: "pivot_b2c", label: "PIVOT — B2C 집중", desc: "B2C 학생 모집에 집중. B2B 영역 보류" },
  { value: "pivot_b2b", label: "PIVOT — B2B 집중", desc: "B2B SaaS에 집중. B2C 영역 축소" },
  { value: "stop", label: "STOP — Phase 5 보류", desc: "본부로 환원 · 손익 정리" },
] as const;

export default function DecisionForm() {
  const router = useRouter();
  const [decision, setDecision] = useState<typeof OPTIONS[number]["value"]>("go");
  const [rationale, setRationale] = useState("");
  const [actions, setActions] = useState("");
  const [boardDate, setBoardDate] = useState("");
  const [spinoff, setSpinoff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rationale.trim()) return;
    if (!confirm(`G4-C 결정: ${decision}. 확정?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/super-admin/g4c-decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, rationale, next_actions: actions, board_meeting_date: boardDate || null, spinoff_consideration: spinoff }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 저장 완료");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <label className="mb-2 block text-sm font-medium">결정</label>
        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <label key={opt.value} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${decision === opt.value ? "border-foreground bg-muted/50" : "hover:bg-muted/20"}`}>
              <input type="radio" name="decision" value={opt.value} checked={decision === opt.value} onChange={() => setDecision(opt.value)} className="mt-1" />
              <div>
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">결정 사유 *</span>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={4} required
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="이사회 논의 핵심 · 통과/미달 KPI · 핵심 인수인계 사항" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">다음 액션 플랜</span>
        <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={6}
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder={`GO 시: 출범식 일정 / 채용 개시 / 베트남 진입 일정\nHOLD 시: 보강 항목 / 재평가 시점`} />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">이사회 일자</span>
          <input type="date" value={boardDate} onChange={(e) => setBoardDate(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spinoff} onChange={(e) => setSpinoff(e.target.checked)} />
          분사 검토 (GO 시)
        </label>
      </div>

      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy || !rationale.trim()} className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "저장 중..." : "결정 기록"}
        </button>
      </div>
    </form>
  );
}
