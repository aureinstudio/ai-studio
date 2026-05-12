"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AtRiskActions({
  studentId,
  studentEmail,
  alertIds,
}: {
  studentId: string;
  studentEmail: string | null;
  alertIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(action: "encourage" | "instructor" | "session" | "ack") {
    setBusy(action);
    setErr(null);
    setDone(null);
    try {
      const r = await fetch("/api/admin/at-risk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, student_id: studentId, alert_ids: alertIds }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      setDone(action);
      if (action === "ack") router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 min-w-[180px]">
      <button
        disabled={!!busy || !studentEmail}
        onClick={() => call("encourage")}
        className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
        title={!studentEmail ? "이메일 없음" : ""}
      >
        {busy === "encourage" ? "발송 중…" : "📨 격려 메시지"}
      </button>
      <button
        disabled={!!busy}
        onClick={() => call("instructor")}
        className="px-3 py-1.5 text-xs rounded border hover:bg-muted disabled:opacity-50"
      >
        {busy === "instructor" ? "요청 중…" : "👨‍🏫 강사 연락 요청"}
      </button>
      <button
        disabled={!!busy || !studentEmail}
        onClick={() => call("session")}
        className="px-3 py-1.5 text-xs rounded border hover:bg-muted disabled:opacity-50"
      >
        {busy === "session" ? "발송 중…" : "📅 1:1 세션 제안"}
      </button>
      {alertIds.length > 0 && (
        <button
          disabled={!!busy}
          onClick={() => call("ack")}
          className="px-3 py-1.5 text-xs rounded text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy === "ack" ? "확인 중…" : "✓ 확인 처리"}
        </button>
      )}
      {done && <p className="text-xs text-emerald-600">✓ {done} 완료</p>}
      {err && <p className="text-xs text-red-600">⚠ {err}</p>}
    </div>
  );
}
