"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetroEntry({
  id, content, author, createdAt, isOwn,
}: {
  id: string;
  content: string;
  author: string | null;
  createdAt: string;
  isOwn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("삭제하시겠습니까?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/retrospective/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background/60 border rounded p-3 text-sm">
      <p className="leading-relaxed">{content}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{author ?? "익명"} · {new Date(createdAt).toLocaleDateString()}</span>
        {isOwn && (
          <button onClick={remove} disabled={busy} className="hover:text-red-600 disabled:opacity-50">
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
