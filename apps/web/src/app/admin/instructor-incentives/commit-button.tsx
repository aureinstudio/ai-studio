"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommitButton({ period }: { period: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function commit() {
    if (!confirm(`${period} 인센티브를 확정 저장하시겠습니까?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/instructor-incentives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ ${json.saved}건 저장됨`);
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm">{msg}</span>}
      <button
        onClick={commit}
        disabled={loading}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "저장 중..." : "확정 저장"}
      </button>
    </div>
  );
}
