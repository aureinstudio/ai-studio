"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "regenerating" | "regenerated" | "dismissed";

export default function RemediationActions({
  queueId,
  status,
  studioJobId,
}: {
  queueId: string;
  status: Status;
  studioJobId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(action: "dismiss" | "ack") {
    setBusy(action);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/remediation/${queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (status !== "pending") {
    return (
      <div className="text-xs text-muted-foreground min-w-[140px] text-right">
        {status === "regenerated" ? "완료" : status === "regenerating" ? "처리 중" : "보류됨"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-w-[160px]">
      <a
        href={`/studio?supplement_for=${studioJobId}`}
        className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 text-center"
      >
        🔄 Studio에서 재생성
      </a>
      <button
        disabled={!!busy}
        onClick={() => call("dismiss")}
        className="px-3 py-1.5 text-xs rounded border hover:bg-muted disabled:opacity-50"
      >
        {busy === "dismiss" ? "보류 중…" : "보류"}
      </button>
      {err && <p className="text-xs text-red-600">⚠ {err}</p>}
    </div>
  );
}
