"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NpsForm({ segment }: { segment: string }) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score === null) {
      setErr("점수를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, reason: reason || null, segment }),
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
      <div>
        <label className="block text-sm font-medium mb-3">
          0~10 사이로 답해주세요 (0 = 절대 안 함, 10 = 적극 추천) *
        </label>
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`py-3 rounded border text-sm font-semibold ${
                score === n
                  ? n <= 6 ? "bg-red-500 text-white border-red-500"
                    : n <= 8 ? "bg-amber-500 text-white border-amber-500"
                    : "bg-emerald-500 text-white border-emerald-500"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>비추천</span><span>중립</span><span>적극 추천</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">왜 그 점수를 주셨나요? (선택)</label>
        <textarea
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="어떤 점이 좋았고, 어떤 점이 아쉬웠나요?"
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
