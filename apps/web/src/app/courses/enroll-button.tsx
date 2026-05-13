"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnrollButton({
  studioJobId,
  initialEnrolled,
}: {
  studioJobId: string;
  initialEnrolled: boolean;
}) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio_job_id: studioJobId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.message ?? j.error ?? "실패");
        return;
      }
      setEnrolled(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (enrolled) {
    return (
      <span className="px-3 py-1.5 text-xs rounded bg-emerald-100 text-emerald-700 font-semibold">
        ✓ 수강 중
      </span>
    );
  }
  return (
    <>
      <button
        onClick={enroll}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded bg-foreground text-background disabled:opacity-50 hover:opacity-90"
      >
        {busy ? "등록 중…" : "수강 신청"}
      </button>
      {err && <span className="text-xs text-red-600">⚠ {err}</span>}
    </>
  );
}
