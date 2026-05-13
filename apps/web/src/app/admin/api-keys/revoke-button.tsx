"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RevokeButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function revoke() {
    if (!confirm("이 키를 즉시 취소합니다. 진행하시겠습니까?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={revoke}
      disabled={loading}
      className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      {loading ? "..." : "취소"}
    </button>
  );
}
