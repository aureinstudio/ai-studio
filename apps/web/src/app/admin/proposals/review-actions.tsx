"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/proposals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: decision, feedback }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        placeholder="피드백 (선택, 반려 시 권장)"
        className="w-full rounded-md border bg-background p-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          승인 (보너스 지급 대상)
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={busy}
          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          반려
        </button>
      </div>
    </div>
  );
}
