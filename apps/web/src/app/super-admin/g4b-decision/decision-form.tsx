"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GateSummary = { name: string; current: number; target: number; pass: boolean };

export default function DecisionForm({ overallStatus, gates }: { overallStatus: string; gates: GateSummary[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState(
    overallStatus === "pass" ? "pass_to_phase4c" : overallStatus === "partial" ? "reinforce_2w" : "fail"
  );
  const [rationale, setRationale] = useState("");
  const [actions, setActions] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rationale.trim()) return;
    if (!confirm(`${decision} 으로 기록합니다. 확정?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/super-admin/g4b-decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, rationale, next_actions: actions, gates }),
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">결정</label>
        <div className="flex flex-wrap gap-2">
          {(["pass_to_phase4c", "reinforce_2w", "fail"] as const).map((opt) => (
            <button key={opt} type="button" onClick={() => setDecision(opt)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${decision === opt ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}>
              {opt === "pass_to_phase4c" ? "Phase 4C 진입 (PASS)" : opt === "reinforce_2w" ? "2주 보강" : "실패 (재검토)"}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">결정 사유 *</span>
        <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={4} required
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder="자동 평가 결과 + 정성적 판단 근거" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">다음 액션 플랜</span>
        <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={5}
          className="w-full rounded-md border bg-background p-3 text-sm"
          placeholder={`PASS: Phase 4C 사업부 분리 일정·인력 채용 JD 확정...\n부분: 2주간 보강 항목 (미달 KPI별)\n실패: 근본 원인 분석 + 재계획`} />
      </label>

      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy || !rationale.trim()}
          className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "저장 중..." : "결정 기록"}
        </button>
      </div>
    </form>
  );
}
