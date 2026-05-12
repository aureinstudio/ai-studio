"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = "went_well" | "tough" | "do_differently";

const LABELS: Record<Category, string> = {
  went_well: "잘 된 것",
  tough: "어려웠던 것",
  do_differently: "다음에 다르게 할 것",
};

export default function RetroForm({ userName }: { userName: string | null }) {
  const router = useRouter();
  const [cat, setCat] = useState<Category>("went_well");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 5) {
      setErr("내용을 5자 이상 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/retrospective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, content }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.detail ?? j.error ?? "실패");
        return;
      }
      setContent("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border rounded-lg p-5 space-y-3">
      <div className="text-sm text-muted-foreground">
        {userName ? `${userName}님 ` : ""}회고 의견 추가
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`px-3 py-1.5 text-sm rounded ${
              cat === c ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {LABELS[c]}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={1000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="자유 서술 — 구체적인 사건·교훈일수록 좋습니다"
        className="w-full px-3 py-2 border rounded text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2 rounded bg-foreground text-background font-semibold text-sm disabled:opacity-50"
        >
          {busy ? "추가 중…" : "추가"}
        </button>
        {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
      </div>
    </form>
  );
}
