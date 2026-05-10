"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  topic: string;
  level: string;
};

export function HistoryDetailActions({ jobId, topic, level }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/dashboard/history/${jobId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 거부 시 prompt fallback
      window.prompt("아래 URL을 복사하세요:", url);
    }
  }

  function handleRegenerate() {
    // 입력값을 sessionStorage에 저장 → /studio가 읽어서 prefill (다음 v0.7.x에서 구현)
    // 일단 단순 라우팅
    const params = new URLSearchParams({ topic, level });
    router.push(`/studio?${params.toString()}`);
  }

  async function handleDelete() {
    if (!confirm("이 작업을 삭제하시겠습니까? 복구 불가능합니다.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/studio/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      router.push("/dashboard/history");
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleShare}
        className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
      >
        {copied ? "✓ 복사됨" : "공유 링크 복사"}
      </button>
      <button
        onClick={handleRegenerate}
        className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
      >
        다시 생성
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-md border border-red-500/30 bg-transparent px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
      >
        {deleting ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
