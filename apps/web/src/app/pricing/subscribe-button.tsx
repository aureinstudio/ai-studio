"use client";

import { useState } from "react";

export default function SubscribeButton({ plan, label, highlight }: { plan: string; label: string; highlight: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
      } else {
        setErr(json.error ?? "결제 시작 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={start}
        disabled={busy}
        className={`w-full rounded-md py-3 text-sm font-medium disabled:opacity-50 ${
          highlight ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-foreground text-background hover:opacity-90"
        }`}
      >
        {busy ? "이동 중..." : label}
      </button>
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </>
  );
}
