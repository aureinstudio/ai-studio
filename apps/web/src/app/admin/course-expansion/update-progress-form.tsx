"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["planned", "content_migration", "sme_review", "beta", "live", "retired"] as const;

export default function UpdateProgressForm({ id, currentStatus, currentProgress }: { id: string; currentStatus: string; currentProgress: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [progress, setProgress] = useState(currentProgress);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/course-catalog/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, migration_progress_pct: progress }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline">수정</button>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border bg-background px-1 py-0.5 text-xs">
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-14 rounded border bg-background px-1 py-0.5 text-xs" />
      <button type="submit" disabled={busy} className="rounded bg-foreground px-2 py-0.5 text-xs text-background disabled:opacity-50">저장</button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">취소</button>
    </form>
  );
}
