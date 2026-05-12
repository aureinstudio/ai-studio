"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = "continue_full" | "delete_all" | "anonymous_stats_only";

const OPTIONS: { value: Choice; emoji: string; title: string; body: string; warn?: string }[] = [
  {
    value: "continue_full",
    emoji: "🚀",
    title: "정식 서비스 전환",
    body: "계정·학습 이력·진도를 모두 유지하고 정식 서비스로 자동 전환됩니다. 50% 할인 쿠폰이 자동 발급됩니다.",
  },
  {
    value: "anonymous_stats_only",
    emoji: "📊",
    title: "익명 통계로만 유지",
    body: "개인 식별 정보는 모두 삭제하고, 익명 학습 패턴만 통계 분석용으로 30일 유지 후 영구 삭제합니다.",
  },
  {
    value: "delete_all",
    emoji: "🗑️",
    title: "데이터 완전 삭제",
    body: "계정과 모든 데이터를 영구 삭제합니다.",
    warn: "되돌릴 수 없습니다. 학습 이력·결제 기록 포함 30일 내 완전 삭제됩니다.",
  },
];

export default function BetaEndForm({ currentChoice }: { currentChoice: string | null }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(currentChoice as Choice | null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) {
      setErr("선택지를 골라주세요.");
      return;
    }
    if (choice === "delete_all") {
      if (!confirm("정말로 모든 데이터를 영구 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/beta-end-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, note: note || null }),
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
        <h3 className="text-lg font-bold text-emerald-900">선택이 저장되었습니다</h3>
        <p className="text-sm text-emerald-800 mt-2">베타 종료 후 30일 내 자동 처리됩니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={`block border rounded-lg p-5 cursor-pointer ${
            choice === o.value ? "border-foreground bg-muted/30" : "hover:bg-muted/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="choice"
              checked={choice === o.value}
              onChange={() => setChoice(o.value)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {o.emoji} {o.title}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{o.body}</p>
              {o.warn && (
                <p className="text-xs text-red-600 mt-2 font-medium">⚠ {o.warn}</p>
              )}
            </div>
          </div>
        </label>
      ))}

      <div className="pt-4">
        <label className="block text-sm font-medium mb-1.5">메모 (선택)</label>
        <textarea
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="피드백·요청 사항이 있으면 자유롭게 적어주세요"
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {busy ? "저장 중…" : "선택 저장"}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}

      <p className="text-xs text-muted-foreground text-center pt-2">
        선택은 언제든 본 페이지에서 변경 가능합니다.
      </p>
    </form>
  );
}
