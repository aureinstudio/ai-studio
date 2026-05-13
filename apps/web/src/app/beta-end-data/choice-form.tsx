"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { key: "convert_paid", label: "정식 서비스 전환 (50% 할인)", color: "border-emerald-300 hover:bg-emerald-50" },
  { key: "anonymize_only", label: "익명화만 유지 (학술 자료로 활용)", color: "border-blue-300 hover:bg-blue-50" },
  { key: "delete_all", label: "모든 데이터 완전 삭제", color: "border-red-300 hover:bg-red-50" },
] as const;

export default function ChoiceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(choice: string) {
    if (!confirm(`선택: ${OPTIONS.find((o) => o.key === choice)?.label}. 확정하시겠습니까?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/beta-end-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const json = await res.json();
      if (res.ok) router.refresh();
      else setErr(json.error ?? "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => submit(o.key)}
          disabled={busy}
          className={`block w-full rounded-lg border-2 ${o.color} p-4 text-left text-base font-semibold disabled:opacity-50`}
        >
          {o.label}
        </button>
      ))}
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
    </div>
  );
}
